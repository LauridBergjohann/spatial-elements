import * as THREE from 'three/webgpu';
import { texture, uniform } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { gaussianTargets } from '../stage/renderTargetInventory.js';
import { clearFullTarget, withRendererState } from '../stage/rendererState.js';
import type { CatalogWarmOutputContext } from './CatalogWarmOutputContext.js';

export interface BlurRect { left: number; top: number; width: number; height: number }

export function resolveDepthBlurRect(bounds: BlurRect, radius: number,
	clip: BlurRect = { left: 0, top: 0, width: innerWidth, height: innerHeight }): BlurRect | undefined {
	const padding = Math.ceil(radius * 3 + 2);
	const left = Math.max(0, clip.left, Math.floor(bounds.left - padding));
	const top = Math.max(0, clip.top, Math.floor(bounds.top - padding));
	const right = Math.min(innerWidth, clip.left + clip.width, Math.ceil(bounds.left + bounds.width + padding));
	const bottom = Math.min(innerHeight, clip.top + clip.height, Math.ceil(bounds.top + bounds.height + padding));
	return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : undefined;
}

/** One bounded scratch image for all defocused models and panels, reused between draws. */
export class CatalogDepthBlur {
	private capture?: THREE.RenderTarget;
	private effect?: ReturnType<typeof gaussianBlur>;
	private material?: THREE.NodeMaterial;
	private quad?: THREE.QuadMesh;
	private readonly camera = new THREE.PerspectiveCamera();
	private readonly direction = uniform(new THREE.Vector2());
	private passes = 0;
	private resolvedTexture?: ReturnType<typeof texture>;
	private readonly resolvedOpacity = uniform(1);
	private resolvedMaterial?: THREE.NodeMaterial;
	private cacheResolveQuad?: THREE.QuadMesh;
	private resolvedCanvasQuad?: THREE.QuadMesh;
	private resolvedOffscreenQuad?: THREE.QuadMesh;
	getRenderTargets() { return this.capture ? [this.capture, ...gaussianTargets(this.effect!)] : []; }
	getStats() { return { passes: this.passes, targets: this.getRenderTargets().length, size: this.capture?.width ?? 0 }; }
	/** Idle preparation borrows the real capture context without resolving it onto any output. */
	prepareCapture(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
		draw: (camera: THREE.PerspectiveCamera) => void) {
		this.ensureResources();
		const destination = renderer.getRenderTarget(), previousCamera = this.camera.clone();
		try {
			this.camera.copy(camera);
			renderer.setRenderTarget(this.capture!);
			draw(this.camera);
		} finally {
			this.camera.copy(previousCamera);
			renderer.setRenderTarget(destination);
		}
	}
	/** Idle-only: retain one already blurred image, using the existing capture/Gaussian scratch. */
	prepareResolved(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
		rect: BlurRect, radius: number, target: THREE.RenderTarget,
		draw: (camera: THREE.PerspectiveCamera) => void) {
		this.ensureResources();
		this.ensureResolvedComposite(target.texture);
		const previousCamera = this.camera.clone(), direction = this.direction.value.clone();
		try {
			withRendererState(renderer, () => {
				this.captureSource(renderer, camera, rect, radius, draw);
				renderer.setRenderTarget(target);
				renderer.setClearColor(0, 0);
				clearFullTarget(renderer);
				// The Gaussian resolves at 256²; this full-size copy introduces no resampling.
				this.cacheResolveQuad!.render(renderer);
			});
		} finally { this.camera.copy(previousCamera); this.direction.value.copy(direction); }
	}
	/** No allocation or Gaussian update: only the retained image and its linear opacity. */
	drawResolved(renderer: THREE.WebGPURenderer, source: THREE.Texture, rect: BlurRect, opacity: number,
		preserveCanvasScissor = false, warmOutput?: CatalogWarmOutputContext) {
		if (!this.resolvedTexture || !this.resolvedCanvasQuad || !this.resolvedOffscreenQuad) return false;
		const destination = renderer.getRenderTarget();
		const viewport = destination ? destination.viewport.clone() : renderer.getViewport(new THREE.Vector4());
		const scissorTest = renderer.getScissorTest();
		this.resolvedTexture.value = source;
		this.resolvedOpacity.value = opacity;
		try {
			if (destination || !preserveCanvasScissor) renderer.setScissorTest(false);
			this.setOutputViewport(renderer, destination, viewport, rect);
			(destination && !warmOutput?.usesCanvasOwner(destination) ? this.resolvedOffscreenQuad : this.resolvedCanvasQuad).render(renderer);
		} finally {
			if (destination) destination.viewport.copy(viewport); else renderer.setViewport(viewport);
			renderer.setScissorTest(scissorTest);
		}
		return true;
	}

	render(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
		bounds: BlurRect, radius: number, draw: (camera: THREE.PerspectiveCamera) => void,
		clip: BlurRect = { left: 0, top: 0, width: innerWidth, height: innerHeight }, preserveCanvasScissor = false) {
		if (radius < 0.05) { draw(camera); return; }
		const rect = resolveDepthBlurRect(bounds, radius, clip);
		if (!rect) return;
		this.ensureResources();
		this.renderCapture(renderer, camera, rect.left, rect.top, rect.width, rect.height, radius, draw, preserveCanvasScissor);
	}
	private ensureResolvedComposite(source: THREE.Texture) {
		if (this.resolvedMaterial) return;
		const resolvedTexture = texture(source);
		this.resolvedTexture = resolvedTexture;
		this.resolvedMaterial = new THREE.NodeMaterial();
		this.resolvedMaterial.fragmentNode = resolvedTexture.mul(this.resolvedOpacity);
		this.resolvedMaterial.transparent = true;
		this.resolvedMaterial.blending = THREE.CustomBlending;
		this.resolvedMaterial.blendSrc = this.resolvedMaterial.blendSrcAlpha = THREE.OneFactor;
		this.resolvedMaterial.blendDst = this.resolvedMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
		this.resolvedMaterial.depthTest = this.resolvedMaterial.depthWrite = this.resolvedMaterial.toneMapped = false;
		// The cache's HalfFloat copy must not replace the live resolve owner's
		// Canvas/RGBA8 pipeline when a later pointer pose needs the live fallback.
		this.cacheResolveQuad = new THREE.QuadMesh(this.material!);
		// Retain both render-object owners, just as the live geometry fade does.
		this.resolvedCanvasQuad = new THREE.QuadMesh(this.resolvedMaterial);
		this.resolvedOffscreenQuad = new THREE.QuadMesh(this.resolvedMaterial);
	}
	private ensureResources() {
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
	}
	private renderCapture(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
		left: number, top: number, width: number, height: number, radius: number,
		draw: (camera: THREE.PerspectiveCamera) => void, preserveCanvasScissor: boolean) {
		const destination = renderer.getRenderTarget();
		const viewport = destination ? destination.viewport.clone() : renderer.getViewport(new THREE.Vector4());
		const clearColor = renderer.getClearColor(new THREE.Color());
		const clearAlpha = renderer.getClearAlpha();
		const scissorTest = renderer.getScissorTest();
		try {
			this.captureSource(renderer, camera, { left, top, width, height }, radius, draw);
			renderer.setRenderTarget(destination);
			// Idle warmup still uses the real Canvas format, but must not paint it.
			if (!destination && preserveCanvasScissor) renderer.setScissorTest(scissorTest);
			this.setOutputViewport(renderer, destination, viewport, { left, top, width, height });
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
	private captureSource(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
		rect: BlurRect, radius: number, draw: (camera: THREE.PerspectiveCamera) => void) {
		this.camera.copy(camera);
		this.camera.setViewOffset(innerWidth, innerHeight, rect.left, rect.top, rect.width, rect.height);
		// The half-resolution Gaussian uses a kernel standard deviation of 7/3 texels.
		this.direction.value.set(radius * 256 / rect.width / (7 / 3), radius * 256 / rect.height / (7 / 3));
		renderer.setRenderTarget(this.capture!);
		renderer.setScissorTest(false);
		renderer.setClearColor(0, 0);
		renderer.clear();
		draw(this.camera);
	}
	private setOutputViewport(renderer: THREE.WebGPURenderer, destination: THREE.RenderTarget | null,
		viewport: THREE.Vector4, rect: BlurRect) {
		const scaleX = viewport.z / innerWidth, scaleY = viewport.w / innerHeight;
		const output = new THREE.Vector4(viewport.x + rect.left * scaleX, viewport.y + rect.top * scaleY,
			rect.width * scaleX, rect.height * scaleY);
		if (destination) destination.viewport.copy(output); else renderer.setViewport(output);
	}
	dispose() {
		this.capture?.dispose();
		this.effect?.dispose();
		this.material?.dispose();
		this.resolvedMaterial?.dispose();
	}
}
