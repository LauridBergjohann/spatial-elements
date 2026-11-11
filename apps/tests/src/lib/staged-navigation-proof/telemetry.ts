export interface ProofEvent {
	kind: string;
	time: number;
	owner?: number;
	href?: string;
	phase?: string;
	[key: string]: unknown;
}

export interface NavigationProof {
	events: ProofEvent[];
	phase: string;
	owner?: number;
	ready: boolean;
	warm?: (href: string) => Promise<void>;
	cancel?: () => void;
}

declare global {
	interface Window {
		__stagedNavigationProof?: NavigationProof;
	}
}

export function proofState(): NavigationProof | undefined {
	if (typeof window === 'undefined') return;
	return (window.__stagedNavigationProof ??= { events: [], phase: 'idle', ready: false });
}

export function trace(kind: string, details: Omit<Partial<ProofEvent>, 'kind' | 'time'> = {}) {
	const state = proofState();
	if (!state) return;
	state.events.push({
		kind,
		time: performance.now(),
		phase: state.phase,
		owner: state.owner,
		...details
	});
}
