import type { ProductOverviewItem, ProductSectionStyle, ProductStageConfig } from './types.js';

const SECTION_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Validates section identifiers before they are used as DOM anchors. */
export function isProductSectionId(value: string) {
	return SECTION_ID_PATTERN.test(value);
}

/** Converts section styling data into scoped CSS custom properties. */
export function getProductSectionStyle(style: ProductSectionStyle | undefined) {
	if (!style) return '';

	return [
		style.tint ? `--product-section-tint: ${style.tint}` : '',
		style.tintOpacity !== undefined
			? `--product-section-tint-opacity: ${toPercentage(style.tintOpacity)}`
			: '',
		style.backdropBlur !== undefined
			? `--product-section-backdrop-blur: ${Math.max(style.backdropBlur, 0)}px`
			: '',
		style.textColor ? `--product-section-color: ${style.textColor}` : '',
		style.width ? `--product-section-width: ${style.width}` : ''
	]
		.filter(Boolean)
		.join('; ');
}

function toPercentage(value: number) {
	const finiteValue = Number.isFinite(value) ? value : 0;
	return `${Math.min(Math.max(finiteValue, 0), 1) * 100}%`;
}

/** Finds a product by route id while retaining a narrow, serializable return type. */
export function findProduct<T extends { id: string }>(products: readonly T[], productId: string) {
	return products.find((product) => product.id === productId);
}

interface ProductOverviewSource {
	id: string;
	eyebrow: string;
	title: string;
	features: readonly { label: string }[];
}

/** Keeps content projections lightweight; spatial catalogs explicitly request migration asset metadata. */
export function getProductOverviewItems(
	products: readonly (ProductOverviewSource & { stage: ProductStageConfig })[],
	basePath: string,
	options: { includeStage: true }
): ProductOverviewItem[];
export function getProductOverviewItems(
	products: readonly ProductOverviewSource[],
	basePath: string,
	options?: { includeStage?: false }
): ProductOverviewItem[];
export function getProductOverviewItems(
	products: readonly ProductOverviewSource[],
	basePath: string,
	options: { includeStage?: boolean } = {}
): ProductOverviewItem[] {
	const normalizedBasePath = basePath.replace(/\/$/, '');

	return products.map((product) => ({
		id: product.id,
		href: `${normalizedBasePath}/${encodeURIComponent(product.id)}`,
		eyebrow: product.eyebrow,
		title: product.title,
		features: product.features.map(({ label }) => label),
		...(options.includeStage && 'stage' in product
			? { stage: product.stage as ProductStageConfig }
			: {})
	}));
}
