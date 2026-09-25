import type {
	CatalogIdentity,
	CatalogEndpointSlot,
	CatalogSharedRole
} from './CatalogEndpointRegistry.js';

export type CatalogComposition =
	'list' | 'carousel' | 'hero' | 'dock' | 'intermediate' | 'unavailable';
export interface CatalogNavigationIntent {
	identity: CatalogIdentity;
	direction: 'list-to-detail' | 'detail-to-list';
	history: boolean;
	target: 'hero' | 'list' | 'section' | 'restored';
}

/** Route intent does not decide whether a restored PDP is actually showing its hero or dock. */
export function resolveCatalogIntent(
	from: URL,
	to: URL,
	type: string
): CatalogNavigationIntent | undefined {
	if (from.origin !== to.origin) return;
	const parse = (url: URL) => {
		const match = /^\/([^/]+)\/(categories\/(?:list|carousel|mixed)|products\/([^/]+))\/?$/.exec(
			url.pathname
		);
		if (!match) return;
		try {
			return {
				brandId: decodeURIComponent(match[1]),
				productId: match[3] ? decodeURIComponent(match[3]) : undefined
			};
		} catch {
			return;
		}
	};
	const source = parse(from);
	const target = parse(to);
	if (
		!source ||
		!target ||
		source.brandId !== target.brandId ||
		Boolean(source.productId) === Boolean(target.productId)
	)
		return;
	const history = type === 'popstate';
	return {
		identity: { brandId: target.brandId, productId: (source.productId ?? target.productId)! },
		direction: target.productId ? 'list-to-detail' : 'detail-to-list',
		history,
		target: history ? 'restored' : to.hash ? 'section' : target.productId ? 'hero' : 'list'
	};
}

export interface CatalogRecipe {
	id:
		| 'list-to-hero'
		| 'hero-to-list'
		| 'list-to-dock'
		| 'dock-to-list'
		| 'carousel-to-hero'
		| 'hero-to-carousel'
		| 'carousel-to-dock'
		| 'dock-to-carousel'
		| 'list-to-carousel'
		| 'carousel-to-list';
	identity: CatalogIdentity;
	source: CatalogEndpointSlot;
	targetGeometry: CatalogEndpointSlot;
	targetShared: CatalogEndpointSlot;
	roles: readonly CatalogSharedRole[];
}

/** Only implemented edges are enabled. Parsing reverse/history intent does not enable motion. */
export function selectCatalogRecipe(
	intent: CatalogNavigationIntent | undefined,
	source: CatalogComposition,
	target: CatalogComposition
): CatalogRecipe | undefined {
	if (
		intent?.direction === 'list-to-detail' &&
		source === 'carousel' &&
		(target === 'hero' || target === 'intermediate' || target === 'dock')
	)
		return {
			id: target === 'dock' ? 'carousel-to-dock' : 'carousel-to-hero',
			identity: intent.identity,
			source: 'carousel.front',
			targetGeometry: target === 'dock' ? 'pdp.dock' : 'pdp.hero',
			targetShared: target === 'dock' ? 'pdp.dock' : 'pdp.summary',
			roles: ['summary-surface', 'eyebrow', 'title', 'features', 'primary-action']
		};
	if (
		intent?.direction === 'detail-to-list' &&
		target === 'carousel' &&
		(source === 'hero' || source === 'intermediate' || source === 'dock')
	)
		return {
			id: source === 'dock' ? 'dock-to-carousel' : 'hero-to-carousel',
			identity: intent.identity,
			source: source === 'dock' ? 'pdp.dock' : 'pdp.summary',
			targetGeometry: 'carousel.front',
			targetShared: 'carousel.front',
			roles: ['summary-surface', 'eyebrow', 'title', 'features', 'primary-action']
		};
	if (
		intent &&
		intent.direction === 'detail-to-list' &&
		(source === 'hero' || source === 'intermediate' || source === 'dock') &&
		target === 'list'
	)
		return {
			id: source === 'dock' ? 'dock-to-list' : 'hero-to-list',
			identity: intent.identity,
			source: source === 'dock' ? 'pdp.dock' : 'pdp.summary',
			targetGeometry: 'catalog.card',
			targetShared: 'catalog.card',
			roles: ['summary-surface', 'eyebrow', 'title']
		};
	if (
		!intent ||
		intent.direction !== 'list-to-detail' ||
		source !== 'list' ||
		(target !== 'hero' && target !== 'intermediate' && target !== 'dock')
	)
		return;
	return {
		id: target === 'dock' ? 'list-to-dock' : 'list-to-hero',
		identity: intent.identity,
		source: 'catalog.card',
		targetGeometry: target === 'dock' ? 'pdp.dock' : 'pdp.hero',
		targetShared: target === 'dock' ? 'pdp.dock' : 'pdp.summary',
		roles: ['summary-surface', 'eyebrow', 'title']
	};
}
