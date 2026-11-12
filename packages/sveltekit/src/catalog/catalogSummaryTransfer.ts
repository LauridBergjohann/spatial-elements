import type { CatalogEndpointRegistry } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
import { resolveCatalogIntent } from '@spatial-elements/core/catalog/catalogRecipes';
import type { SpatialSummaryHostController } from '../spatial-element/spatialSummaryHost.svelte.js';

/** Semantic ownership must survive routing even if motion is declined or interrupted. */
export function prepareCatalogSummaryTransfer(options: {
	from: URL;
	to: URL;
	type: string;
	endpoints: CatalogEndpointRegistry;
	host: SpatialSummaryHostController;
}) {
	const { endpoints, host } = options;
	const intent = resolveCatalogIntent(options.from, options.to, options.type, endpoints.navigation);
	if (!intent) return;
	const returning = intent.direction === 'detail-to-list';
	const contentSlot = returning
		? endpoints.getPreferredContentSlot(intent.identity)
		: endpoints.getContentSlot(intent.identity);
	if (contentSlot !== 'carousel.front') return;
	const sourceSlot = returning ? 'detail.summary' : 'carousel.front';
	const targetSlot = returning ? 'carousel.front' : 'detail.summary';
	const surface = endpoints.resolve({ ...intent.identity, slot: sourceSlot, role: 'summary-surface' });
	const retained = surface && host.retainByElement(surface);
	if (!retained || retained.record.kind !== 'summary') { retained?.restore() || retained?.release(); return; }
	const root = retained.record.root;
	// Legacy transition snapshots hide source roles. The same nodes become the
	// destination, so those temporary source visibility changes cannot travel.
	const visibility = [root, ...root.querySelectorAll<HTMLElement | SVGElement>('*')].map(element => ({
		element, value: element.style.getPropertyValue('visibility'), priority: element.style.getPropertyPriority('visibility')
	}));
	let holding: HTMLElement | undefined;
	let finished = false;
	const clean = (restore: boolean) => {
		if (finished) return;
		finished = true;
		try { if (!restore || !retained.restore()) retained.release(); }
		finally { holding?.remove(); holding = undefined; }
	};
	return {
		/** Call after decorative snapshots have captured the still-mounted source. */
		hold() {
			if (finished || holding) return;
			holding = document.createElement('div');
			holding.hidden = true;
			holding.inert = true;
			holding.dataset.spatialSummaryTransfer = '';
			document.body.append(holding);
			retained.hold(holding);
			for (const { element, value, priority } of visibility) {
				if (value) element.style.setProperty('visibility', value, priority);
				else element.style.removeProperty('visibility');
			}
		},
		/** Call after route placement, before the destination's panel/GPU measurement. */
		adopt(): HTMLElement | undefined {
			if (finished) return;
			try {
				const destination = endpoints.resolve({ ...intent.identity, slot: targetSlot, role: 'summary-surface' });
				const slot = destination?.querySelector<HTMLElement>('[data-spatial-summary-slot]');
				if (!slot || !retained.adopt(slot)) return;
				retained.unfreeze();
				return slot;
			} finally { clean(true); }
		},
		cancel() { clean(true); }
	};
}
