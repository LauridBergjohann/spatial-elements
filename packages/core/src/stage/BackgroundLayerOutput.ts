import * as THREE from 'three/webgpu';
import { screenUV, texture } from 'three/tsl';

export interface BackgroundOutputScratch {
	/** Borrowed storage. Only BackgroundLayerOutput may resize or dispose it. */
	readonly target: THREE.RenderTarget;
	readonly generation: number;
	isCurrent(): boolean;
	/** Synchronous submission only. No Canvas publication or asynchronous callback. */
	borrow(draw: () => void): boolean;
}

type Mode = 'explicit' | 'fallback' | 'disposed';

/** Public getViewport(target) copies into its argument. Preserve its depth range too. */
class OutputViewport extends THREE.Vector4 {
	minDepth = 0;
	maxDepth = 1;
	override copy(source: THREE.Vector4): this {
		super.copy(source);
		const depth = source as THREE.Vector4 & { minDepth?: number; maxDepth?: number };
		this.minDepth = depth.minDepth ?? 0; this.maxDepth = depth.maxDepth ?? 1;
		return this;
	}
}

/** Internal output owner; callers must select it before the first Background Canvas draw.
 * Scene/blur inputs and the Canvas are borrowed, never owned. No Stage integration yet.
 */
export class BackgroundLayerOutput {
	private mode: Mode = 'explicit';
	private generation = 0;
	private contentsValid = false;
	private busy = false;
	private resizing = false;
	private publications = 0;
	private borrows = 0;
	private readonly target: THREE.RenderTarget;
	private readonly outputTexture: THREE.Texture;
	private readonly output: THREE.RenderPipeline;
	private readonly size = new THREE.Vector2();
	private readonly css = new THREE.Vector2();
	private readonly viewport = new OutputViewport();
	private readonly exposure: number;
	private readonly onResize = () => { this.generation++; this.contentsValid = false; };
	private readonly onCanvasDispose = () => { this.dispose(); };
	private readonly onTargetDispose = () => { if (!this.resizing) this.release('fallback', false); };

	private constructor(private readonly renderer: THREE.WebGPURenderer,
		private readonly canvas: THREE.CanvasTarget, width: number, height: number) {
		this.exposure = renderer.toneMappingExposure;
		this.target = new THREE.RenderTarget(width, height, {
			type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples: 4,
			depthBuffer: true, stencilBuffer: false, colorSpace: THREE.LinearSRGBColorSpace,
			minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false
		});
		this.outputTexture = this.target.texture;
		this.output = new THREE.RenderPipeline(renderer, texture(this.outputTexture, screenUV));
		canvas.addEventListener('resize', this.onResize);
		canvas.addEventListener('dispose', this.onCanvasDispose);
		this.target.addEventListener('dispose', this.onTargetDispose);
	}

	/** No draw, clear, compile or access to Three's private framebuffer cache. */
	static create(renderer: THREE.WebGPURenderer, canvas: THREE.CanvasTarget): BackgroundLayerOutput | undefined {
		const size = new THREE.Vector2();
		if (!supported(renderer, canvas, size, new THREE.Vector2(), new OutputViewport())) return;
		return new BackgroundLayerOutput(renderer, canvas, size.x, size.y);
	}

	/** The display is the existing opaque, depth-independent fullscreen QuadMesh. */
	compose(display: Pick<THREE.QuadMesh, 'render'>, panels: () => void, publish = true): boolean {
		return this.rebuild(() => {
			const renderer = this.renderer;
			renderer.setClearColor(0xffffff, 1);
			renderer.autoClear = renderer.autoClearColor = renderer.autoClearDepth = renderer.autoClearStencil = true;
			assertSynchronous(display.render(renderer));
			this.assertDestination();
			renderer.autoClear = false;
			assertSynchronous(panels());
			this.assertDestination();
		}, publish);
	}

	clearTransparent(publish = true): boolean {
		return this.rebuild(() => {
			this.renderer.setClearColor(0, 0);
			this.renderer.clear(true, true, true);
		}, publish);
	}

	/** Only a fully rebuilt target may be published. Never used for hidden warming. */
	publish(): boolean {
		this.assertIdle();
		if (!this.usable() || !this.contentsValid) return false;
		this.busy = true;
		try { this.withState(() => this.publishCurrent()); return true; }
		catch (error) { this.contentsValid = false; throw error; }
		finally { this.busy = false; }
	}

	/** The handle is an owner/generation capability, not a copy or a second target. */
	captureScratch(): BackgroundOutputScratch | undefined {
		this.assertIdle();
		if (!this.usable()) return;
		const generation = this.generation;
		return {
			target: this.target, generation,
			isCurrent: () => this.current(generation),
			borrow: draw => this.borrow(generation, draw)
		};
	}

	/** Resize only to the actual Canvas. Holding an outgoing Canvas is the caller's job. */
	resize(): boolean {
		this.assertIdle();
		if (!this.profileCurrent()) return false;
		if (this.target.width === this.size.x && this.target.height === this.size.y) return true;
		this.generation++; this.contentsValid = false; this.resizing = true;
		try { this.target.setSize(this.size.x, this.size.y); }
		finally { this.resizing = false; }
		return true;
	}

	/** Terminal for this owner. The Stage must not later recreate an explicit owner. */
	selectFallback() { this.release('fallback'); }
	dispose() { this.release('disposed'); }
	getRenderTargets(): readonly THREE.RenderTarget[] { return this.mode === 'explicit' ? [this.target] : []; }
	getStats() {
		return { mode: this.mode, generation: this.generation, contentsValid: this.contentsValid,
			busy: this.busy, publications: this.publications, borrows: this.borrows,
			width: this.target.width, height: this.target.height, samples: this.target.samples };
	}

	private rebuild(draw: () => void, publish: boolean) {
		this.assertIdle();
		if (!this.usable()) return false;
		const generation = this.generation;
		this.contentsValid = false; this.busy = true;
		try {
			this.withState(() => {
				this.bindTarget();
				draw();
				if (!this.current(generation)) throw new Error('Background output changed during composition');
				this.contentsValid = true;
				if (publish) this.publishCurrent();
			});
			return true;
		} catch (error) { this.contentsValid = false; throw error; }
		finally { this.busy = false; }
	}

	private borrow(generation: number, draw: () => void) {
		this.assertIdle();
		if (!this.current(generation)) return false;
		this.contentsValid = false; this.busy = true; this.borrows++;
		try {
			this.withState(() => { this.bindTarget(); assertSynchronous(draw()); });
			return this.current(generation);
		} finally { this.busy = false; }
	}

	private bindTarget() {
		const renderer = this.renderer;
		renderer.setCanvasTarget(this.canvas);
		renderer.setRenderTarget(this.target);
		Object.assign(this.target.viewport.set(0, 0, this.target.width, this.target.height), { minDepth: 0, maxDepth: 1 });
		this.target.scissorTest = false;
		renderer.setScissorTest(false);
		renderer.setClearDepth(1); renderer.setClearStencil(0);
		renderer.autoClear = false;
	}

	private publishCurrent() {
		const renderer = this.renderer;
		renderer.setCanvasTarget(this.canvas); renderer.setRenderTarget(null);
		renderer.setScissorTest(false); renderer.autoClear = false;
		// Same public output-transform path as the independently validated pixel proof.
		this.output.render();
		this.publications++;
	}

	private assertDestination() {
		if (this.renderer.getCanvasTarget() !== this.canvas || this.renderer.getRenderTarget() !== this.target ||
			this.renderer.getOutputRenderTarget() !== null)
			throw new Error('Background composition changed its output destination');
	}
	private assertIdle() { if (this.busy) throw new Error('Background output is already in use; publication during a lease is forbidden'); }
	private current(generation: number) {
		return this.mode === 'explicit' && generation === this.generation && this.profileMatches() &&
			this.target.width === this.size.x && this.target.height === this.size.y;
	}
	private usable() {
		return this.profileCurrent() && this.target.width === this.size.x && this.target.height === this.size.y;
	}
	private profileCurrent() {
		if (this.mode !== 'explicit') return false;
		if (!this.profileMatches()) { this.selectFallback(); return false; }
		return true;
	}
	private profileMatches() {
		const target = this.target;
		return supported(this.renderer, this.canvas, this.size, this.css, this.viewport) &&
			this.renderer.toneMappingExposure === this.exposure && target.samples === 4 &&
			target.depthBuffer && !target.stencilBuffer && !target.depthTexture && target.depth === 1 &&
			!target.multiview && !target.useArrayDepthTexture && target.textures.length === 1 &&
			target.texture === this.outputTexture && target.texture.type === THREE.HalfFloatType && target.texture.format === THREE.RGBAFormat &&
			target.texture.colorSpace === THREE.LinearSRGBColorSpace && !target.texture.generateMipmaps &&
			target.texture.minFilter === THREE.LinearFilter && target.texture.magFilter === THREE.LinearFilter &&
			target.resolveColorBuffer && target.resolveDepthBuffer && target.resolveStencilBuffer &&
			target.storeMultisampledColorBuffer && target.storeMultisampledDepthBuffer && target.storeMultisampledStencilBuffer;
	}

	private release(mode: 'fallback' | 'disposed', disposeTarget = true) {
		if (this.mode !== 'explicit') { if (mode === 'disposed') this.mode = mode; return; }
		this.mode = mode; this.generation++; this.contentsValid = false;
		this.canvas.removeEventListener('resize', this.onResize);
		this.canvas.removeEventListener('dispose', this.onCanvasDispose);
		this.target.removeEventListener('dispose', this.onTargetDispose);
		try { this.output.dispose(); }
		finally { if (disposeTarget) this.target.dispose(); }
	}

	/** No await may escape this scope, including a failing public RenderPipeline.render(). */
	private withState(draw: () => void) {
		const r = this.renderer, canvas = r.getCanvasTarget(), target = r.getRenderTarget(), output = r.getOutputRenderTarget();
		const face = r.getActiveCubeFace(), level = r.getActiveMipmapLevel();
		const viewport = new OutputViewport(); r.getViewport(viewport);
		const scissor = r.getScissor(new THREE.Vector4()), test = r.getScissorTest();
		const ownViewport = new OutputViewport(); this.canvas.getViewport(ownViewport);
		const generation = this.generation;
		const ownScissor = this.canvas.getScissor(new THREE.Vector4()), ownTest = this.canvas.getScissorTest();
		const targetViewport = new OutputViewport().copy(this.target.viewport), targetScissor = this.target.scissor.clone(), targetTest = this.target.scissorTest;
		const color = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha(), depth = r.getClearDepth(), stencil = r.getClearStencil();
		const auto = r.autoClear, colorClear = r.autoClearColor, depthClear = r.autoClearDepth, stencilClear = r.autoClearStencil;
		const tone = r.toneMapping, exposure = r.toneMappingExposure, space = r.outputColorSpace, xr = r.xr.enabled;
		const mrt = r.getMRT(), renderObject = r.getRenderObjectFunction();
		try { draw(); }
		finally {
			r.toneMapping = tone; r.toneMappingExposure = exposure; r.outputColorSpace = space; r.xr.enabled = xr;
			r.autoClear = auto; r.autoClearColor = colorClear; r.autoClearDepth = depthClear; r.autoClearStencil = stencilClear;
			Object.assign(this.target.viewport.copy(targetViewport), { minDepth: targetViewport.minDepth, maxDepth: targetViewport.maxDepth });
			this.target.scissor.copy(targetScissor); this.target.scissorTest = targetTest;
			// A real resize/disposal during a callback invalidates the transaction. Do
			// not overwrite the resized Canvas viewport with the obsolete dimensions.
			if (generation === this.generation) {
				this.canvas.setViewport(ownViewport.x, ownViewport.y, ownViewport.z, ownViewport.w, ownViewport.minDepth, ownViewport.maxDepth);
				this.canvas.setScissor(ownScissor); this.canvas.setScissorTest(ownTest);
			}
			r.setCanvasTarget(canvas); r.setRenderTarget(target, face, level); r.setOutputRenderTarget(output);
			r.setMRT(mrt); r.setRenderObjectFunction(renderObject);
			if (canvas !== this.canvas || generation === this.generation) {
				r.setViewport(viewport.x, viewport.y, viewport.z, viewport.w, viewport.minDepth, viewport.maxDepth);
				r.setScissor(scissor); r.setScissorTest(test);
			} else r.setScissorTest(canvas.getScissorTest());
			r.setClearColor(color, alpha); r.setClearDepth(depth); r.setClearStencil(stencil);
		}
	}
}

function assertSynchronous(result: unknown) {
	if (result && (typeof result === 'object' || typeof result === 'function') && 'then' in result)
		throw new TypeError('Background output callbacks must be synchronous');
}

function supported(r: THREE.WebGPURenderer, canvas: THREE.CanvasTarget,
	size: THREE.Vector2, css: THREE.Vector2, viewport: OutputViewport) {
	if (!(r.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ||
		r.coordinateSystem !== THREE.WebGPUCoordinateSystem || r.getOutputBufferType() !== THREE.HalfFloatType ||
		r.samples !== 4 || !r.depth || r.stencil || r.reversedDepthBuffer || r.xr.isPresenting ||
		r.getMRT() || r.getOutputRenderTarget() || r.getRenderObjectFunction() ||
		r.getClearDepth() !== 1 || r.getClearStencil() !== 0 || canvas.getScissorTest() ||
		THREE.ColorManagement.workingColorSpace !== THREE.LinearSRGBColorSpace || r.outputColorSpace !== THREE.SRGBColorSpace ||
		r.toneMapping !== THREE.ACESFilmicToneMapping || !Number.isFinite(r.toneMappingExposure) || r.toneMappingExposure <= 0) return false;
	canvas.getDrawingBufferSize(size); canvas.getSize(css); canvas.getViewport(viewport);
	const ratio = canvas.getPixelRatio();
	return [size.x, size.y, css.x, css.y, ratio].every(value => Number.isFinite(value) && value > 0) &&
		size.x === Math.floor(css.x * ratio) && size.y === Math.floor(css.y * ratio) &&
		viewport.x === 0 && viewport.y === 0 && viewport.z === css.x && viewport.w === css.y &&
		viewport.minDepth === 0 && viewport.maxDepth === 1;
}
