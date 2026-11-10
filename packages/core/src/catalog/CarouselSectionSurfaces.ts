import type { BlurRect } from './CatalogDepthBlur.js';

/** Only decorative section surfaces leave the document stacking context. The real
 * section, summary, focus targets and their event ownership remain untouched. */
export class CarouselSectionSurfaces {
	private entries = new Map<
		HTMLElement,
		{
			output: HTMLDivElement;
			rect: BlurRect;
			scrollX: number;
			scrollY: number;
		}
	>();

	sync(surfaces: ReadonlyMap<HTMLElement, BlurRect>, scrollX: number, scrollY: number) {
		for (const [source, entry] of this.entries) {
			if (surfaces.has(source)) continue;
			entry.output.remove();
			source.removeAttribute('data-carousel-surface-projected');
			this.entries.delete(source);
		}
		for (const [source, rect] of surfaces) {
			const stage = source.closest?.('.stage');
			if (!stage) continue;
			let entry = this.entries.get(source);
			if (!entry) {
				const output = document.createElement('div');
				output.className = 'stage-carousel-surface';
				output.setAttribute('aria-hidden', 'true');
				stage.appendChild(output);
				entry = { output, rect, scrollX, scrollY };
				this.entries.set(source, entry);
				source.setAttribute('data-carousel-surface-projected', '');
			}
			entry.rect = rect;
			entry.scrollX = scrollX;
			entry.scrollY = scrollY;
			const style = getComputedStyle(source);
			// Keep semantic variables live: the stage shares the brand's theme scope.
			entry.output.style.background = source.parentElement?.hasAttribute(
				'data-spatial-legacy-material'
			)
				? style.background
				: source.style.background || style.background;
			entry.output.style.borderRadius = style.borderRadius;
			entry.output.style.backdropFilter = style.backdropFilter;
			entry.output.style.width = `${rect.width}px`;
			entry.output.style.height = `${rect.height}px`;
		}
	}

	update(scrollX: number, scrollY: number, opacity: number) {
		for (const { output, rect, scrollX: measuredX, scrollY: measuredY } of this.entries.values()) {
			output.style.transform = `translate(${rect.left + measuredX - scrollX}px, ${rect.top + measuredY - scrollY}px)`;
			output.style.opacity = String(opacity);
		}
	}

	dispose() {
		for (const [source, { output }] of this.entries) {
			output.remove();
			source.removeAttribute('data-carousel-surface-projected');
		}
		this.entries.clear();
	}
}
