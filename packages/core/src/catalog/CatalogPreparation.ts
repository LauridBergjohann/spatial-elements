import * as THREE from 'three/webgpu';
import type { ProductStageConfig } from '../product-detail/types.js';
import { prepareProductFrame } from '../stage/productFrame.js';
import {
	applyModelMaterialOverrides,
	getMeshBounds,
	getMeshMaterials,
	isMesh
} from '../stage/stageSceneUtils.js';
import { ProductRefinement } from '../stage/ProductRefinement.js';
import type { ProductAssetInstance, ProductAssetManager } from './assets/ProductAssetManager.js';
import type { EnvironmentCache, PreparedEnvironment } from './EnvironmentCache.js';
import type { PreparationGate } from './PreparationGate.js';
import { resolveProductLodPair } from './productLodPair.js';

export interface PreparedHigh {
	instance: ProductAssetInstance;
	pose: THREE.Object3D;
	overrides: Set<THREE.Material>;
	blend: ProductRefinement;
}
export interface ProductPreparation {
	key: string;
	controller: AbortController;
	environment: ReturnType<EnvironmentCache['acquire']>;
	backgroundState: 'loading' | 'ready' | 'failed';
	highState: 'loading' | 'ready' | 'failed' | 'unavailable' | 'adopted';
	high?: PreparedHigh;
	timings?: { buildMs: number; gpuWarmMs: number };
}
export const preparationKey = (
	stage: Pick<ProductStageConfig, 'hdr' | 'glb' | 'lodPair' | 'model' | 'background'>
) => JSON.stringify([stage.hdr, stage.glb, stage.lodPair, stage.model ?? {}, stage.background]);

/** At most one speculative presentation is retained; active instances are adopted by the stage. */
export class CatalogPreparation {
	current?: ProductPreparation;
	constructor(
		private assets: ProductAssetManager,
		private environments: EnvironmentCache,
		private gate: PreparationGate,
		private warm: (
			high: PreparedHigh,
			environment: PreparedEnvironment,
			signal: AbortSignal
		) => Promise<void>,
		private changed: () => void
	) {}
	prepare(stage: ProductStageConfig) {
		const key = preparationKey(stage);
		if (this.current?.key === key && this.current.highState !== 'adopted') return this.current;
		this.dispose();
		const pair = resolveProductLodPair(stage.glb, stage.lodPair);
		const entry: ProductPreparation = {
			key,
			controller: new AbortController(),
			environment: this.environments.acquire(stage.hdr),
			backgroundState: 'loading',
			highState: pair ? 'loading' : 'unavailable'
		};
		this.current = entry;
		void entry.environment.ready
			.then(
				async () => {
					await this.gate.wait(entry.controller.signal);
					entry.backgroundState = 'ready';
					this.changed();
				},
				() => {
					entry.backgroundState = 'failed';
					this.changed();
				}
			)
			.catch(() => {});
		if (entry.environment.value) entry.backgroundState = 'ready';
		if (pair) {
			const signal = entry.controller.signal;
			const lease = this.assets.acquire(pair.high, { signal });
			void (async () => {
				let high: PreparedHigh | undefined;
				let instance: ProductAssetInstance | undefined;
				try {
					const [, environment] = await Promise.all([lease.ready, entry.environment.ready]);
					await this.gate.wait(signal);
					instance = await lease.createInstance();
					let buildStarted = 0;
					await this.gate.run(() => {
						buildStarted = performance.now();
						signal.throwIfAborted();
						const settings = stage.model ?? {};
						applyModelMaterialOverrides(instance!.scene, settings.materialOverrides);
						const overrides = new Set<THREE.Material>();
						const excluded = new Set(settings.excludeMeshes ?? []);
						instance!.scene.traverse((object) => {
							if (!isMesh(object)) return;
							if (excluded.has(object.name)) object.visible = false;
							if (settings.materialOverrides?.[object.name])
								getMeshMaterials(object).forEach((material) => overrides.add(material));
						});
						const container = new THREE.Group();
						prepareProductFrame(container, instance!.scene, pair, settings);
						high = {
							instance: instance!,
							overrides,
							pose: container.children[0],
							blend: new ProductRefinement(true)
						};
						instance = undefined;
						if (getMeshBounds(container, (mesh) => !excluded.has(mesh.name)).isEmpty())
							throw new Error('High contains no product meshes');
					}, signal);
					const warmStarted = performance.now();
					await this.warm(high!, environment, signal);
					entry.timings = {
						buildMs: warmStarted - buildStarted,
						gpuWarmMs: performance.now() - warmStarted
					};
					await this.gate.wait(signal);
					signal.throwIfAborted();
					entry.high = high;
					high = undefined;
					entry.highState = 'ready';
					this.changed();
				} catch (error) {
					if (!signal.aborted) {
						entry.highState = 'failed';
						console.warn('Optional product preparation failed; retaining Low', error);
						this.changed();
					}
				} finally {
					instance?.dispose();
					if (high) disposePreparedHigh(high);
					lease.release();
				}
			})();
		}
		return entry;
	}
	takeHigh(entry: ProductPreparation) {
		const high = entry.high;
		if (high) {
			entry.high = undefined;
			entry.highState = 'adopted';
		}
		return high;
	}
	dispose() {
		const entry = this.current;
		this.current = undefined;
		if (!entry) return;
		entry.controller.abort();
		entry.environment.release();
		if (entry.high) disposePreparedHigh(entry.high);
	}
}
export function disposePreparedHigh(high: PreparedHigh) {
	high.pose.removeFromParent();
	high.blend.dispose();
	high.overrides.forEach((material) => material.dispose());
	high.instance.dispose();
}
