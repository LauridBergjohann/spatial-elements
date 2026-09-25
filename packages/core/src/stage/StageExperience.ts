import type {
	CatalogGeometryEndpoint,
	CatalogGeometryDestination
} from '../catalog/catalogGeometryRequest.js';
import { describeRenderTargets } from './renderTargetInventory.js';
import { StageRenderPipeline } from './StageRenderPipeline.js';
import { PanelPresentationController } from './PanelPresentationController.js';
import { MinimapController } from './MinimapController.js';
import type { StagePanelRuntime } from './StagePanelRuntime.js';
import { ProductInteractionController } from './ProductInteractionController.js';

import { ProductPresentationController } from './ProductPresentationController.js';
import { PageBindingController, type CachedStageRect } from './PageBindingController.js';
import { resolveStageProfile } from './resolveStageProfile.js';
import type {
	CatalogParticipantEndpoint,
	CatalogParticipantPair
} from '../catalog/catalogJourney.js';

import { PreparationGate } from '../catalog/PreparationGate.js';
import { EnvironmentCache, type PreparedEnvironment } from '../catalog/EnvironmentCache.js';
import { CatalogPreparation, type PreparedHigh } from '../catalog/CatalogPreparation.js';
import { type TransitionMode } from '../catalog/transitionTiming.js';
import type { ProductLodPair } from '../catalog/productLodPair.js';
import * as THREE from 'three/webgpu';
import { ProductAssetManager } from '../catalog/assets/ProductAssetManager.js';
import { ProductEntityStore } from '../catalog/productAssets.js';
import { CatalogProductLayer } from '../catalog/CatalogProductLayer.js';
import {
	SpatialGeometryCapture,
	type ProductProjection,
	captureProductProjection
} from '../catalog/SpatialGeometryCapture.js';
import { captureCssSurface } from '../catalog/catalogSurfaceCapture.js';
import {
	getCatalogTransitionOpacity,
	normalizeCatalogPresentation,
	RESTING_CATALOG_PRESENTATION,
	type CatalogTransitionPresentation
} from '../catalog/catalogPresentation.js';
import type { ProductOverviewItem, ProductStageConfig } from '../product-detail/types.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

import { uniform } from 'three/tsl';
import type { Mesh, Object3D } from 'three';
import {
	LiquidGlassPanel,
	resolveLiquidGlassPanelOptions,
	type LiquidGlassPanelOptions
} from './LiquidGlassPanel.js';

import { STAGE_PANEL_LAYOUT_EVENT, STAGE_PANEL_VISUAL_EVENT } from './panelContext.js';
import {
	DEFAULT_INTERACTION_THEME,
	DEFAULT_PANELS,
	PANEL_CAMERA_FOV,
	PANEL_CONTENT_Z,
	PRODUCT_CAMERA_FIT_MARGIN,
	ZOOM_FOCUS_NOTIFY_EPSILON
} from './stageConstants.js';
import { getStagePositionFromRect, isViewportRectVisible } from './stageDom.js';
import {
	STAGE_SCROLL_PRIORITY,
	getStageVisualScrollPosition,
	subscribeStageScrollFrame,
	type StageScrollFrame
} from './scrollFrame.js';
import {
	getCameraFitDistance,
	getCameraOrbitDirection,
	getBoxCorners,
	getPanelFocusOpacity,
	getPerspectiveDistance,
	getSequencedMinimapFocus,
	getStageUiFocus,
	getZoomFocusDistanceRange,
	hasPanelGeometryChanged
} from './stageMath.js';
import { type SpaceMouseNavigationUpdate } from './SpaceMouseAdapter.js';
import { disposeMinimapModelMaterials } from './minimap/MinimapModel.js';

import { type CssProjectionQuad } from './minimap/MinimapProjection.js';
import type { StageMinimapState } from './minimap/MinimapState.js';
import { disposeMaterialOnly, getMeshBounds, getMeshMaterials, isMesh } from './stageSceneUtils.js';
import type {
	BackgroundSettings,
	StageCameraSettings,
	StageExperienceOptions,
	StageInteractionTheme,
	StageMinimapOptions,
	StageModelSettings,
	StagePanelTarget,
	StageVisualTestView,
	StageZoomFocusState
} from './stageTypes.js';

export type {
	BackgroundSettings,
	StageCameraSettings,
	StageExperienceOptions,
	StageInteractionTheme,
	StageMinimapOptions,
	StageModelSettings,
	StagePanelSurface,
	StagePanelTarget,
	StageVisualTestView,
	StageViewportTarget,
	StageZoomFocusState
} from './stageTypes.js';

const SCROLL_SETTLE_DELAY = 120;

const VIEWPORT_CULL_MARGIN = 96;

/** Shared spatial state for both WebGPU glass and DOM-backed panel surfaces. */

/**
 * Coordinates the WebGPU product scene, glass panels, accessible CSS3D content,
 * pointer interaction, camera controls, and optional product minimaps.
 *
 * Rendering helpers and deterministic calculations live in focused modules; this
 * class remains the public lifecycle facade consumed by the Svelte component.
 */
export class StageExperience {
	captureGeometry(source: CatalogGeometryEndpoint) {
		switch (source.slot) {
			case 'pdp.dock':
				return this.captureDockPresentation(source.productId);
			case 'pdp.hero':
				return this.captureReturnGeometry(source.productId);
			default:
				return this.captureCatalogGeometry(source.productId);
		}
	}
	prepareGeometryDestination(destination: CatalogGeometryDestination) {
		return destination.kind === 'content'
			? this.prepareReturnDestination()
			: this.prepareCatalogDestination(destination.kind === 'dock');
	}

	private readonly pipeline: StageRenderPipeline;
	private backgroundSettings: BackgroundSettings;
	private pageBackground = '#ffffff';
	private hdr: string;
	private glb: string;
	private lodPair?: ProductLodPair;
	private get lowModel() {
		return this.presentation.lowModel;
	}
	private get referenceBounds() {
		return this.presentation.referenceBounds;
	}
	private get highInstance() {
		return this.presentation.highInstance;
	}
	private get highPose() {
		return this.presentation.highPose;
	}
	private get refinement() {
		return this.presentation.refinement;
	}
	private get refinementState() {
		return this.presentation.refinementState;
	}
	private get refinementFrames() {
		return this.presentation.refinementFrames;
	}
	private modelSettings: StageModelSettings;
	private cameraSettings: StageCameraSettings;
	private excludedMeshNames: ReadonlySet<string>;
	private readonly interactionTheme: StageInteractionTheme;
	private readonly pageBinding = new PageBindingController();
	private get panelTargets() {
		return this.pageBinding.panels;
	}
	private get viewportTarget() {
		return this.pageBinding.viewport;
	}
	private readonly panels: PanelPresentationController;
	private readonly minimapController: MinimapController;
	private readonly interaction: ProductInteractionController;
	private readonly spaceMouseEnabled: boolean;
	private fallbackPanelOptions: LiquidGlassPanelOptions[];
	private readonly catalog: boolean;
	private catalogLayer?: CatalogProductLayer;
	private catalogHandoff = false;
	private catalogMotionComplete = false;
	private catalogLayerAnimating = false;
	private catalogPresentation: CatalogTransitionPresentation = { ...RESTING_CATALOG_PRESENTATION };
	private pageModelReady = false;
	private readonly preparationGate = new PreparationGate();
	/** Optional High build/warm must not compete with required Low destination binding. */
	private readonly detailPreparationGate = new PreparationGate();
	readonly assets = new ProductAssetManager({ preparationGate: this.preparationGate });
	private readonly presentation = new ProductPresentationController(this.assets, () =>
		this.requestRender()
	);
	private environments!: EnvironmentCache;
	private preparation!: CatalogPreparation;
	private get pagePreparation() {
		return this.presentation.readiness.entry;
	}
	private get catalogMode() {
		return this.presentation.readiness.mode;
	}
	private get catalogBlend() {
		return this.presentation.catalogBlend;
	}
	private get returnBlend() {
		return this.presentation.returnBlend;
	}
	private spatialCapture?: SpatialGeometryCapture;
	private exitingMinimaps: {
		capture: SpatialGeometryCapture;
		minimap: StageMinimapState;
		opacity: number;
		ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
		ringOpacity: number;
	}[] = [];
	private adoptedForward = false;
	private returnProduct?: string;
	private contentSecondaries: {
		source: CatalogParticipantEndpoint;
		capture: SpatialGeometryCapture;
		target?: ProductProjection;
	}[] = [];
	private returnProjection?: ReturnType<CatalogProductLayer['getDestinationProjection']>;
	private returnProgress = 0;
	private outgoingBackground = false;
	private catalogDockTarget = false;
	private get deferDetailPreparation() {
		return this.presentation.readiness.deferred;
	}
	private heroIsPresented = () => true;
	private get backgroundPending() {
		return this.presentation.readiness.backgroundPending;
	}
	private get catalogBackgroundPrepared() {
		return this.presentation.readiness.backgroundPrepared;
	}
	private get backgroundApplied() {
		return this.presentation.readiness.backgroundApplied;
	}

	readonly products = new ProductEntityStore();
	private get assetInstance() {
		return this.presentation.assetInstance;
	}
	private get loadedModelKey() {
		return this.presentation.modelKey;
	}

	private readonly scene = new THREE.Scene();
	private readonly backgroundScene = new THREE.Scene();
	private readonly tintScene = new THREE.Scene();
	private readonly panelScene = new THREE.Scene();
	private get minimapScene() {
		return this.minimapController.scene;
	}
	private readonly panelContentScene = new THREE.Scene();

	private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
	private readonly tintCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	private readonly panelCamera = new THREE.PerspectiveCamera(PANEL_CAMERA_FOV, 1, 0.1, 5000);
	private readonly renderer = new THREE.WebGPURenderer({ antialias: true });
	private readonly backgroundCanvasTarget = this.renderer.getCanvasTarget();
	private readonly backgroundCanvas = this.renderer.domElement;
	private readonly cssRenderer = new CSS3DRenderer();
	private readonly flatPanelLayer = document.createElement('div');
	private readonly nativePanelLayer = document.createElement('div');

	private get panelRuntimes() {
		return this.panels.runtimes;
	}
	private get minimaps() {
		return this.minimapController.views;
	}

	private readonly resize = () => this.resizeRenderer();
	private readonly render = () => {
		this.renderRequestId = 0;
		this.renderFrame();
	};

	private readonly visibilityChange = () => {
		if (!document.hidden) this.requestRender();
	};
	private readonly pointerMove = (event: PointerEvent) => this.handlePointerMove(event);
	private readonly pointerLeave = () => this.handlePointerLeave();
	private readonly pointerDown = (event: PointerEvent) => this.handlePointerDown(event);
	private readonly pointerUp = (event: PointerEvent) => this.handlePointerUp(event);
	private readonly wheel = (event: WheelEvent) => this.handleWheel(event);
	private readonly scroll = (frame: StageScrollFrame) => this.handleScrollFrame(frame);
	private readonly finishScroll = () => {
		this.scrollEndTimer = 0;
		if (this.disposed) return;

		this.scrollActive = false;
		this.pipeline.setScrollRenderQuality(false);
		this.panelMeasurementsDirty = true;
		this.viewportMeasurementDirty = true;
		this.layoutDirty = true;
		this.requestRender();
	};
	private readonly requestPanelSync = () => {
		this.layoutDirty = true;
		this.panelMeasurementsDirty = true;
		this.viewportMeasurementDirty = true;
		this.requestRender();
	};
	private readonly requestPanelVisualSync = () => this.requestRender();
	private get pointer() {
		return this.interaction.pointer;
	}

	private readonly onZoomFocusChange?: (state: StageZoomFocusState) => void;
	private readonly viewportFrame = new THREE.Vector4(0, 0, 1, 1);
	private readonly viewportLayoutSize = new THREE.Vector2(1, 1);
	private readonly fittedViewportMetrics = new THREE.Vector4();
	private readonly modelBounds = new THREE.Box3();

	private get controls() {
		return this.interaction.controls;
	}

	private get spaceMouseMoving() {
		return this.interaction.spaceMouseMoving;
	}
	private environmentTarget?: THREE.RenderTarget;
	private get model() {
		return this.presentation.model;
	}

	private get modelHover() {
		return this.interaction.modelHover;
	}
	private get modelInteractionActive() {
		return this.interaction.modelInteractionActive;
	}

	private tintGeometry?: THREE.PlaneGeometry;
	private disposed = false;
	private tintMaterial?: THREE.MeshBasicMaterial;
	private readonly catalogBackgroundReveal = uniform(1);

	private stopScrollFrames?: () => void;

	private renderRequestId = 0;
	private renderInvalidated = true;
	private animationActive = false;
	private scrollActive = false;
	private scrollEndTimer = 0;
	private lastInteractionTime = performance.now();
	private layoutDirty = true;
	private panelMeasurementsDirty = true;
	private viewportMeasurementDirty = true;
	private stageViewportVisible = true;
	private get visiblePanelCount() {
		return this.panels.visiblePanels;
	}
	private get visibleMinimapCount() {
		return this.panels.visibleMinimaps;
	}

	private get focusCloseDistance() {
		return this.interaction.focusCloseDistance;
	}
	private modelRadius = 1;
	private panelFocus = 0;
	private panelUiFocus = 0;
	private minimapFocus = 0;
	private currentScrollX = 0;
	private currentScrollY = 0;
	private lastScrollY = 0;
	private lastReportedZoomFocus: StageZoomFocusState = {
		focus: -1,
		uiFocus: -1,
		uiOpacity: -1,
		minimapFocus: -1
	};
	private get zoomResetTargetDistance() {
		return this.interaction.zoomResetTargetDistance;
	}

	private get wheelZoomTargetDistance() {
		return this.interaction.wheelZoomTargetDistance;
	}
	private get initialCameraPosition() {
		return this.interaction.initialCameraPosition;
	}
	private get initialControlsTarget() {
		return this.interaction.initialControlsTarget;
	}
	private readonly initialCameraWorldQuaternion = new THREE.Quaternion();
	private readonly initialModelWorldQuaternion = new THREE.Quaternion();
	private get initialCameraFov() {
		return this.interaction.initialCameraFov;
	}
	private get initialViewCaptured() {
		return this.interaction.initialViewCaptured;
	}
	private get viewResetActive() {
		return this.interaction.viewResetActive;
	}

	/**
	 * Creates a stage lifecycle facade for one container.
	 *
	 * @param container - Element that receives the WebGPU and CSS3D renderer layers.
	 * @param options - Scene assets, panel registrations, viewport anchor, and callbacks.
	 */
	constructor(
		private readonly container: HTMLElement,
		options: StageExperienceOptions = {}
	) {
		if (options.dracoDecoderPath) this.assets.setDracoDecoderPath(options.dracoDecoderPath);
		this.interaction = new ProductInteractionController({
			camera: this.camera,
			canvas: this.backgroundCanvas,
			container,
			cssRoot: this.cssRenderer.domElement,
			requestRender: () => this.requestRender(),
			markActivity: () => {
				this.lastInteractionTime = performance.now();
			},
			updateProjection: () => this.updateStageCameraProjection(),
			readGeometry: () => ({
				poseOwner:
					this.catalogHandoff || this.spatialCapture
						? 'transition'
						: this.catalog && !this.viewportTarget
							? 'none'
							: 'page',
				visible: this.stageViewportVisible,
				viewport: this.viewportFrame,
				bounds: this.modelBounds
			})
		});
		this.minimapController = new MinimapController({
			renderer: this.renderer,
			camera: this.camera,
			panelCamera: this.panelCamera,
			panelScene: this.panelScene,
			panel: (index) => this.panelRuntimes[index],
			target: (index) => this.panelTargets[index],
			product: () => ({
				model: this.model,
				low: this.lowModel,
				camera: this.cameraSettings,
				restCamera: this.initialCameraWorldQuaternion,
				restModel: this.initialModelWorldQuaternion,
				hasControls: Boolean(this.controls),
				referenceTarget: this.getZoomReferenceTarget()
			}),
			frame: () => ({
				hovering: this.modelHover,
				interacting: this.modelInteractionActive,
				scrolling: this.scrollActive
			}),
			environment: () => this.environmentTarget,
			capture: () => this.pipeline.activeRenderTargets,
			blurTexture: (options) => this.pipeline.getPanelBlurTexture(options),
			transitionOpacity: (panel) => this.getPanelTransitionOpacity(panel),
			pixelRatio: () => this.pipeline.getFullPixelRatio(),
			includeMesh: (mesh) => this.isProductMesh(mesh)
		});
		this.panels = new PanelPresentationController({
			camera: this.panelCamera,
			contentScene: this.panelContentScene,
			flatLayer: this.flatPanelLayer,
			nativeLayer: this.nativePanelLayer,
			registrations: () => this.panelTargets,
			minimaps: () => this.minimaps,
			updateMinimap: (minimap, focus) => this.minimapController.updateMinimapState(minimap, focus),
			frame: () => ({
				presentation: this.catalogPresentation,
				minimapFocus: this.minimapFocus,
				uiFocus: this.panelUiFocus,
				pointer: this.pointer
			}),
			visible: (index) => this.isPanelTargetVisible(index),
			transitionOpacity: (panel) => this.getPanelTransitionOpacity(panel),
			requestRender: () => this.requestRender()
		});
		const reportDeviceLost = this.renderer.onDeviceLost.bind(this.renderer);
		this.renderer.onDeviceLost = (info) => {
			reportDeviceLost(info);
			if (!this.disposed)
				queueMicrotask(() => {
					if (!this.disposed) options.onDeviceLost?.();
				});
		};

		const profile = resolveStageProfile(options);
		this.backgroundSettings = profile.background;
		this.catalog = options.catalog ?? false;
		this.hdr = profile.hdr;
		this.glb = profile.glb;
		this.lodPair = profile.lodPair;
		this.modelSettings = profile.model;
		this.cameraSettings = profile.camera;
		this.excludedMeshNames = new Set(this.modelSettings.excludeMeshes ?? []);
		this.interactionTheme = { ...DEFAULT_INTERACTION_THEME, ...options.interactionTheme };
		this.pageBinding.attach(options.panels, options.viewport);
		this.spaceMouseEnabled = options.enableSpaceMouse ?? true;
		this.fallbackPanelOptions = this.panelTargets.length
			? this.panelTargets
					.filter(
						(panel) =>
							panel.surface === 'glass' || (panel.surface === 'frosted' && Boolean(panel.minimap))
					)
					.map((panel) => panel.options)
			: this.catalog
				? []
				: DEFAULT_PANELS;

		this.pipeline = new StageRenderPipeline({
			pageBackground: (this.pageBackground = options.pageBackground ?? '#ffffff'),
			renderer: this.renderer,
			container: this.container,
			backgroundCanvas: this.backgroundCanvas,
			backgroundCanvasTarget: this.backgroundCanvasTarget,
			scene: this.scene,
			backgroundScene: this.backgroundScene,
			tintScene: this.tintScene,
			panelScene: this.panelScene,
			camera: this.camera,
			panelCamera: this.panelCamera,
			tintCamera: this.tintCamera,
			panelRuntimes: () => this.panelRuntimes,
			minimaps: () => this.minimaps,
			minimapScene: () => this.minimapScene,
			catalogLayer: () => this.catalogLayer,
			spatialCapture: () => this.spatialCapture,
			exitingMinimaps: () => this.exitingMinimaps,
			contentSecondaries: () => this.contentSecondaries,
			fallbackPanelOptions: () => this.fallbackPanelOptions,
			interactionTheme: () => this.interactionTheme,
			frame: () => ({
				outgoingBackground: this.outgoingBackground,
				catalogDockTarget: this.catalogDockTarget,
				catalogHandoff: this.catalogHandoff,
				catalogMotionComplete: this.catalogMotionComplete,
				stageViewportVisible: this.stageViewportVisible,
				modelHover: this.modelHover,
				modelInteractionActive: this.modelInteractionActive,
				catalog: this.catalog,
				pageModelReady: this.pageModelReady,
				backgroundReveal: this.catalogBackgroundReveal.value
			}),
			renderStage: () => this.renderStage(),
			renderMinimapBlur: (view) => this.minimapController.renderMinimapBlur(view),
			renderMinimapPanelCapture: (view) => this.minimapController.renderMinimapPanelCapture(view),
			getPanelTransitionOpacity: (panel) => this.getPanelTransitionOpacity(panel),
			isInteractionMesh: (mesh) => this.isInteractionMesh(mesh)
		});

		this.onZoomFocusChange = options.onZoomFocusChange;
	}

	/** Loads GPU resources and assets, creates panels, and starts the render loop. */
	async init() {
		if (!navigator.gpu) {
			throw new Error('WebGPU is not available in this browser');
		}

		this.pipeline.configureRenderer();
		await this.renderer.init();
		this.environments = new EnvironmentCache(this.renderer, this.preparationGate);
		this.preparation = new CatalogPreparation(
			this.assets,
			this.environments,
			this.detailPreparationGate,
			(high, environment, signal) => this.warmPreparedHigh(high, environment, signal),
			() => this.requestRender()
		);
		// Three reports unexpected loss but deliberately ignores device.destroy().
		// A destroyed device is also unusable if our stage has not been disposed.
		const device = (this.renderer.backend as unknown as { device?: GPUDevice }).device;
		void device?.lost.then((info) => {
			if (!this.disposed && info.reason === 'destroyed') {
				this.renderer.onDeviceLost({
					api: 'WebGPU',
					message: info.message,
					reason: info.reason,
					originalEvent: info
				});
			}
		});
		if (this.disposed) {
			this.renderer.dispose();
			return;
		}

		this.backgroundCanvas.className = 'stage-webgpu-background';
		this.container.appendChild(this.backgroundCanvas);
		this.configureCssRenderer();
		this.container.appendChild(this.cssRenderer.domElement);
		this.configureFlatPanelLayer();
		this.container.appendChild(this.flatPanelLayer);
		this.configureNativePanelLayer();
		this.container.appendChild(this.nativePanelLayer);
		this.pipeline.createForegroundCanvas();
		this.interaction.initialize();

		await this.loadEnvironment();
		if (this.disposed) return;
		this.createBackgroundTint();
		//this.createLights();
		if (!this.catalog || this.viewportTarget) await this.loadModel();
		if (this.disposed) return;
		this.pageModelReady = Boolean(this.model);
		if (!this.catalog || this.viewportTarget) this.pipeline.createSceneCapture();
		this.createPanels();
		this.resizeRenderer();
		this.pipeline.warmRenderTargetSets();
		await this.pipeline.prepareZoomEffects();
		if (this.disposed) return;

		this.observePanelTargets();
		const scrollPosition = getStageVisualScrollPosition();
		this.currentScrollX = scrollPosition.scrollX;
		this.currentScrollY = scrollPosition.scrollY;
		this.lastScrollY = this.currentScrollY;

		window.addEventListener('resize', this.resize);
		this.stopScrollFrames = subscribeStageScrollFrame(this.scroll, STAGE_SCROLL_PRIORITY.stage);
		window.addEventListener(STAGE_PANEL_LAYOUT_EVENT, this.requestPanelSync);
		window.addEventListener(STAGE_PANEL_VISUAL_EVENT, this.requestPanelVisualSync);
		window.addEventListener('pointermove', this.pointerMove);
		window.addEventListener('pointerup', this.pointerUp);
		window.addEventListener('pointercancel', this.pointerUp);
		window.addEventListener('pointerleave', this.pointerLeave);
		window.addEventListener('blur', this.pointerLeave);
		document.addEventListener('visibilitychange', this.visibilityChange);
		this.backgroundCanvas.addEventListener('pointerdown', this.pointerDown, { capture: true });
		this.backgroundCanvas.addEventListener('wheel', this.wheel, {
			capture: true,
			passive: false
		});
		if (this.spaceMouseEnabled) void this.initializeSpaceMouse();
		this.requestRender();
	}

	/** Releases listeners, DOM layers, scene resources, controls, and GPU allocations. */
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.releaseSpatialCapture();
		this.container.removeAttribute('data-stage-scroll-rendering');

		window.removeEventListener('resize', this.resize);
		this.stopScrollFrames?.();
		this.stopScrollFrames = undefined;
		window.removeEventListener(STAGE_PANEL_LAYOUT_EVENT, this.requestPanelSync);
		window.removeEventListener(STAGE_PANEL_VISUAL_EVENT, this.requestPanelVisualSync);
		window.removeEventListener('pointermove', this.pointerMove);
		window.removeEventListener('pointerup', this.pointerUp);
		window.removeEventListener('pointercancel', this.pointerUp);
		window.removeEventListener('pointerleave', this.pointerLeave);
		window.removeEventListener('blur', this.pointerLeave);
		document.removeEventListener('visibilitychange', this.visibilityChange);
		this.backgroundCanvas.removeEventListener('pointerdown', this.pointerDown, {
			capture: true
		});
		this.backgroundCanvas.removeEventListener('wheel', this.wheel, { capture: true });
		if (this.renderRequestId) cancelAnimationFrame(this.renderRequestId);
		this.renderRequestId = 0;
		if (this.scrollEndTimer) window.clearTimeout(this.scrollEndTimer);
		this.scrollEndTimer = 0;
		this.interaction.dispose();
		this.releasePage();
		this.tintGeometry?.dispose();
		this.tintMaterial?.dispose();
		this.pipeline.disposeSceneCapture();
		this.pageBinding.clearMeasurements();
		this.pageBinding.viewportRect = undefined;
		this.releaseModel();
		this.catalogLayer?.dispose();
		this.assets.dispose();
		this.products.clear();
		this.preparationGate.setPaused(false);
		this.preparation?.dispose();
		this.detailPreparationGate.setPaused(false);
		this.presentation.disposeEnvironment();
		this.environments?.dispose();
		this.pipeline.dispose();
		this.renderer.dispose();
		this.backgroundCanvas.remove();

		this.cssRenderer.domElement.remove();
		this.flatPanelLayer.remove();
		this.nativePanelLayer.remove();
	}

	/** Page DOM is a replaceable binding, not the owner of the device or product cache. */
	releasePage() {
		this.pageBinding.invalidate();
		this.pageModelReady = false;
		this.presentation.cancelRequests();
		this.minimapController.dispose();
		this.panels.release();
		this.pageBinding.release();
		this.fallbackPanelOptions = [];
		this.interaction.releasePage();
		this.requestPanelSync();
	}

	/** A failed page binding owns no model or panels; the device/cache remain reusable. */
	discardFailedPage() {
		this.releasePage();
		this.releaseModel();
		this.pipeline.disposeSceneCapture();
		this.finishCatalogGeometry();
		// With no viewport the catalog path clears its overlay instead of retaining
		// the last transition frame while the semantic page shows its poster.
		this.renderFrame(true);
	}

	private rememberDomHome(element: HTMLElement) {
		return this.panels.rememberDomHome(element);
	}

	resolvePanelSurface(element: HTMLElement) {
		return (
			this.panelTargets.find(
				(target) => target.content === element || target.content.contains(element)
			)?.frame ??
			element.closest<HTMLElement>('[data-catalog-card]') ??
			element
		);
	}

	capturePanelSurface(element: HTMLElement) {
		if (element.hasAttribute('data-catalog-dock-surface')) {
			const header = element.closest<HTMLElement>('[data-product-sticky-header]');
			if (header) return captureCssSurface(element, header, '::before');
		}
		const panel = this.panelTargets.find(
			(target) => target.content === element || target.content.contains(element)
		);
		if (!panel) return captureCssSurface(element);
		const surface = panel.surfaceElement;
		const rect = surface.getBoundingClientRect();
		const bounds =
			rect.width > 0 && rect.height > 0 && getComputedStyle(surface).visibility !== 'hidden'
				? surface
				: panel.frame;
		const paint = captureCssSurface(bounds, surface, '::before');
		const runtime = this.panelRuntimes[this.panelTargets.indexOf(panel)];
		if (runtime && !panel.minimap && runtime.domRenderMode === 'spatial') {
			runtime.group.updateWorldMatrix(true, false);
			const { width, height } = runtime.options;
			const corners = [
				[-width / 2, height / 2],
				[width / 2, height / 2],
				[width / 2, -height / 2],
				[-width / 2, -height / 2]
			].map(([x, y]) => {
				const point = new THREE.Vector3(x, y, 0)
					.applyMatrix4(runtime.group.matrixWorld)
					.project(this.panelCamera);
				return new THREE.Vector2(
					((point.x + 1) * innerWidth) / 2,
					((1 - point.y) * innerHeight) / 2
				);
			}) as unknown as CssProjectionQuad;
			return { ...paint, corners };
		}
		return paint;
	}

	/** Project authored DOM depth inside the actual CSS3D object, without flattening its type. */
	capturePanelElement(element: HTMLElement) {
		const runtime = this.panelRuntimes.find(
			(panel) => panel.domRenderMode === 'spatial' && panel.content?.element.contains(element)
		);
		const content = runtime?.content;
		if (!content) return;
		const root = content.element;
		const size = (node: HTMLElement) => ({
			width: Number.parseFloat(getComputedStyle(node).width) || node.offsetWidth,
			height: Number.parseFloat(getComputedStyle(node).height) || node.offsetHeight
		});
		const { width, height } = size(element);
		const rootSize = size(root);
		if (!width || !height || !rootSize.width || !rootSize.height) return;
		content.updateWorldMatrix(true, false);
		const project = (x: number, y: number) => {
			let point = new DOMPoint(x, y, 0);
			for (let node: HTMLElement | null = element; node && node !== root;) {
				const style = getComputedStyle(node);
				const origin = style.transformOrigin.split(' ').map(Number.parseFloat);
				const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
				point = new DOMPoint(
					point.x - origin[0],
					point.y - origin[1],
					point.z - (origin[2] || 0)
				).matrixTransform(matrix);
				point.x += origin[0] + node.offsetLeft;
				point.y += origin[1] + node.offsetTop;
				point.z += origin[2] || 0;
				node = node.offsetParent as HTMLElement | null;
				if (!node || (node !== root && !root.contains(node))) return;
			}
			const projected = new THREE.Vector3(
				point.x - rootSize.width / 2,
				rootSize.height / 2 - point.y,
				point.z
			)
				.applyMatrix4(content.matrixWorld)
				.project(this.panelCamera);
			return { x: ((projected.x + 1) * innerWidth) / 2, y: ((1 - projected.y) * innerHeight) / 2 };
		};
		const corners = [project(0, 0), project(width, 0), project(width, height), project(0, height)];
		if (corners.some((point) => !point)) return;
		return { width, height, corners: corners as unknown as CssProjectionQuad };
	}

	async updatePage(options: StageExperienceOptions) {
		if (this.disposed) return;
		this.pageBackground = options.pageBackground ?? '#ffffff';
		this.pipeline.setPageBackground(this.pageBackground);
		this.catalogLayer?.setPageBackground(this.pageBackground);
		this.releasePage();
		const generation = this.pageBinding.token;
		const profile = resolveStageProfile(options, { glb: this.glb, hdr: this.hdr });
		this.pageBinding.attach(options.panels, options.viewport);
		this.hdr = profile.hdr;
		this.backgroundSettings = profile.background;
		this.presentation.readiness.reset(Boolean(options.deferDetailPreparation));
		if (this.catalogPresentation.active) this.catalogBackgroundReveal.value = 0;
		this.heroIsPresented = options.heroIsPresented ?? (() => true);
		if (this.catalog && this.viewportTarget && !this.deferDetailPreparation) {
			this.presentation.readiness.attach(
				this.preparation.prepare({
					hdr: this.hdr,
					background: this.backgroundSettings,
					glb: options.glb ?? this.glb,
					lodPair: options.lodPair,
					model: options.model
				})
			);
		} else {
			this.presentation.readiness.attach(undefined);
			this.preparation.dispose();
			if (!this.deferDetailPreparation) await this.loadEnvironment();
		}
		if (this.disposed || !this.pageBinding.isCurrent(generation)) return;
		this.fallbackPanelOptions = this.panelTargets
			.filter((panel) => panel.surface === 'glass' || Boolean(panel.minimap))
			.map((panel) => panel.options);
		const requestedModelKey = profile.modelKey;
		this.lodPair = profile.lodPair;
		this.glb = profile.glb;
		this.modelSettings = profile.model;
		this.cameraSettings = profile.camera;
		this.excludedMeshNames = new Set(this.modelSettings.excludeMeshes ?? []);
		if (this.viewportTarget && (this.loadedModelKey !== requestedModelKey || !this.model))
			await this.loadModel();
		if (!this.viewportTarget) this.releaseModel();
		if (this.disposed || generation !== this.pageBinding.token) return;
		if (this.viewportTarget && this.model) this.fitModelCamera();
		this.pageModelReady = Boolean(this.viewportTarget && this.model);
		if (this.pageModelReady) this.startHighRequest();
		this.pipeline.disposeSceneCapture();
		if (!this.catalog || this.viewportTarget) this.pipeline.createSceneCapture();
		this.createPanels();
		this.observePanelTargets();
		this.resizeRenderer();
		this.renderFrame(true);
		await this.pipeline.prepareZoomEffects();
		if (this.disposed || !this.pageBinding.isCurrent(generation)) return;
		// A submitted Low/panel frame is not yet GPU-ready. Drain the required binding work
		// before the navigation bridge starts motion, especially on the first cold PDP.
		const device = (this.renderer.backend as unknown as { device?: GPUDevice }).device;
		await device?.queue.onSubmittedWorkDone();
		if (this.disposed || generation !== this.pageBinding.token) return;
		if (this.spaceMouseEnabled && this.viewportTarget) void this.initializeSpaceMouse();
	}

	setCatalogProducts(brandId: string, items: ProductOverviewItem[]) {
		this.catalogLayer ??= new CatalogProductLayer(this.assets, () => this.requestRender());
		this.catalogLayer.setPageBackground(this.pageBackground);
		this.catalogLayer.setExitOpacity(
			this.returnProduct
				? this.catalogPresentation.enterOpacity
				: this.catalogPresentation.exitOpacity,
			this.catalogPresentation.active
		);
		return this.catalogLayer.setProducts(brandId, items);
	}

	setCatalogTransitionPresentation(state: CatalogTransitionPresentation) {
		this.catalogPresentation = normalizeCatalogPresentation(state);
		for (const entry of this.exitingMinimaps) {
			this.setMinimapDisplayModelOpacity(entry.minimap, entry.opacity * state.exitOpacity);
			entry.ring.material.opacity = entry.ringOpacity * state.exitOpacity;
		}
		if (this.presentation.readiness.acceptsClockOpacity())
			this.catalogBackgroundReveal.value = this.catalogPresentation.active
				? (this.catalogPresentation.backgroundOpacity ?? this.catalogPresentation.enterOpacity)
				: 1;
		if (this.catalogMode === 'synchronous' && this.catalogHandoff) {
			this.catalogLayer?.setHighHandoff(
				this.highPose,
				this.catalogBlend,
				state.geometryOpacity ?? 0,
				this.pagePreparation?.environment.value?.target.texture
			);
			if (this.catalogBlend && (state.geometryOpacity ?? 0) > 0 && !this.catalogMotionComplete) {
				this.presentation.markRefinement('refining', this.catalogBlend.frames);
			}
		}
		this.catalogLayer?.setExitOpacity(
			this.returnProduct
				? this.catalogPresentation.enterOpacity
				: this.catalogPresentation.exitOpacity,
			this.catalogPresentation.active
		);
		if (this.returnProjection)
			this.spatialCapture?.setTarget(
				this.returnProjection,
				this.returnProgress,
				state.geometryOpacity ?? 0
			);
		if (this.outgoingBackground)
			this.backgroundCanvas.style.opacity = String(state.active ? state.exitOpacity : 0);
		this.requestRender();
	}

	/** Reports actual applied GPU alpha for browser verification without layout or style reads. */
	getCatalogPresentation() {
		const triangles = (root?: Object3D) => {
			let count = 0;
			root?.traverse((child) => {
				if (isMesh(child))
					count +=
						(child.geometry.index?.count ?? child.geometry.getAttribute('position')?.count ?? 0) /
						3;
			});
			return count;
		};
		return {
			mode: this.catalogMode ?? null,
			exitingMinimaps: this.exitingMinimaps.map(({ capture, minimap }) => ({
				...capture.getSnapshot(),
				opacity: minimap.displayOpacity
			})),
			preparation: this.preparation?.current
				? {
						background: this.preparation.current.backgroundState,
						high: this.preparation.current.highState,
						timings: this.preparation.current.timings,
						key: this.preparation.current.key
					}
				: null,
			channels: { ...this.catalogPresentation },
			backgroundReveal: this.catalogBackgroundReveal.value,
			backgroundPrepared: this.catalogBackgroundPrepared,
			handoffPoint: this.getCatalogGeometryPoint(),
			representations: {
				retainedBlendTargets: this.returnBlend?.targetCount ?? 0,
				state: this.refinementState,
				hero: this.model ? (this.refinementState === 'high' ? 'high' : 'low') : null,
				minimap: this.minimaps.size ? 'low' : null,
				frames: this.refinementFrames,
				temporaryTargets: this.refinement?.targetCount ?? 0,
				heroTriangles: triangles(
					this.refinementState === 'high' ? this.highPose : this.assetInstance?.scene
				),
				minimapTriangles: [...this.minimaps.values()].map((minimap) =>
					triangles(minimap.displayModel)
				),
				lowUrl: this.lodPair?.low.url ?? this.glb,
				highUrl: this.lodPair?.high.url ?? null
			},
			model: {
				loadedKey: this.loadedModelKey ?? null,
				ready: this.pageModelReady,
				handoff: this.catalogHandoff
			},
			panels: this.panelRuntimes.map((panel) => {
				const backdrop = panel.glass?.group.children.find(
					(child) => isMesh(child) && child.renderOrder === 3
				);
				return {
					group: panel.transitionGroup ?? null,
					surface: panel.surface,
					transitionOpacity: this.getPanelTransitionOpacity(panel),
					glassOpacity:
						backdrop && isMesh(backdrop) ? (getMeshMaterials(backdrop)[0]?.opacity ?? null) : null,
					visible: panel.group.visible
				};
			}),
			minimaps: [...this.minimaps.values()].map((minimap) => ({
				group: this.panelRuntimes[minimap.panelIndex]?.transitionGroup ?? null,
				transitionOpacity: this.getPanelTransitionOpacity(this.panelRuntimes[minimap.panelIndex]),
				modelOpacity: minimap.displayOpacity,
				materialOpacities: minimap.displayMaterials.map(({ material }) => material.opacity),
				ringOpacity: minimap.overlayRing.material.opacity,
				compositeOpacity: minimap.overlayVisibility.value,
				visible: minimap.layer.visible
			}))
		};
	}

	/** Exercises the actual WebGPU loss callback; exposed only by the opt-in test controller. */
	loseDeviceForTest() {
		const device = (this.renderer.backend as unknown as { device?: GPUDevice }).device;
		if (!device) throw new Error('A native WebGPU device is required');
		device.destroy();
	}

	private getPanelTransitionOpacity(panel?: StagePanelRuntime) {
		return getCatalogTransitionOpacity(this.catalogPresentation, panel?.transitionGroup);
	}

	private captureCatalogGeometry(productId: string) {
		this.catalogMotionComplete = false;
		this.catalogHandoff = this.catalogLayer?.capture(productId) ?? false;
		if (this.catalogHandoff) this.detailPreparationGate.setPaused(true);
		return this.catalogHandoff;
	}

	/** Content-to-content motion owns only the prepared Low representation. */
	captureContentGeometry(productId: string, secondary: CatalogParticipantEndpoint[] = []) {
		if (!this.captureCatalogGeometry(productId)) return false;
		if (!this.adoptCatalogPresentation({ productId, kind: 'content' })) return false;
		this.outgoingBackground = false;
		for (const source of secondary.slice(0, 4)) {
			if (!this.catalogLayer?.capture(source.productId, source.occurrence)) continue;
			const moving = this.catalogLayer.detachHandoff();
			if (!moving) continue;
			const environment = this.environments.pinTexture(moving.environment);
			const capture = new SpatialGeometryCapture(moving.model, moving.projection, {
				environment: moving.environment,
				environmentIntensity: moving.projection.environmentIntensity,
				referencePoint: moving.referencePoint,
				lights: [],
				release: () => {
					environment?.release();
					moving.release();
				}
			});
			this.contentSecondaries.push({ source, capture });
		}
		return true;
	}

	prepareContentParticipants(pairs: CatalogParticipantPair[]) {
		const retained: typeof this.contentSecondaries = [];
		const targets: CatalogParticipantEndpoint[] = [];
		const prepared: CatalogParticipantPair[] = [];
		for (const entry of this.contentSecondaries) {
			const pair = pairs.find(
				(p) =>
					p.source.productId === entry.source.productId &&
					p.source.occurrence === entry.source.occurrence
			);
			const target =
				pair &&
				this.catalogLayer?.getDestinationProjection(pair.target.productId, pair.target.occurrence);
			if (!target || !pair) {
				entry.capture.dispose();
				continue;
			}
			entry.target = target;
			retained.push(entry);
			targets.push(pair.target);
			prepared.push(pair);
		}
		this.contentSecondaries = retained;
		this.catalogLayer?.setDestinationOccurrences(targets);
		this.presentation.readiness.useSynchronousMotion();
		this.preparationGate.setPaused(true);
		this.requestRender();
		return prepared;
	}

	/** Rebase matching neighbours from their submitted pose; release unmatched owners once. */
	adoptContentParticipants(pairs: CatalogParticipantPair[]) {
		this.contentSecondaries = this.contentSecondaries.filter((entry) => {
			const pair = pairs.find(
				(pair) =>
					pair.source.productId === entry.source.productId &&
					pair.source.occurrence === entry.source.occurrence
			);
			if (!pair) {
				entry.capture.dispose();
				return false;
			}
			entry.capture.freeze();
			entry.source = pair.target;
			entry.target = undefined;
			return true;
		});
		this.catalogLayer?.setDestinationOccurrences([]);
	}

	promoteContentParticipant(source: CatalogParticipantEndpoint) {
		const entry = this.contentSecondaries.find(
			(entry) =>
				entry.source.productId === source.productId && entry.source.occurrence === source.occurrence
		);
		if (!entry) return false;
		this.spatialCapture?.dispose();
		this.spatialCapture = entry.capture;
		this.contentSecondaries = this.contentSecondaries.filter((candidate) => candidate !== entry);
		this.returnProduct = source.productId;
		this.catalogLayer?.setDestinationProduct(source.productId);
		return true;
	}

	getCatalogGeometryPoint() {
		return this.spatialCapture?.getPoint() ?? this.catalogLayer?.getHandoffPoint() ?? null;
	}

	/** Lease the last submitted product frame before another page binding can release it. */
	adoptCatalogPresentation(destination: CatalogGeometryDestination) {
		const { productId } = destination;
		const reverse = destination.kind === 'content';
		if (!this.spatialCapture) {
			const moving = this.catalogLayer?.detachHandoff();
			if (moving) {
				const high = this.highInstance;
				const highPose = this.highPose;
				const blend = this.catalogBlend;
				const transferredHigh = this.presentation.takeHigh();
				const environment = this.environments.pinTexture(moving.environment);
				const highEnvironment = this.environments.pinTexture(moving.highEnvironment ?? null);
				const generation = this.pageBinding.token;
				const parent = highPose?.parent;
				if (highPose) moving.model.add(highPose);
				this.spatialCapture = new SpatialGeometryCapture(moving.model, moving.projection, {
					environment: moving.environment,
					highEnvironment: moving.highEnvironment,
					environmentIntensity: moving.projection.environmentIntensity,
					referencePoint: moving.referencePoint,
					lights: [],
					high: highPose,
					blend,
					highWeight: blend ? (this.catalogPresentation.geometryOpacity ?? 0) : 0,
					release: () => {
						environment?.release();
						highEnvironment?.release();
						if (!this.disposed && this.pageBinding.token === generation && parent && highPose) {
							parent.add(highPose);
							if (transferredHigh) this.presentation.restoreHigh(transferredHigh);
							for (const child of parent.children) child.visible = child === highPose;
							moving.release();
							return false;
						}
						highPose?.removeFromParent();
						transferredHigh?.overrides.forEach(disposeMaterialOnly);
						high?.dispose();
						moving.release();
					}
				});
			} else if (
				!(this.catalogDockTarget
					? this.captureDockPresentation(productId)
					: this.captureHeroPresentation())
			)
				return false;
		}
		this.spatialCapture!.freeze();
		this.returnProjection = undefined;
		this.returnProduct = reverse ? productId : undefined;
		this.adoptedForward = !reverse;
		this.catalogLayer?.setDestinationProduct(reverse ? productId : undefined);
		this.catalogMotionComplete = false;
		this.catalogHandoff = true;
		this.detailPreparationGate.setPaused(true);
		// Required Low binding must remain possible while the successor resolves.
		this.preparationGate.setPaused(false);
		if (reverse) {
			this.captureExitingMinimaps();
			if (this.pipeline.freezeBackground()) this.outgoingBackground = true;
		} else this.outgoingBackground = false;
		return true;
	}

	/** Transfer already prepared hero resources before releasePage/cancelHighRequest can dispose them. */
	captureHeroPresentation() {
		if (!this.model || !this.pageModelReady || !this.stageViewportVisible || this.spatialCapture)
			return false;
		const highWeight =
			this.refinementState === 'high' ? 1 : (this.refinement?.presentedProgress ?? 0);
		const blend = this.returnBlend ?? this.catalogBlend ?? this.refinement;
		if (highWeight > 0 && !blend) return false;
		const model = this.model;
		const projection = captureProductProjection(model, this.camera);
		const transfer = this.presentation.takeHero()!;
		const highPose = transfer.high?.pose;
		const environment = this.environments.pinTexture(this.scene.environment);
		const generation = this.pageBinding.token;
		this.pageModelReady = false;
		this.spatialCapture = new SpatialGeometryCapture(model, projection, {
			environment: this.scene.environment,
			environmentIntensity: this.scene.environmentIntensity,
			lights: this.scene.children.filter(
				(child): child is THREE.Light => child instanceof THREE.Light
			),
			high: highPose,
			highWeight,
			blend,
			release: () => {
				environment?.release();
				if (!this.disposed && this.pageBinding.token === generation && !this.model) {
					// Cancellation before page release restores ownership to the still-live PDP.
					model.matrixAutoUpdate = true;
					this.presentation.restoreHero(transfer);
					this.scene.add(model);
					this.pageModelReady = true;
					return false;
				} else {
					this.presentation.disposeTransfer(transfer);
				}
			}
		});
		this.requestRender();
		return true;
	}

	getSpatialCapture() {
		return this.spatialCapture
			? {
					...this.spatialCapture.getSnapshot(),
					secondary: this.contentSecondaries.map((entry) => ({
						productId: entry.source.productId,
						occurrence: entry.source.occurrence,
						...entry.capture.getSnapshot()
					}))
				}
			: null;
	}

	private captureReturnGeometry(productId: string) {
		if (!this.captureHeroPresentation()) return false;
		this.captureExitingMinimaps();
		this.returnProduct = productId;
		this.returnProgress = 0;
		this.catalogLayer?.setDestinationProduct(productId);
		// Freeze the existing background canvas without the independently retained hero.
		if (this.pipeline.freezeBackground()) this.outgoingBackground = true;
		return true;
	}

	getDockProjection() {
		const candidates = [...this.minimaps.values()].filter((minimap) => minimap.viewportVisible);
		if (candidates.length !== 1) return;
		const minimap = candidates[0];
		const rect = this.getProjectedMinimapModelRect(minimap);
		if (
			!rect ||
			rect.x < 0 ||
			rect.y < 0 ||
			rect.x + rect.width > innerWidth ||
			rect.y + rect.height > innerHeight
		)
			return;
		return {
			...captureProductProjection(minimap.productRoot, minimap.screenCamera),
			environmentIntensity: this.minimapScene.environmentIntensity
		};
	}

	private captureDockPresentation(productId: string) {
		if (this.spatialCapture || !this.assetInstance) return false;
		const candidates = [...this.minimaps.values()].filter((minimap) => minimap.viewportVisible);
		if (candidates.length !== 1) return false;
		const minimap = candidates[0];
		const projection = this.getDockProjection();
		if (!projection || minimap.displayOpacity < 0.999 || minimap.overlayProgress > 0.001)
			return false;
		const model = minimap.productRoot;
		const parent = model.parent!;
		const low = this.assetInstance;
		const generation = this.pageBinding.token;
		const environment = this.environments.pinTexture(this.minimapScene.environment);
		this.presentation.takeLowInstance();
		this.spatialCapture = new SpatialGeometryCapture(model, projection, {
			environment: this.minimapScene.environment,
			environmentIntensity: this.minimapScene.environmentIntensity,
			lights: this.minimapScene.children.filter(
				(child): child is THREE.Light => child instanceof THREE.Light
			),
			release: () => {
				environment?.release();
				if (!this.disposed && this.pageBinding.token === generation) {
					this.presentation.restoreLowInstance(low);
					model.matrixAutoUpdate = true;
					model.updateMatrix();
					parent.add(model);
				} else {
					disposeMinimapModelMaterials(model);
					low.dispose();
				}
			}
		});
		this.returnProduct = productId;
		this.returnProgress = 0;
		this.catalogLayer?.setDestinationProduct(productId);
		this.requestRender();
		return true;
	}

	private prepareCatalogDestination(dock: boolean) {
		this.catalogDockTarget = dock;
		if (this.adoptedForward) {
			this.returnProjection = dock
				? this.getDockProjection()
				: this.model
					? {
							...captureProductProjection(this.model, this.camera),
							environmentIntensity: this.scene.environmentIntensity
						}
					: undefined;
			return Boolean(this.returnProjection);
		}
		return !dock || Boolean(this.getDockProjection());
	}

	private prepareReturnDestination() {
		if (!this.returnProduct || !this.spatialCapture) return false;
		// Lay out the suppressed matching actor before freezing its destination projection.
		this.catalogLayer?.setExitOpacity(1, true);
		this.flushCatalogFrame();
		this.returnProjection = this.catalogLayer?.getDestinationProjection(this.returnProduct);
		this.catalogLayer?.setExitOpacity(this.catalogPresentation.enterOpacity, true);
		return Boolean(this.returnProjection);
	}

	/** Retain unshared rail geometry until its exit fade completes, independently of the page. */
	private captureExitingMinimaps() {
		if (this.exitingMinimaps.length) {
			for (const entry of this.exitingMinimaps) {
				entry.opacity = entry.minimap.displayOpacity;
				entry.ringOpacity = entry.ring.material.opacity;
			}
			return;
		}
		for (const minimap of this.minimaps.values()) {
			const model = minimap.productRoot;
			if (
				!minimap.viewportVisible ||
				minimap.displayOpacity <= 0 ||
				model === this.spatialCapture?.model
			)
				continue;
			const parent = model.parent;
			if (!parent) continue;
			const projection = captureProductProjection(model, minimap.screenCamera);
			const ring = minimap.overlayRing.clone();
			ring.geometry = minimap.overlayRing.geometry.clone();
			ring.material = minimap.overlayRing.material.clone();
			minimap.overlayRing.updateWorldMatrix(true, false);
			ring.matrixAutoUpdate = false;
			ring.matrix.copy(projection.model).invert().multiply(minimap.overlayRing.matrixWorld);
			const ringOpacity = ring.material.opacity;
			const environment = this.environments.pinTexture(this.minimapScene.environment);
			const lease = this.assets.acquire(
				this.lodPair?.low ?? {
					url: this.glb,
					format: 'glb',
					revision: 'legacy-unversioned',
					requirements: { decoders: ['draco'], extensions: [] }
				}
			);
			const generation = this.pageBinding.token;
			const opacity = minimap.displayOpacity;
			const capture = new SpatialGeometryCapture(model, projection, {
				environment: this.minimapScene.environment,
				environmentIntensity: this.minimapScene.environmentIntensity,
				lights: this.minimapScene.children.filter(
					(child): child is THREE.Light => child instanceof THREE.Light
				),
				release: () => {
					ring.removeFromParent();
					ring.geometry.dispose();
					ring.material.dispose();
					if (!this.disposed && generation === this.pageBinding.token) {
						model.matrixAutoUpdate = true;
						model.updateMatrix();
						parent.add(model);
						this.setMinimapDisplayModelOpacity(minimap, opacity);
					} else disposeMinimapModelMaterials(model);
					environment?.release();
					lease.release();
				}
			});
			model.add(ring);
			this.exitingMinimaps.push({ capture, minimap, opacity, ring, ringOpacity });
		}
	}

	releaseSpatialCapture() {
		for (const entry of this.contentSecondaries) entry.capture.dispose();
		this.contentSecondaries = [];
		this.catalogLayer?.setDestinationOccurrences([]);
		for (const entry of this.exitingMinimaps) entry.capture.dispose();
		this.exitingMinimaps = [];
		const capture = this.spatialCapture;
		this.spatialCapture = undefined;
		capture?.dispose();
		this.requestRender();
	}

	setCatalogGeometryProgress(progress: number) {
		for (const entry of this.contentSecondaries)
			if (entry.target) entry.capture.setTarget(entry.target, progress, 0);
		if (this.returnProjection && this.spatialCapture) {
			this.returnProgress = progress;
			this.spatialCapture.setTarget(
				this.returnProjection,
				progress,
				this.adoptedForward ? progress : (this.catalogPresentation.geometryOpacity ?? 0)
			);
			if (this.adoptedForward && progress >= 1) {
				this.catalogMotionComplete = true;
				this.releaseSpatialCapture();
				this.returnProjection = undefined;
			}
			this.requestRender();
			return;
		}
		if (!this.catalogHandoff || !this.model) return;
		const dock = this.catalogDockTarget
			? [...this.minimaps.values()].find((minimap) => minimap.viewportVisible)
			: undefined;
		this.catalogLayer?.setHandoffTarget({
			camera: dock?.screenCamera ?? this.camera,
			model: dock?.productRoot ?? this.model,
			environmentIntensity: dock
				? this.minimapScene.environmentIntensity
				: this.scene.environmentIntensity,
			progress
		});
		const previouslyComplete = this.catalogMotionComplete;
		this.catalogMotionComplete = progress >= 1;
		// Submit the first final-pose frame before releasing deferred preparation work.
		if (this.catalogMotionComplete && !previouslyComplete) {
			this.catalogLayer?.finishHandoff();
			if (this.catalogMode === 'synchronous' && this.highPose) {
				for (const child of this.model.children) child.visible = child === this.highPose;
				this.presentation.markRefinement('high', this.catalogBlend?.frames ?? 0);
			}
			if (this.catalogMode === 'synchronous') this.presentation.readiness.completeMotion();
		}
		if (previouslyComplete) {
			this.preparationGate.setPaused(false);
			this.detailPreparationGate.setPaused(false);
			this.startHighRequest();
		}
		this.requestRender();
	}

	/** Commit GPU and DOM motion in the same browser frame, not on consecutive RAFs. */
	flushCatalogFrame() {
		cancelAnimationFrame(this.renderRequestId);
		this.renderRequestId = 0;
		this.renderFrame(true);
		// After the transition's external clock stops, optional refinement resumes its own RAF.
		if (!this.catalogPresentation.active && (this.animationActive || this.renderInvalidated))
			this.scheduleRender();
	}

	finishCatalogGeometry() {
		this.releaseSpatialCapture();
		this.adoptedForward = false;
		this.returnProduct = undefined;
		this.catalogDockTarget = false;
		this.returnProjection = undefined;
		this.catalogLayer?.setDestinationProduct();
		this.outgoingBackground = false;
		this.backgroundCanvas.style.removeProperty('opacity');
		this.preparationGate.setPaused(false);
		this.detailPreparationGate.setPaused(false);
		if (this.catalogMode === 'synchronous') {
			this.presentation.readiness.completeMotion();
		}
		this.catalogHandoff = false;
		this.catalogMotionComplete = false;
		this.catalogLayer?.finishHandoff();
		this.presentation.finishHandoff(this.catalogMode === 'synchronous');
		if (!this.disposed && this.highPose && this.model && this.refinementState === 'high') {
			this.collectModelPickTargets(this.highPose);
			const outline = this.model.clone(false);
			outline.add(this.highPose.clone(true));
			this.pipeline.createModelOutline(outline);
		}
		if (this.pageModelReady && !this.disposed) this.startHighRequest();
		this.requestRender();
	}

	private releaseModel() {
		this.presentation.release();
		this.pipeline.releaseOutline();
		this.interaction.setPickTargets(undefined, () => false);
	}

	/** Smoothly restores the initial fitted camera position and orbit target. */
	resetView() {
		return this.interaction.resetView();
	}

	/** @deprecated Use {@link resetView} to restore the complete fitted pose. */
	resetZoom() {
		this.resetView();
	}

	/**
	 * Applies an exact camera pose for screenshot tests.
	 *
	 * This bypasses OrbitControls damping so a visual test can capture a known
	 * state. It is only called by the query-gated
	 * test controller installed by the Svelte stage component.
	 *
	 * @param view - Normalized zoom, orbit offsets, and optional target translation.
	 */
	setVisualTestView(view: StageVisualTestView = {}) {
		if (!this.controls || !this.initialViewCaptured) {
			throw new Error('The stage camera is not ready for visual testing');
		}

		this.clearZoomReset();
		this.clearWheelZoom();
		this.interaction.stopViewReset();

		const targetOffset = view.targetOffset ?? {};
		const target = this.initialControlsTarget
			.clone()
			.add(
				new THREE.Vector3(
					(targetOffset.x ?? 0) * this.modelRadius,
					(targetOffset.y ?? 0) * this.modelRadius,
					(targetOffset.z ?? 0) * this.modelRadius
				)
			);
		const spherical = new THREE.Spherical().setFromVector3(
			this.initialCameraPosition.clone().sub(this.initialControlsTarget)
		);
		spherical.theta += THREE.MathUtils.degToRad(view.azimuth ?? 0);
		spherical.phi = THREE.MathUtils.clamp(
			spherical.phi + THREE.MathUtils.degToRad(view.polar ?? 0),
			0.05,
			Math.PI - 0.05
		);

		const zoom = THREE.MathUtils.clamp(view.zoom ?? 0, 0, 1);
		const distance = THREE.MathUtils.lerp(
			this.controls.maxDistance,
			this.controls.minDistance,
			zoom
		);
		const cameraOffset = new THREE.Vector3().setFromSpherical(spherical).setLength(distance);

		this.controls.target.copy(target);
		this.camera.fov = this.initialCameraFov;
		this.camera.position.copy(target).add(cameraOffset);
		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld(true);
		this.controls.update();

		this.panelFocus = this.getZoomFocusFactor();
		this.panelUiFocus = getStageUiFocus(this.panelFocus);
		this.minimapFocus = getSequencedMinimapFocus(this.panelFocus, this.panelUiFocus);
		this.layoutDirty = true;
		this.lastInteractionTime = performance.now();
		this.requestRender();
	}

	/** Applies the camera/target dolly produced by a real SpaceMouse zoom transaction. */
	setVisualTestSpaceMouseZoom(zoom = 0) {
		if (!this.controls || !this.initialViewCaptured) {
			throw new Error('The stage camera is not ready for visual testing');
		}

		const normalizedZoom = THREE.MathUtils.clamp(zoom, 0, 1);
		const productDistance = THREE.MathUtils.lerp(
			this.controls.maxDistance,
			this.controls.minDistance,
			normalizedZoom
		);
		const nextPosition = this.camera.position
			.clone()
			.sub(this.initialControlsTarget)
			.setLength(productDistance)
			.add(this.initialControlsTarget);
		const translation = nextPosition.clone().sub(this.camera.position);
		const nextTarget = this.controls.target.clone().add(translation);
		const rotation = new THREE.Quaternion().setFromRotationMatrix(
			new THREE.Matrix4().lookAt(nextPosition, nextTarget, this.camera.up)
		);
		const viewMatrix = new THREE.Matrix4().compose(
			nextPosition,
			rotation,
			new THREE.Vector3(1, 1, 1)
		);

		this.applySpaceMouseNavigationUpdate({
			viewMatrix: viewMatrix.elements,
			target: nextTarget.toArray(),
			fov: THREE.MathUtils.degToRad(this.initialCameraFov)
		});
	}

	/** Repeats SpaceMouse navigation transactions while synthetic frames are rendered. */
	driveVisualTestSpaceMouseZoom(zoom = 0, frames = 60) {
		const frameCount = THREE.MathUtils.clamp(Math.floor(frames), 1, 120);
		this.setSpaceMouseMoving(true);

		for (let index = 0; index < frameCount; index += 1) {
			this.setVisualTestSpaceMouseZoom(zoom);
			this.advanceVisualTestFrames(1);
		}
	}

	/** Ends the synthetic SpaceMouse gesture used by browser regression tests. */
	stopVisualTestSpaceMouseMotion() {
		this.setSpaceMouseMoving(false);
	}

	/** Returns the live rendered minimap bounds rather than its hidden DOM fallback bounds. */
	getVisualTestMinimapRect() {
		const minimap = this.minimaps.values().next().value as StageMinimapState | undefined;
		if (!minimap) return null;

		minimap.layer.updateWorldMatrix(true, true);
		minimap.screenCamera.updateMatrixWorld(true);
		const halfWidth = minimap.currentWidth * 0.5;
		const halfHeight = minimap.currentHeight * 0.5;
		const viewportWidth = Math.max(window.innerWidth, 1);
		const viewportHeight = Math.max(window.innerHeight, 1);
		const projected = [
			new THREE.Vector3(-halfWidth, -halfHeight, 0),
			new THREE.Vector3(halfWidth, -halfHeight, 0),
			new THREE.Vector3(halfWidth, halfHeight, 0),
			new THREE.Vector3(-halfWidth, halfHeight, 0)
		].map((corner) => minimap.layer.localToWorld(corner).project(minimap.screenCamera));
		const xCoordinates = projected.map((point) => (point.x + 1) * viewportWidth * 0.5);
		const yCoordinates = projected.map((point) => (1 - point.y) * viewportHeight * 0.5);
		const left = Math.min(...xCoordinates);
		const top = Math.min(...yCoordinates);

		return {
			x: left,
			y: top,
			width: Math.max(...xCoordinates) - left,
			height: Math.max(...yCoordinates) - top
		};
	}

	/** Returns the main product's projected bounds for query-gated layout regressions. */
	getVisualTestModelRect() {
		if (!this.model || this.modelBounds.isEmpty()) return null;

		this.camera.updateMatrixWorld(true);
		const points = getBoxCorners(this.modelBounds).map((point) => point.project(this.camera));
		const xCoordinates = points.map((point) => (point.x + 1) * window.innerWidth * 0.5);
		const yCoordinates = points.map((point) => (1 - point.y) * window.innerHeight * 0.5);
		const left = Math.min(...xCoordinates);
		const top = Math.min(...yCoordinates);

		return {
			x: left,
			y: top,
			width: Math.max(...xCoordinates) - left,
			height: Math.max(...yCoordinates) - top
		};
	}

	/** Returns the projected product bounds used by the dock's header-top anchor. */
	getVisualTestMinimapModelRect() {
		const minimap = this.minimaps.values().next().value as StageMinimapState | undefined;
		return minimap ? this.getProjectedMinimapModelRect(minimap) : null;
	}

	/** Returns minimap orientation endpoints for query-gated browser regressions. */
	getVisualTestMinimapOrientation() {
		const minimap = this.minimaps.values().next().value as StageMinimapState | undefined;
		if (!minimap || !this.model) return null;

		const cameraWorldQuaternion = this.camera.getWorldQuaternion(new THREE.Quaternion());
		const modelWorldQuaternion = this.model.getWorldQuaternion(new THREE.Quaternion());
		const liveQuaternion = cameraWorldQuaternion.invert().multiply(modelWorldQuaternion);
		const serialize = (quaternion: THREE.Quaternion): [number, number, number, number] => [
			quaternion.x,
			quaternion.y,
			quaternion.z,
			quaternion.w
		];

		return {
			rest: serialize(minimap.restQuaternion),
			display: serialize(minimap.displayModel.quaternion),
			live: serialize(liveQuaternion),
			docked: minimap.dockedQuaternion ? serialize(minimap.dockedQuaternion) : null,
			dockProgress: THREE.MathUtils.clamp(
				this.panelTargets[minimap.panelIndex]?.getMinimapDockProgress?.() ?? 0,
				0,
				1
			)
		};
	}

	/** Returns overlay capture submissions for query-gated performance regression tests. */
	getVisualTestMinimapRenderStats() {
		const minimap = this.minimaps.values().next().value as StageMinimapState | undefined;
		return {
			overlayCapturePasses: this.pipeline.minimapOverlayCapturePasses,
			depthNear: minimap?.screenCamera.near ?? 0,
			depthFar: minimap?.screenCamera.far ?? 0,
			viewportRingInForeground: minimap ? !minimap.overlayRing.material.depthTest : false
		};
	}

	/** Returns Low-band and glass-compositor counters without scheduling rendering. */
	getCarouselStats() {
		return this.catalogLayer?.getStats() ?? null;
	}

	/** Returns render-target lifecycle counters for query-gated performance tests. */
	getVisualTestRenderTargetStats() {
		// Captured minimaps retain only their product/ring, not disposed page-local blur targets.
		const views = [...this.minimaps.values()];
		const inventory = describeRenderTargets({
			pipeline: this.pipeline.getRenderTargets(),
			minimap: views.flatMap((view) => [
				view.contextTarget,
				view.displayTarget,
				view.panelTarget,
				...view.blurPipeline.getRenderTargets()
			]),
			catalog: this.catalogLayer?.getRenderTargets() ?? [],
			presentation: this.presentation.getRenderTargets(),
			preparation: this.preparation?.current?.high?.blend.getRenderTargets() ?? [],
			capture: [
				this.spatialCapture,
				...this.contentSecondaries.map((entry) => entry.capture),
				...this.exitingMinimaps.map((entry) => entry.capture)
			].flatMap((capture) => capture?.getRenderTargets() ?? []),
			environment: this.environments?.getRenderTargets() ?? []
		});
		return {
			...inventory,
			canvases: this.pipeline.getCanvasOutputs(),
			creations: this.pipeline.renderTargetSetCreations,
			resizes: this.pipeline.renderTargetSetResizes,
			warmups: this.pipeline.renderTargetSetWarmups,
			activeScale: this.pipeline.activeRenderTargets?.scale ?? 0
		};
	}

	/** Returns live visibility and submitted-pass counters for culling regressions. */
	getVisualTestVisibilityStats() {
		return {
			stageViewportVisible: this.stageViewportVisible,
			visiblePanels: this.visiblePanelCount,
			visibleMinimaps: this.visibleMinimapCount,
			stageModelRenderPasses: this.pipeline.stageModelRenderPasses,
			panelBlurRenderPasses: this.pipeline.panelBlurRenderPasses,
			panelSceneRenderPasses: this.pipeline.panelSceneRenderPasses,
			minimapSceneRenderPasses: this.pipeline.minimapSceneRenderPasses
		};
	}

	/**
	 * Advances the complete stage by a fixed number of synthetic 60 Hz frames.
	 *
	 * Headless browsers can throttle `requestAnimationFrame` even while WebGPU is
	 * active. Visual regression tests use this method to settle damping, panel
	 * layout, minimap composition, and GPU submissions without relying on wall
	 * clock timing. The method is only reachable through the query-gated visual
	 * test controller installed by {@link Stage}.
	 *
	 * @param frames - Number of frames to advance, clamped to a practical limit.
	 */
	advanceVisualTestFrames(frames = 12) {
		const frameCount = THREE.MathUtils.clamp(Math.floor(frames), 1, 120);
		for (let index = 0; index < frameCount; index += 1) {
			this.lastInteractionTime = performance.now() - 1000 / 60;
			this.renderFrame(true);
		}
	}

	/**
	 * Attaches accessible HTML content to an imperative panel.
	 *
	 * @param element - DOM subtree rendered by the CSS3D layer.
	 * @param panelIndex - Index of the panel that owns the content.
	 * @param inset - Padding, in panel-local pixels, around the content.
	 * @returns The CSS3D object that tracks the panel.
	 */
	private attachPanelContent(element: HTMLElement, panelIndex = 0, inset = 28) {
		return this.panels.attachPanelContent(element, panelIndex, inset);
	}

	/** Attaches a complete CSS surface and its content to the shared panel transform. */
	private attachPanelSurface(element: HTMLElement, panelIndex: number, minimap = false) {
		return this.panels.attachPanelSurface(element, panelIndex, minimap);
	}

	private updateContentElement(element: HTMLElement, runtime: StagePanelRuntime, inset = 28) {
		return this.panels.updateContentElement(element, runtime, inset);
	}

	private updateSurfaceElement(
		element: HTMLElement,
		runtime: StagePanelRuntime,
		width = runtime.options.width,
		height = runtime.options.height,
		projected = false
	) {
		return this.panels.updateSurfaceElement(element, runtime, width, height, projected);
	}

	/** Marks the scene as dirty and schedules a browser frame if none is pending. */
	private requestRender() {
		if (this.disposed) return;

		this.renderInvalidated = true;
		this.scheduleRender();
	}

	private scheduleRender() {
		if (this.disposed || document.hidden || this.renderRequestId) return;
		this.renderRequestId = requestAnimationFrame(this.render);
	}

	private configureCssRenderer() {
		const element = this.cssRenderer.domElement;
		element.className = 'stage-css3d';
		element.style.position = 'fixed';
		element.style.inset = '0';
		element.style.width = '100vw';
		element.style.height = '100vh';
		element.style.overflow = 'hidden';
		element.style.pointerEvents = 'none';
	}

	private configureFlatPanelLayer() {
		const element = this.flatPanelLayer;
		element.className = 'stage-css3d-flat';
		element.style.position = 'fixed';
		element.style.inset = '0';
		element.style.width = '100vw';
		element.style.height = '100vh';
		element.style.perspectiveOrigin = '50% 50%';
		element.style.transformStyle = 'flat';
		element.style.pointerEvents = 'none';
	}

	private configureNativePanelLayer() {
		const element = this.nativePanelLayer;
		element.className = 'stage-panel-native';
		element.style.position = 'fixed';
		element.style.inset = '0';
		element.style.width = '100vw';
		element.style.height = '100vh';
		element.style.perspective = 'none';
		element.style.transformStyle = 'flat';
		element.style.pointerEvents = 'none';
	}

	private async loadEnvironment() {
		const token = this.pageBinding.token;
		const lease = this.environments.acquire(this.hdr);
		try {
			const environment = await lease.ready;
			if (this.disposed || !this.pageBinding.isCurrent(token)) return;
			this.applyEnvironment(environment);
		} finally {
			lease.release();
		}
	}

	private applyEnvironment(environment: PreparedEnvironment) {
		this.presentation.retainEnvironment(this.environments, environment);
		this.environmentTarget = environment.target;
		const texture = environment.target.texture;
		this.backgroundScene.background =
			this.backgroundSettings.blurriness <= 0 ? environment.source : texture;
		this.backgroundScene.backgroundBlurriness = this.backgroundSettings.blurriness;
		this.backgroundScene.backgroundIntensity = 1;
		this.scene.environment = texture;
		this.scene.environmentIntensity = 0.5;
		this.panelScene.environment = this.minimapScene.environment = texture;
		this.panelScene.environmentIntensity = this.minimapScene.environmentIntensity = 1;
		for (const minimap of this.minimaps.values()) minimap.sourceScene.environment = texture;
		if (this.tintMaterial) {
			this.tintMaterial.color.set(this.backgroundSettings.tint);
			this.tintMaterial.opacity = this.backgroundSettings.tintIntensity;
		}
		this.presentation.readiness.markApplied();
	}

	prefetchProduct(stage: ProductStageConfig) {
		if (!this.disposed && this.preparation && !this.catalogHandoff) this.preparation.prepare(stage);
	}

	isCatalogBackgroundPrepared() {
		return this.catalogBackgroundPrepared;
	}

	/** Freeze readiness only after Kit has supplied and bound the complete destination DOM. */
	beginCatalogMotion(): TransitionMode {
		if (this.catalogDockTarget) {
			this.preparationGate.setPaused(true);
			this.presentation.readiness.useSynchronousMotion();
			return 'synchronous';
		}
		const entry = this.pagePreparation;
		const ready = this.presentation.readiness.freeze(false, this.adoptedForward) === 'synchronous';
		this.catalogBackgroundReveal.value = 0;
		if (this.catalogBackgroundPrepared && entry) {
			const lowEnvironment = this.scene.environment;
			this.applyEnvironment(entry.environment.value!);
			if (!ready && this.lodPair) this.scene.environment = lowEnvironment;
		}
		if (ready) this.adoptPreparedHigh(true);
		this.preparationGate.setPaused(true);
		return ready ? 'synchronous' : 'asynchronous';
	}

	private async warmPreparedHigh(
		high: PreparedHigh,
		environment: PreparedEnvironment,
		signal: AbortSignal
	) {
		return this.detailPreparationGate.run(
			() =>
				this.preparationGate.run(async () => {
					if (this.disposed) throw new Error('Stage disposed');
					await this.pipeline.warmHigh(high, environment.target.texture, () =>
						this.catalogLayer?.renderForPreparation(this.renderer)
					);
				}, signal),
			signal
		);
	}

	private adoptPreparedHigh(moving = false) {
		const entry = this.pagePreparation;
		if (!entry || !this.model || this.highInstance) return;
		if (entry.highState === 'failed' || entry.highState === 'loading') {
			this.presentation.markRefinement(entry.highState);
			return;
		}
		const high = this.preparation.takeHigh(entry);
		if (high) this.presentation.adoptHigh(high, moving);
	}

	private advancePreparedPage(now: number) {
		if (this.deferDetailPreparation) {
			const rect = this.pageBinding.viewportRect
				? this.resolveStageRect(this.pageBinding.viewportRect)
				: undefined;
			if (
				this.catalogPresentation.active ||
				!this.stageViewportVisible ||
				!this.heroIsPresented() ||
				!this.viewportTarget ||
				!rect ||
				rect.bottom <= 0 ||
				rect.top >= innerHeight
			)
				return;
			this.presentation.readiness.resume(
				this.preparation.prepare({
					hdr: this.hdr,
					background: this.backgroundSettings,
					glb: this.glb,
					lodPair: this.lodPair,
					model: this.modelSettings
				})
			);
		}
		if (!this.pageModelReady || (this.catalogHandoff && !this.catalogMotionComplete)) return;
		if (this.pagePreparation && this.catalogMode !== 'synchronous') this.adoptPreparedHigh();
		if (!this.backgroundPending && this.catalogMode) return;
		const entry = this.pagePreparation;
		if (!entry || entry.backgroundState === 'loading') return;
		if (!this.backgroundApplied && entry.environment.value) {
			const lowEnvironment = this.scene.environment;
			this.applyEnvironment(entry.environment.value);
			if (this.lodPair && this.refinementState !== 'high') this.scene.environment = lowEnvironment;
		}
		const reveal = this.presentation.readiness.advance(
			now,
			matchMedia('(prefers-reduced-motion: reduce)').matches
		);
		if (reveal !== undefined) this.catalogBackgroundReveal.value = reveal;
	}

	private createBackgroundTint() {
		this.tintMaterial = new THREE.MeshBasicMaterial({
			color: this.backgroundSettings.tint,
			depthTest: false,
			depthWrite: false,
			opacity: this.backgroundSettings.tintIntensity,
			transparent: true
		});
		this.tintMaterial.toneMapped = false;

		this.tintGeometry = new THREE.PlaneGeometry(2, 2);
		const tintOverlay = new THREE.Mesh(this.tintGeometry, this.tintMaterial);
		tintOverlay.position.z = -0.5;
		tintOverlay.frustumCulled = false;
		this.tintScene.add(tintOverlay);
	}

	private createLights() {
		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x20242d, 0.8);
		this.scene.add(hemiLight);

		const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
		keyLight.position.set(4, 5, 3);
		this.scene.add(keyLight);

		const panelKeyLight = new THREE.DirectionalLight(0xffffff, 2.2);
		panelKeyLight.position.set(-2, 3, 8);
		this.panelScene.add(panelKeyLight);
		this.panelScene.add(new THREE.AmbientLight(0xffffff, 0.7));

		const minimapKeyLight = new THREE.DirectionalLight(0xffffff, 2.2);
		minimapKeyLight.position.copy(panelKeyLight.position);
		this.minimapScene.add(minimapKeyLight);
		this.minimapScene.add(new THREE.AmbientLight(0xffffff, 0.7));
	}

	private startHighRequest() {
		if (this.deferDetailPreparation) return;
		if (this.pagePreparation) {
			if (!this.catalogHandoff || this.catalogMotionComplete) this.adoptPreparedHigh();
			return;
		}
		if (!this.catalogHandoff || this.catalogMotionComplete) this.presentation.startHigh();
	}

	private async loadModel() {
		const model = await this.presentation.load(
			resolveStageProfile({
				glb: this.glb,
				hdr: this.hdr,
				lodPair: this.lodPair,
				model: this.modelSettings,
				camera: this.cameraSettings,
				background: this.backgroundSettings
			})
		);
		if (!model) return;
		this.collectModelPickTargets(model);
		this.pipeline.createModelOutline(model);
		this.scene.add(model);
		this.fitModelCamera();
		this.startHighRequest();
	}

	private fitModelCamera() {
		if (!this.model) return;
		const bounds = getMeshBounds(this.model, (mesh) => this.isProductMesh(mesh));
		if (bounds.isEmpty()) {
			throw new Error('The stage model does not contain any product meshes after exclusions');
		}
		if (this.referenceBounds) bounds.copy(this.referenceBounds);
		this.modelBounds.copy(bounds);
		const sphere = bounds.getBoundingSphere(new THREE.Sphere());
		const radius = Math.max(sphere.radius, 1);
		this.modelRadius = radius;
		const orbitDirection = getCameraOrbitDirection(
			this.cameraSettings.azimuth,
			this.cameraSettings.elevation
		);
		this.updateViewportFrame();
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		const fitDistance = this.getProductCameraFitDistance(bounds, orbitDirection);
		const maxDistance = Math.max(fitDistance, radius * 0.6);
		this.rememberFittedViewportMetrics();

		this.camera.position.copy(sphere.center).addScaledVector(orbitDirection, maxDistance);
		this.camera.near = Math.max(maxDistance / 100, 0.01);
		this.camera.far = Math.max(maxDistance * 100, radius * 20);
		this.camera.updateProjectionMatrix();

		const focusRange = getZoomFocusDistanceRange(maxDistance, radius);
		this.interaction.setFocusRange(focusRange.restDistance, focusRange.closeDistance);

		this.controls?.target.copy(sphere.center);
		if (this.controls) {
			this.controls.minDistance = this.focusCloseDistance * 0.64;
			this.controls.maxDistance = maxDistance;
			this.controls.update();
			this.camera.updateMatrixWorld(true);
			this.model.updateWorldMatrix(true, true);
			this.interaction.captureInitialView();
			this.camera.getWorldQuaternion(this.initialCameraWorldQuaternion);
			this.model.getWorldQuaternion(this.initialModelWorldQuaternion);
		}
	}

	private initializeSpaceMouse() {
		return this.interaction.initializeSpaceMouse();
	}

	private applySpaceMouseNavigationUpdate(update: SpaceMouseNavigationUpdate) {
		return this.interaction.applySpaceMouseNavigationUpdate(update);
	}

	private setSpaceMouseMoving(moving: boolean) {
		return this.interaction.setSpaceMouseMoving(moving);
	}

	private isProductMesh(mesh: Mesh) {
		return !this.excludedMeshNames.has(mesh.name);
	}

	private hideExcludedMeshes(model: Object3D) {
		model.traverse((child) => {
			if (isMesh(child) && !this.isProductMesh(child)) child.visible = false;
		});
	}

	private collectModelPickTargets(model: Object3D) {
		this.interaction.setPickTargets(model, (mesh) => this.isInteractionMesh(mesh));
	}

	private isInteractionMesh(mesh: Mesh) {
		if (!this.isProductMesh(mesh)) return false;
		if (this.interactionTheme.excludeMesh?.(mesh)) return false;
		if (mesh.userData.stagePick === false || mesh.userData.stageOutline === false) return false;

		const materialNames = getMeshMaterials(mesh)
			.map((material) => material.name)
			.filter(Boolean)
			.join(' ');
		const label = `${mesh.name} ${materialNames}`.toLowerCase();

		return !/(shadow|ground|floor|plane|helper|collision|collider|reflection)/i.test(label);
	}

	private createPanels() {
		if (
			!this.pipeline.activeRenderTargets &&
			this.panelTargets.some((target) => target.surface === 'glass')
		)
			return;

		if (!this.panelTargets.length) {
			this.fallbackPanelOptions.forEach((options) => {
				const panel = new LiquidGlassPanel(this.pipeline.getPanelBlurTexture(options), options);
				const projectionRoot = this.createPanelProjectionRoot(panel.group);
				this.panels.add({
					domRenderMode: 'spatial',
					glass: panel,
					group: panel.group,
					nativeRestFrames: 0,
					options: panel.options,
					pointerLift: 0,
					pointerReactive: true,
					projectionRoot,
					surface: 'glass'
				});
				this.panelScene.add(projectionRoot);
			});
			return;
		}

		this.panelTargets.forEach((target, index) => {
			// Both nodes receive renderer-owned styles, including when only the surface is
			// reparented. Restore both before persistent panels switch page/surface bindings.
			this.rememberDomHome(target.surfaceElement);
			this.rememberDomHome(target.content);
			const measuredOptions = this.getMeasuredPanelOptions(target);
			if (target.surface === 'glass') {
				const panel = new LiquidGlassPanel(
					this.pipeline.getPanelBlurTexture(target.options),
					measuredOptions
				);
				const projectionRoot = target.minimap
					? undefined
					: this.createPanelProjectionRoot(panel.group);
				this.panels.set(index, {
					domRenderMode: 'spatial',
					glass: panel,
					group: panel.group,
					nativeRestFrames: 0,
					options: panel.options,
					pointerLift: 0,
					pointerReactive: target.pointerReactive ?? true,
					projectionRoot,
					surface: target.surface
				});
				this.panelScene.add(projectionRoot ?? panel.group);
				this.attachPanelContent(target.content, index, target.contentInset);
			} else {
				const options = resolveLiquidGlassPanelOptions(measuredOptions);
				const group = new THREE.Group();
				const projectionRoot = target.minimap ? undefined : this.createPanelProjectionRoot(group);
				if (!projectionRoot) group.position.set(options.position.x, options.position.y, 0);
				this.panels.set(index, {
					domRenderMode: 'spatial',
					group,
					nativeRestFrames: 0,
					options,
					pointerLift: 0,
					pointerReactive: target.pointerReactive ?? true,
					projectionRoot,
					surface: target.surface
				});
				if (projectionRoot) this.panelScene.add(projectionRoot);
				this.attachPanelSurface(target.surfaceElement, index, Boolean(target.minimap));
			}
			this.createMinimap(index, target.minimap);
			const panel = this.panelRuntimes[index];
			const group = target.frame.dataset.catalogTransitionGroup;
			panel.transitionGroup = group === 'enter' || group === 'shared' ? group : undefined;
			panel.glass?.setVisibilityAlpha(
				this.getPanelTransitionOpacity(panel) * (target.getSurfaceOpacity?.() ?? 1)
			);
			const minimap = this.minimaps.get(index);
			if (minimap) {
				this.updateMinimapOverlayVisibility(minimap);
				minimap.layer.visible = this.getPanelTransitionOpacity(panel) > 0.001;
			}
			target.frame.dataset.stagePanelBound = '';
		});
	}

	private createPanelProjectionRoot(child: Object3D) {
		return this.panels.createPanelProjectionRoot(child);
	}

	private setPanelProjectionTransform(
		root: THREE.Group,
		targetX: number,
		targetY: number,
		targetZ: number
	) {
		return this.panels.setPanelProjectionTransform(root, targetX, targetY, targetZ);
	}

	private createMinimap(index: number, options?: StageMinimapOptions) {
		return this.minimapController.createMinimap(index, options);
	}

	private observePanelTargets() {
		this.pageBinding.observe(this.requestPanelSync);
	}

	private syncPanelLayouts(force = false) {
		if (!this.panelTargets.length || (!this.layoutDirty && !force)) return;
		this.layoutDirty = false;
		const measurePanels = force || this.panelMeasurementsDirty;

		this.panelTargets.forEach((target, index) => {
			const runtime = this.panelRuntimes[index];
			if (!runtime) return;

			const options = this.getMeasuredPanelOptions(target, measurePanels);
			const geometryChanged = hasPanelGeometryChanged(runtime.options, options);
			if (geometryChanged && runtime.glass && target.minimap) {
				this.replacePanel(index, options);
			} else {
				if (geometryChanged) {
					const radius = options.radius ?? runtime.options.radius;
					runtime.glass?.setVisualSize(options.width, options.height, radius);
					runtime.options.width = options.width;
					runtime.options.height = options.height;
					runtime.options.radius = radius;
				}
			}

			const currentRuntime = this.panelRuntimes[index];
			if (!currentRuntime) return;
			currentRuntime.options.position.x = options.position!.x;
			currentRuntime.options.position.y = options.position!.y;
			if (currentRuntime.projectionRoot) {
				currentRuntime.group.position.set(0, 0, 0);
				this.setPanelProjectionTransform(
					currentRuntime.projectionRoot,
					options.position!.x,
					options.position!.y,
					0
				);
			} else {
				currentRuntime.group.position.set(options.position!.x, options.position!.y, 0);
			}

			if (currentRuntime.surface === 'glass') {
				this.updateContentElement(target.content, currentRuntime, target.contentInset);
			} else {
				this.updateSurfaceElement(
					target.surfaceElement,
					currentRuntime,
					currentRuntime.options.width,
					currentRuntime.options.height,
					Boolean(target.minimap)
				);
			}

			if (currentRuntime.content) {
				if (currentRuntime.contentProjectionRoot) {
					currentRuntime.content.position.set(0, 0, 0);
					this.setPanelProjectionTransform(
						currentRuntime.contentProjectionRoot,
						currentRuntime.options.position.x,
						currentRuntime.options.position.y,
						PANEL_CONTENT_Z
					);
				} else {
					currentRuntime.content.position.set(
						currentRuntime.options.position.x,
						currentRuntime.options.position.y,
						PANEL_CONTENT_Z
					);
				}
			}

			if (geometryChanged && target.minimap) this.createMinimap(index, target.minimap);
		});
		this.panelMeasurementsDirty = false;
	}

	private replacePanel(index: number, options: LiquidGlassPanelOptions) {
		if (!this.pipeline.activeRenderTargets) return;

		const runtime = this.panelRuntimes[index];
		const previousPanel = runtime?.glass;
		if (!runtime || !previousPanel) return;
		const nextPanel = new LiquidGlassPanel(this.pipeline.getPanelBlurTexture(options), options);
		nextPanel.group.rotation.copy(previousPanel.group.rotation);
		nextPanel.group.scale.copy(previousPanel.group.scale);
		previousPanel.group.removeFromParent();
		previousPanel.dispose();

		runtime.glass = nextPanel;
		runtime.group = nextPanel.group;
		runtime.options = nextPanel.options;
		if (runtime.projectionRoot) {
			nextPanel.group.position.set(0, 0, 0);
			runtime.projectionRoot.add(nextPanel.group);
		} else {
			this.panelScene.add(nextPanel.group);
		}
	}

	private getMeasuredPanelOptions(target: StagePanelTarget, forceMeasurement = false) {
		let cachedRect = this.pageBinding.getPanelRect(target.frame);
		if (!cachedRect || forceMeasurement) {
			cachedRect = this.measureStageRect(target.frame);
			this.pageBinding.setPanelRect(target.frame, cachedRect);
		}
		const rect = this.resolveStageRect(cachedRect);
		const width = Math.max(rect.width, 1);
		const height = Math.max(rect.height, 1);

		return {
			...target.options,
			width,
			height,
			position: getStagePositionFromRect(rect)
		} satisfies LiquidGlassPanelOptions;
	}

	private measureStageRect(element: HTMLElement): CachedStageRect {
		return this.pageBinding.measure(element, this.currentScrollX, this.currentScrollY);
	}

	private resolveStageRect(rect: CachedStageRect) {
		return this.pageBinding.resolve(rect, this.currentScrollX, this.currentScrollY);
	}

	private isPanelTargetVisible(index: number) {
		const target = this.panelTargets[index];
		if (!target) return true;
		const cachedRect = this.pageBinding.getPanelRect(target.frame);
		if (!cachedRect) return true;

		return isViewportRectVisible(
			this.resolveStageRect(cachedRect),
			window.innerWidth,
			window.innerHeight,
			VIEWPORT_CULL_MARGIN
		);
	}

	private resizeRenderer() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.panelMeasurementsDirty = true;
		this.viewportMeasurementDirty = true;

		this.pipeline.resizeRenderTargets();
		this.pipeline.resizeOutline(width, height);

		this.updateStageCameraProjection();

		const panelCameraDistance = getPerspectiveDistance(height, PANEL_CAMERA_FOV);
		this.panelCamera.aspect = width / height;
		this.panelCamera.near = Math.max(panelCameraDistance / 1000, 0.1);
		this.panelCamera.far = panelCameraDistance + 2000;
		this.panelCamera.position.set(0, 0, panelCameraDistance);
		this.panelCamera.lookAt(0, 0, 0);
		this.panelCamera.updateProjectionMatrix();
		this.cssRenderer.setSize(width, height);
		this.flatPanelLayer.style.width = `${width}px`;
		this.flatPanelLayer.style.height = `${height}px`;
		this.flatPanelLayer.style.perspective = `${panelCameraDistance}px`;
		this.nativePanelLayer.style.width = `${width}px`;
		this.nativePanelLayer.style.height = `${height}px`;

		this.layoutDirty = true;
		this.syncPanelLayouts(true);
		this.requestRender();
	}

	/**
	 * Forces WebGPU to allocate and bind both quality levels before input starts.
	 * `RenderTarget` construction and `setSize()` only configure descriptors; the
	 * backend textures, blur intermediates, pipelines, and texture bindings are
	 * materialized by these real offscreen/canvas render passes.
	 */

	private updateViewportFrame() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		const element = this.viewportTarget?.element;
		if (!element) {
			this.stageViewportVisible = true;
			this.viewportFrame.set(0, 0, width, height);
			this.viewportLayoutSize.set(width, height);
			return;
		}

		if (!this.pageBinding.viewportRect || this.viewportMeasurementDirty) {
			this.pageBinding.viewportRect = this.measureStageRect(element);
			this.viewportMeasurementDirty = false;
		}
		const rect = this.resolveStageRect(this.pageBinding.viewportRect);

		if (rect.width < 1 || rect.height < 1) {
			this.stageViewportVisible = false;
			this.viewportFrame.set(0, 0, width, height);
			this.viewportLayoutSize.set(width, height);
			return;
		}
		this.viewportLayoutSize.set(Math.min(rect.width, width), Math.min(rect.height, height));
		this.stageViewportVisible = isViewportRectVisible(rect, width, height, VIEWPORT_CULL_MARGIN);

		const left = THREE.MathUtils.clamp(rect.left, 0, width);
		const top = THREE.MathUtils.clamp(rect.top, 0, height);
		const right = THREE.MathUtils.clamp(rect.right, 0, width);
		const bottom = THREE.MathUtils.clamp(rect.bottom, 0, height);
		const frameWidth = Math.max(right - left, 1);
		const frameHeight = Math.max(bottom - top, 1);

		this.viewportFrame.set(left, top, frameWidth, frameHeight);
	}

	private getViewportScale() {
		const width = Math.max(window.innerWidth, 1);
		const height = Math.max(window.innerHeight, 1);
		const maximumPadding = Math.max(
			Math.min(this.viewportLayoutSize.x, this.viewportLayoutSize.y) * 0.5 - 1,
			0
		);
		const padding = THREE.MathUtils.clamp(this.cameraSettings.fitPadding ?? 0, 0, maximumPadding);

		return {
			x: THREE.MathUtils.clamp((this.viewportLayoutSize.x - padding * 2) / width, 0.08, 1),
			y: THREE.MathUtils.clamp((this.viewportLayoutSize.y - padding * 2) / height, 0.08, 1)
		};
	}

	private getProductCameraFitDistance(bounds: THREE.Box3, viewDirection: THREE.Vector3) {
		const fitScale = THREE.MathUtils.clamp(this.cameraSettings.fitScale ?? 1, 0.2, 4);
		return (
			getCameraFitDistance(
				bounds,
				viewDirection,
				this.camera,
				PRODUCT_CAMERA_FIT_MARGIN,
				this.getViewportScale()
			) / fitScale
		);
	}

	private rememberFittedViewportMetrics() {
		this.fittedViewportMetrics.set(
			window.innerWidth,
			window.innerHeight,
			this.viewportLayoutSize.x,
			this.viewportLayoutSize.y
		);
	}

	private refitCameraForViewport() {
		if (!this.controls || !this.initialViewCaptured || this.modelBounds.isEmpty()) return;

		const metricsChanged =
			Math.abs(this.fittedViewportMetrics.x - window.innerWidth) > 0.5 ||
			Math.abs(this.fittedViewportMetrics.y - window.innerHeight) > 0.5 ||
			Math.abs(this.fittedViewportMetrics.z - this.viewportLayoutSize.x) > 0.5 ||
			Math.abs(this.fittedViewportMetrics.w - this.viewportLayoutSize.y) > 0.5;
		if (!metricsChanged) return;

		const previousMinDistance = this.controls.minDistance;
		const previousMaxDistance = this.controls.maxDistance;
		const previousEffectiveDistance = this.getEffectiveCameraDistance();
		const zoom =
			previousMaxDistance - previousMinDistance > 0.0001
				? THREE.MathUtils.clamp(
						(previousMaxDistance - previousEffectiveDistance) /
							(previousMaxDistance - previousMinDistance),
						0,
						1
					)
				: 0;
		const initialDirection = this.initialCameraPosition
			.clone()
			.sub(this.initialControlsTarget)
			.normalize();
		const currentDirection = this.camera.position.clone().sub(this.controls.target).normalize();
		const maxDistance = Math.max(
			this.getProductCameraFitDistance(this.modelBounds, initialDirection),
			this.modelRadius * 0.6
		);
		const focusRange = getZoomFocusDistanceRange(maxDistance, this.modelRadius);
		const minDistance = focusRange.closeDistance * 0.64;
		const nextEffectiveDistance = THREE.MathUtils.lerp(maxDistance, minDistance, zoom);
		const currentFovTangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
		const initialFovTangent = Math.tan(THREE.MathUtils.degToRad(this.initialCameraFov * 0.5));
		const nextPhysicalDistance =
			nextEffectiveDistance * (initialFovTangent / Math.max(currentFovTangent, 0.0001));

		this.interaction.setFocusRange(focusRange.restDistance, focusRange.closeDistance);
		this.controls.minDistance = minDistance;
		this.controls.maxDistance = maxDistance;
		this.camera.position
			.copy(this.controls.target)
			.addScaledVector(currentDirection, nextPhysicalDistance);
		this.initialCameraPosition
			.copy(this.initialControlsTarget)
			.addScaledVector(initialDirection, maxDistance);
		this.camera.near = Math.max(maxDistance / 100, 0.01);
		this.camera.far = Math.max(maxDistance * 100, this.modelRadius * 20);
		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld(true);
		this.controls.update();
		this.rememberFittedViewportMetrics();
	}

	private updateStageCameraProjection() {
		const width = window.innerWidth;
		const height = window.innerHeight;
		this.updateViewportFrame();

		const viewportCenterX = this.viewportFrame.x + this.viewportFrame.z * 0.5;
		const viewportCenterY = this.viewportFrame.y + this.viewportFrame.w * 0.5;
		const offsetX = width * 0.5 - viewportCenterX;
		const offsetY = height * 0.5 - viewportCenterY;

		this.camera.aspect = width / height;
		if (Math.abs(offsetX) > 0.25 || Math.abs(offsetY) > 0.25) {
			this.camera.setViewOffset(width, height, offsetX, offsetY, width, height);
		} else {
			this.camera.clearViewOffset();
		}
		this.refitCameraForViewport();
	}

	private handlePointerMove(event: PointerEvent) {
		return this.interaction.handlePointerMove(event);
	}

	private handlePointerDown(event: PointerEvent) {
		return this.interaction.handlePointerDown(event);
	}

	private handlePointerUp(event: PointerEvent) {
		return this.interaction.handlePointerUp(event);
	}

	private handleWheel(event: WheelEvent) {
		return this.interaction.handleWheel(event);
	}

	private handleScrollFrame(frame: StageScrollFrame) {
		if (this.disposed) return;
		this.currentScrollX = frame.scrollX;
		this.currentScrollY = frame.scrollY;

		if (this.renderRequestId) cancelAnimationFrame(this.renderRequestId);
		this.renderRequestId = 0;
		if (!this.scrollActive) {
			// Refresh document-space anchors once at the start of a scroll gesture.
			// Subsequent frames only subtract the current scroll offset.
			this.panelMeasurementsDirty = true;
			this.viewportMeasurementDirty = true;
			this.pipeline.setScrollRenderQuality(true);
		}
		this.scrollActive = true;
		this.layoutDirty = true;
		this.renderInvalidated = true;
		if (this.scrollEndTimer) window.clearTimeout(this.scrollEndTimer);
		this.scrollEndTimer = window.setTimeout(this.finishScroll, SCROLL_SETTLE_DELAY);

		const scrollY = frame.scrollY;
		const scrollDelta = scrollY - this.lastScrollY;
		this.lastScrollY = scrollY;
		if (scrollDelta > 0.5 && !this.spaceMouseMoving) {
			this.requestScrollZoomReset(scrollDelta);
		}

		// The shared scroll callback already runs inside requestAnimationFrame and
		// after dock mutations, so rendering here avoids adding another frame of lag.
		this.renderFrame();
	}

	private requestScrollZoomReset(scrollDelta: number) {
		return this.interaction.requestScrollZoomReset(scrollDelta);
	}

	private clearZoomReset() {
		return this.interaction.clearZoomReset();
	}

	private clearWheelZoom() {
		return this.interaction.clearWheelZoom();
	}

	private getEffectiveCameraDistance() {
		return this.interaction.getEffectiveCameraDistance();
	}

	private handlePointerLeave() {
		return this.interaction.handlePointerLeave();
	}

	private updateControlsAvailability() {
		return this.interaction.updateControlsAvailability();
	}

	private reportZoomFocus(state: StageZoomFocusState) {
		const change = Math.max(
			Math.abs(state.focus - this.lastReportedZoomFocus.focus),
			Math.abs(state.uiFocus - this.lastReportedZoomFocus.uiFocus),
			Math.abs(state.uiOpacity - this.lastReportedZoomFocus.uiOpacity),
			Math.abs(state.minimapFocus - this.lastReportedZoomFocus.minimapFocus)
		);
		if (!this.onZoomFocusChange || change < ZOOM_FOCUS_NOTIFY_EPSILON) return;

		this.lastReportedZoomFocus = { ...state };
		this.onZoomFocusChange(state);
	}

	private getZoomFocusFactor() {
		return this.interaction.getZoomFocusFactor();
	}

	private getZoomReferenceTarget() {
		return this.interaction.getZoomReferenceTarget();
	}

	private getProjectedMinimapModelRect(minimap: StageMinimapState) {
		return this.minimapController.getProjectedMinimapModelRect(minimap);
	}

	private updateMinimapOverlayVisibility(minimap: StageMinimapState) {
		return this.minimapController.updateMinimapOverlayVisibility(minimap);
	}

	private setMinimapDisplayModelOpacity(minimap: StageMinimapState, opacity: number) {
		return this.minimapController.setMinimapDisplayModelOpacity(minimap, opacity);
	}

	private updatePanelPointerInteraction(delta: number) {
		return this.panels.updatePanelPointerInteraction(delta);
	}

	/**
	 * Switches settled, screen-aligned panels out of every transformed ancestor.
	 * Two stable frames prevent mode churn while the damped pose snaps back to rest.
	 */
	private updatePanelDomRenderModes() {
		return this.panels.updatePanelDomRenderModes();
	}

	private renderFlatPanelSurfaces() {
		return this.panels.renderFlatPanelSurfaces();
	}

	private renderFrame(force = false) {
		const renderTargets = this.pipeline.activeRenderTargets;
		const listOnly = this.catalog && !this.viewportTarget;
		if (this.disposed || (!listOnly && (!renderTargets || !this.pipeline.stageDisplayQuad))) return;
		if (!force && document.hidden) return;
		if (!force && !this.renderInvalidated && !this.animationActive) return;

		this.renderInvalidated = false;
		this.renderer.setCanvasTarget(this.backgroundCanvasTarget);
		this.renderer.setClearColor(0xffffff, 1);

		const now = performance.now();
		const delta = Math.min((now - this.lastInteractionTime) / 1000, 0.05);
		this.advancePreparedPage(now);
		this.lastInteractionTime = now;
		this.backgroundCanvas.style.visibility = '';
		this.catalogLayerAnimating =
			this.catalogLayer?.update(this.renderer, this.scene.environment, now) ?? false;
		this.updateControlsAvailability();
		if (listOnly) {
			// The list has no hero camera. Never inherit close-up hiding/offsets from the PDP.
			this.panelFocus = 0;
			this.panelUiFocus = 0;
			this.minimapFocus = 0;
			this.reportZoomFocus({ focus: 0, uiFocus: 0, uiOpacity: 1, minimapFocus: 0 });
			this.syncPanelLayouts();
			const panelsAnimating = this.updatePanelPointerInteraction(delta);
			const domAnimating = this.updatePanelDomRenderModes();
			this.pipeline.renderFrame(true, false);
			this.cssRenderer.render(this.panelContentScene, this.panelCamera);
			this.renderFlatPanelSurfaces();
			this.animationActive = this.catalogLayerAnimating || panelsAnimating || domAnimating;
			if (!force && (this.animationActive || this.renderInvalidated)) this.scheduleRender();
			return;
		}
		if (!renderTargets) return;
		const { controls: controlsAnimating, wheel: wheelZoomAnimating } = this.interaction.advance(
			now,
			delta
		);

		// The damped camera distance is the single animation clock for geometry and
		// every close-up UI phase. Phase remapping remains, temporal lag does not.
		this.panelFocus = this.getZoomFocusFactor();
		this.panelUiFocus = getStageUiFocus(this.panelFocus);
		this.minimapFocus = getSequencedMinimapFocus(this.panelFocus, this.panelUiFocus);
		this.updateStageCameraProjection();
		this.reportZoomFocus({
			focus: this.panelFocus,
			uiFocus: this.panelUiFocus,
			uiOpacity: getPanelFocusOpacity(this.panelUiFocus),
			minimapFocus: this.minimapFocus
		});
		this.syncPanelLayouts();
		const panelsAnimating = this.updatePanelPointerInteraction(delta);
		const panelDomModeAnimating = this.updatePanelDomRenderModes();

		this.pipeline.renderFrame(false, !this.scrollActive && !this.catalogHandoff);
		this.cssRenderer.render(this.panelContentScene, this.panelCamera);
		this.renderFlatPanelSurfaces();

		this.animationActive =
			this.presentation.readiness.animating ||
			this.catalogLayerAnimating ||
			(this.stageViewportVisible &&
				(!this.catalogHandoff || this.catalogMotionComplete) &&
				Boolean(this.refinement)) ||
			this.spaceMouseMoving ||
			controlsAnimating ||
			wheelZoomAnimating ||
			this.wheelZoomTargetDistance !== undefined ||
			this.zoomResetTargetDistance !== undefined ||
			this.viewResetActive ||
			panelsAnimating ||
			panelDomModeAnimating;

		if (!force && (this.animationActive || this.renderInvalidated)) this.scheduleRender();
	}

	/** Draws only spatial UI into the transparent canvas above the page DOM. */

	/** Renders every glass surface below the DOM while preserving minimap screen projection. */

	private renderStage() {
		if (
			this.stageViewportVisible &&
			(!this.catalogHandoff || this.catalogMotionComplete) &&
			this.pageModelReady &&
			this.presentation.renderRefinement(
				this.renderer,
				this.scene,
				this.pagePreparation?.environment.value?.target.texture,
				() => this.pipeline.renderStageContents(),
				(model, outline) => {
					this.collectModelPickTargets(model);
					this.pipeline.createModelOutline(outline);
				},
				window.matchMedia('(prefers-reduced-motion: reduce)').matches
			)
		)
			return;
		this.pipeline.renderStageContents();
	}
}
