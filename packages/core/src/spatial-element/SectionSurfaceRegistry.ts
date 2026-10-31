import type { ResolvedSectionBackground } from './sectionBackground.js';

export const SECTION_SURFACES = Symbol('spatial-section-surfaces');
type Surface = Pick<ResolvedSectionBackground, 'color' | 'size'>;

/** Presentation-only order, separate from the semantic navigation registry. */
export class SectionSurfaceRegistry {
	private entries = new Map<number, Surface>();
	private nextId = 0;
	constructor(private readonly changed: () => void = () => {}) {}

	register(surface: Surface) {
		const id = this.nextId++;
		this.entries.set(id, surface);
		this.changed();
		return {
			id,
			update: (next: Surface) => {
				const previous = this.entries.get(id);
				if (!previous || (previous.color === next.color && previous.size === next.size)) return;
				this.entries.set(id, next);
				this.changed();
			},
			unregister: () => { if (this.entries.delete(id)) this.changed(); }
		};
	}

	/** Reconcile keyed component moves without measuring layout or reading per animation frame. */
	order(ids: readonly number[]) {
		const ordered = [...new Set(ids)].filter(id => this.entries.has(id));
		const missing = [...this.entries.keys()].filter(id => !ordered.includes(id));
		const next = [...ordered, ...missing];
		if (next.every((id, index) => [...this.entries.keys()][index] === id)) return;
		this.entries = new Map(next.map(id => [id, this.entries.get(id)!]));
		this.changed();
	}

	get corners() {
		const entries = [...this.entries];
		const eligible = (entry: typeof entries[number] | undefined) => Boolean(entry &&
			entry[1].size === 'standard' && entry[1].color !== 'transparent');
		return entries.map((entry, index) => ({
			id: entry[0],
			top: eligible(entry) && !eligible(entries[index - 1]),
			bottom: eligible(entry) && !eligible(entries[index + 1])
		}));
	}
}
