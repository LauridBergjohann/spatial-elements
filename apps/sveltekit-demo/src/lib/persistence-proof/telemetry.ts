export interface ProofTelemetry {
	mounts: number;
	destroys: number;
	updates: number;
	leaseDisposals: number;
	routeMounts: number;
	routeDestroys: number;
}
declare global {
	interface Window {
		__persistentSummaryProof?: ProofTelemetry;
	}
}
export function telemetry() {
	return (window.__persistentSummaryProof ??= {
		mounts: 0,
		destroys: 0,
		updates: 0,
		leaseDisposals: 0,
		routeMounts: 0,
		routeDestroys: 0
	});
}
