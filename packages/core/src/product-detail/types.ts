import type { VerifiedProductAssetManifest } from '../catalog/productAssets.js';
import type { ProductLodPair } from '../catalog/productLodPair.js';
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

/** Scene assets and environment settings required by a product stage. */
export interface ProductStageConfig {
	dracoDecoderPath?: string;
	assetManifest?: VerifiedProductAssetManifest;
	lodPair?: ProductLodPair;
	background: BackgroundSettings;
	hdr: string;
	glb: string;
	/** Product pose and non-product geometry exclusions applied after loading the GLB. */
	model?: StageModelSettings;
	/** Initial camera orbit; distance and product framing remain automatic. */
	camera?: StageCameraSettings;
	/** Accessible fallback image shown before enhancement or without JavaScript. */
	fallbackImage?: string;
	/** Actual pixel dimensions of the fallback asset, independent of product dimensions. */
	fallbackImageSize?: readonly [number, number];
}

/** Compact product data used by a brand catalog without loading a detail document in the layout. */
export interface ProductOverviewItem {
	/** Runtime-only pose provider installed by a spatial section, never serialized in route data. */
	pose?: import('../catalog/catalogPose.js').CatalogPoseProvider;
	/** Optional full summary projection, sourced from the same document as the PDP. */
	summary?: {
		features: ProductFeature[];
		action?: ProductAction;
		/** Optional authored link to an existing product content section. */
		sectionLink?: { href: string; label: string };
	};
	/** Stable optional key when the same product occurs twice within a section. */
	itemKey?: string;
	/** Internal presentation identity; assets retain product identity. */
	occurrence?: string;
	id: string;
	href: string;
	eyebrow: string;
	title: string;
	features: string[];
	/** Temporary asset metadata for the catalog renderer while manifests are introduced. */
	stage?: ProductStageConfig;
}

/** Shared CSS-glass controls for regular product sections. */
export interface ProductSectionTheme {
	tint: string;
	/** Direct tint opacity from zero to one. */
	tintOpacity: number;
	/** CSS backdrop blur radius in pixels. */
	backdropBlur: number;
}

/** CSS material used only by the fixed product header and its docked subnavigation. */
export interface ProductDockedPanelTheme {
	/** Gaussian CSS backdrop blur radius in pixels. */
	backdropBlur: number;
	/** Surface tint, using the same color representation as a stage panel. */
	tint: NonNullable<StagePanelTheme['tint']>;
	/** Direct tint opacity from zero to one. */
	tintOpacity: number;
	/** Normalized shadow intensity from zero to one. */
	shadowIntensity: number;
}

/** Shared visual language supplied by a brand layout to product pages beneath it. */
export interface ProductBrandTheme {
	id: string;
	name: string;
	/** Opaque CSS/Three.js color behind content and the independently revealed HDR stage. */
	background: string;
	minimapTheme: ProductMinimapTheme;
	interactionTheme: Partial<StageInteractionTheme>;
	panelShape: StagePanelShape;
	panelTheme: StagePanelTheme;
	dockedPanelTheme: ProductDockedPanelTheme;
	sectionTheme: ProductSectionTheme;
	colors: {
		ink: string;
		body: string;
		accent: string;
		onAccent: string;
		tabBackground: string;
	};
}

/** A single line in the product-summary feature list. */
export interface ProductFeature {
	label: string;
	/** Optional short marker displayed before the feature text. */
	marker?: string;
}

/** Primary conversion action displayed in the product summary panel. */
export interface ProductAction {
	label: string;
	/** Stable behavior identity for shared presentation; never supplies an event handler. */
	semanticId?: string;
	href?: string;
	ariaLabel?: string;
}

/** A breadcrumb link or terminal breadcrumb label. */
export interface ProductBreadcrumb {
	label: string;
	href?: string;
}

/** Media entries rendered in the product rail. */
export type ProductMediaItem =
	| { id: string; kind: 'minimap'; label: string }
	| { id: string; kind: 'drawing'; label: string }
	| { id: string; kind: 'image'; label: string; src: string; alt: string };

/** Optional CSS presentation for a regular HTML product section. */
export interface ProductSectionStyle {
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

/** Metadata supplied to a composable product-detail `Section`. */
export interface ProductSectionDefinition {
	id: string;
	title: string;
	style?: ProductSectionStyle;
}

/** Minimal section metadata consumed by generated product navigation. */
export type ProductSectionNavigationItem = Pick<ProductSectionDefinition, 'id' | 'title'>;

/** Complete serializable product-detail document supplied by a dynamic product route. */
export interface ProductDetailData {
	id: string;
	brandId: string;
	pageTitle: string;
	eyebrow: string;
	title: string;
	features: ProductFeature[];
	action: ProductAction;
	stage: ProductStageConfig;
	breadcrumbs: ProductBreadcrumb[];
	media: ProductMediaItem[];
	minimap?: Omit<StagePanelMinimapOptions, keyof ProductMinimapTheme>;
}

/** Brand-wide minimap appearance; framing and model pose remain product-specific. */
export type ProductMinimapTheme = Pick<
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
	breadcrumbs?: ProductBreadcrumb[];
}
