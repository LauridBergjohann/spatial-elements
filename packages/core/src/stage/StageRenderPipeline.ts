import { getRefinementSize } from './ProductRefinement.js';
import { getMinimapMeasurementMode } from './minimapMeasurement.js';
import { parseRenderMeasurement } from './renderMeasurement.js';
import type { PreparedHigh } from '../catalog/CatalogPreparation.js';
import { gaussianTargets } from './renderTargetInventory.js';
import { withRendererState, withVisibility } from './rendererState.js';

import type { StagePanelRuntime } from './StagePanelRuntime.js';

import * as THREE from 'three/webgpu';

import { CatalogProductLayer } from '../catalog/CatalogProductLayer.js';
import { SpatialGeometryCapture } from '../catalog/SpatialGeometryCapture.js';

import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import {
	Fn,
	float,
	If,
	mix,
	color,
	max as tslMax,
	min as tslMin,
	premultiplyAlpha,
	texture,
	uniform,
	uv,
	vec2,
	vec4
} from 'three/tsl';
import type { Mesh, Object3D } from 'three';
import {
	inverseAcesToneMapping,
	STAGE_TONE_MAPPING_EXPOSURE,
	type LiquidGlassPanelOptions
} from './LiquidGlassPanel.js';

import type { StageMinimapState } from './minimap/MinimapState.js';
import { isMesh } from './stageSceneUtils.js';
import type { StageInteractionTheme } from './stageTypes.js';
interface PanelBlurCapture {
	/** Intermediate pixels per CSS pixel; independent of output DPR/scroll quality. */
	resolutionScale: number;
	effect?: ReturnType<typeof gaussianBlur>;
	material: THREE.NodeMaterial;
	quad: THREE.QuadMesh;
	target: THREE.RenderTarget;
}
interface StageRenderTargetSet {
	scale: number;
	sceneCapture: THREE.RenderTarget;
	panelBlurCaptures: Map<number, PanelBlurCapture>;
}
const SCROLL_RENDER_SCALE = 0.82;

export interface StageRenderPorts {
	pageBackground?: string;
	renderer: THREE.WebGPURenderer;
	container: HTMLElement;
	backgroundCanvas: HTMLCanvasElement;
	backgroundCanvasTarget: THREE.CanvasTarget;
	scene: THREE.Scene;
	backgroundScene: THREE.Scene;
	tintScene: THREE.Scene;
	panelScene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	panelCamera: THREE.PerspectiveCamera;
	tintCamera: THREE.OrthographicCamera;
	panelRuntimes(): readonly StagePanelRuntime[];
	minimaps(): ReadonlyMap<number, StageMinimapState>;
	minimapScene(): THREE.Scene;
	catalogLayer(): Pick<CatalogProductLayer, 'hasCarousel' | 'renderRear' | 'draw'> | undefined;
	spatialCapture(): SpatialGeometryCapture | undefined;
	exitingMinimaps(): readonly { capture: SpatialGeometryCapture; minimap: StageMinimapState }[];
	contentSecondaries(): readonly { capture: SpatialGeometryCapture }[];
	fallbackPanelOptions(): readonly LiquidGlassPanelOptions[];
	interactionTheme(): StageInteractionTheme;
	frame(): Readonly<{
		outgoingBackground: boolean;
		catalogDockTarget: boolean;
		catalogHandoff: boolean;
		catalogMotionComplete: boolean;
		stageViewportVisible: boolean;
		modelHover: boolean;
		modelInteractionActive: boolean;
		catalog: boolean;
		pageModelReady: boolean;
		backgroundReveal: number;
	}>;
	renderStage(): void;
	renderMinimapBlur(minimap: StageMinimapState): void;
	renderMinimapPanelCapture(minimap: StageMinimapState): void;
	getPanelTransitionOpacity(panel?: StagePanelRuntime): number;
	isInteractionMesh(mesh: Mesh): boolean;
}

/** Owns GPU output bands, passes and target lifetimes; never schedules frames or navigation. */
export class StageRenderPipeline {
	private readonly measurementMode = getMinimapMeasurementMode();
	private readonly renderMeasurement = parseRenderMeasurement(
		typeof window === 'undefined' ? '' : (window.location?.search ?? '')
	);
	private readonly fuseOutline = ![
		'halo-separate',
		'halo-mask-only',
		'halo-frozen-mask',
		'halo-half-mask'
	].includes(this.renderMeasurement);
	private readonly measuredBackdropSeeds = new WeakMap<THREE.RenderTarget, string>();
	private readonly preparedZoomViews = new WeakSet<StageMinimapState>();
	private disposed = false;
	/** Retain the last PDP background while its geometry is owned by a transition. */
	freezeBackground() {
		const targets = this._activeRenderTargets;
		if (!targets) return false;
		withRendererState(this.ports.renderer, () => {
			this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
			this.ports.renderer.setRenderTarget(targets.sceneCapture);
			this.renderStageContents();
			this.renderStageDisplay();
			this.renderBackgroundPanels();
		});
		return true;
	}
	async warmHigh(high: PreparedHigh, environment: THREE.Texture, drawLow: () => void) {
		const scene = new THREE.Scene();
		scene.environment = environment;
		scene.environmentIntensity = 0.5;
		scene.add(high.pose);
		const camera = new THREE.PerspectiveCamera(
			45,
			window.innerWidth / window.innerHeight,
			0.01,
			100
		);
		camera.position.z = 5;
		const size = this.ports.renderer.getDrawingBufferSize(new THREE.Vector2());
		const warmSize = getRefinementSize(size.x, size.y);
		const target = new THREE.RenderTarget(warmSize.width, warmSize.height, {
			type: THREE.HalfFloatType,
			samples: 4
		});
		const destination = this.ports.renderer.getRenderTarget();
		const clear = this.ports.renderer.getClearColor(new THREE.Color());
		const alpha = this.ports.renderer.getClearAlpha();
		try {
			this.ports.renderer.setRenderTarget(target);
			this.ports.renderer.setClearColor(0, 0);
			high.blend.render(
				this.ports.renderer,
				(useHigh) => {
					this.ports.renderer.clear();
					if (useHigh) this.ports.renderer.render(scene, camera);
					else drawLow();
				},
				false,
				0
			);
		} finally {
			this.ports.renderer.setRenderTarget(destination);
			this.ports.renderer.setClearColor(clear, alpha);
			high.pose.removeFromParent();
			target.dispose();
		}
		const device = (this.ports.renderer.backend as unknown as { device?: GPUDevice }).device;
		await device?.queue.onSubmittedWorkDone();
	}

	getRenderTargets() {
		return [
			...(this.outlineMaskTarget ? [this.outlineMaskTarget] : []),
			...[this.fullQualityTargets, this.scrollQualityTargets].flatMap((set) =>
				set
					? [
							set.sceneCapture,
							...[...set.panelBlurCaptures.values()].flatMap((blur) => [
								blur.target,
								...gaussianTargets(blur.effect)
							])
						]
					: []
			)
		];
	}
	getCanvasOutputs() {
		return [
			this.ports.backgroundCanvasTarget,
			this.foregroundCanvasTarget,
			this.carouselRearTarget
		].flatMap((target, index) => {
			if (!target) return [];
			const size = target.getDrawingBufferSize(new THREE.Vector2());
			return [
				{
					band: ['background', 'foreground', 'carousel-rear'][index],
					width: size.x,
					height: size.y,
					colorAttachments: 1,
					depthAttachments: 1
				}
			];
		});
	}
	constructor(private readonly ports: StageRenderPorts) {
		this.setPageBackground(ports.pageBackground ?? '#ffffff');
		this.backgroundCoverMaterial.fragmentNode = premultiplyAlpha(
			vec4(inverseAcesToneMapping(this.backgroundCoverColor), this.backgroundCoverOpacity)
		);
		this.backgroundCoverMaterial.depthTest = this.backgroundCoverMaterial.depthWrite = false;
		this.backgroundCoverMaterial.transparent =
			this.backgroundCoverMaterial.premultipliedAlpha = true;
		this.backgroundCoverMaterial.toneMapped = false;
	}
	private readonly backgroundCoverOpacity = uniform(0);
	private readonly backgroundCoverColor = uniform(new THREE.Vector3(1, 1, 1));
	setPageBackground(value: string) {
		const color = new THREE.Color(value);
		this.backgroundCoverColor.value.set(color.r, color.g, color.b);
	}
	private readonly backgroundCoverMaterial = new THREE.NodeMaterial();
	private readonly backgroundCover = new THREE.QuadMesh(this.backgroundCoverMaterial);
	private readonly outlineMaskScene = new THREE.Scene();
	private _minimapOverlayCapturePasses = 0;
	private _renderTargetSetCreations = 0;
	private _renderTargetSetResizes = 0;
	private _renderTargetSetWarmups = 0;
	private _stageModelRenderPasses = 0;
	private _panelBlurRenderPasses = 0;
	private _panelSceneRenderPasses = 0;
	private _minimapSceneRenderPasses = 0;
	private outlineMaskModel?: Object3D;
	private outlineMaskMaterial?: THREE.MeshBasicMaterial;
	private outlineCompositeMaterial?: THREE.MeshBasicNodeMaterial;
	private outlineQuad?: THREE.QuadMesh;
	private outlineMaskTarget?: THREE.RenderTarget;
	private outlineMaskValid = false;
	private readonly emptyOutlineMask = new THREE.DataTexture(new Uint8Array(4), 1, 1);
	private readonly displayOutlineMask = texture(this.emptyOutlineMask);
	private readonly displayOutlineOpacity = uniform(0);
	private outlineWidth = 1;
	private outlineHeight = 1;
	private outlineTexel = uniform(new THREE.Vector2(1, 1));
	private outlineGlowTexel = uniform(new THREE.Vector2(1, 1));
	private outlineOpacityScale = uniform(1);
	private fullQualityTargets?: StageRenderTargetSet;
	private scrollQualityTargets?: StageRenderTargetSet;
	private _activeRenderTargets?: StageRenderTargetSet;
	private stageDisplayMaterial?: THREE.NodeMaterial;
	private _stageDisplayQuad?: THREE.QuadMesh;
	private stageDisplayTextureNode?: ReturnType<typeof texture>;
	private foregroundCanvasTarget?: THREE.CanvasTarget;
	private carouselRearTarget?: THREE.CanvasTarget;
	private carouselRearCanvas?: HTMLCanvasElement;
	private carouselRearSize = new THREE.Vector3();
	private foregroundCanvas?: HTMLCanvasElement;
	configureRenderer() {
		this.ports.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.ports.renderer.toneMappingExposure = STAGE_TONE_MAPPING_EXPOSURE;
		this.ports.renderer.setClearColor(0xffffff, 1);
		this.ports.renderer.autoClear = false;
		this.ports.backgroundCanvas.tabIndex = -1;
		this.ports.backgroundCanvas.style.touchAction = 'pan-y';
	}
	renderCarouselRear() {
		if (!this.carouselRearTarget && !this.ports.catalogLayer()?.hasCarousel()) return;
		if (!this.carouselRearTarget) {
			const canvas = document.createElement('canvas');
			canvas.className = 'stage-webgpu-carousel-rear';
			canvas.setAttribute('aria-hidden', 'true');
			this.carouselRearCanvas = canvas;
			this.carouselRearTarget = new THREE.CanvasTarget(canvas);
			this.ports.container.appendChild(canvas);
		}
		const target = this.carouselRearTarget;
		const width = window.innerWidth,
			height = window.innerHeight,
			ratio = this.getFullPixelRatio();
		if (
			this.carouselRearSize.x !== width ||
			this.carouselRearSize.y !== height ||
			this.carouselRearSize.z !== ratio
		) {
			this.resizeCanvasTarget(target, width, height, ratio);
			this.carouselRearSize.set(width, height, ratio);
		}
		this.ports.renderer.setCanvasTarget(target);
		this.ports.renderer.setRenderTarget(null);
		this.ports.renderer.setClearColor(0x000000, 0);
		this.ports.renderer.clear();
		this.ports.catalogLayer()?.renderRear(this.ports.renderer);
		this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
	}
	createForegroundCanvas() {
		const canvas = document.createElement('canvas');
		canvas.className = 'stage-webgpu-foreground';
		canvas.setAttribute('aria-hidden', 'true');
		this.foregroundCanvas = canvas;
		this.foregroundCanvasTarget = new THREE.CanvasTarget(canvas);
		this.ports.container.appendChild(canvas);
		this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
	}
	createModelOutline(model: Object3D) {
		this.outlineMaskModel?.removeFromParent();
		this.outlineMaskMaterial?.dispose();
		this.outlineCompositeMaterial?.dispose();
		this.outlineMaskTarget?.dispose();
		this.outlineMaskMaterial = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			depthTest: true,
			depthWrite: true,
			side: THREE.DoubleSide,
			toneMapped: false
		});

		const maskModel = model.clone(true);
		maskModel.traverse((child) => {
			if (!isMesh(child)) return;

			const sourceMesh = this.findSourceMeshByName(model, child.name);
			const include = sourceMesh
				? this.ports.isInteractionMesh(sourceMesh)
				: this.ports.isInteractionMesh(child);
			child.visible = include;
			child.material = this.outlineMaskMaterial!;
		});

		this.outlineMaskModel = maskModel;
		this.outlineMaskScene.add(maskModel);
		this.outlineMaskTarget = new THREE.RenderTarget(1, 1, {
			depthBuffer: true,
			stencilBuffer: false,
			samples: 4
		});
		this.outlineMaskTarget.texture.minFilter = THREE.LinearFilter;
		this.outlineMaskTarget.texture.magFilter = THREE.LinearFilter;
		this.outlineMaskTarget.texture.generateMipmaps = false;
		this.displayOutlineMask.value = this.outlineMaskTarget.texture;
		this.outlineCompositeMaterial = this.createOutlineCompositeMaterial(
			this.outlineMaskTarget.texture
		);
		this.outlineQuad = new THREE.QuadMesh(this.outlineCompositeMaterial);
		// High refinement can replace the silhouette long after the last window resize.
		this.resizeOutline(this.outlineWidth, this.outlineHeight);
	}
	private findSourceMeshByName(root: Object3D, name: string) {
		let source: Mesh | undefined;
		root.traverse((child) => {
			if (!source && isMesh(child) && child.name === name) source = child;
		});

		return source;
	}
	private createOutlineOpacity(mask: ReturnType<typeof texture>) {
		const calculate = () => {
			const texel = this.outlineTexel;
			const glowTexel = this.outlineGlowTexel;
			const sampleMaskRing = (sampleTexel: typeof texel, scale = 1) => {
				const centerUv = uv();
				const sampleX = sampleTexel.x.mul(scale);
				const sampleY = sampleTexel.y.mul(scale);
				const left = mask.sample(centerUv.sub(vec2(sampleX, 0))).r;
				const right = mask.sample(centerUv.add(vec2(sampleX, 0))).r;
				const up = mask.sample(centerUv.add(vec2(0, sampleY))).r;
				const down = mask.sample(centerUv.sub(vec2(0, sampleY))).r;
				const upLeft = mask.sample(centerUv.add(vec2(0, sampleY)).sub(vec2(sampleX, 0))).r;
				const upRight = mask.sample(centerUv.add(vec2(sampleX, sampleY))).r;
				const downLeft = mask.sample(centerUv.sub(vec2(sampleX, sampleY))).r;
				const downRight = mask.sample(centerUv.add(vec2(sampleX, 0)).sub(vec2(0, sampleY))).r;

				return {
					average: left
						.add(right)
						.add(up)
						.add(down)
						.add(upLeft)
						.add(upRight)
						.add(downLeft)
						.add(downRight)
						.div(8),
					max: tslMax(
						tslMax(tslMax(left, right), tslMax(up, down)),
						tslMax(tslMax(upLeft, upRight), tslMax(downLeft, downRight))
					),
					min: tslMin(
						tslMin(tslMin(left, right), tslMin(up, down)),
						tslMin(tslMin(upLeft, upRight), tslMin(downLeft, downRight))
					)
				};
			};
			const edgeNeighbor = sampleMaskRing(texel);
			const glowNearNeighbor = sampleMaskRing(glowTexel, 0.45);
			const glowMidNeighbor = sampleMaskRing(glowTexel, 0.7);
			const glowFarNeighbor = sampleMaskRing(glowTexel);
			const center = mask.sample(uv()).r;
			const outside = center.oneMinus();
			const edgeGradient = edgeNeighbor.max.sub(center).max(0);
			const core = edgeGradient.mul(this.ports.interactionTheme().outlineOpacity);
			// Average neighbouring coverage, rather than dilating a solid band. Keep the
			// halo outside the product so it cannot be mistaken for painted geometry.
			const glowNear = glowNearNeighbor.average
				.mul(outside)
				.mul(this.ports.interactionTheme().outlineGlow * 0.6);
			const glowMid = glowMidNeighbor.average
				.mul(outside)
				.mul(this.ports.interactionTheme().outlineGlow * 0.3);
			const glowFar = glowFarNeighbor.average
				.mul(outside)
				.mul(this.ports.interactionTheme().outlineGlow * 0.1);
			const opacity = tslMin(core.add(glowNear).add(glowMid).add(glowFar), 1).mul(
				this.outlineOpacityScale
			);

			return opacity;
		};
		if (this.renderMeasurement === 'halo-unconditional') return calculate();
		return Fn(() => {
			const opacity = float(0).toVar();
			// A fully covered pixel has zero outer halo. Skip all 32 neighbour taps there.
			If(mask.sample(uv()).r.lessThan(1), () => {
				opacity.assign(calculate());
			});
			return opacity;
		})();
	}
	private createOutlineCompositeMaterial(maskTexture: THREE.Texture) {
		const material = new THREE.MeshBasicNodeMaterial({
			blending: THREE.NormalBlending,
			depthTest: false,
			depthWrite: false,
			transparent: true
		});
		material.colorNode = color(new THREE.Color(this.ports.interactionTheme().outlineColor));
		material.opacityNode = this.createOutlineOpacity(texture(maskTexture));
		material.toneMapped = false;
		return material;
	}
	disposeSceneCapture() {
		this.disposeRenderTargetSet(this.fullQualityTargets);
		this.disposeRenderTargetSet(this.scrollQualityTargets);
		this.stageDisplayMaterial?.dispose();
		this.fullQualityTargets = undefined;
		this.scrollQualityTargets = undefined;
		this._activeRenderTargets = undefined;
		this.stageDisplayMaterial = undefined;
		this._stageDisplayQuad = undefined;
		this.stageDisplayTextureNode = undefined;
	}
	createSceneCapture() {
		const blurKeys = new Set(
			this.ports.fallbackPanelOptions().map((options) => this.getPanelBlurKey(options))
		);
		this.fullQualityTargets = this.createRenderTargetSet(1, blurKeys);
		this.scrollQualityTargets = this.createRenderTargetSet(SCROLL_RENDER_SCALE, blurKeys);
		this._activeRenderTargets = this.fullQualityTargets;

		this.stageDisplayTextureNode = texture(this.fullQualityTargets.sceneCapture.texture);
		this.stageDisplayMaterial = new THREE.NodeMaterial();
		// CanvasTarget already runs WebGPURenderer's output transform after this
		// fullscreen copy. Keep the capture linear here so ACES and sRGB are applied
		// exactly once; using renderOutput() here would wash out the entire stage.
		// CanvasTarget unpremultiplies before tone mapping and premultiplies afterwards.
		// Environment visibility is applied before the hero; the composed capture stays opaque.
		this.stageDisplayMaterial.fragmentNode = vec4(this.stageDisplayTextureNode.rgb, 1);
		if (this.fuseOutline) {
			this.emptyOutlineMask.needsUpdate = true;
			const source = this.stageDisplayTextureNode;
			const haloColor = color(new THREE.Color(this.ports.interactionTheme().outlineColor));
			const haloOpacity = this.createOutlineOpacity(this.displayOutlineMask);
			// Merge into the existing linear display pass before the canvas output transform.
			this.stageDisplayMaterial.fragmentNode = Fn(() => {
				const rgb = source.rgb.toVar();
				If(this.displayOutlineOpacity.greaterThan(0), () => {
					rgb.assign(mix(rgb, haloColor, haloOpacity.mul(this.displayOutlineOpacity)));
				});
				return vec4(rgb, 1);
			})();
		}
		this.stageDisplayMaterial.depthTest = false;
		this.stageDisplayMaterial.depthWrite = false;
		this.stageDisplayMaterial.blending = THREE.NoBlending;
		this.stageDisplayMaterial.toneMapped = false;
		this.stageDisplayMaterial.needsUpdate = true;
		this._stageDisplayQuad = new THREE.QuadMesh(this.stageDisplayMaterial);
	}
	private createRenderTargetSet(
		scale: number,
		blurKeys: ReadonlySet<number>
	): StageRenderTargetSet {
		this._renderTargetSetCreations += 1;
		const sceneCapture = new THREE.RenderTarget(1, 1, {
			depthBuffer: true,
			stencilBuffer: false,
			samples: 4,
			type: THREE.HalfFloatType
		});
		sceneCapture.texture.minFilter = THREE.LinearFilter;
		sceneCapture.texture.magFilter = THREE.LinearFilter;
		sceneCapture.texture.generateMipmaps = false;
		sceneCapture.texture.colorSpace = THREE.NoColorSpace;

		const panelBlurCaptures = new Map<number, PanelBlurCapture>();
		blurKeys.forEach((blur) => {
			panelBlurCaptures.set(blur, this.createPanelBlurCapture(sceneCapture.texture, blur, scale));
		});

		return { scale, sceneCapture, panelBlurCaptures };
	}
	private disposeRenderTargetSet(targets?: StageRenderTargetSet) {
		if (!targets) return;
		targets.sceneCapture.dispose();
		targets.panelBlurCaptures.forEach(({ target, material, effect }) => {
			target.dispose();
			material.dispose();
			effect?.dispose();
		});
		targets.panelBlurCaptures.clear();
	}
	resizeRenderTargets() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		const pixelRatio = this.getFullPixelRatio();
		if (!this.ports.frame().outgoingBackground)
			this.resizeCanvasTarget(this.ports.backgroundCanvasTarget, width, height, pixelRatio);
		if (this.foregroundCanvasTarget) {
			this.resizeCanvasTarget(this.foregroundCanvasTarget, width, height, pixelRatio);
		}
		this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
		this.resizeRenderTargetSet(this.fullQualityTargets, width, height, pixelRatio);
		this.resizeRenderTargetSet(this.scrollQualityTargets, width, height, pixelRatio);
	}
	private resizeRenderTargetSet(
		targets: StageRenderTargetSet | undefined,
		width: number,
		height: number,
		pixelRatio: number
	) {
		if (!targets) return;
		this._renderTargetSetResizes += 1;
		const captureWidth = Math.max(1, Math.round(width * pixelRatio * targets.scale));
		const captureHeight = Math.max(1, Math.round(height * pixelRatio * targets.scale));
		targets.sceneCapture.setSize(captureWidth, captureHeight);
		targets.panelBlurCaptures.forEach(({ target, effect, resolutionScale }) => {
			target.setSize(captureWidth, captureHeight);
			if (effect) effect.resolutionScale = resolutionScale / (pixelRatio * targets.scale);
			effect?.setSize(captureWidth, captureHeight);
		});
	}
	getFullPixelRatio() {
		return Math.min(window.devicePixelRatio || 1, 2);
	}
	setScrollRenderQuality(active: boolean) {
		this.ports.container.toggleAttribute('data-stage-scroll-rendering', active);
		const nextTargets = active ? this.scrollQualityTargets : this.fullQualityTargets;
		if (!nextTargets || this._activeRenderTargets === nextTargets) return;
		this.activateRenderTargetSet(nextTargets);
	}
	private activateRenderTargetSet(nextTargets: StageRenderTargetSet) {
		this._activeRenderTargets = nextTargets;
		if (this.stageDisplayTextureNode) {
			this.stageDisplayTextureNode.value = nextTargets.sceneCapture.texture;
		}
		this.ports.panelRuntimes().forEach((runtime) => {
			runtime.glass?.setBackdropTexture(this.getPanelBlurTexture(runtime.options, nextTargets));
		});
		this.ports.minimaps().forEach((minimap) => {
			minimap.stageCaptureTexture.value = nextTargets.sceneCapture.texture;
			const panel = this.ports.panelRuntimes()[minimap.panelIndex];
			if (panel) {
				minimap.stageBlurTexture.value =
					panel.surface === 'solid'
						? nextTargets.sceneCapture.texture
						: this.getPanelBlurTexture(panel.options, nextTargets);
			}
			minimap.overlayCaptureDirty = true;
		});
	}
	warmRenderTargetSets() {
		const previousTargets = this._activeRenderTargets;
		const availableTargets = [this.fullQualityTargets, this.scrollQualityTargets].filter(
			(targets): targets is StageRenderTargetSet => Boolean(targets)
		);
		if (!previousTargets || !this._stageDisplayQuad || availableTargets.length !== 2) return;
		// Finish with the active/full-quality set so the warm-up itself cannot
		// leave a lower-resolution frame on the visible canvas.
		const targetSets = [
			...availableTargets.filter((targets) => targets !== previousTargets),
			previousTargets
		];

		try {
			withRendererState(this.ports.renderer, () => {
				targetSets.forEach((targets) => {
					this.activateRenderTargetSet(targets);
					this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
					this.ports.renderer.setRenderTarget(targets.sceneCapture);
					this.ports.renderStage();
					this.renderPanelBlurCaptures(targets, true);
					this.renderStageDisplay();
					this.renderBackgroundPanels();
					this._renderTargetSetWarmups += 1;
				});
			});
		} finally {
			this.activateRenderTargetSet(previousTargets);
		}
	}
	private resizeCanvasTarget(
		target: THREE.CanvasTarget,
		width: number,
		height: number,
		pixelRatio: number
	) {
		this.ports.renderer.setCanvasTarget(target);
		this.ports.renderer.setPixelRatio(pixelRatio);
		this.ports.renderer.setSize(width, height, false);
	}
	private createPanelBlurCapture(
		sceneTexture: THREE.Texture,
		blur: number,
		renderScale: number
	): PanelBlurCapture {
		const target = new THREE.RenderTarget(1, 1, {
			depthBuffer: false,
			stencilBuffer: false
		});
		target.texture.minFilter = THREE.LinearFilter;
		target.texture.magFilter = THREE.LinearFilter;
		target.texture.generateMipmaps = false;
		target.texture.colorSpace = THREE.NoColorSpace;

		const sourceTexture = texture(sceneTexture);
		// Scale resolution and sample offsets together to retain the CSS blur radius.
		// The final full-size texture still uses the existing screen-space mapping.
		const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location?.search);
		const fullResolutionProbe =
			query.get('stage-test') === '1' && query.get('stage-backdrop') === 'full';
		const blurResolution = blur >= 4 && !fullResolutionProbe ? 0.5 : 1;
		const effect =
			blur > 0
				? gaussianBlur(sourceTexture, blurResolution, Math.max(1, Math.round(blur)), {
						resolutionScale: blurResolution / (this.getFullPixelRatio() * renderScale)
					})
				: undefined;
		const material = new THREE.NodeMaterial();
		material.colorNode = effect ?? sourceTexture;
		material.needsUpdate = true;

		return {
			resolutionScale: blurResolution,
			effect,
			material,
			quad: new THREE.QuadMesh(material),
			target
		};
	}
	private getPanelBlurKey(options: LiquidGlassPanelOptions) {
		const value = Number.isFinite(options.backdropBlur) ? (options.backdropBlur ?? 0) : 0;
		return Math.round(THREE.MathUtils.clamp(value, 0, 100) * 100) / 100;
	}
	getPanelBlurTexture(options: LiquidGlassPanelOptions, targets = this._activeRenderTargets) {
		const blur = this.getPanelBlurKey(options);
		const capture = targets?.panelBlurCaptures.get(blur);
		if (!capture) {
			throw new Error(`No backdrop capture exists for panel blur ${blur}`);
		}
		return capture.target.texture;
	}
	/** Prepare hidden close-up effects during page binding, never during camera motion.
	 * Captures stay invalid: the first visible frame must still sample the live product.
	 * Only compile the foreground scene, so preparation cannot paint an overlay on screen.
	 */
	async prepareZoomEffects() {
		if (!this.foregroundCanvasTarget || this.disposed) return;
		const views = [...this.ports.minimaps().values()].filter(
			(view) => !this.preparedZoomViews.has(view)
		);
		if (!views.length) return;
		const pending: Promise<unknown>[] = [];
		for (const view of views) {
			withRendererState(this.ports.renderer, () => {
				this.ports.renderMinimapBlur(view);
				if (this.ports.panelRuntimes()[view.panelIndex]?.surface === 'glass')
					this.ports.renderMinimapPanelCapture(view);
				this.ports.renderer.setCanvasTarget(this.foregroundCanvasTarget!);
				this.ports.renderer.setRenderTarget(null);
				const ringMaterial = view.overlayRing.material;
				const compositeCulled = view.overlayComposite.frustumCulled;
				const ringCulled = view.overlayRing.frustumCulled;
				try {
					// A newly bound minimap camera may not yet have its screen projection.
					// Compile the hidden effects even if that initial frustum excludes them.
					view.overlayComposite.frustumCulled = false;
					view.overlayRing.frustumCulled = false;
					withVisibility(
						[
							...[...this.ports.minimaps().values()].map((entry) => entry.layer),
							view.overlayComposite,
							view.overlayRing
						],
						() => {
							for (const entry of this.ports.minimaps().values())
								entry.layer.visible = entry === view;
							view.overlayComposite.visible = true;
							view.overlayRing.visible = true;
							for (const material of [view.ringRestMaterial, view.ringForegroundMaterial]) {
								view.overlayRing.material = material;
								pending.push(
									this.ports.renderer.compileAsync(this.ports.minimapScene(), view.screenCamera)
								);
							}
						}
					);
				} finally {
					view.overlayRing.material = ringMaterial;
					view.overlayComposite.frustumCulled = compositeCulled;
					view.overlayRing.frustumCulled = ringCulled;
				}
			});
		}
		await Promise.all(pending);
		const device = (this.ports.renderer.backend as unknown as { device?: GPUDevice }).device;
		await device?.queue.onSubmittedWorkDone();
		if (!this.disposed) for (const view of views) this.preparedZoomViews.add(view);
	}
	renderForegroundLayer() {
		if (!this.foregroundCanvasTarget) return;

		this.ports.renderer.setCanvasTarget(this.foregroundCanvasTarget);
		this.ports.renderer.setRenderTarget(null);
		this.ports.renderer.setClearColor(0x000000, 0);
		this.ports.renderer.clear();
		this.renderMinimapScene();
		for (const entry of this.ports.exitingMinimaps())
			if (entry.minimap.displayOpacity > 0) entry.capture.render(this.ports.renderer);
		this.ports.catalogLayer()?.draw(this.ports.renderer, 'front');
		for (const entry of this.ports.contentSecondaries()) entry.capture.render(this.ports.renderer);
		this.ports.spatialCapture()?.render(this.ports.renderer);
	}
	renderBackgroundPanels() {
		return withVisibility(
			this.ports.panelRuntimes().map((panel) => panel.group),
			() => {
				const minimaps = Array.from(this.ports.minimaps().values());
				const minimapPanelIndices = new Set(minimaps.map((minimap) => minimap.panelIndex));
				const panelVisibility = this.ports.panelRuntimes().map((panel) => panel.group.visible);
				const visibleMinimaps = minimaps.filter(
					(minimap) =>
						minimap.viewportVisible &&
						panelVisibility[minimap.panelIndex] &&
						Boolean(this.ports.panelRuntimes()[minimap.panelIndex]?.glass)
				);
				const hasVisibleRegularPanel = this.ports
					.panelRuntimes()
					.some(
						(panel, index) =>
							Boolean(panel.glass) && panelVisibility[index] && !minimapPanelIndices.has(index)
					);

				// Regular panels share the stage camera. Minimap panels use an off-axis
				// screen camera, so leave them out of this pass and draw them separately.
				this.ports.panelRuntimes().forEach((panel, index) => {
					if (panel.glass) {
						panel.group.visible = panelVisibility[index] && !minimapPanelIndices.has(index);
					}
				});

				if (hasVisibleRegularPanel) {
					this.ports.renderer.clearDepth();
					this.ports.renderer.render(this.ports.panelScene, this.ports.panelCamera);
					this._panelSceneRenderPasses += 1;
				}

				// Keep the glass body in the same compositing layer as the other panels,
				// but retain the exact camera and transform used by its foreground model.
				visibleMinimaps.forEach((active) => {
					this.ports.panelRuntimes().forEach((panel, index) => {
						if (panel.glass) {
							panel.group.visible = panelVisibility[index] && index === active.panelIndex;
						}
					});

					this.ports.renderer.clearDepth();
					this.ports.renderer.render(this.ports.panelScene, active.screenCamera);
					this._panelSceneRenderPasses += 1;
				});

				this.ports.panelRuntimes().forEach((panel, index) => {
					panel.group.visible = panelVisibility[index];
				});
			}
		);
	}
	private renderMinimapScene() {
		return withVisibility(
			[
				...this.ports.panelRuntimes().map((panel) => panel.group),
				...[...this.ports.minimaps().values()].flatMap((view) => [view.layer, view.productRoot])
			],
			() => {
				if (!this.ports.minimaps().size) return;

				const minimaps = Array.from(this.ports.minimaps().values());
				const visibleMinimaps = minimaps.filter(
					(minimap) =>
						minimap.viewportVisible &&
						this.ports.getPanelTransitionOpacity(this.ports.panelRuntimes()[minimap.panelIndex]) >
							0.001
				);
				if (!visibleMinimaps.length) return;
				const panelVisibility = this.ports.panelRuntimes().map((panel) => panel.group.visible);

				visibleMinimaps.forEach((active) => {
					minimaps.forEach((minimap) => {
						minimap.layer.visible = minimap === active;
					});
					this.ports.panelRuntimes().forEach((panel, index) => {
						if (panel.glass) panel.group.visible = index === active.panelIndex;
					});

					if (
						active.overlayComposite.visible &&
						(!active.overlayCaptureValid ||
							(this.measurementMode !== 'reuse-capture' && active.overlayCaptureDirty))
					) {
						this.ports.renderMinimapBlur(active);
						active.overlayCaptureDirty = false;
						active.overlayCaptureValid = true;
						this._minimapOverlayCapturePasses += 1;
					}
					if (
						active.overlayComposite.visible &&
						this.ports.panelRuntimes()[active.panelIndex]?.surface === 'glass' &&
						(!active.panelCaptureValid ||
							(this.measurementMode !== 'reuse-capture' && active.panelCaptureDirty))
					) {
						this.ports.renderMinimapPanelCapture(active);
						active.panelCaptureDirty = false;
						active.panelCaptureValid = true;
					}
					this.ports.renderer.clearDepth();
					const productVisible = active.productRoot.visible;
					if (
						this.ports.frame().catalogDockTarget &&
						this.ports.frame().catalogHandoff &&
						!this.ports.frame().catalogMotionComplete
					)
						active.productRoot.visible = false;
					this.ports.renderer.render(this.ports.minimapScene(), active.screenCamera);
					active.productRoot.visible = productVisible;
					this._minimapSceneRenderPasses += 1;
				});

				this.ports.panelRuntimes().forEach((panel, index) => {
					panel.group.visible = panelVisibility[index];
				});
				minimaps.forEach((minimap) => {
					minimap.layer.visible =
						minimap.viewportVisible &&
						this.ports.getPanelTransitionOpacity(this.ports.panelRuntimes()[minimap.panelIndex]) >
							0.001;
				});
			}
		);
	}
	renderModelOutline(target: THREE.RenderTarget | null, opacity = 1) {
		this.displayOutlineOpacity.value = 0;
		if (this.renderMeasurement === 'no-halo') return;
		const opacityBefore = this.outlineOpacityScale.value;
		try {
			return withRendererState(this.ports.renderer, () => {
				if (
					!this.ports.frame().stageViewportVisible ||
					!(this.ports.frame().modelHover || this.ports.frame().modelInteractionActive) ||
					!this.outlineMaskTarget ||
					!this.outlineQuad
				)
					return;

				const previousClearAlpha = this.ports.renderer.getClearAlpha();
				const previousClearColor = this.ports.renderer.getClearColor(new THREE.Color());
				const previousOpacity = this.outlineOpacityScale.value;

				if (this.renderMeasurement !== 'halo-frozen-mask' || !this.outlineMaskValid) {
					this.ports.renderer.setRenderTarget(this.outlineMaskTarget);
					this.ports.renderer.setClearColor(0x000000, 0);
					this.ports.renderer.clear();
					this.ports.renderer.render(this.outlineMaskScene, this.ports.camera);
					this.outlineMaskValid = true;
				}
				this.ports.renderer.setClearColor(previousClearColor, previousClearAlpha);
				this.ports.renderer.setRenderTarget(target);

				this.outlineOpacityScale.value = opacity;
				// Glass can refract the sharp scene capture, so keep the halo in that
				// capture while a glass surface is visible. Forced fusion is a test probe.
				const fuseThisFrame =
					this.fuseOutline &&
					(this.renderMeasurement === 'halo-fused' ||
						!this.ports
							.panelRuntimes()
							.some((panel) => panel.surface === 'glass' && panel.group.visible));
				if (fuseThisFrame) this.displayOutlineOpacity.value = opacity;
				else if (this.renderMeasurement !== 'halo-mask-only')
					this.outlineQuad.render(this.ports.renderer);
				this.outlineOpacityScale.value = previousOpacity;
			});
		} finally {
			this.outlineOpacityScale.value = opacityBefore;
		}
	}
	renderPanelBlurCaptures(renderTargets: StageRenderTargetSet, forceAll = false) {
		const visibleBlurKeys = forceAll
			? undefined
			: new Set(
					this.ports.panelRuntimes().flatMap((panel, index) => {
						if (!panel.group.visible) return [];
						const needsGlassCapture = panel.surface === 'glass' && Boolean(panel.glass);
						const needsFrostedMinimapCapture =
							panel.surface === 'frosted' &&
							Boolean(this.ports.minimaps().get(index)?.overlayComposite.visible);
						return needsGlassCapture || needsFrostedMinimapCapture
							? [this.getPanelBlurKey(panel.options)]
							: [];
					})
				);
		renderTargets.panelBlurCaptures.forEach(({ target, quad }, blurKey) => {
			if (visibleBlurKeys && !visibleBlurKeys.has(blurKey)) return;
			const size = `${target.width}:${target.height}`;
			if (
				this.renderMeasurement === 'frozen-backdrop' &&
				this.measuredBackdropSeeds.get(target) === size
			)
				return;
			this.ports.renderer.setRenderTarget(target);
			this.ports.renderer.clear();
			quad.render(this.ports.renderer);
			if (this.renderMeasurement === 'frozen-backdrop')
				this.measuredBackdropSeeds.set(target, size);
			this._panelBlurRenderPasses += 1;
		});
	}
	renderStageDisplay() {
		if (!this._stageDisplayQuad) return;
		this.ports.renderer.setRenderTarget(null);
		this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
		this.ports.renderer.setClearColor(0xffffff, 1);
		this.ports.renderer.clear();
		this._stageDisplayQuad.render(this.ports.renderer);
	}
	renderStageContents() {
		this.ports.renderer.clear();
		this.ports.renderer.render(this.ports.backgroundScene, this.ports.camera);
		this.ports.renderer.render(this.ports.tintScene, this.ports.tintCamera);
		this.backgroundCoverOpacity.value = 1 - this.ports.frame().backgroundReveal;
		if (this.backgroundCoverOpacity.value > 0) this.backgroundCover.render(this.ports.renderer);
		if (
			this.ports.frame().stageViewportVisible &&
			(!this.ports.frame().catalogHandoff || this.ports.frame().catalogMotionComplete) &&
			(!this.ports.frame().catalog || this.ports.frame().pageModelReady)
		) {
			this.ports.renderer.clearDepth();
			this.ports.renderer.render(this.ports.scene, this.ports.camera);
			this._stageModelRenderPasses += 1;
		}
	}
	releaseOutline() {
		this.displayOutlineOpacity.value = 0;
		this.displayOutlineMask.value = this.emptyOutlineMask;
		this.outlineMaskModel?.removeFromParent();
		this.outlineMaskMaterial?.dispose();
		this.outlineCompositeMaterial?.dispose();
		this.outlineMaskTarget?.dispose();
		this.outlineMaskModel = undefined;
		this.outlineMaskMaterial = undefined;
		this.outlineCompositeMaterial = undefined;
		this.outlineMaskTarget = undefined;
		this.outlineQuad = undefined;
	}
	resizeOutline(width: number, height: number) {
		this.outlineWidth = width;
		this.outlineHeight = height;
		const scale = this.renderMeasurement === 'halo-half-mask' ? 0.5 : 1;
		this.outlineMaskTarget?.setSize(
			Math.max(1, Math.round(width * scale)),
			Math.max(1, Math.round(height * scale))
		);
		this.outlineMaskValid = false;
		this.outlineTexel.value.set(
			this.ports.interactionTheme().outlineThickness / Math.max(width, 1),
			this.ports.interactionTheme().outlineThickness / Math.max(height, 1)
		);
		this.outlineGlowTexel.value.set(
			(this.ports.interactionTheme().outlineThickness *
				this.ports.interactionTheme().outlineGlowThickness) /
				Math.max(width, 1),
			(this.ports.interactionTheme().outlineThickness *
				this.ports.interactionTheme().outlineGlowThickness) /
				Math.max(height, 1)
		);
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.releaseOutline();
		this.emptyOutlineMask.dispose();
		this.disposeSceneCapture();
		this.backgroundCoverMaterial.dispose();
		this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
		this.foregroundCanvasTarget?.dispose();
		this.foregroundCanvasTarget = undefined;
		this.carouselRearTarget?.dispose();
		this.carouselRearTarget = undefined;
		this.carouselRearCanvas?.remove();
		this.foregroundCanvas?.remove();
	}

	get activeRenderTargets() {
		return this._activeRenderTargets;
	}
	get stageDisplayQuad() {
		return this._stageDisplayQuad;
	}
	get minimapOverlayCapturePasses() {
		return this._minimapOverlayCapturePasses;
	}
	get renderTargetSetCreations() {
		return this._renderTargetSetCreations;
	}
	get renderTargetSetResizes() {
		return this._renderTargetSetResizes;
	}
	get renderTargetSetWarmups() {
		return this._renderTargetSetWarmups;
	}
	get stageModelRenderPasses() {
		return this._stageModelRenderPasses;
	}
	get panelBlurRenderPasses() {
		return this._panelBlurRenderPasses;
	}
	get panelSceneRenderPasses() {
		return this._panelSceneRenderPasses;
	}
	get minimapSceneRenderPasses() {
		return this._minimapSceneRenderPasses;
	}

	/** The facade advances owners first; this command submits the ordered GPU passes. */
	renderFrame(contentOnly: boolean, outline: boolean) {
		this.displayOutlineOpacity.value = 0;
		return withRendererState(this.ports.renderer, () => {
			this.ports.renderer.setCanvasTarget(this.ports.backgroundCanvasTarget);
			if (contentOnly) {
				this.ports.renderer.setRenderTarget(null);
				if (!this.ports.frame().outgoingBackground) {
					this.ports.renderer.setClearColor(0, 0);
					this.ports.renderer.clear();
				}
			} else {
				if (!this._activeRenderTargets) return;
				this.ports.renderer.setRenderTarget(this._activeRenderTargets.sceneCapture);
				this.ports.renderStage();
				this.renderPanelBlurCaptures(this._activeRenderTargets);
				if (outline) this.renderModelOutline(this._activeRenderTargets.sceneCapture, 1);
				this.renderStageDisplay();
				this.renderBackgroundPanels();
			}
			this.renderCarouselRear();
			this.renderForegroundLayer();
		});
	}
}
