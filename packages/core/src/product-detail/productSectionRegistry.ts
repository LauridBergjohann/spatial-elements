import type { ProductSectionDefinition, ProductSectionNavigationItem } from './types.js';
import { isProductSectionId } from './productDetail.js';

/** Context key used by `ProductDetailPage` and its descendant `Section` components. */
export const PRODUCT_SECTION_REGISTRY_KEY = Symbol('product-section-registry');

/** Handle retained by a section while it participates in generated page navigation. */
export interface ProductSectionRegistration {
	update(section: ProductSectionDefinition): void;
	unregister(): void;
}

/**
 * Collects section metadata in render order for the product tabs.
 *
 * The registry deliberately stores navigation data only. Section content remains ordinary Svelte
 * markup and never passes through this shared abstraction.
 */
export class ProductSectionRegistry {
	private readonly entries = new Map<symbol, ProductSectionNavigationItem>();

	constructor(
		private readonly onChange: (sections: ProductSectionNavigationItem[]) => void = () => undefined
	) {}

	/** Returns an immutable snapshot in the same order as the rendered section components. */
	get sections(): ProductSectionNavigationItem[] {
		return [...this.entries.values()];
	}

	/** Registers one section and returns lifecycle methods for that registration. */
	register(section: ProductSectionDefinition): ProductSectionRegistration {
		const token = Symbol(section.id);
		this.assertSection(section);
		this.assertUniqueId(section.id);
		this.entries.set(token, this.toNavigationItem(section));
		this.emit();

		return {
			update: (nextSection) => {
				this.assertSection(nextSection);
				this.assertUniqueId(nextSection.id, token);

				const current = this.entries.get(token);
				if (current?.id === nextSection.id && current.title === nextSection.title) return;

				this.entries.set(token, this.toNavigationItem(nextSection));
				this.emit();
			},
			unregister: () => {
				if (!this.entries.delete(token)) return;
				this.emit();
			}
		};
	}

	private assertSection(section: ProductSectionDefinition) {
		if (!isProductSectionId(section.id)) {
			throw new Error(
				`Invalid product section id "${section.id}". Use a lowercase anchor such as "technical-data".`
			);
		}

		if (!section.title.trim()) {
			throw new Error(`Product section "${section.id}" requires a non-empty title.`);
		}
	}

	private assertUniqueId(id: string, currentToken?: symbol) {
		for (const [token, section] of this.entries) {
			if (token !== currentToken && section.id === id) {
				throw new Error(`Duplicate product section id "${id}".`);
			}
		}
	}

	private toNavigationItem(section: ProductSectionDefinition): ProductSectionNavigationItem {
		return { id: section.id, title: section.title };
	}

	private emit() {
		this.onChange(this.sections);
	}
}

export const SECTION_PAGE_KIND = Symbol('section-page-kind');
