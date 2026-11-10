import type {
	CardSize,
	CardVariant,
	CardMediaAspect,
	CardMediaFit,
	ContentSpan,
	SurfaceTone
} from '@page-sections/core';

/** Page Sections card layout options; spatial media defaults to square/contain. */
export interface SpatialCardGridOptions {
	cardSize?: CardSize;
	cardVariant?: CardVariant;
	cardTone?: SurfaceTone;
	textAlign?: 'start' | 'center';
	mediaAspect?: CardMediaAspect;
	mediaFit?: CardMediaFit;
	/** Grid span for editorial cards. Catalog cards use the responsive cardSize allocation. */
	itemSpan?: ContentSpan;
}
