import { hydrate, mount, unmount, type Snippet } from 'svelte';
import { PresentationLease } from '@spatial-elements/core/catalog/PresentationLease';
import IslandRoot from './IslandRoot.svelte';
import { islandTelemetry } from './telemetry';

export const islandContext = Symbol('persistent-island-proof');
export interface IslandDescriptor {
	key: string;
	slot: 'source' | 'target' | 'wide';
	width: number;
}
export class IslandController {
	private root?: HTMLElement;
	private component?: ReturnType<typeof hydrate>;
	private lease?: PresentationLease<HTMLElement>;
	private owner?: ReturnType<PresentationLease<HTMLElement>['claim']>;
	private disposed = false;
	private generation = 0;
	private sourceSlot?: HTMLElement;
	private targetSlot?: IslandDescriptor['slot'];
	projection?: HTMLElement;
	constructor(
		readonly content: () => Snippet,
		readonly contexts: Map<unknown, unknown>,
		private readonly changed: (phase: string) => void
	) {}
	attach(slot: HTMLElement, descriptor: IslandDescriptor) {
		if (this.disposed || (this.targetSlot && descriptor.slot !== this.targetSlot)) return () => {};
		let active = true;
		let claim: ReturnType<PresentationLease<HTMLElement>['claim']> | undefined;
		// The outer application finishes hydration before the independent inner root starts.
		queueMicrotask(() => {
			if (!active || this.disposed) return;
			if (!this.root) {
				let root = slot.querySelector<HTMLElement>('[data-island-root]');
				const serverRoot = Boolean(root);
				if (!root) {
					root = document.createElement('div');
					root.dataset.islandRoot = '';
					root.style.cssText =
						'width:100%;container-type:inline-size;container-name:island-summary';
					slot.append(root);
				}
				this.root = root;
				const options = {
					target: root,
					props: { content: this.content() },
					context: this.contexts
				};
				this.component = serverRoot
					? hydrate(IslandRoot, { ...options, recover: false })
					: mount(IslandRoot, options);
				if (serverRoot) islandTelemetry().hydrations++;
				this.lease = new PresentationLease(root, () => {
					if (this.component) {
						void unmount(this.component);
						this.component = undefined;
					}
					this.root?.remove();
					this.root = undefined;
				});
			}
			claim = this.lease!.claim();
			this.owner = claim;
			this.sourceSlot = slot;
			this.targetSlot = undefined;
			slot.append(this.root);
			this.root.style.width = '100%';
			this.changed('settled');
		});
		return () => {
			active = false;
			claim?.release();
		};
	}
	begin(target: IslandDescriptor['slot']) {
		if (!this.root || !this.lease || !this.projection) return;
		const generation = ++this.generation;
		this.targetSlot = target;
		this.owner = this.lease.claim();
		const rect = this.root.getBoundingClientRect();
		if (this.sourceSlot) this.sourceSlot.style.minHeight = `${rect.height}px`;
		this.root.style.width = `${rect.width}px`;
		this.projection.style.left = `${rect.left}px`;
		this.projection.style.top = `${rect.top}px`;
		this.projection.append(this.root);
		this.changed('motion');
		return () => {
			if (generation === this.generation && !this.disposed) this.changed('handoff');
		};
	}
	destroy() {
		if (this.disposed) return;
		this.disposed = true;
		this.generation++;
		this.owner?.release();
	}
}
