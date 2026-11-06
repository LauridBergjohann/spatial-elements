import type { CatalogViewContext } from './catalogJourney.js';
import { focusCatalogLink } from './catalogActivationFocus.js';

/** Native anchor enhancement. No routing interception and no GPU state in the URL. */
export function catalogViewLink(node: HTMLAnchorElement, context: CatalogViewContext = {}) {
	const update = (value: CatalogViewContext) => {
		node.dataset.catalogView = JSON.stringify(value);
	};
	const activate = (event: MouseEvent) => focusCatalogLink(node, event);
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
	return readCatalogLinkContext(link, destination);
}

/** Read the originally activated anchor even after focus/ownership has changed. */
export function readCatalogLinkContext(link: HTMLAnchorElement | null | undefined, destination: URL): CatalogViewContext {
	if (!link || link.href !== destination.href) return {};
	try {
		const parsed = JSON.parse(link.dataset.catalogView ?? '{}');
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		const context: CatalogViewContext = Object.fromEntries(
			[
				'spatialElementId',
				'sourceSection',
				'targetSection',
				'sourceOccurrence',
				'targetOccurrence'
			].flatMap((key) => (typeof parsed[key] === 'string' ? [[key, parsed[key]]] : []))
		);
		if (parsed.targetPresentation === 'hero' || parsed.targetPresentation === 'dock') context.targetPresentation = parsed.targetPresentation;
		return context;
	} catch {
		return {};
	}
}
