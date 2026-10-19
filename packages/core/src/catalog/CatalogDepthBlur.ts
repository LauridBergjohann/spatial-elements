import * as THREE from 'three/webgpu';
import { texture, uniform } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { gaussianTargets } from '../stage/renderTargetInventory.js';

export interface BlurRect { left: number; top: number; width: number; height: number }

/** One bounded scratch image for all defocused models and panels, reused between draws. */
export class CatalogDepthBlur {
	private capture?: THREE.RenderTarget;
	private effect?: ReturnType<typeof gaussianBlur>;
	private material?: THREE.NodeMaterial;
	private quad?: THREE.QuadMesh;
	private readonly camera = new THREE.PerspectiveCamera();
	private readonly direction = uniform(new THREE.Vector2());
	private passes = 0;
	getRenderTargets() { return this.capture ? [this.capture, ...gaussianTargets(this.effect!)] : []; }
	getStats() { return { passes: this.passes, targets: this.getRenderTargets().length, size: this.capture?.width ?? 0 }; }

	render(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
		bounds: BlurRect, radius: number, draw: (camera: THREE.PerspectiveCamera) => void,
		clip: BlurRect = { left: 0, top: 0, width: innerWidth, height: innerHeight }) {
		if (radius < 0.05) { draw(camera); return; }
		const padding = Math.ceil(radius * 3 + 2);
		const left = Math.max(0, clip.left, Math.floor(bounds.left - padding));
		const top = Math.max(0, clip.top, Math.floor(bounds.top - padding));
		const right = Math.min(innerWidth, clip.left + clip.width, Math.ceil(bounds.left + bounds.width + padding));
		const bottom = Math.min(innerHeight, clip.top + clip.height, Math.ceil(bounds.top + bounds.height + padding));
		const width = right - left, height = bottom - top;
		if (width <= 0 || height <= 0) return;
		if (!this.capture) {
			this.capture = new THREE.RenderTarget(512, 512, { type: THREE.HalfFloatType });
			this.effect = gaussianBlur(texture(this.capture.texture), this.direction, 2,
				{ resolutionScale: 0.5, premultipliedAlpha: false });
			// Several actors reuse the scratch image within one stage frame.
			this.effect.updateBeforeType = THREE.NodeUpdateType.RENDER;
			this.material = new THREE.NodeMaterial();
			this.material.fragmentNode = this.effect;
			this.material.transparent = true;
			// Captures and Gaussian samples are already premultiplied; do not multiply alpha twice.
			this.material.blending = THREE.CustomBlending;
			this.material.blendSrc = this.material.blendSrcAlpha = THREE.OneFactor;
			this.material.blendDst = this.material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
			this.material.depthTest = false;
			this.material.depthWrite = false;
			this.material.toneMapped = false;
			this.quad = new THREE.QuadMesh(this.material);
		}
		const destination = renderer.getRenderTarget();
		const viewport = destination ? destination.viewport.clone() : renderer.getViewport(new THREE.Vector4());
		const clearColor = renderer.getClearColor(new THREE.Color());
		const clearAlpha = renderer.getClearAlpha();
		const scissorTest = renderer.getScissorTest();
		this.camera.copy(camera);
		this.camera.setViewOffset(innerWidth, innerHeight, left, top, width, height);
		// The half-resolution Gaussian uses a kernel standard deviation of 7/3 texels.
		this.direction.value.set(radius * 256 / width / (7 / 3), radius * 256 / height / (7 / 3));
		try {
			renderer.setRenderTarget(this.capture);
			renderer.setScissorTest(false);
			renderer.setClearColor(0x000000, 0);
			renderer.clear();
			draw(this.camera);
			renderer.setRenderTarget(destination);
			const scaleX = viewport.z / innerWidth, scaleY = viewport.w / innerHeight;
			const output = new THREE.Vector4(viewport.x + left * scaleX, viewport.y + top * scaleY, width * scaleX, height * scaleY);
			if (destination) destination.viewport.copy(output);
			else renderer.setViewport(output);
			this.quad!.render(renderer);
			this.passes++;
		} finally {
			renderer.setRenderTarget(destination);
			if (destination) destination.viewport.copy(viewport);
			else renderer.setViewport(viewport);
			renderer.setClearColor(clearColor, clearAlpha);
			renderer.setScissorTest(scissorTest);
		}
	}
	dispose() {
		this.capture?.dispose();
		this.effect?.dispose();
		this.material?.dispose();
	}
}
