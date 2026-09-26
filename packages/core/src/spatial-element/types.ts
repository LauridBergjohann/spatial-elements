import type { VerifiedSpatialElementAssetManifest } from '../catalog/spatialElementAssets.js';
import type { SpatialElementLodPair } from '../catalog/spatialElementLodPair.js';
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

/** Scene assets and environment settings required by a element stage. */
export interface SpatialStageConfig {
	dracoDecoderPath?: string;
	assetManifest?: VerifiedSpatialElementAssetManifest;
	lodPair?: SpatialElementLodPair;
	background: BackgroundSettings;
	hdr: string;
	glb: string;
	/** SpatialElement pose and non-spatial-element geometry exclusions applied after loading the GLB. */
	model?: StageModelSettings;
	/** Initial camera orbit; distance and element framing remain automatic. */
	camera?: StageCameraSettings;
	/** Accessible fallback image shown before enhancement or without JavaScript. */
	fallbackImage?: string;
	/** Actual pixel dimensions of the fallback asset, independent of element dimensions. */
	fallbackImageSize?: readonly [number, number];
}

/** Compact element data used by a brand catalog without loading a detail document in the layout. */
export interface SpatialListItem {
	/** Runtime-only pose provider installed by a spatial section, never serialized in route data. */
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
	/** Internal presentation identity; assets retain element identity. */
	occurrence?: string;
	id: string;
	href: string;
	eyebrow: string;
	title: string;
	features: string[];
	/** Temporary asset metadata for the catalog renderer while manifests are introduced. */
	stage?: SpatialStageConfig;
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
	id: string;
	name: string;
	/** Opaque CSS/Three.js color behind content and the independently revealed HDR stage. */
	background: string;
	minimapTheme: SpatialMinimapTheme;
	interactionTheme: Partial<StageInteractionTheme>;
	panelShape: StagePanelShape;
	panelTheme: StagePanelTheme;
	dockedPanelTheme: SpatialDockedPanelTheme;
	sectionTheme: SpatialSectionTheme;
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
export type SpatialElementSectionNavigationItem = Pick<SpatialElementSectionDefinition, 'id' | 'title'>;

/** Complete serializable spatial-element document supplied by a dynamic element route. */
export interface SpatialElementData {
	id: string;
	brandId: string;
	pageTitle: string;
	eyebrow: string;
	title: string;
	features: SpatialElementFeature[];
	action: SpatialElementAction;
	stage: SpatialStageConfig;
	breadcrumbs: SpatialElementBreadcrumb[];
	media: SpatialElementMediaItem[];
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

export interface ContentPageData {
	pageTitle?: string;
	title: string;
	eyebrow?: string;
	intro?: string;
	breadcrumbs?: SpatialElementBreadcrumb[];
}
