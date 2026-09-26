export interface CatalogIdentity {
	brandId: string;
	spatialElementId: string;
}

export type CatalogSharedRole =
	'summary-surface' | 'eyebrow' | 'title' | 'features' | 'primary-action';
export type CatalogEndpointRole = CatalogSharedRole | 'geometry' | 'container';
export type CatalogEndpointSlot =
	| 'catalog.card'
	| 'carousel.front'
	| 'carousel.neighbour'
	| 'detail.hero'
	| 'detail.summary'
	| 'detail.dock';
export type CatalogContentSlot = 'catalog.card' | 'carousel.front' | 'carousel.neighbour';

export interface CatalogEndpointAddress extends CatalogIdentity {
	slot: CatalogEndpointSlot;
	occurrence?: string;
	role: CatalogEndpointRole;
}

export const CATALOG_ENDPOINTS = Symbol('catalog-endpoints');

/** Semantic identity excludes representation and location; registrations additionally need a slot. */
export function catalogSharedKey(identity: CatalogIdentity, role: CatalogSharedRole) {
	return JSON.stringify([identity.brandId, identity.spatialElementId, role]);
}

export function catalogEndpointKey(address: CatalogEndpointAddress) {
	return JSON.stringify([
		address.brandId,
		address.spatialElementId,
		address.slot,
		address.occurrence ?? null,
		address.role
	]);
}

/** Index semantic slots first; resolution explicitly chooses a concrete occurrence. */
function catalogSlotKey(address: CatalogEndpointAddress) {
	return JSON.stringify([address.brandId, address.spatialElementId, address.slot, address.role]);
}

interface Registration {
	address: CatalogEndpointAddress;
	element: HTMLElement;
}

/** Owned by one persistent stage, never a process-global/SSR singleton. */
export class CatalogEndpointRegistry {
	private presentations = new Map<
		string,
		Set<() => 'hero' | 'dock' | 'intermediate' | 'unavailable'>
	>();
	private entries = new Map<string, Set<Registration>>();
	private revision = 0;
	private preferred = new Map<string, string>();
	private preferredSlots = new Map<string, CatalogContentSlot>();
	private restoredOrigin?: CatalogIdentity & { occurrence: string; slot: CatalogContentSlot };
	restoreOrigin(origin?: CatalogIdentity & { occurrence: string; slot: CatalogContentSlot }) {
		this.restoredOrigin = origin ? { ...origin } : undefined;
		if (origin) this.prefer(origin.brandId, origin.spatialElementId, origin.occurrence, origin.slot);
	}
	prefer(
		brandId: string,
		spatialElementId: string,
		occurrence: string,
		slot: CatalogContentSlot = 'catalog.card'
	) {
		this.preferred.set(JSON.stringify([brandId, spatialElementId]), occurrence);
		this.preferredSlots.set(JSON.stringify([brandId, spatialElementId]), slot);
		if (this.preferredSlots.size > 100)
			this.preferredSlots.delete(this.preferredSlots.keys().next().value!);
		if (this.preferred.size > 100) this.preferred.delete(this.preferred.keys().next().value!);
	}
	restoreFocus(key?: string) {
		if (!key?.startsWith('catalog:')) return;
		try {
			const tuple: unknown = JSON.parse(key.slice(8));
			if (
				Array.isArray(tuple) &&
				(tuple.length === 3 || tuple.length === 4) &&
				tuple.every((value) => typeof value === 'string')
			)
				this.prefer(
					tuple[0],
					tuple[1],
					tuple[2],
					tuple[3] === 'carousel.front' ? 'carousel.front' : 'catalog.card'
				);
		} catch {
			/* Ignore stale or malformed entry metadata. */
		}
	}

	/** Activated/restored occurrence wins; otherwise require a unique visible composition. */
	getContentSlot(identity: CatalogIdentity): CatalogContentSlot | undefined {
		const key = JSON.stringify([identity.brandId, identity.spatialElementId]);
		const preferred = this.preferred.get(key);
		const preferredSlot = this.preferredSlots.get(key);
		const slots: CatalogContentSlot[] = ['catalog.card', 'carousel.front', 'carousel.neighbour'];
		if (
			preferredSlot &&
			[
				...(this.entries.get(
					catalogSlotKey({ ...identity, slot: preferredSlot, role: 'container' })
				) ?? [])
			].some((entry) => entry.element.isConnected && entry.address.occurrence === preferred)
		)
			return preferredSlot;
		if (preferredSlot?.startsWith('carousel.')) {
			const other = preferredSlot === 'carousel.front' ? 'carousel.neighbour' : 'carousel.front';
			if (
				[
					...(this.entries.get(catalogSlotKey({ ...identity, slot: other, role: 'container' })) ??
						[])
				].some((entry) => entry.element.isConnected && entry.address.occurrence === preferred)
			)
				return other;
		}
		if (
			this.restoredOrigin?.brandId === identity.brandId &&
			this.restoredOrigin.spatialElementId === identity.spatialElementId
		)
			return undefined;
		const visible = slots
			.map((slot) => ({
				slot,
				entries: [
					...(this.entries.get(catalogSlotKey({ ...identity, slot, role: 'container' })) ?? [])
				].filter(({ element }) => {
					if (!element.isConnected) return false;
					const rect = element.getBoundingClientRect();
					return (
						rect.width > 0 &&
						rect.height > 0 &&
						rect.bottom > 0 &&
						rect.top < innerHeight &&
						rect.right > 0 &&
						rect.left < innerWidth
					);
				})
			}))
			.filter(({ entries }) => entries.length > 0);
		if (visible.length !== 1) return undefined;
		const candidate = visible[0];
		return candidate.slot !== 'catalog.card' && candidate.entries.length !== 1
			? undefined
			: candidate.slot;
	}

	getPreferredContentSlot(identity: CatalogIdentity) {
		return this.preferredSlots.get(JSON.stringify([identity.brandId, identity.spatialElementId]));
	}

	/** Read-only occurrence inventory; unlike resolve(), this does not change activation. */
	getContentEndpoints() {
		return [...this.entries.values()]
			.flatMap((entries) => [...entries])
			.filter(
				({ address, element }) =>
					address.role === 'container' && !address.slot.startsWith('detail.') && element.isConnected
			);
	}

	registerPresentation(
		identity: CatalogIdentity,
		read: () => 'hero' | 'dock' | 'intermediate' | 'unavailable'
	) {
		const key = JSON.stringify([identity.brandId, identity.spatialElementId]);
		const readers = this.presentations.get(key) ?? new Set();
		readers.add(read);
		this.presentations.set(key, readers);
		return () => {
			readers.delete(read);
			if (!readers.size && this.presentations.get(key) === readers) this.presentations.delete(key);
		};
	}

	getComposition(identity: CatalogIdentity) {
		const readers = this.presentations.get(JSON.stringify([identity.brandId, identity.spatialElementId]));
		return readers?.size === 1 ? [...readers][0]() : 'unavailable';
	}

	register(address: CatalogEndpointAddress, element: HTMLElement): () => void {
		const key = catalogSlotKey(address);
		const registration = { address: { ...address }, element };
		const entries = this.entries.get(key) ?? new Set<Registration>();
		entries.add(registration);
		this.entries.set(key, entries);
		this.revision++;
		return () => {
			// A late or repeated Svelte teardown only releases its own registration.
			if (!entries.delete(registration)) return;
			if (!entries.size && this.entries.get(key) === entries) this.entries.delete(key);
			this.revision++;
		};
	}

	resolve(address: CatalogEndpointAddress): HTMLElement | undefined {
		let candidates = [...(this.entries.get(catalogSlotKey(address)) ?? [])].filter(
			(entry) => entry.element.isConnected
		);
		if (address.slot === 'catalog.card' || address.slot.startsWith('carousel.')) {
			const preferred =
				address.occurrence ??
				this.preferred.get(JSON.stringify([address.brandId, address.spatialElementId]));
			const matching = candidates.filter((entry) => entry.address.occurrence === preferred);
			const containers = this.entries.get(catalogSlotKey({ ...address, role: 'container' }));
			const registeredPreference =
				preferred &&
				[...(containers ?? [])].some(
					(entry) => entry.element.isConnected && entry.address.occurrence === preferred
				);
			if (
				address.occurrence !== undefined ||
				registeredPreference ||
				(preferred && matching.length)
			)
				candidates = matching;
			else if (candidates.length > 1 && candidates.every((entry) => entry.address.occurrence)) {
				const visible = candidates.filter((entry) => {
					const rect = entry.element.getBoundingClientRect();
					return (
						rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
					);
				});
				const sorted = visible.sort((a, b) =>
					a.address.occurrence!.localeCompare(b.address.occurrence!)
				);
				const occurrence = sorted[0]?.address.occurrence;
				candidates = occurrence
					? candidates.filter((entry) => entry.address.occurrence === occurrence)
					: [];
			}
			if (candidates.length === 1) {
				const occurrence = candidates[0].address.occurrence;
				if (occurrence)
					this.prefer(
						address.brandId,
						address.spatialElementId,
						occurrence,
						address.slot as CatalogContentSlot
					);
				const cards = ['catalog.card', 'carousel.front', 'carousel.neighbour'].flatMap((slot) => [
					...(this.entries.get(
						catalogSlotKey({ ...address, slot: slot as CatalogContentSlot, role: 'container' })
					) ?? [])
				]);
				for (const entry of cards)
					entry.element.toggleAttribute(
						'data-catalog-selected',
						entry.address.occurrence === occurrence
					);
			}
		}
		// Ambiguity is a fallback, never a "first DOM match wins" choice.
		return candidates.length === 1 ? candidates[0].element : undefined;
	}

	/** Registration revision is not a rendered-pose/layout revision. No layout reads here. */
	getSnapshot() {
		return {
			registrationRevision: this.revision,
			entries: [...this.entries.values()].flatMap((entries) =>
				[...entries].map(({ address, element }) => ({ ...address, connected: element.isConnected }))
			)
		};
	}
}
