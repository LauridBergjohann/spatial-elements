import { gaussianTargets } from './renderTargetInventory.js';
import * as THREE from 'three/webgpu';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { texture, uniform } from 'three/tsl';

const BLUR_KERNEL_SIGMA = 6;
const BLUR_KERNEL_STANDARD_DEVIATION = (3 + 2 * BLUR_KERNEL_SIGMA) / 3;
const TARGET_RESIDUAL_SIGMA = 5;
const MAX_DOWNSAMPLE_STEPS = 5;

interface DownsamplePass {
	target: THREE.RenderTarget;
	material: THREE.NodeMaterial;
	quad: THREE.QuadMesh;
}

/**
 * CSS-pixel Gaussian blur for transparent, display-space captures.
 *
 * A staged 2x pyramid removes high frequencies before reducing resolution. The
 * final Gaussian therefore uses dense samples instead of skipping across the
 * source image, while premultiplied color prevents dark or glowing silhouettes.
 */
export class MinimapBlurPipeline {
	getRenderTargets() {
		return [
			this.outputTarget,
			...this.downsamplePasses.map((pass) => pass.target),
			...gaussianTargets(this.blurNode)
		];
	}
	readonly outputTarget: THREE.RenderTarget;

	private readonly downsamplePasses: DownsamplePass[] = [];
	private readonly blurDirection = uniform(new THREE.Vector2());
	private readonly blurNode: ReturnType<typeof gaussianBlur>;
	private readonly resolveMaterial: THREE.NodeMaterial;
	private readonly resolveQuad: THREE.QuadMesh;
	private readonly downsampleSteps: number;
	private readonly blurRadius: number;

	constructor(
		inputTexture: THREE.Texture,
		blurRadius: number,
		maximumSourcePixelsPerCssPixel: number
	) {
		this.blurRadius = Math.max(blurRadius, 0);
		this.downsampleSteps = getMinimapBlurDownsampleSteps(
			this.blurRadius,
			maximumSourcePixelsPerCssPixel
		);

		let passTexture = inputTexture;
		for (let index = 0; index < this.downsampleSteps; index += 1) {
			const target = createRenderTarget(THREE.HalfFloatType);
			const sample = texture(passTexture);
			// StageExperience's renderOutput() pass already stores premultiplied
			// display-space RGB. Multiplying by alpha again here makes wider blur
			// radii lose energy and appear darker instead of softer.
			const material = createFullscreenMaterial(sample);
			const quad = new THREE.QuadMesh(material);
			this.downsamplePasses.push({ target, material, quad });
			passTexture = target.texture;
		}

		const blurInput = texture(passTexture);
		this.blurNode = gaussianBlur(blurInput, this.blurDirection, BLUR_KERNEL_SIGMA, {
			// The capture and every pyramid level stay premultiplied until the
			// final resolve below.
			premultipliedAlpha: false,
			resolutionScale: 1
		});

		// Keep the final texture premultiplied as well. Unpremultiplying here and
		// sampling the result again in the minimap compositor made filtering alter
		// silhouette coverage, so a rotated model could appear smaller or clipped.
		this.resolveMaterial = createFullscreenMaterial(this.blurNode);
		this.resolveQuad = new THREE.QuadMesh(this.resolveMaterial);
		this.outputTarget = createRenderTarget(THREE.HalfFloatType);
	}

	setSize(width: number, height: number) {
		const resolvedWidth = Math.max(Math.round(width), 1);
		const resolvedHeight = Math.max(Math.round(height), 1);
		this.outputTarget.setSize(resolvedWidth, resolvedHeight);

		let levelWidth = resolvedWidth;
		let levelHeight = resolvedHeight;
		this.downsamplePasses.forEach((pass) => {
			levelWidth = Math.max(Math.round(levelWidth * 0.5), 1);
			levelHeight = Math.max(Math.round(levelHeight * 0.5), 1);
			pass.target.setSize(levelWidth, levelHeight);
		});
	}

	render(
		renderer: THREE.WebGPURenderer,
		sourcePixelsPerCssPixelX: number,
		sourcePixelsPerCssPixelY: number
	) {
		this.updateDirection(sourcePixelsPerCssPixelX, sourcePixelsPerCssPixelY);

		this.downsamplePasses.forEach((pass) => {
			renderer.setRenderTarget(pass.target);
			renderer.clear();
			pass.quad.render(renderer);
		});

		renderer.setRenderTarget(this.outputTarget);
		renderer.clear();
		this.resolveQuad.render(renderer);
	}

	dispose() {
		this.downsamplePasses.forEach((pass) => {
			pass.target.dispose();
			pass.material.dispose();
		});
		this.blurNode.dispose();
		this.resolveMaterial.dispose();
		this.outputTarget.dispose();
	}

	private updateDirection(sourcePixelsPerCssPixelX: number, sourcePixelsPerCssPixelY: number) {
		this.blurDirection.value.copy(
			getMinimapBlurDirection(
				this.blurRadius,
				sourcePixelsPerCssPixelX,
				sourcePixelsPerCssPixelY,
				this.downsampleSteps
			)
		);
	}
}

/** Selects a bounded blur pyramid depth for a CSS-pixel blur radius. */
export function getMinimapBlurDownsampleSteps(
	blurRadius: number,
	maximumSourcePixelsPerCssPixel: number
) {
	const radius = Number.isFinite(blurRadius) ? Math.max(blurRadius, 0) : 0;
	if (radius <= 0.001) return 0;

	const sourceDensity = Number.isFinite(maximumSourcePixelsPerCssPixel)
		? Math.max(maximumSourcePixelsPerCssPixel, 1)
		: 1;
	const sourceSigma = radius * sourceDensity;
	return THREE.MathUtils.clamp(
		Math.max(Math.ceil(Math.log2(sourceSigma / TARGET_RESIDUAL_SIGMA)), 1),
		1,
		MAX_DOWNSAMPLE_STEPS
	);
}

/**
 * Converts a CSS-pixel blur radius into the Gaussian node's per-axis sample radius.
 *
 * The result compensates for both source pixel density and the selected blur
 * pyramid level.
 */
export function getMinimapBlurDirection(
	blurRadius: number,
	sourcePixelsPerCssPixelX: number,
	sourcePixelsPerCssPixelY: number,
	downsampleSteps: number
) {
	const pyramidScale = 2 ** Math.max(Math.floor(downsampleSteps), 0);
	const radius = Number.isFinite(blurRadius) ? Math.max(blurRadius, 0) : 0;
	const densityX = Number.isFinite(sourcePixelsPerCssPixelX)
		? Math.max(sourcePixelsPerCssPixelX, 0)
		: 0;
	const densityY = Number.isFinite(sourcePixelsPerCssPixelY)
		? Math.max(sourcePixelsPerCssPixelY, 0)
		: 0;
	return new THREE.Vector2(
		(radius * densityX) / pyramidScale / BLUR_KERNEL_STANDARD_DEVIATION,
		(radius * densityY) / pyramidScale / BLUR_KERNEL_STANDARD_DEVIATION
	);
}

function createRenderTarget(type: THREE.TextureDataType) {
	const target = new THREE.RenderTarget(1, 1, {
		depthBuffer: false,
		stencilBuffer: false,
		type
	});
	target.texture.minFilter = THREE.LinearFilter;
	target.texture.magFilter = THREE.LinearFilter;
	target.texture.generateMipmaps = false;
	target.texture.colorSpace = THREE.NoColorSpace;
	return target;
}

function createFullscreenMaterial(fragmentNode: THREE.Node) {
	const material = new THREE.NodeMaterial();
	material.fragmentNode = fragmentNode;
	material.depthTest = false;
	material.depthWrite = false;
	material.blending = THREE.NoBlending;
	material.toneMapped = false;
	material.needsUpdate = true;
	return material;
}
