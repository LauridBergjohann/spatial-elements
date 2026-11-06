import * as THREE from 'three/webgpu';
import { mix, texture, uniform } from 'three/tsl';
import { easeInOutSine, ASYNC_REVEAL_DURATION } from '../catalog/transitionTiming.js';

// Bound temporary attachments independently of viewport size and device pixel ratio.
const MAX_REFINEMENT_PIXELS = 512 * 1024;
export function getRefinementSize(width: number, height: number) {
	const scale = Math.min(1, Math.sqrt(MAX_REFINEMENT_PIXELS / (width * height)));
	return {
		width: Math.max(1, Math.floor(width * scale)),
		height: Math.max(1, Math.floor(height * scale))
	};
}

export interface SceneEndpointGuard {
	isValid(): boolean;
	dispose(): void;
}
export interface SceneEndpointTicket {
	commit(): boolean;
	cancel(): void;
}
export interface RefinementRenderOptions {
	/** Hidden preparation/its intervening RAFs borrow pixels without ticking q. */
	advanceClock?: boolean;
	backgroundReveal?: number;
}
interface SceneEndpointCache {
	destination: THREE.RenderTarget;
	destinationWidth: number;
	destinationHeight: number;
	zero: [THREE.RenderTarget, THREE.RenderTarget];
	material: THREE.NodeMaterial;
	quad: THREE.QuadMesh;
	copyMaterial: THREE.NodeMaterial;
	copy: THREE.QuadMesh;
	background: { value: number };
	refinement: { value: number };
	guard: SceneEndpointGuard;
	epoch: number;
	ready: boolean;
}

/** Separate scene captures preserve authored alpha without sorting two translucent element meshes. */
export class SpatialElementRefinement {
	getRenderTargets() {
		return [this.low, this.high, ...(this.sceneCache?.zero ?? [])].filter((target): target is THREE.RenderTarget => Boolean(target));
	}
	constructor(private readonly overlay = false) {}
	private low?: THREE.RenderTarget;
	private high?: THREE.RenderTarget;
	private material?: THREE.NodeMaterial;
	private quad?: THREE.QuadMesh;
	private readonly progress = uniform(0);
	private lastFrame?: number;
	private linearProgress = 0;
	private writeEpoch = 0;
	private sceneCache?: SceneEndpointCache;
	private readonly cacheStats = { preparations: 0, ready: 0, hits: 0, pendingReads: 0, invalidations: 0, staleTickets: 0 };
	getSceneEndpointStats() { return { ...this.cacheStats, active: Boolean(this.sceneCache?.ready), pending: Boolean(this.sceneCache && !this.sceneCache.ready) }; }
	complete = false;
	frames = 0;
	get presentedProgress() {
		return this.progress.value;
	}
	restart() {
		this.invalidateSceneEndpoints();
		this.lastFrame = undefined;
		this.linearProgress = 0;
		this.progress.value = 0;
		this.complete = false;
		this.frames = 0;
	}
	get targetCount() {
		return this.getRenderTargets().length;
	}

	invalidateSceneEndpoints() {
		const cache = this.sceneCache;
		if (!cache) return;
		this.sceneCache = undefined;
		this.cacheStats.invalidations++;
		cache.zero.forEach(target => target.dispose());
		cache.material.dispose(); cache.copyMaterial.dispose(); cache.guard.dispose();
	}

	private ensureTargets(renderer: THREE.WebGPURenderer) {
		const destination = renderer.getRenderTarget();
		if (!destination && !this.overlay) throw new Error('SpatialElement refinement requires an owned scene capture');
		const size = destination ?? renderer.getDrawingBufferSize(new THREE.Vector2());
		if (!this.low || !this.high) {
			this.low = destination?.clone() ?? new THREE.RenderTarget(size.width, size.height, { type: THREE.HalfFloatType, samples: 4 });
			this.high = this.low.clone();
			this.material = this.createCompositeMaterial(mix(texture(this.low.texture), texture(this.high.texture), this.progress));
			this.quad = new THREE.QuadMesh(this.material);
		}
		const { width, height } = getRefinementSize(size.width, size.height);
		if (this.low.width !== width || this.low.height !== height || this.high.width !== width || this.high.height !== height) {
			this.invalidateSceneEndpoints(); this.writeEpoch++;
			this.low.setSize(width, height); this.high.setSize(width, height);
		}
		return destination;
	}
	private createCompositeMaterial(fragment: THREE.NodeMaterial['fragmentNode']) {
		const material = new THREE.NodeMaterial(); material.fragmentNode = fragment;
		material.depthTest = material.depthWrite = false;
		material.blending = this.overlay ? THREE.NormalBlending : THREE.NoBlending;
		material.transparent = material.premultipliedAlpha = this.overlay;
		material.toneMapped = false;
		return material;
	}
	private endpointsCurrent(cache: SceneEndpointCache) {
		return cache.epoch === this.writeEpoch && cache.destination.width === cache.destinationWidth && cache.destination.height === cache.destinationHeight &&
			this.low?.width === cache.zero[0].width && this.low?.height === cache.zero[0].height &&
			this.high?.width === cache.zero[1].width && this.high?.height === cache.zero[1].height && cache.guard.isValid();
	}

	/** Call only after all warm live passes. Taking endpoints never advances the refinement clock.
	 * The caller fences these submissions and explicitly commits the returned ticket. */
	prepareSceneEndpoints(renderer: THREE.WebGPURenderer, draw: (high: boolean, backgroundReveal: number) => void, guard: SceneEndpointGuard): SceneEndpointTicket | undefined {
		this.invalidateSceneEndpoints();
		let destination: THREE.RenderTarget | null = renderer.getRenderTarget();
		try { destination = this.ensureTargets(renderer); }
		catch (error) { guard.dispose(); throw error; }
		if (!destination || this.low!.texture.type !== THREE.HalfFloatType || !guard.isValid()) { guard.dispose(); return; }
		const zero = [0, 1].map(() => {
			const target = new THREE.RenderTarget(this.low!.width, this.low!.height, { type: THREE.HalfFloatType, samples: 0, depthBuffer: false, stencilBuffer: false });
			target.texture.colorSpace = THREE.NoColorSpace; target.texture.generateMipmaps = false;
			return target;
		}) as [THREE.RenderTarget, THREE.RenderTarget];
		const background = uniform(0), refinement = uniform(0);
		const material = this.createCompositeMaterial(mix(mix(texture(zero[0].texture), texture(this.low!.texture), background), mix(texture(zero[1].texture), texture(this.high!.texture), background), refinement));
		const source = texture(this.low!.texture);
		const copyMaterial = new THREE.NodeMaterial(); copyMaterial.fragmentNode = source;
		copyMaterial.depthTest = copyMaterial.depthWrite = false; copyMaterial.blending = THREE.NoBlending; copyMaterial.toneMapped = false;
		const cache: SceneEndpointCache = { destination, destinationWidth: destination.width, destinationHeight: destination.height,
			zero, background, refinement, material, quad: new THREE.QuadMesh(material), copyMaterial, copy: new THREE.QuadMesh(copyMaterial), guard, epoch: ++this.writeEpoch, ready: false };
		this.sceneCache = cache;
		try {
			for (const p of [0, 1]) for (const high of [true, false]) {
				const target = high ? this.high! : this.low!;
				renderer.setRenderTarget(target); draw(high, p);
				if (p === 0) { source.value = target.texture; renderer.setRenderTarget(zero[high ? 1 : 0]); cache.copy.render(renderer); }
			}
			// Warm the exact overlay pipeline without touching the actual q uniform/clock.
			renderer.setRenderTarget(destination); background.value = 0.5; refinement.value = this.progress.value;
			// Offscreen rendering reads RenderTarget.scissor, not the Canvas scissor.
			// Preserve the real presentation seed: even a hidden overlay can change it for transmission.
			const scissor = destination.scissor.clone(), scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
			try {
				destination.scissor.set(0, 0, 0, 0); renderer.setScissorTest(true); renderer.autoClear = false;
				cache.quad.render(renderer);
			} finally { destination.scissor.copy(scissor); renderer.setScissorTest(scissorTest); renderer.autoClear = autoClear; }
			this.cacheStats.preparations++;
		} catch (error) { this.invalidateSceneEndpoints(); throw error; }
		finally { renderer.setRenderTarget(destination); }
		return {
			commit: () => {
				if (this.sceneCache !== cache || !this.endpointsCurrent(cache)) {
					this.cacheStats.staleTickets++;
					if (this.sceneCache === cache) this.invalidateSceneEndpoints();
					return false;
				}
				if (!cache.ready) { cache.ready = true; this.cacheStats.ready++; }
				return true;
			},
			cancel: () => { if (this.sceneCache === cache) this.invalidateSceneEndpoints(); }
		};
	}

	render(
		renderer: THREE.WebGPURenderer,
		draw: (high: boolean) => void,
		reducedMotion: boolean,
		progress?: number,
		options: RefinementRenderOptions = {}
	) {
		const destination = this.ensureTargets(renderer);
		let cache = this.sceneCache;
		if (cache && (cache.destination !== destination || !this.endpointsCurrent(cache) || !Number.isFinite(options.backgroundReveal) || (!cache.ready && options.advanceClock !== false))) {
			this.invalidateSceneEndpoints(); cache = undefined;
		}
		try {
			if (!cache) {
				this.writeEpoch++;
				// Every live write invalidates a fence ticket, even when its scene generation did not change.
				renderer.setRenderTarget(this.high!); draw(true);
				renderer.setRenderTarget(this.low!); draw(false);
			}
			if (options.advanceClock !== false) {
				const now = performance.now();
				if (this.lastFrame !== undefined) this.linearProgress = Math.min(1, this.linearProgress + Math.min(50, now - this.lastFrame) / ASYNC_REVEAL_DURATION);
				this.progress.value = progress ?? easeInOutSine(this.linearProgress);
				this.lastFrame = now;
				if (reducedMotion) this.progress.value = 1;
			}
			renderer.setRenderTarget(destination);
			if (!this.overlay) renderer.clear();
			if (cache) {
				cache.background.value = Math.max(0, Math.min(1, options.backgroundReveal!)); cache.refinement.value = this.progress.value;
				cache.quad.render(renderer);
				if (cache.ready) this.cacheStats.hits++; else this.cacheStats.pendingReads++;
			} else this.quad!.render(renderer);
			if (options.advanceClock !== false) { this.frames += 1; this.complete = this.progress.value === 1; }
		} finally {
			renderer.setRenderTarget(destination);
		}
	}

	dispose() {
		this.invalidateSceneEndpoints(); this.writeEpoch++;
		this.low?.dispose();
		this.high?.dispose();
		this.material?.dispose();
		this.low = this.high = undefined;
		this.material = undefined;
		this.quad = undefined;
	}
}
