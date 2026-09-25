import * as THREE from 'three/webgpu';
import { PresentationReadiness } from './PresentationReadiness.js';
import type { EnvironmentCache, PreparedEnvironment } from '../catalog/EnvironmentCache.js';
import type {
	ProductAssetInstance,
	ProductAssetManager
} from '../catalog/assets/ProductAssetManager.js';
import type { PreparedHigh } from '../catalog/CatalogPreparation.js';
import { ProductRefinement } from './ProductRefinement.js';
import { prepareProductFrame } from './productFrame.js';
import type { resolveStageProfile } from './resolveStageProfile.js';
import {
	applyModelMaterialOverrides,
	centerAndScale,
	disposeMaterialOnly,
	getMeshBounds,
	getMeshMaterials,
	isMesh
} from './stageSceneUtils.js';

type Profile = ReturnType<typeof resolveStageProfile>;
type RefinementState = 'unavailable' | 'loading' | 'decoded' | 'refining' | 'high' | 'failed';
interface HeroTransfer {
	model: THREE.Object3D;
	low?: THREE.Object3D;
	bounds?: THREE.Box3;
	instance?: ProductAssetInstance;
	high?: PreparedHigh;
	profile?: Profile;
	overrides: Set<THREE.Material>;
	refinement?: ProductRefinement;
	blend?: ProductRefinement;
	state: RefinementState;
}

/** Renderer-independent ownership of one hero's representations. Captures transfer, never borrow. */
export class ProductPresentationController {
	getRenderTargets() {
		return [...new Set([this.blend, this.retainedBlend, this.movingBlend])].flatMap(
			(blend) => blend?.getRenderTargets() ?? []
		);
	}
	readonly readiness = new PresentationReadiness();
	private environmentLease?: ReturnType<EnvironmentCache['acquire']>;
	private readonly finalizedTransfers = new WeakSet<HeroTransfer>();
	private generation = 0;
	private request?: AbortController;
	private highRequest?: AbortController;
	private profile?: Profile;
	private value?: THREE.Object3D;
	private low?: THREE.Object3D;
	private bounds?: THREE.Box3;
	private instance?: ProductAssetInstance;
	private high?: PreparedHigh;
	private overrides = new Set<THREE.Material>();
	private blend?: ProductRefinement;
	private movingBlend?: ProductRefinement;
	private retainedBlend?: ProductRefinement;
	private state: RefinementState = 'unavailable';
	private frames = 0;

	constructor(
		private readonly assets: Pick<ProductAssetManager, 'acquire'>,
		private readonly changed: () => void
	) {}

	get model() {
		return this.value;
	}
	get lowModel() {
		return this.low;
	}
	get referenceBounds() {
		return this.bounds;
	}
	get modelKey() {
		return this.value ? this.profile?.modelKey : undefined;
	}
	get highPose() {
		return this.high?.pose;
	}
	get refinement() {
		return this.blend;
	}
	get refinementState() {
		return this.state;
	}
	get refinementFrames() {
		return this.frames;
	}
	get assetInstance() {
		return this.instance;
	}
	get highInstance() {
		return this.high?.instance;
	}
	get catalogBlend() {
		return this.movingBlend;
	}
	get returnBlend() {
		return this.retainedBlend;
	}

	retainEnvironment(cache: EnvironmentCache, environment: PreparedEnvironment) {
		const next = cache.acquire(environment.url);
		this.environmentLease?.release();
		this.environmentLease = next;
	}

	disposeEnvironment() {
		this.environmentLease?.release();
		this.environmentLease = undefined;
	}

	markRefinement(state: RefinementState, frames = this.frames) {
		this.state = state;
		this.frames = frames;
	}

	finishHandoff(synchronous: boolean) {
		if (synchronous && this.high && this.state !== 'high') this.blend = new ProductRefinement(true);
		if (this.movingBlend && this.high) {
			this.retainedBlend?.dispose();
			this.retainedBlend = this.movingBlend;
		} else this.movingBlend?.dispose();
		this.movingBlend = undefined;
	}

	takeHigh() {
		const high = this.high;
		this.high = undefined;
		this.movingBlend = undefined;
		return high;
	}

	restoreHigh(high: PreparedHigh) {
		this.high = high;
		this.retainedBlend = high.blend;
		this.state = 'high';
	}

	takeLowInstance() {
		const low = this.instance;
		this.instance = undefined;
		return low;
	}
	restoreLowInstance(low?: ProductAssetInstance) {
		this.instance = low;
	}

	takeHero(): HeroTransfer | undefined {
		if (!this.value) return;
		const transfer: HeroTransfer = {
			model: this.value,
			low: this.low,
			bounds: this.bounds,
			instance: this.instance,
			high: this.high,
			profile: this.profile,
			overrides: this.overrides,
			refinement: this.blend,
			blend: this.retainedBlend ?? this.movingBlend ?? this.blend,
			state: this.state
		};
		this.value = this.low = undefined;
		this.bounds = undefined;
		this.instance = undefined;
		this.high = undefined;
		this.profile = undefined;
		this.overrides = new Set();
		this.blend = this.retainedBlend = this.movingBlend = undefined;
		return transfer;
	}

	restoreHero(transfer: HeroTransfer) {
		if (this.finalizedTransfers.has(transfer)) return;
		if (this.value) throw new Error('Cannot restore over a live presentation');
		this.finalizedTransfers.add(transfer);
		this.value = transfer.model;
		this.low = transfer.low;
		this.bounds = transfer.bounds;
		this.instance = transfer.instance;
		this.high = transfer.high;
		this.profile = transfer.profile;
		this.overrides = transfer.overrides;
		this.blend = transfer.refinement;
		this.retainedBlend = transfer.blend !== transfer.refinement ? transfer.blend : undefined;
		this.state = transfer.state;
	}

	/** The capture owns/disposes its blend separately. */
	disposeTransfer(transfer: HeroTransfer) {
		if (this.finalizedTransfers.has(transfer)) return;
		this.finalizedTransfers.add(transfer);
		if (transfer.refinement !== transfer.blend) transfer.refinement?.dispose();
		transfer.overrides.forEach(disposeMaterialOnly);
		transfer.high?.overrides.forEach(disposeMaterialOnly);
		transfer.instance?.dispose();
		transfer.high?.instance.dispose();
	}

	/** Page replacement cancels work, not resources already transferred to a capture. */
	cancelRequests() {
		this.generation++;
		this.request?.abort();
		this.request = undefined;
		this.cancelHigh();
	}

	cancelHigh() {
		this.highRequest?.abort();
		this.highRequest = undefined;
		this.blend?.dispose();
		this.blend = undefined;
		if (this.state !== 'high') {
			if (this.value)
				for (const child of this.value.children) child.visible = child !== this.high?.pose;
			this.releaseHigh();
			this.state = 'unavailable';
		}
	}

	private releaseHigh() {
		this.high?.pose.removeFromParent();
		this.high?.overrides.forEach(disposeMaterialOnly);
		this.high?.instance.dispose();
		this.high = undefined;
	}

	release() {
		this.retainedBlend?.dispose();
		this.movingBlend?.dispose();
		this.retainedBlend = this.movingBlend = undefined;
		this.cancelRequests();
		this.releaseHigh();
		this.value?.removeFromParent();
		this.overrides.forEach(disposeMaterialOnly);
		this.overrides.clear();
		this.instance?.dispose();
		this.instance = undefined;
		this.value = this.low = undefined;
		this.bounds = undefined;
		this.profile = undefined;
		this.state = 'unavailable';
	}

	async load(profile: Profile) {
		this.cancelRequests();
		const generation = this.generation;
		const request = (this.request = new AbortController());
		const lease = this.assets.acquire(
			profile.lodPair?.low ?? {
				url: profile.glb,
				format: 'glb',
				revision: 'legacy-unversioned',
				requirements: { decoders: ['draco'], extensions: [] }
			},
			{ signal: request.signal }
		);
		let instance: ProductAssetInstance;
		try {
			instance = await lease.createInstance();
		} catch (error) {
			if (request.signal.aborted) return;
			throw error;
		} finally {
			lease.release();
			if (this.request === request) this.request = undefined;
		}
		if (generation !== this.generation || request.signal.aborted) {
			instance.dispose();
			return;
		}
		this.release();
		this.profile = profile;
		this.instance = instance;
		const model = (this.value = new THREE.Group());
		if (profile.lodPair)
			this.bounds = prepareProductFrame(model, instance.scene, profile.lodPair, profile.model);
		else {
			model.add(instance.scene);
			const rotation = profile.model.rotation;
			if (rotation)
				instance.scene.rotation.set(
					instance.scene.rotation.x + (rotation.x ?? 0),
					instance.scene.rotation.y + (rotation.y ?? 0),
					instance.scene.rotation.z + (rotation.z ?? 0),
					instance.scene.rotation.order
				);
		}
		applyModelMaterialOverrides(instance.scene, profile.model.materialOverrides);
		instance.scene.traverse((object) => {
			if (isMesh(object) && profile.model.materialOverrides?.[object.name])
				getMeshMaterials(object).forEach((material) => this.overrides.add(material));
		});
		if (!profile.lodPair)
			centerAndScale(model, (mesh) => !profile.model.excludeMeshes?.includes(mesh.name));
		this.low = model.clone(true);
		return model;
	}

	adoptHigh(high: PreparedHigh, moving: boolean) {
		if (!this.value || this.high) return false;
		this.high = high;
		this.value.add(high.pose);
		high.pose.visible = false;
		this.state = 'decoded';
		if (moving) this.movingBlend = high.blend;
		else {
			high.blend.restart();
			this.blend = high.blend;
		}
		this.changed();
		return true;
	}

	startHigh() {
		const profile = this.profile;
		const pair = profile?.lodPair;
		const model = this.value;
		if (!profile || !pair || !model || this.highRequest || this.high || this.state === 'failed')
			return;
		const request = (this.highRequest = new AbortController());
		this.state = 'loading';
		this.frames = 0;
		const lease = this.assets.acquire(pair.high, { signal: request.signal });
		void (async () => {
			let instance: ProductAssetInstance | undefined;
			const overrides = new Set<THREE.Material>();
			try {
				instance = await lease.createInstance();
				if (request.signal.aborted || this.value !== model) return;
				applyModelMaterialOverrides(instance.scene, profile.model.materialOverrides);
				instance.scene.traverse((object) => {
					if (isMesh(object) && profile.model.materialOverrides?.[object.name])
						getMeshMaterials(object).forEach((material) => overrides.add(material));
				});
				const container = new THREE.Group();
				prepareProductFrame(container, instance.scene, pair, profile.model);
				if (
					getMeshBounds(
						container,
						(mesh) => !profile.model.excludeMeshes?.includes(mesh.name)
					).isEmpty()
				)
					throw new Error('High contains no product meshes');
				this.adoptHigh(
					{
						instance,
						pose: container.children[0],
						overrides: new Set(overrides),
						blend: new ProductRefinement(true)
					},
					false
				);
				instance = undefined;
				overrides.clear();
			} catch (error) {
				if (!request.signal.aborted && this.value === model) {
					this.state = 'failed';
					console.warn('Optional High loading failed; retaining Low', error);
				}
			} finally {
				overrides.forEach(disposeMaterialOnly);
				instance?.dispose();
				lease.release();
				if (this.highRequest === request) this.highRequest = undefined;
			}
		})();
	}

	/** Returns false when the ordinary single-representation pass should render instead. */
	renderRefinement(
		renderer: THREE.WebGPURenderer,
		scene: THREE.Scene,
		highEnvironment: THREE.Texture | undefined,
		draw: () => void,
		representationChanged: (model: THREE.Object3D, outline: THREE.Object3D) => void,
		reducedMotion: boolean
	) {
		const refinement = this.blend;
		const high = this.high;
		const model = this.value;
		if (!refinement || !high || !model) return false;
		try {
			refinement.render(
				renderer,
				(useHigh) => {
					const environment = scene.environment;
					if (useHigh && highEnvironment) scene.environment = highEnvironment;
					for (const child of model.children) child.visible = (child === high.pose) === useHigh;
					try {
						draw();
					} finally {
						scene.environment = environment;
					}
				},
				reducedMotion
			);
			this.markRefinement(refinement.complete ? 'high' : 'refining', refinement.frames);
			for (const child of model.children)
				child.visible = (child === high.pose) === refinement.complete;
			if (refinement.complete) {
				if (highEnvironment) scene.environment = highEnvironment;
				const outline = model.clone(false);
				outline.add(high.pose.clone(true));
				representationChanged(high.pose, outline);
				this.retainedBlend?.dispose();
				this.retainedBlend = refinement;
				this.blend = undefined;
				draw();
			}
			return true;
		} catch (error) {
			console.warn('Optional High rendering failed; retaining Low', error);
			this.state = 'failed';
			this.cancelHigh();
			this.state = 'failed';
			representationChanged(model, this.low ?? model);
			return false;
		}
	}
}
