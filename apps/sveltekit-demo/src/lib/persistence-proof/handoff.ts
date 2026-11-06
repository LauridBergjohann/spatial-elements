import { PresentationLease } from '@spatial-elements/core/catalog/PresentationLease';

export const proofSlots = {
	source: { width: 320, label: 'Source card' },
	target: { width: 640, label: 'Detail summary' },
	wide: { width: 960, label: 'Wide detail summary' }
} as const;
export type ProofSlot = keyof typeof proofSlots;
export interface ProofState {
	slot: ProofSlot;
	phase: 'settled' | 'motion' | 'handoff';
	queryWidth: number;
	pendingSlot?: ProofSlot;
	contentRevision: number;
}

/** Fixture-only coordinator. Component lifetime belongs to the persistent Svelte layout. */
export class ProofHandoff {
	private lease: PresentationLease<object>;
	private generation = 0;
	private disposed = false;
	private queuedRevision = 0;
	private state: ProofState;
	constructor(slot: ProofSlot, private changed: (state: ProofState) => void, dispose: () => void) {
		this.state = { slot, phase: 'settled', queryWidth: proofSlots[slot].width, contentRevision: 0 };
		this.lease = new PresentationLease({}, () => { this.disposed = true; dispose(); });
	}
	get snapshot() { return { ...this.state }; }
	claimRoute(slot: ProofSlot) {
		// A superseded navigation can still finish mounting. It must not steal the bridge lease.
		const expectedSlot = this.state.phase === 'settled' ? this.state.slot : this.state.pendingSlot;
		if (this.disposed || slot !== expectedSlot) {
			return { isCurrent: () => false, release: () => false };
		}
		return this.lease.claim();
	}
	private publish(next: ProofState) { this.state = next; this.changed(this.snapshot); }
	begin(slot: ProofSlot) {
		// The bridge takes ownership before source route cleanup can release the presentation.
		this.lease.claim();
		const generation = ++this.generation;
		const source = this.state.slot;
		this.publish({ ...this.state, phase: 'motion', pendingSlot: slot });
		const current = () => !this.disposed && generation === this.generation;
		return {
			finishMotion: () => {
				if (!current()) return false;
				this.publish({ ...this.state, phase: 'handoff' });
				return true;
			},
			commit: () => {
				if (!current()) return false;
				this.generation++;
				this.publish({ slot, phase: 'settled', queryWidth: proofSlots[slot].width, contentRevision: this.queuedRevision });
				return true;
			},
			cancel: () => {
				if (!current()) return false;
				this.generation++;
				this.publish({ slot: source, phase: 'settled', queryWidth: proofSlots[source].width, contentRevision: this.queuedRevision });
				return true;
			}
		};
	}
	queueContentChange() {
		this.queuedRevision++;
		if (this.state.phase === 'settled') this.publish({ ...this.state, contentRevision: this.queuedRevision });
	}
	destroy() {
		this.generation++;
		if (!this.disposed) this.lease.claim().release();
	}
}

export const proofContext = Symbol('persistent-summary-proof');
export function slotFromPath(path: string): ProofSlot | undefined {
	const name = path.split('/').at(-1);
	return path.startsWith('/proof/persistent-summary/') && name && Object.hasOwn(proofSlots, name) ? name as ProofSlot : undefined;
}
