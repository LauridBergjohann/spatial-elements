import type { StageVisualTestView, StageZoomFocusState } from './stageTypes.js';
import type { StageExperience } from './StageExperience.js';

export interface StageVisualTestRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface StageVisualTestMinimapRenderStats {
	overlayCapturePasses: number;
	depthNear: number;
	depthFar: number;
	viewportRingInForeground: boolean;
}

export type StageVisualTestQuaternion = [number, number, number, number];

export interface StageVisualTestMinimapOrientation {
	rest: StageVisualTestQuaternion;
	display: StageVisualTestQuaternion;
	live: StageVisualTestQuaternion;
	docked: StageVisualTestQuaternion | null;
	dockProgress: number;
}

export type StageVisualTestRenderTargetStats = ReturnType<
	StageExperience['getVisualTestRenderTargetStats']
>;

export interface StageVisualTestVisibilityStats {
	stageViewportVisible: boolean;
	visiblePanels: number;
	visibleMinimaps: number;
	stageModelRenderPasses: number;
	panelBlurRenderPasses: number;
	panelSceneRenderPasses: number;
	minimapSceneRenderPasses: number;
}

/** Browser-only controls exposed when a stage is opened with `?stage-test=1`. */
export interface StageVisualTestController {
	getNavigationTimings(): { dataReady: number; captured: number; restoring: number; bound: number };
	captureHeroPresentation(): boolean;
	getSpatialCapture(): ReturnType<StageExperience['getSpatialCapture']> | null;
	releaseSpatialCapture(): void;
	getCatalogOwnership(): ReturnType<
		import('../catalog/CatalogTransition.js').CatalogTransition['getOwnership']
	>;
	/** Query-gated fixture registration for ambiguity/teardown tests. */
	registerCatalogEndpoint(
		address: import('../catalog/CatalogEndpointRegistry.js').CatalogEndpointAddress,
		element: HTMLElement
	): () => void;
	getCatalogEndpoints(): ReturnType<
		import('../catalog/CatalogEndpointRegistry.js').CatalogEndpointRegistry['getSnapshot']
	>;
	loseDevice(): void;
	/** Holds one destination after DOM commit to verify its pre-render visibility gate. */
	holdNextPageBinding(): void;
	releasePageBinding(): void;
	getCatalogPresentation(): ReturnType<StageExperience['getCatalogPresentation']> | null;
	/** Resource ownership diagnostics for catalog navigation acceptance. */
	getCarouselStats(): ReturnType<
		import('../catalog/CatalogProductLayer.js').CatalogProductLayer['getStats']
	> | null;
	getCatalogStats(): ReturnType<StageExperience['assets']['getStats']> | null;
	/** Applies a deterministic camera pose and waits until dependent render state settles. */
	setView(view: StageVisualTestView): Promise<void>;
	/** Applies an equivalent zoom through the SpaceMouse camera/target dolly path. */
	setSpaceMouseZoom(zoom: number): Promise<void>;
	/** Repeats SpaceMouse updates while frames render, leaving the synthetic gesture active. */
	driveSpaceMouseZoom(zoom: number, frames?: number): Promise<void>;
	/** Ends a synthetic SpaceMouse gesture and lets dependent render state settle. */
	stopSpaceMouse(): Promise<void>;
	/** Returns the current rendered minimap bounds in viewport pixels. */
	getMinimapRect(): StageVisualTestRect | null;
	/** Returns the projected main product bounds in viewport pixels. */
	getModelRect(): StageVisualTestRect | null;
	/** Returns the projected 3D product bounds in viewport pixels. */
	getMinimapModelRect(): StageVisualTestRect | null;
	/** Returns canonical, displayed, and fully synchronized minimap orientations. */
	getMinimapOrientation(): StageVisualTestMinimapOrientation | null;
	/** Returns minimap overlay submissions for performance regression tests. */
	getMinimapRenderStats(): StageVisualTestMinimapRenderStats;
	/** Returns target allocation, resize, and warm-up counters. */
	getRenderTargetStats(): StageVisualTestRenderTargetStats;
	/** Returns current culling state and submitted render-pass counters. */
	getVisibilityStats(): StageVisualTestVisibilityStats;
	/** Restores the exact fitted camera pose without running the user-facing reset animation. */
	reset(): Promise<void>;
	/** Advances the renderer by a fixed number of synthetic frames. */
	settle(frames?: number): Promise<void>;
	/** Returns the latest zoom phases reported by the stage. */
	getState(): StageZoomFocusState;
}

declare global {
	interface Window {
		__stageVisualTest?: StageVisualTestController;
	}
}

/** Returns whether the current page explicitly requested deterministic visual-test controls. */
export function isStageVisualTestMode() {
	return new URLSearchParams(window.location.search).get('stage-test') === '1';
}
