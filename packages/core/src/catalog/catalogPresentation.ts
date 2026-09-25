import type { Material, Object3D } from 'three';

export interface CatalogTransitionPresentation {
	active: boolean;
	enterOpacity: number;
	exitOpacity: number;
	sharedOpacity: number;
	/** Independent environment reveal; older callers default to the content channel. */
	backgroundOpacity?: number;
	/** Product-only LOD blend; independent of the environment channel. */
	geometryOpacity?: number;
}

export type CatalogTransitionGroup = 'enter' | 'shared';

export const RESTING_CATALOG_PRESENTATION: Readonly<CatalogTransitionPresentation> = {
	active: false,
	enterOpacity: 1,
	exitOpacity: 1,
	sharedOpacity: 1
};

export function normalizeCatalogPresentation(
	state: CatalogTransitionPresentation
): CatalogTransitionPresentation {
	if (!state.active) return { ...RESTING_CATALOG_PRESENTATION };
	const opacity = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
	return {
		active: true,
		enterOpacity: opacity(state.enterOpacity),
		exitOpacity: opacity(state.exitOpacity),
		sharedOpacity: opacity(state.sharedOpacity),
		...(state.backgroundOpacity === undefined
			? {}
			: { backgroundOpacity: opacity(state.backgroundOpacity) }),
		...(state.geometryOpacity === undefined
			? {}
			: { geometryOpacity: opacity(state.geometryOpacity) })
	};
}

export function getCatalogTransitionOpacity(state: CatalogTransitionPresentation, group?: string) {
	if (!state.active) return 1;
	return group === 'enter' ? state.enterOpacity : group === 'shared' ? state.sharedOpacity : 1;
}

/** Capture authored alpha once so presentation updates never compound material opacity. */
export function captureCatalogMaterialOpacity(model: Object3D) {
	const materials = new Set<Material>();
	model.traverse((object) => {
		const material = (object as Object3D & { material?: Material | Material[] }).material;
		if (material)
			for (const item of Array.isArray(material) ? material : [material]) materials.add(item);
	});
	return [...materials].map((material) => ({
		material,
		opacity: material.opacity,
		transparent: material.transparent,
		depthWrite: material.depthWrite
	}));
}

export function applyCatalogMaterialOpacity(
	states: ReturnType<typeof captureCatalogMaterialOpacity>,
	opacity: number
) {
	for (const state of states) {
		const transparent = state.transparent || opacity < 1;
		if (state.material.transparent !== transparent) {
			state.material.transparent = transparent;
			state.material.needsUpdate = true;
		}
		state.material.opacity = state.opacity * opacity;
		state.material.depthWrite = state.depthWrite && opacity === 1;
	}
}
