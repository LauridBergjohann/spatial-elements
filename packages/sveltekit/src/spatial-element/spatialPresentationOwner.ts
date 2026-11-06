import type { SpatialSummaryHostController } from './spatialSummaryHost.svelte.js';

/** Adapter-local upward registration: Stage owns transitions; its child owns live Svelte roots. */
export const SPATIAL_PRESENTATION_OWNER = Symbol('spatial-presentation-owner');
export interface SpatialPresentationOwner {
	register(host: SpatialSummaryHostController): () => void;
}
