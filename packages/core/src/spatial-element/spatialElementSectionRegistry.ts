import type { SpatialElementSectionDefinition, SpatialElementSectionNavigationItem } from './types.js';
import { isSpatialElementSectionId } from './spatialElement.js';

/** Context key used by `SpatialElementPage` and its descendant `Section` components. */
export const SPATIAL_ELEMENT_SECTION_REGISTRY_KEY = Symbol('spatial-element-section-registry');

/** Handle retained by a section while it participates in generated page navigation. */
export interface SpatialElementSectionRegistration {
	update(section: SpatialElementSectionDefinition): void;
	unregister(): void;
}

/**
 * Collects section metadata in render order for the element tabs.
 *
 * The registry deliberately stores navigation data only. Section content remains ordinary Svelte
 * markup and never passes through this shared abstraction.
 */
export class SpatialElementSectionRegistry {
	private readonly entries = new Map<symbol, SpatialElementSectionNavigationItem>();

	constructor(
		private readonly onChange: (sections: SpatialElementSectionNavigationItem[]) => void = () => undefined
	) {}

	/** Returns an immutable snapshot in the same order as the rendered section components. */
	get sections(): SpatialElementSectionNavigationItem[] {
		return [...this.entries.values()];
	}

	/** Registers one section and returns lifecycle methods for that registration. */
	register(section: SpatialElementSectionDefinition): SpatialElementSectionRegistration {
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

	private assertSection(section: SpatialElementSectionDefinition) {
		if (!isSpatialElementSectionId(section.id)) {
			throw new Error(
				`Invalid spatialElement section id "${section.id}". Use a lowercase anchor such as "technical-data".`
			);
		}

		if (!section.title.trim()) {
			throw new Error(`SpatialElement section "${section.id}" requires a non-empty title.`);
		}
	}

	private assertUniqueId(id: string, currentToken?: symbol) {
		for (const [token, section] of this.entries) {
			if (token !== currentToken && section.id === id) {
				throw new Error(`Duplicate spatialElement section id "${id}".`);
			}
		}
	}

	private toNavigationItem(section: SpatialElementSectionDefinition): SpatialElementSectionNavigationItem {
		return { id: section.id, title: section.title };
	}

	private emit() {
		this.onChange(this.sections);
	}
}

export const SECTION_PAGE_KIND = Symbol('section-page-kind');
