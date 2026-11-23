import type {
	CardSize,
	CardMediaAspect,
	CardMediaFit,
	ContentSpan,
	SurfaceTone
} from '@page-sections/core';

/** Page Sections card layout options; spatial media defaults to square/contain. */
export interface SpatialCardGridOptions {
	cardSize?: CardSize;
	cardShadow?: boolean;
	cardTone?: SurfaceTone;
	textAlign?: 'start' | 'center';
	mediaAspect?: CardMediaAspect;
	mediaFit?: CardMediaFit;
	/** Optional explicit grid span. Omit to use the responsive cardSize allocation. */
	itemSpan?: ContentSpan;
}
