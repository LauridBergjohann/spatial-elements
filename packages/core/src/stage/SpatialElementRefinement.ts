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

/** Separate scene captures preserve authored alpha without sorting two translucent element meshes. */
export class SpatialElementRefinement {
	getRenderTargets() {
		return [this.low, this.high].filter((target): target is THREE.RenderTarget => Boolean(target));
	}
	constructor(private readonly overlay = false) {}
	private low?: THREE.RenderTarget;
	private high?: THREE.RenderTarget;
	private material?: THREE.NodeMaterial;
	private quad?: THREE.QuadMesh;
	private readonly progress = uniform(0);
	private lastFrame?: number;
	private linearProgress = 0;
	complete = false;
	frames = 0;
	get presentedProgress() {
		return this.progress.value;
	}
	restart() {
		this.lastFrame = undefined;
		this.linearProgress = 0;
		this.progress.value = 0;
		this.complete = false;
		this.frames = 0;
	}
	get targetCount() {
		return Number(Boolean(this.low)) + Number(Boolean(this.high));
	}

	render(
		renderer: THREE.WebGPURenderer,
		draw: (high: boolean) => void,
		reducedMotion: boolean,
		progress?: number
	) {
		const destination = renderer.getRenderTarget();
		if (!destination && !this.overlay)
			throw new Error('SpatialElement refinement requires an owned scene capture');
		const size = destination ?? renderer.getDrawingBufferSize(new THREE.Vector2());
		const targetWidth = size.width;
		const targetHeight = size.height;
		if (!this.low || !this.high) {
			this.low =
				destination?.clone() ??
				new THREE.RenderTarget(targetWidth, targetHeight, {
					type: THREE.HalfFloatType,
					samples: 4
				});
			this.high = this.low.clone();
			this.material = new THREE.NodeMaterial();
			this.material.fragmentNode = mix(
				texture(this.low.texture),
				texture(this.high.texture),
				this.progress
			);
			this.material.depthTest = false;
			this.material.depthWrite = false;
			this.material.blending = this.overlay ? THREE.NormalBlending : THREE.NoBlending;
			this.material.transparent = this.overlay;
			this.material.premultipliedAlpha = this.overlay;
			this.material.toneMapped = false;
			this.quad = new THREE.QuadMesh(this.material);
		}
		const { width, height } = getRefinementSize(targetWidth, targetHeight);
		this.low.setSize(width, height);
		this.high.setSize(width, height);
		try {
			// High first: its first actual render must succeed before it becomes visible.
			renderer.setRenderTarget(this.high);
			draw(true);
			renderer.setRenderTarget(this.low);
			draw(false);
			const now = performance.now();
			if (this.lastFrame !== undefined)
				this.linearProgress = Math.min(
					1,
					this.linearProgress + Math.min(50, now - this.lastFrame) / ASYNC_REVEAL_DURATION
				);
			this.progress.value = progress ?? easeInOutSine(this.linearProgress);
			this.lastFrame = now;
			if (reducedMotion) this.progress.value = 1;
			renderer.setRenderTarget(destination);
			if (!this.overlay) renderer.clear();
			this.quad!.render(renderer);
			this.frames += 1;
			this.complete = this.progress.value === 1;
		} finally {
			renderer.setRenderTarget(destination);
		}
	}

	dispose() {
		this.low?.dispose();
		this.high?.dispose();
		this.material?.dispose();
		this.low = this.high = undefined;
		this.material = undefined;
		this.quad = undefined;
	}
}
