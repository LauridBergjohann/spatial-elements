export interface IslandTelemetry {
	mounts: number;
	destroys: number;
	updates: number;
	hydrations: number;
	routeMounts: number;
	routeDestroys: number;
}
declare global {
	interface Window {
		__islandProof?: IslandTelemetry;
	}
}
export function islandTelemetry() {
	return (window.__islandProof ??= {
		mounts: 0,
		destroys: 0,
		updates: 0,
		hydrations: 0,
		routeMounts: 0,
		routeDestroys: 0
	});
}
