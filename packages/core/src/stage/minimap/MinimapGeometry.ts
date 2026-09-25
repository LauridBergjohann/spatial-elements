import * as THREE from 'three/webgpu';
import { smoothstep } from '../stageMath.js';

/** Per-corner radii used by the minimap viewport and panel shapes. */
export interface MinimapCornerRadii {
	topLeft: number;
	topRight: number;
	bottomRight: number;
	bottomLeft: number;
}

/**
 * Blends viewport corners into the panel corners as the cutout reaches an edge.
 * Sharing this result keeps the cutout and its border visually synchronized.
 */
export function getMinimapViewportCornerRadii(
	panelWidth: number,
	panelHeight: number,
	left: number,
	top: number,
	width: number,
	height: number,
	radius: number,
	panelRadius: number
): MinimapCornerRadii {
	const right = Math.max(panelWidth - left - width, 0);
	const bottom = Math.max(panelHeight - top - height, 0);
	const limit = Math.max(Math.min(width, height) * 0.5, 0);
	const innerRadius = THREE.MathUtils.clamp(radius, 0, limit);
	const edgeRadius = THREE.MathUtils.clamp(panelRadius, 0, limit);
	const edgeBlendDistance = Math.max(edgeRadius * 1.45, 1);
	const cornerRadius = (horizontalDistance: number, verticalDistance: number) => {
		const distance = Math.max(Math.max(horizontalDistance, 0), Math.max(verticalDistance, 0));
		const proximity = 1 - THREE.MathUtils.clamp(distance / edgeBlendDistance, 0, 1);
		return THREE.MathUtils.lerp(innerRadius, edgeRadius, smoothstep(0, 1, proximity));
	};
	return {
		topLeft: cornerRadius(left, top),
		topRight: cornerRadius(right, top),
		bottomRight: cornerRadius(right, bottom),
		bottomLeft: cornerRadius(left, bottom)
	};
}

/** Creates the rounded panel surface used by the minimap composite. */
export function createMinimapPanelGeometry(
	panelWidth: number,
	panelHeight: number,
	panelRadius: number
) {
	const geometry = new THREE.BufferGeometry();
	updateMinimapPanelGeometry(geometry, panelWidth, panelHeight, panelRadius);
	return geometry;
}

/** Fixed convex fan with the original quadratic corner profile; resize in-place. */
export function updateMinimapPanelGeometry(
	geometry: THREE.BufferGeometry,
	panelWidth: number,
	panelHeight: number,
	panelRadius: number
) {
	const panelW = Math.max(panelWidth, 0.001);
	const panelH = Math.max(panelHeight, 0.001);
	const radius = THREE.MathUtils.clamp(panelRadius, 0, Math.min(panelW, panelH) * 0.5);
	const count = 44;
	let position = geometry.getAttribute('position');
	let uv = geometry.getAttribute('uv');
	if (!position) {
		position = new THREE.Float32BufferAttribute((count + 1) * 3, 3).setUsage(
			THREE.DynamicDrawUsage
		);
		uv = new THREE.Float32BufferAttribute((count + 1) * 2, 2).setUsage(THREE.DynamicDrawUsage);
		geometry.setAttribute('position', position);
		geometry.setAttribute('uv', uv);
		const indices: number[] = [];
		for (let i = 0; i < count; i++) indices.push(0, i + 1, ((i + 1) % count) + 1);
		geometry.setIndex(indices);
	}
	position.setXYZ(0, 0, 0, 0);
	uv.setXY(0, 0.5, 0.5);
	for (let corner = 0; corner < 4; corner++) {
		const xSign = corner < 2 ? 1 : -1;
		const ySign = corner === 0 || corner === 3 ? -1 : 1;
		for (let step = 0; step <= 10; step++) {
			const t = step / 10;
			const a = radius * (1 - t) ** 2;
			const b = radius * t ** 2;
			const x = xSign * (panelW * 0.5 - (corner % 2 === 0 ? a : b));
			const y = ySign * (panelH * 0.5 - (corner % 2 === 0 ? b : a));
			const index = 1 + corner * 11 + step;
			position.setXYZ(index, x, y, 0);
			uv.setXY(index, x / panelW + 0.5, 0.5 - y / panelH);
		}
	}
	position.needsUpdate = true;
	uv.needsUpdate = true;
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
}

/** Creates the rounded border that marks the main camera viewport on the minimap. */
export function createMinimapViewportRingGeometry(
	panelWidth: number,
	panelHeight: number,
	left: number,
	top: number,
	width: number,
	height: number,
	radii: MinimapCornerRadii,
	lineWidth: number
) {
	const geometry = new THREE.BufferGeometry();
	updateMinimapViewportRingGeometry(
		geometry,
		panelWidth,
		panelHeight,
		left,
		top,
		width,
		height,
		radii,
		lineWidth
	);
	return geometry;
}

/**
 * Updates the viewport border without replacing its GPU buffers.
 *
 * `ShapeGeometry` triangulates a rounded rectangle with a hole through Earcut.
 * During animated size/radius transitions that topology can briefly contain a
 * diagonal triangle across the hole. A paired outer/inner contour has fixed,
 * explicit quad topology, so no triangle can ever cross the viewport.
 */
export function updateMinimapViewportRingGeometry(
	geometry: THREE.BufferGeometry,
	panelWidth: number,
	panelHeight: number,
	left: number,
	top: number,
	width: number,
	height: number,
	radii: MinimapCornerRadii,
	lineWidth: number
) {
	const panelW = Math.max(panelWidth, 0.001);
	const panelH = Math.max(panelHeight, 0.001);
	const thickness = THREE.MathUtils.clamp(lineWidth, 0.5, Math.min(width, height) * 0.45);
	const outerX = left - panelW * 0.5;
	const outerY = panelH * 0.5 - top - height;
	const innerX = outerX + thickness;
	const innerY = outerY + thickness;
	const innerWidth = Math.max(width - thickness * 2, 0.001);
	const innerHeight = Math.max(height - thickness * 2, 0.001);
	const radiusLimit = Math.max(Math.min(width, height) * 0.5, 0);
	const outerRadii = {
		topLeft: THREE.MathUtils.clamp(radii.topLeft, 0, radiusLimit),
		topRight: THREE.MathUtils.clamp(radii.topRight, 0, radiusLimit),
		bottomRight: THREE.MathUtils.clamp(radii.bottomRight, 0, radiusLimit),
		bottomLeft: THREE.MathUtils.clamp(radii.bottomLeft, 0, radiusLimit)
	};
	const innerRadii = {
		topLeft: Math.max(outerRadii.topLeft - thickness, 0),
		topRight: Math.max(outerRadii.topRight - thickness, 0),
		bottomRight: Math.max(outerRadii.bottomRight - thickness, 0),
		bottomLeft: Math.max(outerRadii.bottomLeft - thickness, 0)
	};
	const outer = createRoundedRectContour(outerX, outerY, width, height, outerRadii, 10);
	const inner = createRoundedRectContour(innerX, innerY, innerWidth, innerHeight, innerRadii, 10);
	const vertexCount = outer.length * 2;
	let position = geometry.getAttribute('position');
	if (!(position instanceof THREE.BufferAttribute) || position.count !== vertexCount) {
		position = new THREE.Float32BufferAttribute(vertexCount * 3, 3);
		position.setUsage(THREE.DynamicDrawUsage);
		geometry.setAttribute('position', position);

		const indices: number[] = [];
		for (let index = 0; index < outer.length; index += 1) {
			const next = (index + 1) % outer.length;
			const outerIndex = index * 2;
			const innerIndex = outerIndex + 1;
			const nextOuterIndex = next * 2;
			const nextInnerIndex = nextOuterIndex + 1;
			indices.push(
				outerIndex,
				nextOuterIndex,
				nextInnerIndex,
				outerIndex,
				nextInnerIndex,
				innerIndex
			);
		}
		geometry.setIndex(indices);
	}

	for (let index = 0; index < outer.length; index += 1) {
		position.setXYZ(index * 2, outer[index].x, outer[index].y, 0);
		position.setXYZ(index * 2 + 1, inner[index].x, inner[index].y, 0);
	}
	position.needsUpdate = true;
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
}

/** Replaces a mesh geometry while releasing the previous GPU resource. */
export function replaceMeshGeometry(
	mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>,
	geometry: THREE.BufferGeometry
) {
	mesh.geometry.dispose();
	mesh.geometry = geometry;
}

function createRoundedRectContour(
	x: number,
	y: number,
	width: number,
	height: number,
	radii: MinimapCornerRadii,
	segmentsPerCorner: number
) {
	const right = x + width;
	const top = y + height;
	const segments = Math.max(Math.floor(segmentsPerCorner), 1);
	const points: THREE.Vector2[] = [];
	const addArc = (
		centerX: number,
		centerY: number,
		radius: number,
		startAngle: number,
		endAngle: number,
		includeEnd = true
	) => {
		const lastStep = includeEnd ? segments : segments - 1;
		for (let step = 1; step <= lastStep; step += 1) {
			const angle = THREE.MathUtils.lerp(startAngle, endAngle, step / segments);
			points.push(
				new THREE.Vector2(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius)
			);
		}
	};

	points.push(new THREE.Vector2(x + radii.bottomLeft, y));
	points.push(new THREE.Vector2(right - radii.bottomRight, y));
	addArc(right - radii.bottomRight, y + radii.bottomRight, radii.bottomRight, -Math.PI * 0.5, 0);
	points.push(new THREE.Vector2(right, top - radii.topRight));
	addArc(right - radii.topRight, top - radii.topRight, radii.topRight, 0, Math.PI * 0.5);
	points.push(new THREE.Vector2(x + radii.topLeft, top));
	addArc(x + radii.topLeft, top - radii.topLeft, radii.topLeft, Math.PI * 0.5, Math.PI);
	points.push(new THREE.Vector2(x, y + radii.bottomLeft));
	addArc(
		x + radii.bottomLeft,
		y + radii.bottomLeft,
		radii.bottomLeft,
		Math.PI,
		Math.PI * 1.5,
		false
	);

	return points;
}
