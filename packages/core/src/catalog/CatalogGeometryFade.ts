import * as THREE from 'three/webgpu';
import { texture, uniform } from 'three/tsl';
import { getRefinementSize } from '../stage/SpatialElementRefinement.js';
import type { CatalogWarmOutputContext } from './CatalogWarmOutputContext.js';

interface FrozenCapture {
	source: object;
	renderer: THREE.WebGPURenderer;
	destination: THREE.RenderTarget | null;
	canvas?: THREE.CanvasTarget;
	width: number;
	height: number;
	captureWidth: number;
	captureHeight: number;
	coordinateSystem: THREE.WebGPURenderer['coordinateSystem'];
	toneMapping: THREE.WebGPURenderer['toneMapping'];
	exposure: number;
	colorSpace: THREE.WebGPURenderer['outputColorSpace'];
}

/** Fade the resolved image, never the individual opaque surfaces of a element. */
export class CatalogGeometryFade {
	getRenderTargets() {
		return this.capture ? [this.capture] : [];
	}
	private capture?: THREE.RenderTarget;
	private material?: THREE.NodeMaterial;
	private quad?: THREE.QuadMesh;
	private offscreenQuad?: THREE.QuadMesh;
	private readonly alpha = uniform(1);
	private frozenCapture?: FrozenCapture;

	/** A source token belongs to one frozen source generation and output band only. */
	render(renderer: THREE.WebGPURenderer, opacity: number, draw: () => void,
		warmOutput?: CatalogWarmOutputContext, frozenSource?: object) {
		if (!frozenSource || warmOutput || opacity >= 1 || opacity <= 0) this.frozenCapture = undefined;
		if (opacity >= 1) {
			draw();
			return;
		}
		if (opacity <= 0) return;
		const destination = renderer.getRenderTarget();
		const size = destination ?? renderer.getDrawingBufferSize(new THREE.Vector2());
		// Use the same budget as the preparation target. Otherwise the first moving
		// frame reallocates a full-resolution MSAA capture after the bounded warm-up.
		const { width, height } = getRefinementSize(size.width, size.height);
		if (!this.capture) {
			this.capture = new THREE.RenderTarget(width, height, {
				type: THREE.HalfFloatType,
				samples: 4
			});
			this.capture.addEventListener('dispose', () => { this.frozenCapture = undefined; });
			this.material = new THREE.NodeMaterial();
			this.material.fragmentNode = texture(this.capture.texture).mul(this.alpha);
			this.material.transparent = true;
			this.material.premultipliedAlpha = true;
			this.material.depthTest = false;
			this.material.depthWrite = false;
			this.material.toneMapped = false;
			this.quad = new THREE.QuadMesh(this.material);
			// Canvas output and High preparation can share a render-context format
			// while using different color spaces. Keep both render-object owners alive:
			// otherwise preparing High evicts the already warmed Canvas pipeline.
			this.offscreenQuad = new THREE.QuadMesh(this.material);
		}
		this.capture.setSize(width, height);
		const next: FrozenCapture | undefined = frozenSource && !warmOutput ? {
			source: frozenSource, renderer, destination,
			canvas: destination ? undefined : renderer.getCanvasTarget(),
			width: size.width, height: size.height, captureWidth: width, captureHeight: height,
			coordinateSystem: renderer.coordinateSystem, toneMapping: renderer.toneMapping,
			exposure: renderer.toneMappingExposure, colorSpace: renderer.outputColorSpace
		} : undefined;
		const previous = this.frozenCapture;
		const reuse = next && previous && next.source === previous.source && next.renderer === previous.renderer &&
			next.destination === previous.destination && next.canvas === previous.canvas &&
			next.width === previous.width && next.height === previous.height &&
			next.captureWidth === previous.captureWidth && next.captureHeight === previous.captureHeight &&
			next.coordinateSystem === previous.coordinateSystem && next.toneMapping === previous.toneMapping &&
			next.exposure === previous.exposure && next.colorSpace === previous.colorSpace;
		const color = renderer.getClearColor(new THREE.Color());
		const clearAlpha = renderer.getClearAlpha();
		const scissor = renderer.getScissor(new THREE.Vector4());
		const scissorTest = renderer.getScissorTest();
		try {
			// One shared scratch target: another band, ordinary draw or warmup replaces
			// these pixels. The first fractional frame always performs the full capture.
			this.frozenCapture = undefined;
			if (!reuse) {
				renderer.setRenderTarget(this.capture);
				renderer.setScissorTest(false);
				renderer.setClearColor(0x000000, 0);
				renderer.clear();
				draw();
			}
			renderer.setRenderTarget(destination);
			renderer.setScissor(scissor);
			renderer.setScissorTest(scissorTest);
			this.alpha.value = opacity;
			(destination && !warmOutput?.usesCanvasOwner(destination) ? this.offscreenQuad : this.quad)!.render(renderer);
		} finally {
			renderer.setRenderTarget(destination);
			renderer.setClearColor(color, clearAlpha);
			renderer.setScissor(scissor);
			renderer.setScissorTest(scissorTest);
		}
		this.frozenCapture = next;
	}
	dispose() {
		this.frozenCapture = undefined;
		this.capture?.dispose();
		this.material?.dispose();
		this.capture = undefined;
		this.material = undefined;
		this.quad = undefined;
		this.offscreenQuad = undefined;
	}
}
