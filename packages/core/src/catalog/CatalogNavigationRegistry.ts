import type { CatalogIdentity } from './CatalogEndpointRegistry.js';

export type CatalogPageRegistration =
	| { kind: 'content'; brandId: string; elements: readonly string[] }
	| ({ kind: 'detail' } & CatalogIdentity)
	| { kind: 'ordinary' };

/** Per-stage inventory of mounted pages and the detail links authored by spatial sections.
 * URLs are resource keys, never a convention for deriving an element's identity.
 */
export class CatalogNavigationRegistry {
	private pages = new Map<string, CatalogPageRegistration>();
	private links = new Map<string, CatalogIdentity | null>();

	// Routers may canonicalize an authored link with/without a trailing slash.
	private key(url: URL) {
		return url.origin + url.pathname.replace(/\/$/, '') + url.search;
	}

	record(
		url: URL,
		page: CatalogPageRegistration,
		links: readonly (CatalogIdentity & { href?: string })[] = []
	) {
		const key = this.key(url);
		this.pages.delete(key);
		this.pages.set(
			key,
			page.kind === 'content' ? { ...page, elements: [...page.elements] } : { ...page }
		);
		while (this.pages.size > 100) this.pages.delete(this.pages.keys().next().value!);
		// Only the currently mounted collection can advertise destinations. No stale product aliases.
		this.links.clear();
		for (const link of links) {
			if (!link.href) continue;
			let target: URL;
			try {
				target = new URL(link.href, url);
			} catch {
				continue;
			}
			if (target.origin !== url.origin || !/^https?:$/.test(target.protocol)) continue;
			const targetKey = this.key(target);
			const previous = this.links.get(targetKey);
			const identity = { brandId: link.brandId, spatialElementId: link.spatialElementId };
			this.links.set(
				targetKey,
				previous === null ||
					(previous &&
						(previous.brandId !== identity.brandId ||
							previous.spatialElementId !== identity.spatialElementId))
					? null
					: identity
			);
		}
	}

	get(url: URL): CatalogPageRegistration | undefined {
		const page = this.pages.get(this.key(url));
		if (page) return page;
		const link = this.links.get(this.key(url));
		return link === null ? { kind: 'ordinary' } : link ? { kind: 'detail', ...link } : undefined;
	}

	/** Unknown destinations are candidates; mounted target endpoints must confirm the match. */
	resolve(from: URL, to: URL) {
		if (from.origin !== to.origin || this.key(from) === this.key(to)) return;
		const source = this.pages.get(this.key(from));
		if (!source || source.kind === 'ordinary') return;
		const target = this.get(to) ?? {
			kind: 'content' as const,
			brandId: source.brandId,
			elements: undefined
		};
		if (target.kind === 'ordinary' || target.brandId !== source.brandId) return;
		return { source, target };
	}
}
