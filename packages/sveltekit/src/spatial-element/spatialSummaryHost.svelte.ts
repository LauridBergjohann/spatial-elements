import { hydrate, mount, unmount } from 'svelte';
import { PresentationLease } from '@spatial-elements/core/catalog/PresentationLease';
import SpatialSummaryRoot from './SpatialSummaryRoot.svelte';
import type { SpatialSummaryContext, SpatialSummarySnippet } from './spatialSummary.js';

export const SPATIAL_SUMMARY_HOST = Symbol('spatial-summary-host');
export interface SummaryRecord {
	key: string;
	root: HTMLElement;
	slot: HTMLElement;
	model: { current: SpatialSummaryContext };
	component: ReturnType<typeof mount>;
	lease: PresentationLease<HTMLElement>;
	owner: ReturnType<PresentationLease<HTMLElement>['claim']>;
}

/** Instance ownership is independent of a route's placement node. No navigation is activated here. */
export class SpatialSummaryHostController {
	private records = new Map<string, SummaryRecord>();
	private disposed = false;
	constructor(readonly content: () => SpatialSummarySnippet, readonly contexts: Map<unknown, unknown>) {}
	attach(slot: HTMLElement, key: string, context: SpatialSummaryContext) {
		let active = true;
		let owner: SummaryRecord['owner'] | undefined;
		queueMicrotask(() => {
			if (!active || this.disposed) return;
			if (this.records.has(key)) throw new Error(`Duplicate summary occurrence: ${key}`);
			let root = slot.querySelector<HTMLElement>('[data-spatial-summary-root]');
			const serverRoot = Boolean(root);
			if (!root) {
				root = document.createElement('div');
				root.dataset.spatialSummaryRoot = '';
				root.className = 'spatial-summary-query';
				slot.append(root);
			}
			root.style.setProperty('--spatial-summary-content-inset', `${context.contentInset}px`);
			const model = $state({ current: context });
			const options = { target: root, props: { content: this.content(), model }, context: this.contexts };
			const component = serverRoot ? hydrate(SpatialSummaryRoot, { ...options, recover: false }) : mount(SpatialSummaryRoot, options);
			const lease = new PresentationLease(root, () => {
				void unmount(component);
				root.remove();
				this.records.delete(record.key);
			});
			owner = lease.claim();
			const record: SummaryRecord = { key, root, slot, model, component, lease, owner };
			this.records.set(key, record);
		});
		return () => { active = false; owner?.release(); };
	}
	/** Controlled host data updates are applied by the caller in the content phase. */
	update(key: string, context: SpatialSummaryContext) {
		const record = this.records.get(key);
		if (!record) return;
		record.model.current = context;
		record.root.style.setProperty('--spatial-summary-content-inset', `${context.contentInset}px`);
	}
	/** Internal seam for a future explicit occurrence transfer; ordinary navigation does not use it yet. */
	retain(key: string) {
		const record = this.records.get(key);
		if (!record || this.disposed) return;
		record.owner = record.lease.claim();
		return { record, release: record.owner.release };
	}
	destroy() {
		if (this.disposed) return;
		this.disposed = true;
		for (const record of this.records.values()) record.owner.release();
		this.records.clear();
	}
}
