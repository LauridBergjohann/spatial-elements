import type { VerifiedSpatialElementAssetManifest } from '../catalog/spatialElementAssets.js';
import type { SpatialElementGeometry } from './spatialElementGeometry.js';
import type {
	BackgroundSettings,
	StageCameraSettings,
	StageInteractionTheme,
	StageModelSettings
} from '../stage/stageTypes.js';
import type {
	StagePanelMinimapOptions,
	StagePanelShape,
	StagePanelTheme
} from '../stage/panelContext.js';

/**
 * Category-card projection created by {@link getSpatialListItems}.
 * Includes the element's assets automatically; pass these items to ListSection or CarouselSection.
 * Detail-only media and breadcrumbs are omitted. No catalog data belongs in the layout.
 */
export interface SpatialListItem extends Partial<
	Pick<
		SpatialElementData,
		| 'geometry'
		| 'hdr'
		| 'background'
		| 'model'
		| 'camera'
		| 'assetManifest'
		| 'fallbackImage'
		| 'fallbackImageSize'
	>
> {
	/** @internal Runtime-only pose provider installed by a section, never serialized in route data. */
	pose?: import('../catalog/catalogPose.js').CatalogPoseProvider;
	/** Optional full summary projection, sourced from the same document as the DETAIL. */
	summary?: {
		features: SpatialElementFeature[];
		action?: SpatialElementAction;
		/** Optional authored link to an existing element content section. */
		sectionLink?: { href: string; label: string };
	};
	/** Stable optional key when the same element occurs twice within a section. */
	itemKey?: string;
	/** @internal Presentation identity assigned by a section; assets retain element identity. */
	occurrence?: string;
	/** Stable element identity, shared with the detail document. */
	id: string;
	/** Ordinary link to the detail page. */
	href: string;
	/** Short label above the title; the helper supplies an empty string when omitted. */
	eyebrow: string;
	/** Visible card title. */
	title: string;
	/** Plain-text feature labels for compact card presentation. */
	features: string[];
}

/** Shared CSS-glass controls for regular element sections. */
export interface SpatialSectionTheme {
	tint: string;
	/** Direct tint opacity from zero to one. */
	tintOpacity: number;
	/** CSS backdrop blur radius in pixels. */
	backdropBlur: number;
}

/** CSS material used only by the fixed element header and its docked subnavigation. */
export interface SpatialDockedPanelTheme {
	/** Gaussian CSS backdrop blur radius in pixels. */
	backdropBlur: number;
	/** Surface tint, using the same color representation as a stage panel. */
	tint: NonNullable<StagePanelTheme['tint']>;
	/** Direct tint opacity from zero to one. */
	tintOpacity: number;
	/** Normalized shadow intensity from zero to one. */
	shadowIntensity: number;
}

/** Shared visual language supplied by a brand layout to element pages beneath it. */
export interface SpatialTheme {
	/** Stable namespace shared by pages and transitions, e.g. `shop`. Not an element ID. */
	id: string;
	/** Human-readable brand name used in accessible labels. */
	name: string;
	/** Opaque CSS/Three.js color behind content and the independently revealed HDR stage. */
	background: string;
	/** Shared minimap appearance; element-specific framing belongs in SpatialElementData.minimap. */
	minimapTheme: SpatialMinimapTheme;
	/** Hover/selection outline appearance. */
	interactionTheme: Partial<StageInteractionTheme>;
	/** Panel corner radius and content padding, in CSS pixels. */
	panelShape: StagePanelShape;
	/** Default panel material. `frosted` uses CSS blur; `glass` also uses GPU refraction. */
	panelTheme: StagePanelTheme;
	/** Appearance of the compact header and tabs shown after scrolling past the hero. */
	dockedPanelTheme: SpatialDockedPanelTheme;
	/** Appearance of ordinary HTML content sections. */
	sectionTheme: SpatialSectionTheme;
	/** Semantic text, action and navigation colors. */
	colors: {
		ink: string;
		body: string;
		accent: string;
		onAccent: string;
		tabBackground: string;
	};
}

/** A single line in the spatial-element-summary feature list. */
export interface SpatialElementFeature {
	label: string;
	/** Optional short marker displayed before the feature text. */
	marker?: string;
}

/** Primary conversion action displayed in the element summary panel. */
export interface SpatialElementAction {
	label: string;
	/** Stable behavior identity for shared presentation; never supplies an event handler. */
	semanticId?: string;
	href?: string;
	ariaLabel?: string;
}

/** A breadcrumb link or terminal breadcrumb label. */
export interface SpatialElementBreadcrumb {
	label: string;
	href?: string;
}

/** Media entries rendered in the element rail. */
export type SpatialElementMediaItem =
	| { id: string; kind: 'minimap'; label: string }
	| { id: string; kind: 'drawing'; label: string }
	| { id: string; kind: 'image'; label: string; src: string; alt: string };

/** Optional CSS presentation for a regular HTML element section. */
export interface SpatialElementSectionStyle {
	/** Overrides the brand section tint. */
	tint?: string;
	/** Overrides the brand section tint opacity from zero to one. */
	tintOpacity?: number;
	/** Overrides the brand section backdrop blur radius in pixels. */
	backdropBlur?: number;
	textColor?: string;
	/** CSS max-width such as `920px`, `72rem`, or `100%`. */
	width?: string;
}

/** Metadata supplied to a composable spatial-element `Section`. */
export interface SpatialElementSectionDefinition {
	id: string;
	title: string;
	style?: SpatialElementSectionStyle;
}

/** Minimal section metadata consumed by generated element navigation. */
export type SpatialElementSectionNavigationItem = Pick<
	SpatialElementSectionDefinition,
	'id' | 'title'
>;

/**
 * Serializable element content AND its 3D presentation. Supply the same source data to
 * getSpatialListItems on a category page and SpatialElementPage on the detail page.
 * Only id, title, geometry and hdr are required. Layout-wide appearance belongs in SpatialTheme.
 */
export interface SpatialElementData {
	/** Stable element identity within the shell's theme namespace; also used by findSpatialElement. */
	id: string;
	/** Optional identity assertion. When supplied, must match the enclosing theme.id. */
	brandId?: string;
	/** Document title. Defaults to title. */
	pageTitle?: string;
	/** Short category/series label displayed above the title. Defaults to an empty string. */
	eyebrow?: string;
	/** Visible element name. */
	title: string;
	/** Summary bullets. Defaults to an empty list. */
	features?: SpatialElementFeature[];
	/** Optional primary action; omitted actions render no button. */
	action?: SpatialElementAction;
	/** Required Low/High model sources. Identical URLs share one load; both exports must share coordinates. */
	geometry: SpatialElementGeometry;
	/** Detail lighting and background HDR. Category lighting is explicitly set on ContentPage.hdr. */
	hdr: string;
	/** HDR background blur/tint. Does not change the theme's flat page background or model lighting. */
	background?: BackgroundSettings;
	/** Imported model pose, excluded meshes and material replacements. Rotations are in radians. */
	model?: StageModelSettings;
	/** Initial orbit in degrees and optional fit controls. Distance is fitted automatically. */
	camera?: StageCameraSettings;
	/** Advanced verified resource manifest. Omit for the normal GLB/LOD workflow. */
	assetManifest?: VerifiedSpatialElementAssetManifest;
	/** Poster URL displayed during loading, without JavaScript, or when WebGPU is unavailable. */
	fallbackImage?: string;
	/** Actual poster pixel dimensions [width, height], not physical model dimensions. */
	fallbackImageSize?: readonly [number, number];
	/** Navigation trail. Entries without href are plain text; defaults to an empty list. */
	breadcrumbs?: SpatialElementBreadcrumb[];
	/** Media rail entries. Defaults to one interactive 3D minimap; [] hides the rail's entries. */
	media?: SpatialElementMediaItem[];
	/** Element-specific minimap fit/hover/docked pose. Colors come from the theme. */
	minimap?: Omit<StagePanelMinimapOptions, keyof SpatialMinimapTheme>;
}

/** Brand-wide minimap appearance; framing and model pose remain spatial-element-specific. */
export type SpatialMinimapTheme = Pick<
	StagePanelMinimapOptions,
	| 'expandedHeight'
	| 'overlayColor'
	| 'overlayOpacity'
	| 'overlayBlur'
	| 'contextColor'
	| 'contextOpacity'
	| 'viewportColor'
>;

/** Category/content page metadata; only title is required. */
export interface ContentPageData {
	/** Browser document title; defaults to title. */
	pageTitle?: string;
	title: string;
	eyebrow?: string;
	intro?: string;
	breadcrumbs?: SpatialElementBreadcrumb[];
}
