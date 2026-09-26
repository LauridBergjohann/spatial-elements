/** Section state belongs to one history entry, never to the element asset or URL globally. */
export interface CatalogSectionSnapshot {
	selections: Record<string, string>;
	origin?: {
		brandId: string;
		spatialElementId: string;
		occurrence: string;
		slot: 'catalog.card' | 'carousel.front';
	};
}

export const CATALOG_SECTIONS = Symbol('catalog-sections');

interface SelectionHost {
	read(): string | undefined;
	restore(key: string | undefined): void;
}

/** Persistent Stage service; the Kit bridge installs the history port and merges unrelated state. */
export class CatalogSections {
	private hosts = new Map<string, SelectionHost>();
	private history?: {
		read(): CatalogSectionSnapshot | undefined;
		write(snapshot: CatalogSectionSnapshot): void;
	};

	connect(history: NonNullable<CatalogSections['history']>) {
		this.history = history;
		return () => {
			if (this.history === history) this.history = undefined;
		};
	}

	register(id: string, host: SelectionHost) {
		if (this.hosts.has(id)) throw new Error(`Duplicate carousel section: ${id}`);
		const registration = { ...host };
		this.hosts.set(id, registration);
		host.restore(this.history?.read()?.selections?.[id]);
		return () => {
			if (this.hosts.get(id) === registration) this.hosts.delete(id);
		};
	}

	restore() {
		const snapshot = this.history?.read();
		for (const [id, host] of this.hosts) host.restore(snapshot?.selections?.[id]);
	}

	/** Fresh view-link selection only; the bridge never calls this for history restoration. */
	selectForView(sectionId: string, key: string) {
		this.hosts.get(sectionId)?.restore(key);
	}

	/** Called after a user selection settles, not on every drag/animation frame. */
	remember() {
		const selections: Record<string, string> = Object.create(null);
		for (const [id, host] of this.hosts) {
			const key = host.read();
			if (key !== undefined) selections[id] = key;
		}
		this.history?.write({ ...this.history.read(), selections });
	}

	activate(origin: NonNullable<CatalogSectionSnapshot['origin']>) {
		this.remember();
		this.history?.write({ selections: {}, ...this.history.read(), origin });
	}

	getOrigin() {
		return this.history?.read()?.origin;
	}
}
