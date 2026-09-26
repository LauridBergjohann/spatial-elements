import type { SpatialElementLodPair } from '../catalog/spatialElementLodPair.js';
import type { ColorRepresentation, Mesh } from 'three';
import type { LiquidGlassPanelOptions } from './LiquidGlassPanel.js';

/** Selects the rendering backend and visual complexity of a panel surface. */
export type StagePanelSurface = 'solid' | 'frosted' | 'glass';

/** Controls how the HDR environment is presented behind the stage. */
export interface BackgroundSettings {
	/** Three.js background blur amount in the range supported by the active renderer. */
	blurriness: number;
	/** Color mixed over the HDR background. */
	tint: ColorRepresentation;
	/** Strength of the background tint, where zero leaves the HDR unchanged. */
	tintIntensity: number;
}

/** Axis rotations, in radians, applied to a loaded model before it is fitted. */
export interface StageModelRotation {
	x?: number;
	y?: number;
	z?: number;
}

/** Controls the fitted camera's initial orbit around the element. */
export interface StageCameraSettings {
	/** Horizontal viewing angle in degrees. Positive values view from the right. */
	azimuth?: number;
	/** Vertical viewing angle in degrees. Positive values view from above. */
	elevation?: number;
	/** Empty space in CSS pixels reserved on every side of the automatic element fit. */
	fitPadding?: number;
	/** Presentation multiplier applied after fitting. Values above one make the element larger. */
	fitScale?: number;
}

/** Supported blend modes for declarative stage material replacements. */
export type StageMaterialBlending = 'normal' | 'additive';

/** Serializable subset used to replace an asset mesh with a physical material. */
export interface StagePhysicalMaterialSettings {
	type: 'physical';
	color?: ColorRepresentation;
	opacity?: number;
	transparent?: boolean;
	metalness?: number;
	roughness?: number;
	iridescence?: number;
	clearcoat?: number;
	blending?: StageMaterialBlending;
}

export type StageMaterialSettings = StagePhysicalMaterialSettings;

/** Controls the authored model pose and which meshes represent the actual element. */
export interface StageModelSettings {
	/** Optional rotation applied on top of the GLB scene's authored root rotation. */
	rotation?: StageModelRotation;
	/**
	 * Exact, case-sensitive mesh names that remain visible on the main stage but do
	 * not participate in element bounds, picking, outlining, or element minimaps.
	 */
	excludeMeshes?: readonly string[];
	/** Physical material replacements keyed by exact, case-sensitive mesh name. */
	materialOverrides?: Readonly<Record<string, StageMaterialSettings>>;
}

/** Controls the minimap model presentation while its panel is docked. */
export interface StageMinimapDockedView {
	/** Model multiplier used only while the minimap is docked. */
	scale?: number;
	/** Horizontal viewing angle in degrees. Positive values view from the right. */
	azimuth?: number;
	/** Vertical viewing angle in degrees. Positive values view from above. */
	elevation?: number;
}

/** Configures the optional element minimap rendered on top of a panel. */
export interface StageMinimapOptions {
	/** Panel height, in CSS pixels, at maximum stage zoom. */
	expandedHeight?: number;
	/** Space, in CSS pixels, reserved around the minimap model. */
	inset?: number;
	/** Additional unbounded scale applied to the fitted minimap model. Values below 0.2 are clamped. */
	modelScale?: number;
	/** Model multiplier at full pointer hover. Use 1 to disable hover enlargement. */
	hoverModelScale?: number;
	/** Hover multiplier used once the minimap is expanded by camera zoom. */
	expandedHoverModelScale?: number;
	/** Optional spatial-element-specific presentation used while the minimap is docked. */
	dockedView?: StageMinimapDockedView;
	/** Color drawn over the blurred area outside the viewport cutout. */
	overlayColor?: ColorRepresentation;
	/** Overlay alpha using the same zero-to-one convention as CSS/Figma. */
	overlayOpacity?: number;
	/** Gaussian blur radius in CSS pixels. */
	overlayBlur?: number;
	/** Color behind the minimap capture when no stage background is rendered. */
	contextColor?: ColorRepresentation;
	/** Alpha of the minimap capture background. */
	contextOpacity?: number;
	/** Color of the rectangle describing the main camera viewport. */
	viewportColor?: ColorRepresentation;
}

/** Connects one DOM panel declaration to its WebGPU and CSS3D representations. */
export interface StagePanelTarget {
	/** Accessible DOM content displayed above the WebGPU panel. */
	content: HTMLElement;
	/** Inner content padding in CSS pixels. */
	contentInset: number;
	/** DOM element whose layout determines the panel position and dimensions. */
	frame: HTMLElement;
	/** Complete DOM surface used by solid and frosted CSS3D panels. */
	surfaceElement: HTMLElement;
	/** Enables the panel's minimap rendering mode. */
	minimap?: StageMinimapOptions;
	/** Enables proximity lift and pointer-driven tilt. Defaults to true. */
	pointerReactive?: boolean;
	/** Shared geometry, tint, blur, and shadow configuration. */
	options: LiquidGlassPanelOptions;
	/** Visual surface backend. All variants share the same CSS3D transform pipeline. */
	surface: StagePanelSurface;
	/** Reads the current opacity of the visual surface independently of its content. */
	getSurfaceOpacity?: () => number;
	/** Reads a transient scale applied only to the rendered minimap model. */
	getMinimapModelScale?: () => number;
	/** Reads the animated transition from the regular to the docked minimap view. */
	getMinimapDockProgress?: () => number;
	/** Reads the viewport-space top edge used to anchor the rendered model. */
	getMinimapModelTop?: () => number | undefined;
}

/** Identifies the DOM region used to frame the main element camera. */
export interface StageViewportTarget {
	element: HTMLElement;
}

/** Describes the independently animated phases of a close-up zoom. */
export interface StageZoomFocusState {
	/** Camera-derived close-up amount, from the fitted view to maximum zoom. */
	focus: number;
	/** Progress used to fade and move ordinary page content and panels. */
	uiFocus: number;
	/** Exact opacity applied to ordinary panels and non-stage DOM content. */
	uiOpacity: number;
	/** Delayed progress used to expand and morph the minimap. */
	minimapFocus: number;
}

/** A deterministic camera pose used by browser-level visual regression tests. */
export interface StageVisualTestView {
	/** Normalized camera distance, where zero is the fitted view and one is maximum zoom. */
	zoom?: number;
	/** Horizontal orbit offset from the initial pose, in degrees. */
	azimuth?: number;
	/** Vertical orbit offset from the initial pose, in degrees. */
	polar?: number;
	/** Orbit-target offset expressed as a fraction of the fitted model radius. */
	targetOffset?: Partial<{ x: number; y: number; z: number }>;
}

/** Construction options for a {@link StageExperience}. */
export interface StageExperienceOptions {
	/** Directory containing Draco decoder files, including trailing slash. */
	dracoDecoderPath?: string;
	/** Opaque page surface, independent of the HDR environment. */
	pageBackground?: string;
	/** Reveals semantic content when the device can no longer render. */
	onDeviceLost?: () => void;
	lodPair?: SpatialElementLodPair;
	/** Catalog pages register their own presentations, including an intentionally empty list. */
	catalog?: boolean;
	/** A restored dock uses Low only; optional detail preparation resumes when the hero returns. */
	deferDetailPreparation?: boolean;
	heroIsPresented?: () => boolean;
	background?: BackgroundSettings;
	hdr?: string;
	glb?: string;
	model?: StageModelSettings;
	camera?: StageCameraSettings;
	interactionTheme?: Partial<StageInteractionTheme>;
	panels?: StagePanelTarget[];
	viewport?: StageViewportTarget;
	/** Enables optional 3DxWare/SpaceMouse navigation. Defaults to true. */
	enableSpaceMouse?: boolean;
	/** Receives the normalized, sequenced phases of a close-up zoom. */
	onZoomFocusChange?: (state: StageZoomFocusState) => void;
}

/** Visual and filtering options for element hover interaction. */
export interface StageInteractionTheme {
	outlineColor: ColorRepresentation;
	outlineOpacity: number;
	outlineThickness: number;
	outlineGlow: number;
	outlineGlowThickness: number;
	/** Returns true for model meshes that must not participate in picking or outlining. */
	excludeMesh?: (mesh: Mesh) => boolean;
}
