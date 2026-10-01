import type { SpatialListItem, SpatialElementSectionStyle, SpatialElementData } from './types.js';
import type { SpatialElementSceneSource } from './spatialElementScene.js';

const SECTION_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Validates section identifiers before they are used as DOM anchors. */
export function isSpatialElementSectionId(value: string) {
	return SECTION_ID_PATTERN.test(value);
}

/** Converts section styling data into scoped CSS custom properties. */
export function getSpatialElementSectionStyle(style: SpatialElementSectionStyle | undefined) {
	if (!style) return '';

	return [
		style.tint ? `--spatial-element-section-tint: ${style.tint}` : '',
		style.tintOpacity !== undefined
			? `--spatial-element-section-tint-opacity: ${toPercentage(style.tintOpacity)}`
			: '',
		style.backdropBlur !== undefined
			? `--spatial-element-section-backdrop-blur: ${Math.max(style.backdropBlur, 0)}px`
			: '',
		style.textColor ? `--spatial-element-section-color: ${style.textColor}` : '',
		style.width ? `--spatial-element-section-width: ${style.width}` : ''
	]
		.filter(Boolean)
		.join('; ');
}

function toPercentage(value: number) {
	const finiteValue = Number.isFinite(value) ? value : 0;
	return `${Math.min(Math.max(finiteValue, 0), 1) * 100}%`;
}

/** Finds a element by route id while retaining a narrow, serializable return type. */
export function findSpatialElement<T extends { id: string }>(
	spatialElements: readonly T[],
	spatialElementId: string
) {
	return spatialElements.find((spatialElement) => spatialElement.id === spatialElementId);
}

interface SpatialListSource {
	id: string;
	eyebrow?: string;
	title: string;
	features?: readonly { label: string; marker?: string }[];
	action?: SpatialElementData['action'];
}

/**
 * Creates category items, including scene assets and the shared detail summary, from element data.
 * `basePath` is the application's detail route prefix (e.g. `/shop/elements`).
 * IDs are URL-encoded; no assets are loaded by this helper. Text-only sources also work.
 */
export function getSpatialListItems(
	spatialElements: readonly (SpatialListSource & Partial<SpatialElementSceneSource>)[],
	basePath: string
): SpatialListItem[] {
	const normalizedBasePath = basePath.replace(/\/$/, '');

	return spatialElements.map((spatialElement) => ({
		id: spatialElement.id,
		href: `${normalizedBasePath}/${encodeURIComponent(spatialElement.id)}`,
		eyebrow: spatialElement.eyebrow ?? '',
		title: spatialElement.title,
		features: (spatialElement.features ?? []).map(({ label }) => label),
		summary: { features: [...(spatialElement.features ?? [])], action: spatialElement.action },
		geometry: spatialElement.geometry,
		hdr: spatialElement.hdr,
		background: spatialElement.background,
		model: spatialElement.model,
		camera: spatialElement.camera,
		assetManifest: spatialElement.assetManifest,
		fallbackImage: spatialElement.fallbackImage,
		fallbackImageSize: spatialElement.fallbackImageSize
	}));
}

/** @internal Normalized presentation document; the public authoring type keeps optional content optional. */
export type ResolvedSpatialElementData = SpatialElementData &
	Required<
		Pick<
			SpatialElementData,
			'brandId' | 'pageTitle' | 'eyebrow' | 'features' | 'breadcrumbs' | 'media'
		>
	>;

/** @internal Resolve presentation defaults without mutating route data or inventing link destinations. */
export function resolveSpatialElementData(
	element: SpatialElementData,
	brandId: string
): ResolvedSpatialElementData {
	if (element.brandId && element.brandId !== brandId) {
		throw new Error(
			`Element "${element.id}" belongs to "${element.brandId}", but the shell uses "${brandId}".`
		);
	}
	return {
		...element,
		brandId,
		pageTitle: element.pageTitle ?? element.title,
		eyebrow: element.eyebrow ?? '',
		features: element.features ?? [],
		breadcrumbs: element.breadcrumbs ?? [],
		media: element.media ?? [{ id: 'model', kind: 'minimap', label: '3D view' }]
	};
}
