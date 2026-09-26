import type { SpatialListItem, SpatialElementSectionStyle, SpatialStageConfig } from './types.js';

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
export function findSpatialElement<T extends { id: string }>(spatialElements: readonly T[], spatialElementId: string) {
	return spatialElements.find((spatialElement) => spatialElement.id === spatialElementId);
}

interface SpatialListSource {
	id: string;
	eyebrow: string;
	title: string;
	features: readonly { label: string }[];
}

/** Keeps content projections lightweight; spatial catalogs explicitly request migration asset metadata. */
export function getSpatialListItems(
	spatialElements: readonly (SpatialListSource & { stage: SpatialStageConfig })[],
	basePath: string,
	options: { includeStage: true }
): SpatialListItem[];
export function getSpatialListItems(
	spatialElements: readonly SpatialListSource[],
	basePath: string,
	options?: { includeStage?: false }
): SpatialListItem[];
export function getSpatialListItems(
	spatialElements: readonly SpatialListSource[],
	basePath: string,
	options: { includeStage?: boolean } = {}
): SpatialListItem[] {
	const normalizedBasePath = basePath.replace(/\/$/, '');

	return spatialElements.map((spatialElement) => ({
		id: spatialElement.id,
		href: `${normalizedBasePath}/${encodeURIComponent(spatialElement.id)}`,
		eyebrow: spatialElement.eyebrow,
		title: spatialElement.title,
		features: spatialElement.features.map(({ label }) => label),
		...(options.includeStage && 'stage' in spatialElement
			? { stage: spatialElement.stage as SpatialStageConfig }
			: {})
	}));
}
