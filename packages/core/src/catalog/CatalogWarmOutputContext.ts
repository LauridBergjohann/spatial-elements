import * as THREE from 'three/webgpu';
import type { BackgroundOutputScratch } from '../stage/BackgroundLayerOutput.js';

let nextGeneration = 0;

/** Internal, opt-in warm output. Storage is either owned scratch or an exclusive output-owner lease. */
export class CatalogWarmOutputContext {
	readonly target: THREE.RenderTarget;
	readonly profileKey: string;
	private valid = true;
	private disposed = false;
	private borrowed = false;
	private readonly invalidate = () => { this.valid = false; };
	private readonly size = new THREE.Vector2();
	private readonly viewport = new THREE.Vector4();
	private readonly leaseGeneration?: number;

	private constructor(private readonly renderer: THREE.WebGPURenderer,
		private readonly canvas: THREE.CanvasTarget, private readonly width: number, private readonly height: number,
		private readonly cssWidth: number, private readonly cssHeight: number, private readonly pixelRatio: number,
		private readonly exposure: number, private readonly ownerCurrent: () => boolean,
		private readonly lease?: BackgroundOutputScratch) {
		this.target = lease?.target ?? new THREE.RenderTarget(width, height, {
			type: renderer.getOutputBufferType(), format: THREE.RGBAFormat, samples: renderer.samples,
			depthBuffer: renderer.depth, stencilBuffer: renderer.stencil,
			colorSpace: THREE.ColorManagement.workingColorSpace as THREE.ColorSpace, generateMipmaps: false,
			minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
		});
		this.leaseGeneration = lease?.generation;
		this.profileKey = `${lease ? `leased-canvas:${this.leaseGeneration}` : 'scratch-canvas'}:${++nextGeneration}:${width}:${height}:${pixelRatio}:${this.target.texture.type}:${this.target.samples}:${renderer.depth}:${renderer.stencil}:${THREE.ColorManagement.workingColorSpace}:${renderer.outputColorSpace}:${renderer.toneMapping}:${exposure}`;
		canvas.addEventListener('resize', this.invalidate);
		canvas.addEventListener('dispose', this.invalidate);
		this.target.addEventListener('dispose', this.invalidate);
	}

	/** Unknown output profiles retain the existing production warm path. No GPU work here. */
	static create(renderer: THREE.WebGPURenderer, isCurrent: () => boolean): CatalogWarmOutputContext | undefined {
		return this.fromProfile(renderer, isCurrent);
	}

	/** Share the output owner's one target; this context cannot publish, resize or dispose it. */
	static createBorrowed(renderer: THREE.WebGPURenderer, lease: BackgroundOutputScratch,
		isCurrent: () => boolean): CatalogWarmOutputContext | undefined {
		if (!lease.isCurrent()) return;
		return this.fromProfile(renderer, isCurrent, lease);
	}

	private static fromProfile(renderer: THREE.WebGPURenderer, isCurrent: () => boolean,
		lease?: BackgroundOutputScratch): CatalogWarmOutputContext | undefined {
		if (!this.supported(renderer) || !isCurrent()) return;
		const canvas = renderer.getCanvasTarget(), size = canvas.getDrawingBufferSize(new THREE.Vector2());
		const css = canvas.getSize(new THREE.Vector2()), viewport = canvas.getViewport(new THREE.Vector4());
		const ratio = canvas.getPixelRatio();
		if (![size.x, size.y, css.x, css.y, ratio].every(value => Number.isFinite(value) && value > 0) ||
			!Number.isInteger(size.x) || !Number.isInteger(size.y) ||
			size.x !== Math.floor(css.x * ratio) || size.y !== Math.floor(css.y * ratio) ||
			!viewport.equals(new THREE.Vector4(0, 0, css.x, css.y)) || canvas.getScissorTest()) return;
		const context = new CatalogWarmOutputContext(renderer, canvas, size.x, size.y, css.x, css.y,
			ratio, renderer.toneMappingExposure, isCurrent, lease);
		if (lease && !context.isCurrent(renderer)) { context.dispose(); return; }
		return context;
	}

	private static supported(renderer: THREE.WebGPURenderer) {
		return Boolean((renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend &&
			renderer.coordinateSystem === THREE.WebGPUCoordinateSystem && renderer.getOutputBufferType() === THREE.HalfFloatType &&
			renderer.samples === 4 && renderer.depth === true && renderer.stencil === false && !renderer.reversedDepthBuffer &&
			THREE.ColorManagement.workingColorSpace === THREE.LinearSRGBColorSpace && renderer.outputColorSpace === THREE.SRGBColorSpace &&
			renderer.toneMapping === THREE.ACESFilmicToneMapping && Number.isFinite(renderer.toneMappingExposure) && renderer.toneMappingExposure > 0 &&
			!renderer.xr.isPresenting && !renderer.getMRT() && !renderer.getOutputRenderTarget() && !renderer.getRenderObjectFunction());
	}

	isCurrent(renderer: THREE.WebGPURenderer) {
		if (!this.valid || this.disposed || renderer !== this.renderer || !this.ownerCurrent() || this.canvas.getScissorTest() ||
			(this.lease && (this.lease.target !== this.target || this.lease.generation !== this.leaseGeneration || !this.lease.isCurrent())) ||
			!CatalogWarmOutputContext.supported(renderer) || renderer.toneMappingExposure !== this.exposure) return false;
		this.canvas.getDrawingBufferSize(this.size);
		if (this.size.x !== this.width || this.size.y !== this.height || this.canvas.getPixelRatio() !== this.pixelRatio) return false;
		renderer.getDrawingBufferSize(this.size);
		if (this.size.x !== this.width || this.size.y !== this.height || renderer.getPixelRatio() !== this.pixelRatio) return false;
		this.canvas.getSize(this.size);
		if (this.size.x !== this.cssWidth || this.size.y !== this.cssHeight) return false;
		this.canvas.getViewport(this.viewport);
		return this.viewport.x === 0 && this.viewport.y === 0 && this.viewport.z === this.cssWidth && this.viewport.w === this.cssHeight &&
			this.target.width === this.width && this.target.height === this.height && this.target.samples === 4 &&
			this.target.depthBuffer && !this.target.stencilBuffer && this.target.textures.length === 1 &&
			this.target.texture.type === THREE.HalfFloatType && this.target.texture.format === THREE.RGBAFormat &&
			this.target.texture.colorSpace === THREE.LinearSRGBColorSpace && !this.target.texture.generateMipmaps &&
			this.target.texture.minFilter === THREE.LinearFilter && this.target.texture.magFilter === THREE.LinearFilter &&
			!this.target.depthTexture && this.target.depth === 1 && !this.target.multiview && !this.target.useArrayDepthTexture &&
			this.target.resolveColorBuffer && this.target.resolveDepthBuffer && this.target.resolveStencilBuffer &&
			this.target.storeMultisampledColorBuffer && this.target.storeMultisampledDepthBuffer && this.target.storeMultisampledStencilBuffer;
	}

	/** Select Canvas-semantic owners only at this scratch boundary, never inside nested captures. */
	usesCanvasOwner(destination: THREE.RenderTarget | null) { return this.borrowed && destination === this.target; }

	/** Synchronous only; renderer state is restored by the surrounding catalog scope. */
	borrow(renderer: THREE.WebGPURenderer, draw: () => void) {
		if (this.borrowed || !this.isCurrent(renderer) || renderer.getRenderTarget() === this.target)
			throw new Error('Catalog warm output is stale or already in use');
		if (this.lease) {
			let entered = false;
			const accepted = this.lease.borrow(() => {
				// A handle from another renderer must fail before any catalog submission.
				if (renderer.getRenderTarget() !== this.target) throw new Error('Catalog warm output lease bound another renderer');
				entered = true;
				return this.borrowTarget(draw);
			});
			if (!accepted || !entered) {
				this.valid = false;
				throw new Error('Catalog warm output lease became stale');
			}
			return;
		}
		this.borrowTarget(draw);
	}

	private borrowTarget(draw: () => void) {
		const viewport = this.target.viewport.clone(), scissor = this.target.scissor.clone(), test = this.target.scissorTest;
		this.borrowed = true;
		try {
			this.target.viewport.set(0, 0, this.width, this.height);
			this.target.scissor.set(0, 0, 0, 0); this.target.scissorTest = true;
			return draw();
		} finally {
			this.target.viewport.copy(viewport); this.target.scissor.copy(scissor); this.target.scissorTest = test;
			this.borrowed = false;
		}
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true; this.valid = false;
		this.canvas.removeEventListener('resize', this.invalidate); this.canvas.removeEventListener('dispose', this.invalidate);
		this.target.removeEventListener('dispose', this.invalidate);
		if (!this.lease) this.target.dispose();
	}
}
