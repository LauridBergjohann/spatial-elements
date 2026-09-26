import type { CatalogEndpointAddress, CatalogIdentity } from './CatalogEndpointRegistry.js';
import { resolveCatalogIntent, type CatalogNavigationIntent } from './catalogRecipes.js';

/** Optional enhancement on an ordinary anchor; URLs remain authoritative. */
export interface CatalogViewContext {
	spatialElementId?: string;
	sourceSection?: string;
	targetSection?: string;
	sourceOccurrence?: string;
	targetOccurrence?: string;
}

export type CatalogJourney =
	| { kind: 'spatialElement'; intent: CatalogNavigationIntent }
	| { kind: 'content-view'; brandId: string; history: boolean; section?: string };

export function resolveCatalogJourney(
	from: URL,
	to: URL,
	type: string
): CatalogJourney | undefined {
	const intent = resolveCatalogIntent(from, to, type);
	if (intent) return { kind: 'spatialElement', intent };
	if (from.origin !== to.origin || (from.pathname === to.pathname && from.search === to.search))
		return;
	const pattern = /^\/([^/]+)\/categories\/(?:list|carousel|mixed)\/?$/;
	const source = pattern.exec(from.pathname),
		target = pattern.exec(to.pathname);
	if (!source || !target) return;
	try {
		const brandId = decodeURIComponent(source[1]);
		if (brandId !== decodeURIComponent(target[1])) return;
		return {
			kind: 'content-view',
			brandId,
			history: type === 'popstate',
			section: to.hash ? decodeURIComponent(to.hash.slice(1)) : undefined
		};
	} catch {
		return;
	}
}

export interface CatalogParticipantEndpoint extends CatalogEndpointAddress {
	role: 'geometry';
	sectionId?: string;
	/** Explicit authored order, never DOM registration order. */
	order: number;
	eligible: boolean;
	prepared: boolean;
	selected?: boolean;
	focused?: boolean;
}

export interface CatalogParticipantPair {
	identity: CatalogIdentity;
	source: CatalogParticipantEndpoint;
	target: CatalogParticipantEndpoint;
}

/** Pure, frozen pairing. Ambiguous occurrences never borrow another element's panel. */
export function planCatalogParticipants(
	sources: readonly CatalogParticipantEndpoint[],
	targets: readonly CatalogParticipantEndpoint[],
	context: CatalogViewContext = {},
	limit = 5
): CatalogParticipantPair[] {
	const source = sources.filter(
		(p) =>
			p.eligible &&
			p.prepared &&
			(!context.sourceSection || p.sectionId === context.sourceSection) &&
			(!context.sourceOccurrence || p.occurrence === context.sourceOccurrence)
	);
	const target = targets.filter(
		(p) =>
			p.eligible &&
			p.prepared &&
			(!context.targetSection || p.sectionId === context.targetSection) &&
			(!context.targetOccurrence || p.occurrence === context.targetOccurrence)
	);
	const key = (p: CatalogIdentity) => JSON.stringify([p.brandId, p.spatialElementId]);
	const pairs: CatalogParticipantPair[] = [];
	for (const p of source) {
		if (source.filter((other) => key(other) === key(p)).length !== 1) continue;
		const matches = target.filter((other) => key(other) === key(p));
		if (matches.length !== 1) continue;
		pairs.push({
			identity: { brandId: p.brandId, spatialElementId: p.spatialElementId },
			source: { ...p },
			target: { ...matches[0] }
		});
	}
	const activated = pairs.filter((p) => p.source.selected || p.source.focused);
	const primary = context.spatialElementId
		? pairs.find((p) => p.identity.spatialElementId === context.spatialElementId)
		: activated.length === 1
			? activated[0]
			: [...pairs].sort((a, b) => a.source.order - b.source.order)[0];
	if (!primary || !Number.isFinite(limit) || limit < 1) return [];
	return [
		primary,
		...pairs.filter((p) => p !== primary).sort((a, b) => a.source.order - b.source.order)
	].slice(0, Math.min(5, Math.floor(limit)));
}
