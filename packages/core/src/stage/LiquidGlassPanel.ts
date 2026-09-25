import * as THREE from 'three/webgpu';
import {
	abs,
	acesFilmicToneMapping,
	cameraProjectionMatrix,
	cameraViewMatrix,
	clamp,
	color,
	float,
	inverse,
	length,
	mat3,
	max as tslMax,
	min as tslMin,
	mix,
	modelWorldMatrix,
	oneMinus,
	positionLocal,
	sqrt,
	sRGBTransferEOTF,
	sRGBTransferOETF,
	smoothstep,
	step,
	texture,
	uniform,
	varying,
	vec2,
	vec4
} from 'three/tsl';
import type { ColorRepresentation } from 'three';
import type { Node } from 'three/webgpu';
import { PANEL_SHADOW_RECIPE, resolvePanelShadowStrength } from './panelShadow.js';

/** A CSS Gaussian shadow reaches roughly half its declared alpha at an unspread edge. */
const WEBGPU_SHADOW_EDGE_COMPENSATION = 0.5;
const WEBGPU_SHADOW_EXTENT_PER_BLUR = 1.5;

export interface LiquidGlassPanelOptions {
	width?: number;
	height?: number;
	radius?: number;
	position?: { x: number; y: number };
	/** Blur radius of the sampled stage backdrop, in CSS pixels. */
	backdropBlur?: number;
	/** Maximum displacement of the sampled backdrop near the glass edge, in CSS pixels. */
	refraction?: number;
	tint?: ColorRepresentation;
	/** Direct opacity of the tint over the sampled backdrop, from zero to one. */
	tintOpacity?: number;
	/** Width of the refractive/specular edge, in CSS pixels. */
	bezel?: number;
	/** Optical edge weight, from zero (flat) to one (thick glass). */
	thickness?: number;
	specularOpacity?: number;
	/** Normalized strength of the panel shadow, from zero to one. */
	shadowIntensity?: number;
	opacity?: number;
}

const DEFAULT_OPTIONS = {
	width: 360,
	height: 230,
	radius: 42,
	position: { x: 0, y: 42 },
	backdropBlur: 5,
	refraction: 12,
	tint: 0xffffff,
	tintOpacity: 0.28,
	bezel: 18,
	thickness: 0.35,
	specularOpacity: 0.18,
	shadowIntensity: 0.28,
	opacity: 1
} satisfies Required<LiquidGlassPanelOptions>;

/** Exposure shared by the stage renderer and CSS-color compensation for panel tints. */
export const STAGE_TONE_MAPPING_EXPOSURE = 1.15;

/** Applies stable defaults and keeps public visual controls inside their documented ranges. */
export function resolveLiquidGlassPanelOptions(
	options: LiquidGlassPanelOptions = {}
): Required<LiquidGlassPanelOptions> {
	const merged = {
		...DEFAULT_OPTIONS,
		...options,
		position: { ...DEFAULT_OPTIONS.position, ...options.position }
	};
	const width = clampFinite(merged.width, 1, Number.MAX_SAFE_INTEGER, DEFAULT_OPTIONS.width);
	const height = clampFinite(merged.height, 1, Number.MAX_SAFE_INTEGER, DEFAULT_OPTIONS.height);

	return {
		...merged,
		width,
		height,
		radius: clampFinite(merged.radius, 0, Math.min(width, height) * 0.5, DEFAULT_OPTIONS.radius),
		position: {
			x: finiteOr(merged.position.x, DEFAULT_OPTIONS.position.x),
			y: finiteOr(merged.position.y, DEFAULT_OPTIONS.position.y)
		},
		backdropBlur: clampFinite(merged.backdropBlur, 0, 100, DEFAULT_OPTIONS.backdropBlur),
		refraction: clampFinite(merged.refraction, 0, 100, DEFAULT_OPTIONS.refraction),
		tintOpacity: clampFinite(merged.tintOpacity, 0, 1, DEFAULT_OPTIONS.tintOpacity),
		bezel: clampFinite(merged.bezel, 0, Math.min(width, height) * 0.5, DEFAULT_OPTIONS.bezel),
		thickness: clampFinite(merged.thickness, 0, 1, DEFAULT_OPTIONS.thickness),
		specularOpacity: clampFinite(merged.specularOpacity, 0, 1, DEFAULT_OPTIONS.specularOpacity),
		shadowIntensity: clampFinite(merged.shadowIntensity, 0, 1, DEFAULT_OPTIONS.shadowIntensity),
		opacity: clampFinite(merged.opacity, 0, 1, DEFAULT_OPTIONS.opacity)
	};
}

function finiteOr(value: number, fallback: number) {
	return Number.isFinite(value) ? value : fallback;
}

function clampFinite(value: number, min: number, max: number, fallback: number) {
	return THREE.MathUtils.clamp(finiteOr(value, fallback), min, max);
}

export class LiquidGlassPanel {
	readonly group = new THREE.Group();
	readonly options: Required<LiquidGlassPanelOptions>;

	private readonly geometryOptions: Required<LiquidGlassPanelOptions>;
	private readonly backdropGeometry: THREE.BufferGeometry;
	private readonly bezelGeometry: THREE.BufferGeometry;
	private readonly shadowLayers: {
		geometry: THREE.BufferGeometry;
		material: THREE.MeshBasicMaterial;
		mesh: THREE.Mesh;
		alphaScale: number;
	}[];
	private readonly backdropMaterial: THREE.MeshBasicNodeMaterial;
	private readonly backdropTextureNode: ReturnType<typeof texture>;
	private readonly depthMaterial: THREE.MeshBasicMaterial;
	private readonly sheenMaterial: THREE.MeshBasicMaterial;
	private readonly backdropProjection: ReturnType<typeof createBackdropProjectionUniforms>;

	constructor(backdropTexture: THREE.Texture, options: LiquidGlassPanelOptions = {}) {
		this.options = resolveLiquidGlassPanelOptions(options);
		this.geometryOptions = {
			...this.options,
			position: { ...this.options.position }
		};
		this.backdropProjection = createBackdropProjectionUniforms(this.options);

		this.group.position.set(this.options.position.x, this.options.position.y, 0);
		this.backdropGeometry = createRoundedGridGeometry(
			this.geometryOptions.width,
			this.geometryOptions.height,
			this.geometryOptions.radius,
			128,
			82
		);
		this.bezelGeometry = createRoundedBandGeometry(
			this.geometryOptions.width,
			this.geometryOptions.height,
			this.geometryOptions.radius,
			-this.geometryOptions.bezel,
			14,
			1.7
		);
		this.shadowLayers = PANEL_SHADOW_RECIPE.map((layer, index) => {
			const shadowStrength = resolvePanelShadowStrength(this.options.shadowIntensity);
			const geometry = createRoundedBandGeometry(
				this.geometryOptions.width,
				this.geometryOptions.height,
				this.geometryOptions.radius,
				layer.blur * WEBGPU_SHADOW_EXTENT_PER_BLUR,
				Math.max(8, Math.round(layer.blur)),
				2.1
			);
			const material = createVertexAlphaMaterial(
				0x000000,
				shadowStrength * layer.alphaScale * WEBGPU_SHADOW_EDGE_COMPENSATION
			);
			const mesh = new THREE.Mesh(geometry, material);
			mesh.position.set(0, -layer.offsetY, 0);
			mesh.renderOrder = PANEL_SHADOW_RECIPE.length - index;
			return { geometry, material, mesh, alphaScale: layer.alphaScale };
		});
		this.depthMaterial = createVertexAlphaMaterial(
			getDepthColor(this.options.tint),
			getDepthOpacity(this.options.thickness)
		);
		this.sheenMaterial = createVertexAlphaMaterial(
			getSpecularColor(this.options.tint, this.options.tintOpacity),
			this.options.specularOpacity,
			THREE.AdditiveBlending
		);
		const backdropShader = createBackdropMaterial(
			backdropTexture,
			this.options.tint,
			this.options.tintOpacity,
			this.backdropProjection
		);
		this.backdropMaterial = backdropShader.material;
		this.backdropTextureNode = backdropShader.textureNode;

		const backdrop = new THREE.Mesh(this.backdropGeometry, this.backdropMaterial);
		backdrop.position.z = 0;
		backdrop.renderOrder = 3;

		const depthTint = new THREE.Mesh(this.bezelGeometry, this.depthMaterial);
		depthTint.position.z = 0;
		depthTint.renderOrder = 4;

		const sheen = new THREE.Mesh(this.bezelGeometry, this.sheenMaterial);
		sheen.position.z = 0;
		sheen.renderOrder = 6;

		this.group.add(...this.shadowLayers.map(({ mesh }) => mesh), backdrop, depthTint, sheen);
		this.setVisibilityAlpha(1);
	}

	setVisibilityAlpha(alpha: number) {
		const scale = THREE.MathUtils.clamp(alpha * this.options.opacity, 0, 1);
		this.group.visible = scale > 0.01;
		this.backdropMaterial.opacity = scale;
		this.depthMaterial.opacity = getDepthOpacity(this.options.thickness) * scale;
		this.sheenMaterial.opacity = this.options.specularOpacity * scale;
		this.shadowLayers.forEach(({ material, alphaScale }) => {
			material.opacity =
				resolvePanelShadowStrength(this.options.shadowIntensity) *
				alphaScale *
				WEBGPU_SHADOW_EDGE_COMPENSATION *
				scale;
		});
	}

	setBackdropTexture(backdropTexture: THREE.Texture) {
		if (this.backdropTextureNode.value === backdropTexture) return;
		this.backdropTextureNode.value = backdropTexture;
	}

	setVisualSize(width: number, height: number, radius = this.options.radius) {
		const nextWidth = Math.max(width, 1);
		const nextHeight = Math.max(height, 1);
		const nextRadius = Math.min(Math.max(radius, 0), nextWidth * 0.5, nextHeight * 0.5);

		if (
			Math.abs(this.geometryOptions.width - nextWidth) < 0.01 &&
			Math.abs(this.geometryOptions.height - nextHeight) < 0.01 &&
			Math.abs(this.geometryOptions.radius - nextRadius) < 0.01
		) {
			return;
		}

		this.geometryOptions.width = nextWidth;
		this.geometryOptions.height = nextHeight;
		this.geometryOptions.radius = nextRadius;
		this.backdropProjection.panelSize.value.set(nextWidth, nextHeight);
		this.backdropProjection.radius.value = nextRadius;
		createRoundedGridGeometry(nextWidth, nextHeight, nextRadius, 128, 82, this.backdropGeometry);
		copyGeometry(
			this.bezelGeometry,
			createRoundedBandGeometry(nextWidth, nextHeight, nextRadius, -this.options.bezel, 14, 1.7)
		);
		this.shadowLayers.forEach(({ geometry }, index) => {
			const layer = PANEL_SHADOW_RECIPE[index];
			copyGeometry(
				geometry,
				createRoundedBandGeometry(
					nextWidth,
					nextHeight,
					nextRadius,
					layer.blur * WEBGPU_SHADOW_EXTENT_PER_BLUR,
					Math.max(8, Math.round(layer.blur)),
					2.1
				)
			);
		});
	}

	dispose() {
		this.backdropGeometry.dispose();
		this.bezelGeometry.dispose();
		this.shadowLayers.forEach(({ geometry, material }) => {
			geometry.dispose();
			material.dispose();
		});
		this.backdropMaterial.dispose();
		this.depthMaterial.dispose();
		this.sheenMaterial.dispose();
	}
}

function copyGeometry(target: THREE.BufferGeometry, source: THREE.BufferGeometry) {
	const names = Object.keys(source.attributes);
	const reusable =
		names.length === Object.keys(target.attributes).length &&
		names.every((name) => {
			const before = target.getAttribute(name);
			const after = source.getAttribute(name);
			return (
				before instanceof THREE.BufferAttribute &&
				after instanceof THREE.BufferAttribute &&
				before.itemSize === after.itemSize &&
				before.array.constructor === after.array.constructor &&
				before.array.length === after.array.length
			);
		}) &&
		target.index?.count === source.index?.count;
	if (reusable) {
		for (const name of names) {
			const attribute = target.getAttribute(name) as THREE.BufferAttribute;
			attribute.array.set((source.getAttribute(name) as THREE.BufferAttribute).array);
			attribute.needsUpdate = true;
		}
		if (target.index && source.index) {
			target.index.array.set(source.index.array);
			target.index.needsUpdate = true;
		}
		target.computeBoundingBox();
		target.computeBoundingSphere();
	} else {
		// Preserve the authored band if a future recipe changes its buffer layout.
		target.dispose();
		target.copy(source);
	}
	source.dispose();
}

function createBackdropMaterial(
	backdropTexture: THREE.Texture,
	tint: ColorRepresentation,
	tintOpacity: number,
	projection: ReturnType<typeof createBackdropProjectionUniforms>
) {
	const material = new THREE.MeshBasicNodeMaterial({
		depthTest: false,
		depthWrite: false,
		transparent: true
	});
	const displayTintValue = new THREE.Color(tint);
	THREE.ColorManagement.workingToColorSpace(displayTintValue, THREE.SRGBColorSpace);
	const textureNode = texture(backdropTexture, createBackdropUvNode(projection));
	const backdropLinear = textureNode.rgb;
	const backdropDisplay = sRGBTransferOETF(
		acesFilmicToneMapping(backdropLinear, float(STAGE_TONE_MAPPING_EXPOSURE))
	) as Node<'vec3'>;
	const compositeDisplay = mix(backdropDisplay, color(displayTintValue), float(tintOpacity));
	material.colorNode = inverseAcesToneMapping(sRGBTransferEOTF(compositeDisplay) as Node<'vec3'>);
	material.toneMapped = false;

	return { material, textureNode };
}

function createBackdropProjectionUniforms(options: Required<LiquidGlassPanelOptions>) {
	return {
		panelSize: uniform(new THREE.Vector2(options.width, options.height)),
		radius: uniform(options.radius),
		bezel: uniform(options.bezel),
		refraction: uniform(options.refraction)
	};
}

/**
 * Computes the refracted backdrop coordinate once per vertex. The resulting
 * varying is interpolated by the rasterizer, so panel movement and camera
 * changes no longer require rewriting and uploading the complete UV buffer.
 */
function createBackdropUvNode(projection: ReturnType<typeof createBackdropProjectionUniforms>) {
	const localPosition = positionLocal.xy;
	const halfSize = projection.panelSize.mul(0.5);
	const radius = tslMin(projection.radius, tslMin(halfSize.x, halfSize.y));
	const signedDistance = roundedRectSdfNode(localPosition, halfSize, radius);
	const insideDistance = tslMax(signedDistance.negate(), 0);
	const edge = oneMinus(smoothstep(0, tslMax(projection.bezel, 0.0001), insideDistance)).mul(
		step(0.0001, projection.bezel)
	);
	const normalizedPosition = localPosition.div(tslMax(halfSize, 1));
	const centerLens = oneMinus(tslMin(1, length(normalizedPosition)));
	const gradient = roundedRectGradientNode(localPosition, halfSize, radius);
	const refractionOffset = projection.refraction.mul(edge.mul(1.15).add(centerLens.mul(0.04)));
	const samplePosition = localPosition.add(gradient.mul(refractionOffset));
	const clipPosition = cameraProjectionMatrix
		.mul(cameraViewMatrix)
		.mul(modelWorldMatrix)
		.mul(vec4(samplePosition, 0, 1));
	const ndc = clipPosition.xy.div(clipPosition.w);
	const projectedUv = vec2(ndc.x.mul(0.5).add(0.5), ndc.y.mul(-0.5).add(0.5));

	return varying(clamp(projectedUv, 0, 1), 'vLiquidGlassBackdropUv');
}

function roundedRectSdfNode(point: Node<'vec2'>, halfSize: Node<'vec2'>, radius: Node<'float'>) {
	const q = abs(point).sub(halfSize).add(radius);
	return tslMin(tslMax(q.x, q.y), 0)
		.add(length(tslMax(q, 0)))
		.sub(radius) as Node<'float'>;
}

function roundedRectGradientNode(
	point: Node<'vec2'>,
	halfSize: Node<'vec2'>,
	radius: Node<'float'>
) {
	const epsilon = 0.5;
	const dx = roundedRectSdfNode(point.add(vec2(epsilon, 0)), halfSize, radius).sub(
		roundedRectSdfNode(point.sub(vec2(epsilon, 0)), halfSize, radius)
	);
	const dy = roundedRectSdfNode(point.add(vec2(0, epsilon)), halfSize, radius).sub(
		roundedRectSdfNode(point.sub(vec2(0, epsilon)), halfSize, radius)
	);
	const gradient = vec2(dx, dy);

	return gradient.div(tslMax(length(gradient), 0.00001));
}

function getDepthOpacity(thickness: number) {
	return THREE.MathUtils.clamp(thickness, 0, 1) * 0.12;
}

/**
 * Inverts the stage's ACES curve so the final global output pass preserves a
 * CSS-style tint composite instead of tone-mapping it a second time.
 */
export function inverseAcesToneMapping(target: Node<'vec3'>) {
	const inputMatrix = mat3(
		0.59719,
		0.35458,
		0.04823,
		0.076,
		0.90834,
		0.01566,
		0.0284,
		0.13383,
		0.83777
	);
	const outputMatrix = mat3(
		1.60475,
		-0.53108,
		-0.07367,
		-0.10208,
		1.10813,
		-0.00605,
		-0.00327,
		-0.07276,
		1.07602
	);
	const fittedTarget = tslMax(inverse(outputMatrix).mul(target), 0) as Node<'vec3'>;
	const a = float(1).sub(fittedTarget.mul(0.983729));
	const b = float(0.0245786).sub(fittedTarget.mul(0.432951));
	const c = float(-0.000090537).sub(fittedTarget.mul(0.238081));
	const discriminant = tslMax(b.mul(b).sub(a.mul(c).mul(4)), 0);
	const fittedInput = b.negate().add(sqrt(discriminant)).div(a.mul(2)) as Node<'vec3'>;
	const transformedInput = inverse(inputMatrix).mul(fittedInput) as Node<'vec3'>;

	return tslMax(transformedInput.mul(0.6 / STAGE_TONE_MAPPING_EXPOSURE), 0) as Node<'vec3'>;
}

function getDepthColor(tint: ColorRepresentation) {
	return new THREE.Color(tint).lerp(new THREE.Color(0x101820), 0.72);
}

function getSpecularColor(tint: ColorRepresentation, tintOpacity: number) {
	const tintColor = new THREE.Color(tint);
	const tintDarkness = 1 - Math.max(tintColor.r, tintColor.g, tintColor.b);
	const tintInfluence = THREE.MathUtils.clamp(tintOpacity + tintDarkness * 0.55, 0, 1);

	return new THREE.Color(0xffffff).lerp(tintColor, tintInfluence);
}

function createVertexAlphaMaterial(
	color: ColorRepresentation,
	opacity: number,
	blending: typeof THREE.NormalBlending | typeof THREE.AdditiveBlending = THREE.NormalBlending
) {
	const material = new THREE.MeshBasicMaterial({
		blending,
		color,
		depthTest: false,
		depthWrite: false,
		opacity,
		side: THREE.DoubleSide,
		transparent: true,
		vertexColors: true
	});
	material.toneMapped = false;

	return material;
}

const roundedGridVertices = new WeakMap<THREE.BufferGeometry, Int32Array>();

function createRoundedGridGeometry(
	width: number,
	height: number,
	radius: number,
	columns: number,
	rows: number,
	geometry = new THREE.BufferGeometry()
) {
	const halfWidth = width * 0.5;
	const halfHeight = height * 0.5;
	const r = Math.min(radius, halfWidth, halfHeight);
	// Corner cells enter/leave the surface as its size changes. Reserve the full grid
	// once, keeping GPU buffer identity while drawRange selects the exact authored mesh.
	let vertexIndex = roundedGridVertices.get(geometry);
	if (!vertexIndex) {
		const capacity = (columns + 1) * (rows + 1);
		vertexIndex = new Int32Array(capacity);
		roundedGridVertices.set(geometry, vertexIndex);
		geometry.setAttribute(
			'position',
			new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage)
		);
		geometry.setIndex(
			new THREE.BufferAttribute(new Uint16Array(columns * rows * 6), 1).setUsage(
				THREE.DynamicDrawUsage
			)
		);
	}
	vertexIndex.fill(-1);
	const position = geometry.getAttribute('position') as THREE.BufferAttribute;
	const positions = position.array;
	const indexAttribute = geometry.index!;
	const indices = indexAttribute.array;
	let vertexCount = 0;
	let indexCount = 0;

	const addVertex = (gridX: number, gridY: number) => {
		const key = gridY * (columns + 1) + gridX;
		const existing = vertexIndex[key];
		if (existing !== -1) return existing;

		let x = -halfWidth + (gridX / columns) * width;
		let y = -halfHeight + (gridY / rows) * height;
		const distance = roundedRectSdf(x, y, halfWidth, halfHeight, r);

		if (distance > 0) {
			const gradient = roundedRectGradient(x, y, halfWidth, halfHeight, r);
			x -= gradient.x * distance;
			y -= gradient.y * distance;
		}

		const index = vertexCount++;
		positions[index * 3] = x;
		positions[index * 3 + 1] = y;
		positions[index * 3 + 2] = 0;
		vertexIndex[key] = index;

		return index;
	};

	for (let y = 0; y < rows; y += 1) {
		for (let x = 0; x < columns; x += 1) {
			const x0 = -halfWidth + (x / columns) * width;
			const x1 = -halfWidth + ((x + 1) / columns) * width;
			const y0 = -halfHeight + (y / rows) * height;
			const y1 = -halfHeight + ((y + 1) / rows) * height;
			const centerX = -halfWidth + ((x + 0.5) / columns) * width;
			const centerY = -halfHeight + ((y + 0.5) / rows) * height;
			const inside =
				roundedRectSdf(centerX, centerY, halfWidth, halfHeight, r) <= 0 ||
				roundedRectSdf(x0, y0, halfWidth, halfHeight, r) <= 0 ||
				roundedRectSdf(x1, y0, halfWidth, halfHeight, r) <= 0 ||
				roundedRectSdf(x0, y1, halfWidth, halfHeight, r) <= 0 ||
				roundedRectSdf(x1, y1, halfWidth, halfHeight, r) <= 0;

			if (!inside) continue;

			const a = addVertex(x, y);
			const b = addVertex(x + 1, y);
			const c = addVertex(x, y + 1);
			const d = addVertex(x + 1, y + 1);
			indices[indexCount++] = a;
			indices[indexCount++] = b;
			indices[indexCount++] = c;
			indices[indexCount++] = b;
			indices[indexCount++] = d;
			indices[indexCount++] = c;
		}
	}

	positions.fill(0, vertexCount * 3);
	indices.fill(0, indexCount);
	geometry.setDrawRange(0, indexCount);
	position.needsUpdate = true;
	indexAttribute.needsUpdate = true;
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	return geometry;
}

function createRoundedBandGeometry(
	width: number,
	height: number,
	radius: number,
	spread: number,
	rings: number,
	alphaPower: number
) {
	const positions: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];
	const pointsPerRing = 96;

	for (let ring = 0; ring <= rings; ring += 1) {
		const t = ring / rings;
		const offset = spread * t;
		const ringWidth = Math.max(1, width + offset * 2);
		const ringHeight = Math.max(1, height + offset * 2);
		const ringRadius = Math.max(0, Math.min(radius + offset, ringWidth * 0.5, ringHeight * 0.5));
		const alpha = Math.pow(1 - t, alphaPower);
		const points = createRoundedRectPoints(ringWidth, ringHeight, ringRadius, pointsPerRing / 4);

		points.forEach(({ x, y }) => {
			positions.push(x, y, 0);
			colors.push(1, 1, 1, alpha);
		});
	}

	for (let ring = 0; ring < rings; ring += 1) {
		const current = ring * pointsPerRing;
		const next = (ring + 1) * pointsPerRing;

		for (let index = 0; index < pointsPerRing; index += 1) {
			const a = current + index;
			const b = current + ((index + 1) % pointsPerRing);
			const c = next + index;
			const d = next + ((index + 1) % pointsPerRing);
			indices.push(a, b, c, b, d, c);
		}
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setIndex(indices);
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
	geometry.computeVertexNormals();

	return geometry;
}

function createRoundedRectPoints(
	width: number,
	height: number,
	radius: number,
	segmentsPerCorner: number
) {
	const halfWidth = width * 0.5;
	const halfHeight = height * 0.5;
	const r = Math.min(radius, halfWidth, halfHeight);
	const corners = [
		{ x: halfWidth - r, y: halfHeight - r, start: Math.PI * 0.5, end: 0 },
		{ x: halfWidth - r, y: -halfHeight + r, start: 0, end: -Math.PI * 0.5 },
		{ x: -halfWidth + r, y: -halfHeight + r, start: -Math.PI * 0.5, end: -Math.PI },
		{ x: -halfWidth + r, y: halfHeight - r, start: Math.PI, end: Math.PI * 0.5 }
	];
	const points: { x: number; y: number }[] = [];

	corners.forEach((corner) => {
		for (let step = 0; step < segmentsPerCorner; step += 1) {
			const t = step / segmentsPerCorner;
			const angle = THREE.MathUtils.lerp(corner.start, corner.end, t);
			points.push({
				x: corner.x + Math.cos(angle) * r,
				y: corner.y + Math.sin(angle) * r
			});
		}
	});

	return points;
}

function roundedRectSdf(
	x: number,
	y: number,
	halfWidth: number,
	halfHeight: number,
	radius: number
) {
	const qx = Math.abs(x) - halfWidth + radius;
	const qy = Math.abs(y) - halfHeight + radius;
	return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

function roundedRectGradient(
	x: number,
	y: number,
	halfWidth: number,
	halfHeight: number,
	radius: number
) {
	const eps = 0.5;
	const dx =
		roundedRectSdf(x + eps, y, halfWidth, halfHeight, radius) -
		roundedRectSdf(x - eps, y, halfWidth, halfHeight, radius);
	const dy =
		roundedRectSdf(x, y + eps, halfWidth, halfHeight, radius) -
		roundedRectSdf(x, y - eps, halfWidth, halfHeight, radius);
	const length = Math.hypot(dx, dy) || 1;

	return { x: dx / length, y: dy / length };
}
