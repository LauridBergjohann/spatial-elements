export const MODEL_INPUT_EVENT = 'stage:model-input';
export interface ModelInputState { hovered: boolean; active: boolean }
export interface InteractionGuidanceState { prompted: boolean; interacted: boolean }
const STORAGE_KEY = 'spatial-elements:interaction-guidance:v1';

/** One learning state per browser tab, shared across products and stage remounts. */
export class InteractionGuidance {
	private state: InteractionGuidanceState = { prompted: false, interacted: false };
	private readonly listeners = new Set<(state: Readonly<InteractionGuidanceState>) => void>();
	constructor(private readonly storage?: Pick<Storage, 'getItem' | 'setItem'>) {
		try {
			const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
			this.state = { prompted: saved.prompted === true, interacted: saved.interacted === true };
		} catch { /* Storage is optional, including in private browsing. */ }
	}
	get snapshot(): Readonly<InteractionGuidanceState> { return this.state; }
	claimPrompt() {
		if (this.state.prompted || this.state.interacted) return false;
		this.update({ ...this.state, prompted: true });
		return true;
	}
	interact() {
		if (!this.state.interacted) this.update({ prompted: true, interacted: true });
	}
	subscribe(listener: (state: Readonly<InteractionGuidanceState>) => void) {
		this.listeners.add(listener);
		listener(this.state);
		return () => { this.listeners.delete(listener); };
	}
	private update(state: InteractionGuidanceState) {
		this.state = state;
		try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* In-memory fallback. */ }
		for (const listener of this.listeners) listener(state);
	}
}

const sessions = new WeakMap<Window, InteractionGuidance>();
/** Lazy browser access keeps server rendering isolated between requests. */
export function getInteractionGuidance(target = typeof window === 'undefined' ? undefined : window) {
	if (!target) return new InteractionGuidance();
	let session = sessions.get(target);
	if (!session) {
		let storage: Storage | undefined;
		try { storage = target.sessionStorage; } catch { /* Sandboxed/private context. */ }
		session = new InteractionGuidance(storage);
		sessions.set(target, session);
	}
	return session;
}
