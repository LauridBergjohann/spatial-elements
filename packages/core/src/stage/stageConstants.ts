import * as THREE from 'three/webgpu';
import type { LiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import type { BackgroundSettings, StageInteractionTheme } from './stageTypes.js';

/** Default environment presentation used when a route supplies no background settings. */
export const DEFAULT_BACKGROUND = {
	blurriness: 0.2,
	tint: '#b6deff',
	tintIntensity: 0.3
} satisfies BackgroundSettings;

/** Fallback panel used by the imperative API when no declarative panels are registered. */
export const DEFAULT_PANELS = [
	{
		width: 360,
		height: 230,
		radius: 42,
		position: { x: 0, y: 42 },
		backdropBlur: 3,
		refraction: 12,
		tint: '#ffffff',
		tintOpacity: 0.28,
		bezel: 18,
		thickness: 0.35,
		specularOpacity: 0.18,
		shadowIntensity: 0.28,
		opacity: 1
	}
] satisfies LiquidGlassPanelOptions[];

export const PANEL_CAMERA_FOV = 36;
export const PANEL_CONTENT_Z = 0;
/** Shared maximum tilt for every panel at a pointer edge. */
export const PANEL_POINTER_MAX_TILT = THREE.MathUtils.degToRad(10);
export const PANEL_POINTER_MAX_LIFT = 8;
export const PANEL_POINTER_DAMPING = 12;
/** Pointer approach distance derived from the short side with a capped aspect correction. */
export const PANEL_POINTER_PROXIMITY_SCALE = 0.75;
export const PANEL_POINTER_PROXIMITY_ASPECT_LIMIT = 1.65;
export const PANEL_POINTER_PROXIMITY_MIN = 72;
export const PANEL_POINTER_PROXIMITY_MAX = 180;
export const PANEL_FOCUS_MAX_OFFSET = 190;
export const PANEL_FOCUS_MAX_ADVANCE = 360;
/** Caps restored shared-perspective egress on unusually short viewports. */
export const PANEL_FOCUS_PERSPECTIVE_MAX_SCALE = 1.65;
export const PANEL_FOCUS_MIN_OPACITY = 0;
export const PANEL_FOCUS_MAX_BLUR = 7;
/** Exponential damping applied to mouse-wheel dolly input. */
export const WHEEL_ZOOM_DAMPING = 8.5;
/** Exponential damping used while scrolling a close-up back toward the overview. */
export const ZOOM_RESET_DAMPING = 8.5;
/** Duration range for an explicit return to the fitted element view. */
export const VIEW_RESET_MIN_DURATION = 0.3;
export const VIEW_RESET_MAX_DURATION = 0.8;
export const MINIMAP_DEFAULT_EXPANDED_HEIGHT = 230;
/** Viewport inset used only while the minimap is expanded by camera zoom. */
export const MINIMAP_FOCUSED_VIEWPORT_INSET = 10;
export const MINIMAP_PANEL_Z = 8;
export const MINIMAP_POINTER_MODEL_LIFT = 24;
/** Default model scale at full minimap hover, independent of its dock presentation scale. */
export const MINIMAP_DEFAULT_HOVER_MODEL_SCALE = 1.16;
export const MINIMAP_OVERLAY_Z = 0.4;
export const MINIMAP_VIEWPORT_BORDER_THICKNESS = 3;
export const MINIMAP_MIN_BLUR_GUARD = 56;
export const MINIMAP_DEFAULT_OVERLAY_BLUR = 10;
export const MINIMAP_OVERLAY_REVEAL_DAMPING = 10;
export const MINIMAP_DEFAULT_CONTEXT_OPACITY = 0;
export const MINIMAP_DEFAULT_CONTEXT_COLOR = '#000000';
export const MINIMAP_MODEL_RENDER_ORDER = 14;
export const MINIMAP_DEFAULT_MODEL_SCALE = 1;
/** Fraction of the minimap's short side reserved for the element bounding sphere. */
export const MINIMAP_MODEL_FILL = 0.96;
/** Suppresses only floating-point noise while keeping DOM focus on the camera timeline. */
export const ZOOM_FOCUS_NOTIFY_EPSILON = 0.000001;
/** Responsive spatial-element-fit margin that lets authored silhouettes fill the viewport. */
export const SPATIAL_ELEMENT_CAMERA_FIT_MARGIN = 1;
/** Existing default view expressed as orbit angles for backwards-compatible framing. */
export const DEFAULT_CAMERA_AZIMUTH = THREE.MathUtils.radToDeg(Math.atan2(0.45, 1));
export const DEFAULT_CAMERA_ELEVATION = THREE.MathUtils.radToDeg(
	Math.asin(0.28 / Math.hypot(0.45, 0.28, 1))
);
export const DEFAULT_HDR = '';
export const DEFAULT_GLB = '';

/** Default element hover outline, tuned to remain visible on light and dark scenes. */
export const DEFAULT_INTERACTION_THEME = {
	outlineColor: '#7db7ff',
	outlineOpacity: 0.3,
	outlineThickness: 1,
	outlineGlow: 0.9,
	outlineGlowThickness: 8
} satisfies StageInteractionTheme;
