<script lang="ts">
	import type { SpatialElementLodPair } from '@spatial-elements/core/catalog/spatialElementLodPair';
	import { onMount, setContext, tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import type {
		BackgroundSettings,
		StageCameraSettings,
		StageExperience,
		StageInteractionTheme,
		StageModelSettings,
		StagePanelTarget,
		StageVisualTestView,
		StageViewportTarget,
		StageZoomFocusState
	} from '@spatial-elements/core/stage/StageExperience';
	import { isStageVisualTestMode, type StageVisualTestController } from '@spatial-elements/core/stage/stageVisualTest';
	import { VirtualScrollController } from '@spatial-elements/core/stage/VirtualScrollController';
	import ScrollNavigationBridge from '../catalog/ScrollNavigationBridge.svelte';
	import { CatalogTransition } from '@spatial-elements/core/catalog/CatalogTransition';
	import { CATALOG_ENDPOINTS, CatalogEndpointRegistry } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import '../catalog/catalogTransition.css';
	import { createStageSpatialElementAssetManifest } from '@spatial-elements/core/catalog/spatialElementAssets';
	import { CATALOG_ITEMS, CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
	import { CATALOG_SECTIONS, CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
	import type { CatalogPage } from '@spatial-elements/core/catalog/catalogPage';
	import type { OnNavigate } from '@sveltejs/kit';
	import {
		STAGE_CONTEXT_KEY,
		type StageContext,
		type StagePanelRegistration,
		type StageViewportRegistration
	} from '@spatial-elements/core/stage/panelContext';

	interface Props {
		dracoDecoderPath?: string;
		ariaLabel?: string;
		background?: BackgroundSettings;
		pageBackground?: string;
		hdr?: string;
		glb?: string;
		lodPair?: SpatialElementLodPair;
		model?: StageModelSettings;
		camera?: StageCameraSettings;
		interactionTheme?: Partial<StageInteractionTheme>;
		catalog?: CatalogPage;
		children?: Snippet;
	}

	let {
		ariaLabel = 'WebGPU 3D stage',
		dracoDecoderPath,
		pageBackground = '#ffffff',
		background,
		hdr,
		glb,
		lodPair,
		model,
		camera,
		interactionTheme,
		catalog,
		children
	}: Props = $props();

	let displayedSpatialElements = $state<SpatialListItem[]>([]);
	setContext(CATALOG_ITEMS, new CatalogItems((items) => (displayedSpatialElements = items)));
	setContext(CATALOG_SECTIONS, new CatalogSections());
	const catalogSpatialElements = $derived(
		displayedSpatialElements.length ? displayedSpatialElements : (catalog?.spatialElements ?? [])
	);
	const registeredPanels: StagePanelRegistration[] = [];
	const catalogEndpoints = new CatalogEndpointRegistry();
	setContext(CATALOG_ENDPOINTS, catalogEndpoints);
	let registeredViewport: StageViewportRegistration | undefined;
	let stage: HTMLDivElement;
	let virtualScrollSpacer: HTMLDivElement;
	let domLayer: HTMLDivElement;
	let status = $state('Loading stage');
	let showStatus = $state(true);
	let isEnhanced = $state(false);
	let isFallback = $state(true);
	let domLayerHidden = $state(false);
	let domLayerOpacity = $state(1);
	let experience = $state<StageExperience | null>(null);
	let stageState = $state<'loading' | 'enhanced' | 'fallback'>('loading');
	let zoomFocusState = $state<StageZoomFocusState>({
		focus: 0,
		uiFocus: 0,
		uiOpacity: 1,
		minimapFocus: 0
	});
	let visualTestController: StageVisualTestController | undefined;
	let virtualScroll = $state<VirtualScrollController>();
	let transition: CatalogTransition | undefined;
	let initialized: Promise<void> | undefined;
	let navigationGeneration = 0;
	let destroyed = false;
	let nextPageBinding: Promise<void> | undefined;
	let releasePageBinding: (() => void) | undefined;
	let pageBindingConsumed = false;
	let reuseCatalogPage = false;
	let retainedPageSignature: string | undefined;
	const pageSignature = () =>
		JSON.stringify([
			pageBackground,
			background,
			hdr,
			glb,
			lodPair,
			model,
			camera,
			interactionTheme
		]);
	const restingZoomFocus: StageZoomFocusState = {
		focus: 0,
		uiFocus: 0,
		uiOpacity: 1,
		minimapFocus: 0
	};

	setContext<StageContext>(STAGE_CONTEXT_KEY, {
		prefetchSpatialElement: (config) => experience?.prefetchSpatialElement(config),
		registerPanel(panel) {
			registeredPanels.push(panel);

			return () => {
				const index = registeredPanels.indexOf(panel);
				if (index >= 0) registeredPanels.splice(index, 1);
			};
		},
		registerViewport(viewport) {
			registeredViewport = viewport;

			return () => {
				if (registeredViewport === viewport) registeredViewport = undefined;
			};
		},
		resetView() {
			experience?.resetView();
		}
	});

	onMount(() => {
		document.documentElement.classList.add('stage-route');
		document.body.classList.add('stage-route');
		virtualScroll = new VirtualScrollController(stage, domLayer, virtualScrollSpacer);
		virtualScroll.start();
		transition = new CatalogTransition(stage, catalogEndpoints, {
			captureContentGeometry: (endpoint, secondary) =>
				experience?.captureContentGeometry(endpoint.spatialElementId, secondary) ?? false,
			prepareContentParticipants: (pairs) => experience?.prepareContentParticipants(pairs),
			adoptContentParticipants: (pairs) => experience?.adoptContentParticipants(pairs),
			promoteContentParticipant: (source) => experience?.promoteContentParticipant(source) ?? false,
			geometryPoint: () => experience?.getCatalogGeometryPoint() ?? null,
			adoptGeometry: (destination) => experience?.adoptCatalogPresentation(destination) ?? false,
			beginMotion: () => experience?.beginCatalogMotion() ?? 'asynchronous',
			backgroundPrepared: () => experience?.isCatalogBackgroundPrepared() ?? false,
			captureGeometry: (source) => experience?.captureGeometry(source) ?? false,
			prepareDestination: (destination) =>
				experience?.prepareGeometryDestination(destination) ?? false,
			setGeometryProgress: (progress) => experience?.setCatalogGeometryProgress(progress),
			flushFrame: () => experience?.flushCatalogFrame(),
			finishGeometry: () => {
				try {
					experience?.finishCatalogGeometry();
				} finally {
					if (pageBindingConsumed) releasePageBinding?.();
				}
			},
			setPresentation: (presentation) => experience?.setCatalogTransitionPresentation(presentation),
			resolveSurface: (element) => experience?.resolvePanelSurface(element) ?? element,
			captureSurface: (element) => experience!.capturePanelSurface(element),
			captureElement: (element) => experience?.capturePanelElement(element)
		});

		let disposed = false;
		setZoomFocusState(restingZoomFocus);

		const init = async () => {
			await tick();
			if (disposed) return;
			if (!navigator.gpu) {
				stageState = 'fallback';
				showStatus = false;
				return;
			}

			const { StageExperience } = await import('@spatial-elements/core/stage/StageExperience');
			if (disposed) return;
			const panels = getPanelTargets();
			const viewport = getViewportTarget();
			const instance = new StageExperience(stage, {
				dracoDecoderPath,
				catalog: Boolean(catalog),
				heroIsPresented: () =>
					!catalog?.spatialElementId ||
					catalogEndpoints.getComposition({
						brandId: catalog.brandId,
						spatialElementId: catalog.spatialElementId
					}) !== 'dock',
				background,
				pageBackground,
				hdr,
				glb,
				lodPair,
				model,
				camera,
				interactionTheme,
				panels,
				viewport,
				enableSpaceMouse: !isStageVisualTestMode(),
				onDeviceLost: () => {
					if (disposed || experience !== instance) return;
					navigationGeneration += 1;
					transition?.cancel();
					experience = null;
					try {
						instance.dispose();
					} finally {
						setZoomFocusState(restingZoomFocus);
						isEnhanced = false;
						isFallback = true;
						stageState = 'fallback';
						showStatus = false;
					}
				},
				onZoomFocusChange: (focusState) => {
					setZoomFocusState(focusState);
				}
			});
			experience = instance;
			await instance.init();

			if (disposed || experience !== instance) {
				instance.dispose();
				if (experience === instance) experience = null;
				return;
			}

			isEnhanced = true;
			isFallback = false;
			showStatus = false;
			stageState = 'enhanced';
			registerSpatialElements();
			if (catalog) void instance.setCatalogSpatialElements(catalog.brandId, catalogSpatialElements);

			if (isStageVisualTestMode()) {
				visualTestController = createVisualTestController();
				window.__stageVisualTest = visualTestController;
			}
		};

		initialized = init().catch((error: unknown) => {
			if (disposed) return;
			console.error(error);
			experience?.dispose();
			experience = null;
			status = error instanceof Error ? error.message : 'Unable to initialize WebGPU stage';
			isEnhanced = false;
			isFallback = true;
			stageState = 'fallback';
			setZoomFocusState(restingZoomFocus);
			showStatus = false;
		});

		return () => {
			virtualScroll?.destroy();
			virtualScroll = undefined;
			destroyed = true;
			releasePageBinding?.();
			navigationGeneration += 1;
			transition?.dispose();
			document.documentElement.classList.remove('stage-route');
			document.body.classList.remove('stage-route');
			disposed = true;
			experience?.dispose();
			experience = null;
			setZoomFocusState(restingZoomFocus);
			if (window.__stageVisualTest === visualTestController) {
				delete window.__stageVisualTest;
			}
		};
	});

	$effect(() => {
		const spatialElements = catalogSpatialElements;
		if (experience && catalog && isEnhanced) {
			registerSpatialElements();
			void experience.setCatalogSpatialElements(catalog.brandId, spatialElements);
		}
	});
	function registerSpatialElements() {
		if (!catalog || !experience) return;
		for (const spatialElement of catalogSpatialElements) {
			if (spatialElement.stage)
				experience.spatialElements.setManifest(
					createStageSpatialElementAssetManifest(catalog.brandId, spatialElement.id, spatialElement.stage)
				);
		}
		if (catalog.spatialElementId && catalog.spatialElementStage) {
			experience.spatialElements.setManifest(
				createStageSpatialElementAssetManifest(catalog.brandId, catalog.spatialElementId, catalog.spatialElementStage)
			);
		}
	}

	function interruptNavigation() {
		navigationGeneration += 1;
		reuseCatalogPage = false;
		transition?.cancel();
		if (pageBindingConsumed) releasePageBinding?.();
	}

	function supersedeNavigation(destination: URL) {
		navigationGeneration += 1;
		transition?.supersede(destination);
		if (pageBindingConsumed) releasePageBinding?.();
	}

	let navigationTimings = { dataReady: 0, captured: 0, restoring: 0, bound: 0 };
	function captureNavigation(navigation: OnNavigate) {
		navigationTimings = { dataReady: performance.now(), captured: 0, restoring: 0, bound: 0 };
		navigationGeneration += 1;
		reuseCatalogPage = Boolean(
			navigation.from &&
			navigation.to &&
			transition?.capture(navigation.from.url, navigation.to.url, navigation.type)
		);
		navigationTimings.captured = performance.now();
		if (reuseCatalogPage) {
			retainedPageSignature = pageSignature();
			return;
		}
		experience?.releasePage();
		setZoomFocusState(restingZoomFocus);
	}

	async function restoreNavigation() {
		navigationTimings.restoring = performance.now();
		const generation = navigationGeneration;
		await initialized;
		await tick();
		if (destroyed || generation !== navigationGeneration || !experience) return;
		try {
			if (reuseCatalogPage) {
				reuseCatalogPage = false;
				if (retainedPageSignature === pageSignature()) {
					await transition?.play();
					return;
				}
				transition?.cancel();
			}
			if (nextPageBinding) {
				const pending = nextPageBinding;
				nextPageBinding = undefined;
				pageBindingConsumed = true;
				await pending;
				if (destroyed || generation !== navigationGeneration) return;
			}
			registerSpatialElements();
			const catalogReady = catalog
				? experience.setCatalogSpatialElements(catalog.brandId, catalogSpatialElements)
				: undefined;
			await experience.updatePage({
				catalog: Boolean(catalog),
				heroIsPresented: () =>
					!catalog?.spatialElementId ||
					catalogEndpoints.getComposition({
						brandId: catalog.brandId,
						spatialElementId: catalog.spatialElementId
					}) !== 'dock',
				deferDetailPreparation: Boolean(
					catalog?.spatialElementId &&
					catalogEndpoints.getComposition({
						brandId: catalog.brandId,
						spatialElementId: catalog.spatialElementId
					}) === 'dock'
				),
				background,
				pageBackground,
				hdr,
				glb,
				lodPair,
				model,
				camera,
				interactionTheme,
				panels: getPanelTargets(),
				viewport: getViewportTarget()
			});
			if (destroyed || generation !== navigationGeneration) return;
			if (experience.getSpatialCapture()) {
				await Promise.race([
					catalogReady,
					new Promise<void>((resolve) => setTimeout(resolve, 500))
				]);
				if (destroyed || generation !== navigationGeneration) return;
			}
			isEnhanced = true;
			isFallback = false;
			stageState = 'enhanced';
			navigationTimings.bound = performance.now();
			await transition?.play();
		} catch (error) {
			if (destroyed || generation !== navigationGeneration) return;
			transition?.cancel();
			try {
				experience.discardFailedPage();
			} catch (cleanupError) {
				// Even a GPU cleanup failure must reveal the semantic fallback page.
				console.error('Unable to release failed catalog presentation', cleanupError);
			}
			console.error('Unable to bind catalog presentation', error);
			setZoomFocusState(restingZoomFocus);
			isEnhanced = false;
			isFallback = true;
			stageState = 'fallback';
		}
	}

	function setZoomFocusState(focusState: StageZoomFocusState) {
		const clampedFocus = clampFinite(focusState.focus, 0);
		const minimapFocus = clampFinite(focusState.minimapFocus, 0);
		const domOpacity = clampFinite(focusState.uiOpacity, 1);

		domLayerOpacity = domOpacity;
		domLayerHidden = domOpacity <= 0.001;
		zoomFocusState = {
			focus: clampedFocus,
			uiFocus: clampFinite(focusState.uiFocus, 0),
			uiOpacity: domOpacity,
			minimapFocus
		};
		// Focus diagnostics remain in data attributes. Do not publish unused inherited
		// CSS variables here: updating them invalidates styles throughout the page.
	}

	function createVisualTestController(): StageVisualTestController {
		const settle = async (frames = 12) => {
			experience?.advanceVisualTestFrames(frames);
			await Promise.resolve();
		};

		const setView = async (view: StageVisualTestView) => {
			experience?.setVisualTestView(view);
			await settle(18);
		};
		const setSpaceMouseZoom = async (zoom: number) => {
			experience?.setVisualTestSpaceMouseZoom(zoom);
			await settle(120);
		};
		const driveSpaceMouseZoom = async (zoom: number, frames = 60) => {
			experience?.driveVisualTestSpaceMouseZoom(zoom, frames);
			await Promise.resolve();
		};
		const stopSpaceMouse = async () => {
			experience?.stopVisualTestSpaceMouseMotion();
			await settle(120);
		};

		return {
			loseDevice: () => experience?.loseDeviceForTest(),
			getCarouselStats: () => experience?.getCarouselStats() ?? null,
			getCatalogStats: () => experience?.assets.getStats() ?? null,
			getCatalogEndpoints: () => catalogEndpoints.getSnapshot(),
			getCatalogOwnership: () => transition?.getOwnership() ?? null,
			getNavigationTimings: () => ({ ...navigationTimings }),
			captureHeroPresentation: () => experience?.captureHeroPresentation() ?? false,
			getSpatialCapture: () => experience?.getSpatialCapture() ?? null,
			releaseSpatialCapture: () => experience?.releaseSpatialCapture(),
			registerCatalogEndpoint: (address, element) => catalogEndpoints.register(address, element),
			getCatalogPresentation: () => experience?.getCatalogPresentation() ?? null,
			holdNextPageBinding: () => {
				releasePageBinding?.();
				pageBindingConsumed = false;
				nextPageBinding = new Promise<void>((resolve) => {
					releasePageBinding = () => {
						nextPageBinding = undefined;
						pageBindingConsumed = false;
						releasePageBinding = undefined;
						resolve();
					};
				});
			},
			releasePageBinding: () => releasePageBinding?.(),
			setView,
			setSpaceMouseZoom,
			driveSpaceMouseZoom,
			stopSpaceMouse,
			getMinimapRect: () => experience?.getVisualTestMinimapRect() ?? null,
			getModelRect: () => experience?.getVisualTestModelRect() ?? null,
			getMinimapModelRect: () => experience?.getVisualTestMinimapModelRect() ?? null,
			getMinimapOrientation: () => experience?.getVisualTestMinimapOrientation() ?? null,
			getMinimapRenderStats: () =>
				experience?.getVisualTestMinimapRenderStats() ?? {
					overlayCapturePasses: 0,
					depthNear: 0,
					depthFar: 0,
					viewportRingInForeground: false
				},
			getRenderTargetStats: () =>
				experience?.getVisualTestRenderTargetStats() ?? {
					liveTargets: 0,
					targets: [],
					canvases: [],
					creations: 0,
					resizes: 0,
					warmups: 0,
					activeScale: 0
				},
			getVisibilityStats: () =>
				experience?.getVisualTestVisibilityStats() ?? {
					stageViewportVisible: false,
					visiblePanels: 0,
					visibleMinimaps: 0,
					stageModelRenderPasses: 0,
					panelBlurRenderPasses: 0,
					panelSceneRenderPasses: 0,
					minimapSceneRenderPasses: 0
				},
			reset: () => setView({ zoom: 0 }),
			settle,
			getState: () => ({ ...zoomFocusState })
		};
	}

	function clampFinite(value: number, fallback: number) {
		return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : fallback;
	}
	function getViewportTarget(): StageViewportTarget | undefined {
		const element = registeredViewport?.getElement();
		return element ? { element } : undefined;
	}

	function getPanelTargets() {
		const targets: StagePanelTarget[] = [];

		registeredPanels.forEach((panel) => {
			const frame = panel.getFrameElement();
			const content = panel.getElement();
			const surfaceElement = panel.getSurfaceElement();
			if (!frame || !content || !surfaceElement) return;

			targets.push({
				content,
				contentInset: panel.getContentInset(),
				frame,
				getMinimapDockProgress: panel.getMinimapDockProgress,
				getMinimapModelScale: panel.getMinimapModelScale,
				getMinimapModelTop: panel.getMinimapModelTop,
				getSurfaceOpacity: panel.getSurfaceOpacity,
				minimap: panel.getMinimapOptions(),
				options: panel.getOptions(),
				surface: panel.getSurface(),
				surfaceElement,
				pointerReactive: panel.getPointerReactive()
			});
		});

		return targets;
	}
</script>

{#if catalog}
	<ScrollNavigationBridge
		controller={virtualScroll}
		onCapture={captureNavigation}
		onSupersede={supersedeNavigation}
		onInterrupt={interruptNavigation}
		onRestored={restoreNavigation}
	/>
{/if}

<div
	bind:this={stage}
	style:--stage-page-background={pageBackground}
	class="stage"
	class:stage-enhanced={isEnhanced}
	class:stage-fallback={isFallback}
	style:--stage-dom-opacity={domLayerOpacity}
	data-stage-state={stageState}
	data-stage-focus={zoomFocusState.focus.toFixed(3)}
	data-stage-ui-focus={zoomFocusState.uiFocus.toFixed(3)}
	data-stage-minimap-focus={zoomFocusState.minimapFocus.toFixed(3)}
	data-stage-dom-opacity={zoomFocusState.uiOpacity.toFixed(3)}
	aria-label={ariaLabel}
>
	<div bind:this={virtualScrollSpacer} class="stage-virtual-scroll-spacer" aria-hidden="true"></div>

	<div class="stage-virtual-viewport">
		<div
			bind:this={domLayer}
			class="stage-dom-layer"
			class:stage-dom-hidden={domLayerHidden}
			aria-hidden={domLayerHidden}
		>
			{@render children?.()}
		</div>
	</div>

	{#if showStatus}
		<div class="stage-status">{status}</div>
	{/if}
</div>

<style>
	:global(html.stage-route),
	:global(body.stage-route) {
		margin: 0;
		min-width: 100%;
		min-height: 100%;
		background: #ffffff;
	}

	:global(body.stage-route) {
		overflow-x: hidden;
	}

	.stage {
		position: relative;
		min-height: 100vh;
		width: 100%;
		overflow: visible;
		background: var(--stage-page-background, #ffffff);
	}

	.stage-virtual-scroll-spacer {
		display: none;
		width: 1px;
		min-height: 100vh;
		pointer-events: none;
	}

	.stage-virtual-viewport {
		position: relative;
		z-index: 1;
	}

	.stage:global(.stage-virtual-scroll-active) .stage-virtual-scroll-spacer {
		display: block;
	}

	.stage:global(.stage-virtual-scroll-active) .stage-virtual-viewport {
		position: fixed;
		inset: 0;
		/* Clip without creating a second, programmatically scrollable container. */
		overflow: clip;
		pointer-events: none;
	}

	.stage :global(.stage-webgpu-background),
	.stage :global(.stage-webgpu-carousel-rear),
	.stage :global(.stage-webgpu-foreground) {
		position: fixed;
		inset: 0;
		display: block;
		width: 100vw;
		height: 100vh;
	}

	.stage :global(.stage-webgpu-background) {
		z-index: 0;
		touch-action: pan-y;
	}

	.stage :global(.stage-webgpu-carousel-rear) {
		z-index: 0;
		pointer-events: none;
	}

	.stage :global(.stage-webgpu-foreground) {
		/* Keep rendered minimaps above the fixed element header (z-index 20). */
		z-index: 21;
		pointer-events: none;
	}

	.stage :global(.stage-css3d),
	.stage :global(.stage-css3d-flat) {
		z-index: 3;
	}

	.stage :global(.stage-panel-native) {
		z-index: 2;
	}

	.stage-dom-layer {
		position: relative;
		z-index: 1;
		pointer-events: none;
	}

	.stage:global(.stage-virtual-scroll-active) .stage-dom-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		min-height: 100vh;
		will-change: transform;
	}

	/*
	 * Fade ordinary page surfaces individually. Keeping opacity off this shared
	 * ancestor lets nested backdrop filters sample the WebGPU canvas at z-index 0.
	 */
	.stage :global([data-stage-dom-content]) {
		opacity: var(--stage-dom-opacity, 1);
	}

	.stage-dom-layer.stage-dom-hidden :global([data-stage-dom-content]) {
		visibility: hidden;
		pointer-events: none !important;
	}

	.stage-dom-layer.stage-dom-hidden
		:global([data-stage-panel-fallback]:not([data-stage-panel-minimap])) {
		pointer-events: none !important;
	}

	:global(.stage.stage-enhanced [data-stage-panel-fallback][data-stage-panel-bound]) {
		visibility: hidden !important;
		opacity: 0 !important;
		pointer-events: none !important;
	}

	/* A failed binding may leave pixels in either canvas; the poster owns fallback paint. */
	.stage.stage-fallback :global(.stage-webgpu-background),
	.stage.stage-fallback :global(.stage-webgpu-carousel-rear),
	.stage.stage-fallback :global(.stage-webgpu-foreground) {
		visibility: hidden !important;
		pointer-events: none !important;
	}

	.stage-status {
		position: fixed;
		left: 16px;
		bottom: 16px;
		z-index: 3;
		max-width: min(420px, calc(100vw - 32px));
		padding: 8px 10px;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 6px;
		color: #f5f7fb;
		background: rgb(5 6 9 / 0.72);
		font:
			13px/1.35 system-ui,
			sans-serif;
	}
</style>
