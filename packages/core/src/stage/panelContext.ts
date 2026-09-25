
import type { LiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import type { StageMinimapDockedView, StagePanelSurface } from './stageTypes.js';

export const STAGE_CONTEXT_KEY = Symbol('stage');

/** Notifies an active stage that externally positioned panel frames changed layout. */
export const STAGE_PANEL_LAYOUT_EVENT = 'stage:panel-layout';

/** Notifies an active stage that an external panel visual changed without affecting layout. */
export const STAGE_PANEL_VISUAL_EVENT = 'stage:panel-visual';

export interface StagePanelPose {
	width: number;
	height: number;
	position: { x: number; y: number };
}

export interface StagePanelShape {
	radius: number;
	contentInset?: number;
}

export type StagePanelTheme = Omit<
	LiquidGlassPanelOptions,
	'width' | 'height' | 'position' | 'radius'
> & {
	/** Semantic surface style. Defaults to the WebGPU-backed `glass` mode. */
	surface?: StagePanelSurface;
};



export interface StagePanelMinimapOptions {
	expandedHeight?: number;
	inset?: number;
	/** Additional unbounded scale applied to the fitted model. Values below 0.2 are clamped. */
	modelScale?: number;
	/** Model multiplier at full pointer hover. Use 1 to disable hover enlargement. */
	hoverModelScale?: number;
	/** Hover multiplier used once the minimap is expanded by camera zoom. */
	expandedHoverModelScale?: number;
	/** Optional product-specific presentation used while the minimap is docked. */
	dockedView?: StageMinimapDockedView;
	overlayColor?: string | number;
	overlayOpacity?: number;
	/** Gaussian blur radius in CSS pixels. */
	overlayBlur?: number;
	contextColor?: string | number;
	contextOpacity?: number;
	viewportColor?: string | number;
}

export interface StagePanelRegistration {
	getContentInset(): number;
	getElement(): HTMLElement | undefined;
	getFrameElement(): HTMLElement | undefined;
	getSurfaceElement(): HTMLElement | undefined;
	getPointerReactive(): boolean;
	getMinimapOptions(): StagePanelMinimapOptions | undefined;
	getOptions(): LiquidGlassPanelOptions;
	getSurface(): StagePanelSurface;
	/** Returns the opacity of the panel surface without affecting panel content. */
	getSurfaceOpacity(): number;
	/** Returns a transient presentation scale applied to a rendered minimap model. */
	getMinimapModelScale(): number;
	/** Returns the animated transition from the regular to the docked minimap view. */
	getMinimapDockProgress(): number;
	/** Returns the viewport-space top edge used to anchor the rendered model. */
	getMinimapModelTop(): number | undefined;
}

export interface StageViewportRegistration {
	getElement(): HTMLElement | undefined;
}

export interface StageContext {
	prefetchProduct?(stage: import('../product-detail/types.js').ProductStageConfig): void;
	registerPanel(panel: StagePanelRegistration): () => void;
	registerViewport(viewport: StageViewportRegistration): () => void;
	/** Restores the product camera to its initial fitted pose. */
	resetView(): void;
}
