import * as THREE from 'three/webgpu';

let nextGeneration = 0;

/** Internal, opt-in scratch output. It owns its target; never borrow a published layer. */
export class CatalogWarmOutputContext {
	readonly target: THREE.RenderTarget;
	readonly profileKey: string;
	private valid = true;
	private disposed = false;
	private borrowed = false;
	private readonly invalidate = () => { this.valid = false; };
	private readonly size = new THREE.Vector2();
	private readonly viewport = new THREE.Vector4();

	private constructor(private readonly renderer: THREE.WebGPURenderer,
		private readonly canvas: THREE.CanvasTarget, private readonly width: number, private readonly height: number,
		private readonly cssWidth: number, private readonly cssHeight: number, private readonly pixelRatio: number,
		private readonly exposure: number, private readonly ownerCurrent: () => boolean) {
		this.target = new THREE.RenderTarget(width, height, {
			type: renderer.getOutputBufferType(), format: THREE.RGBAFormat, samples: renderer.samples,
			depthBuffer: renderer.depth, stencilBuffer: renderer.stencil,
			colorSpace: THREE.ColorManagement.workingColorSpace as THREE.ColorSpace, generateMipmaps: false,
			minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
		});
		this.profileKey = `scratch-canvas:${++nextGeneration}:${width}:${height}:${pixelRatio}:${this.target.texture.type}:${this.target.samples}:${renderer.depth}:${renderer.stencil}:${THREE.ColorManagement.workingColorSpace}:${renderer.outputColorSpace}:${renderer.toneMapping}:${exposure}`;
		canvas.addEventListener('resize', this.invalidate);
		canvas.addEventListener('dispose', this.invalidate);
		this.target.addEventListener('dispose', this.invalidate);
	}

	/** Unknown output profiles retain the existing production warm path. No GPU work here. */
	static create(renderer: THREE.WebGPURenderer, isCurrent: () => boolean): CatalogWarmOutputContext | undefined {
		if (!this.supported(renderer) || !isCurrent()) return;
		const canvas = renderer.getCanvasTarget(), size = canvas.getDrawingBufferSize(new THREE.Vector2());
		const css = canvas.getSize(new THREE.Vector2()), viewport = canvas.getViewport(new THREE.Vector4());
		const ratio = canvas.getPixelRatio();
		if (![size.x, size.y, css.x, css.y, ratio].every(value => Number.isFinite(value) && value > 0) ||
			!Number.isInteger(size.x) || !Number.isInteger(size.y) ||
			size.x !== Math.floor(css.x * ratio) || size.y !== Math.floor(css.y * ratio) ||
			!viewport.equals(new THREE.Vector4(0, 0, css.x, css.y)) || canvas.getScissorTest()) return;
		return new CatalogWarmOutputContext(renderer, canvas, size.x, size.y, css.x, css.y,
			ratio, renderer.toneMappingExposure, isCurrent);
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
		const viewport = this.target.viewport.clone(), scissor = this.target.scissor.clone(), test = this.target.scissorTest;
		this.borrowed = true;
		try {
			this.target.viewport.set(0, 0, this.width, this.height);
			this.target.scissor.set(0, 0, 0, 0); this.target.scissorTest = true;
			draw();
		} finally {
			this.target.viewport.copy(viewport); this.target.scissor.copy(scissor); this.target.scissorTest = test;
			this.borrowed = false;
		}
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true; this.valid = false;
		this.canvas.removeEventListener('resize', this.invalidate); this.canvas.removeEventListener('dispose', this.invalidate);
		this.target.removeEventListener('dispose', this.invalidate); this.target.dispose();
	}
}
