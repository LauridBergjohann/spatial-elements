import type { CatalogViewContext } from './catalogJourney.js';

/** Native anchor enhancement. No routing interception and no GPU state in the URL. */
export function catalogViewLink(node: HTMLAnchorElement, context: CatalogViewContext = {}) {
	const update = (value: CatalogViewContext) => {
		node.dataset.catalogView = JSON.stringify(value);
	};
	const activate = () => node.focus({ preventScroll: true });
	update(context);
	node.addEventListener('click', activate);
	return {
		update,
		destroy() {
			node.removeEventListener('click', activate);
			delete node.dataset.catalogView;
		}
	};
}

export function readCatalogViewContext(destination: URL): CatalogViewContext {
	const link = document.activeElement?.closest<HTMLAnchorElement>('a[data-catalog-view]');
	if (!link || link.href !== destination.href) return {};
	try {
		const parsed = JSON.parse(link.dataset.catalogView ?? '{}');
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			[
				'productId',
				'sourceSection',
				'targetSection',
				'sourceOccurrence',
				'targetOccurrence'
			].flatMap((key) => (typeof parsed[key] === 'string' ? [[key, parsed[key]]] : []))
		);
	} catch {
		return {};
	}
}
