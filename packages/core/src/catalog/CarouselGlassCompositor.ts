import { gaussianTargets } from '../stage/renderTargetInventory.js';
import * as THREE from 'three/webgpu';
import { texture } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { LiquidGlassPanel } from '../stage/LiquidGlassPanel.js';
import type { CatalogDepthBlur } from './CatalogDepthBlur.js';

/** Reuses the stage device/output and glass shader; never samples its own glass output. */
export class CarouselGlassCompositor {
	constructor(private readonly depthBlur: CatalogDepthBlur) {}
	getRenderTargets() {
		return [
			...(this.capture ? [this.capture] : []),
			...[...this.blurs.values()].flatMap((blur) => [blur.target, ...gaussianTargets(blur.effect)])
		];
	}
	private scene = new THREE.Scene();
	private capture?: THREE.RenderTarget;
	private compositeMaterial?: THREE.NodeMaterial;
	private composite?: THREE.QuadMesh;
	private blurs = new Map<
		number,
		{
			target: THREE.RenderTarget;
			material: THREE.NodeMaterial;
			quad: THREE.QuadMesh;
			effect: ReturnType<typeof gaussianBlur>;
		}
	>();
	private panels = new Map<
		HTMLElement,
		{ glass: LiquidGlassPanel; blur: number; focusBlur: number; width: number; height: number; active: boolean; seen: boolean }
	>();
	private size = new THREE.Vector2();
	private passes = 0;
	private resizes = 0;

	getStats() {
		return {
			panels: this.panels.size,
			targets: (this.capture ? 1 : 0) + this.blurs.size,
			passes: this.passes,
			resizes: this.resizes
		};
	}

	beginFrame() {
		for (const entry of this.panels.values()) {
			entry.active = false;
			entry.seen = false;
			entry.glass.group.visible = false;
		}
	}

	panel(card: HTMLElement, matrix: THREE.Matrix4, width: number, height: number, opacity: number, focusBlur = 0) {
		if (card.dataset.carouselSurface !== 'glass') return;
		if (!this.capture) {
			this.capture = new THREE.RenderTarget(1, 1);
			this.compositeMaterial = new THREE.NodeMaterial();
			this.compositeMaterial.fragmentNode = texture(this.capture.texture);
			this.compositeMaterial.transparent = true;
			this.compositeMaterial.blending = THREE.CustomBlending;
			this.compositeMaterial.blendSrc = this.compositeMaterial.blendSrcAlpha = THREE.OneFactor;
			this.compositeMaterial.blendDst = this.compositeMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
			this.compositeMaterial.depthTest = false;
			this.compositeMaterial.depthWrite = false;
			this.compositeMaterial.toneMapped = false;
			this.composite = new THREE.QuadMesh(this.compositeMaterial);
		}
		let entry = this.panels.get(card);
		if (!entry) {
			const options = JSON.parse(card.dataset.carouselTheme ?? '{}');
			const blur = Math.min(100, Math.max(0, options.backdropBlur ?? 5));
			if (!this.blurs.has(blur)) {
				const target = new THREE.RenderTarget(1, 1, { depthBuffer: false });
				const sample = texture(this.capture.texture);
				const effect = gaussianBlur(
					sample,
					1,
					Math.max(1, Math.round(blur)),
					{ resolutionScale: 1 }
				);
				const material = new THREE.NodeMaterial();
				// Resolve the original white backdrop after blurring, without another fullscreen capture.
				const filtered = blur ? effect : sample;
				material.colorNode = filtered.rgb.add(filtered.a.oneMinus());
				this.blurs.set(blur, { target, effect, material, quad: new THREE.QuadMesh(material) });
			}
			const glass = new LiquidGlassPanel(this.blurs.get(blur)!.target.texture, {
				...options,
				width,
				height
			});
			glass.group.matrixAutoUpdate = false;
			this.scene.add(glass.group);
			entry = { glass, blur, focusBlur, width, height, active: false, seen: false };
			this.panels.set(card, entry);
		}
		entry.seen = true;
		entry.focusBlur = focusBlur;
		entry.width = width;
		entry.height = height;
		entry.active = opacity > 0.001;
		entry.glass.setVisualSize(width, height);
		entry.glass.setVisibilityAlpha(opacity);
		entry.glass.group.matrix.copy(matrix);
		entry.glass.group.matrixWorldNeedsUpdate = true;
	}

	endFrame() {
		for (const [card, entry] of this.panels) {
			if (!entry.active) card.removeAttribute('data-carousel-glass-ready');
			if (!entry.seen || !card.isConnected || card.hidden) {
				this.scene.remove(entry.glass.group);
				entry.glass.dispose();
				this.panels.delete(card);
			}
		}
	}

	render(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera, drawRear: () => void) {
		const active = [...this.panels.entries()].filter(([, entry]) => entry.active);
		if (!active.length || !this.capture) {
			drawRear();
			return;
		}
		// CSS-pixel resolution bounds blur cost; resizing only on viewport changes.
		const width = Math.max(1, window.innerWidth),
			height = Math.max(1, window.innerHeight);
		if (this.size.x !== width || this.size.y !== height) {
			this.size.set(width, height);
			this.capture.setSize(width, height);
			this.resizes++;
		}
		const original = renderer.getRenderTarget();
		const clearColor = renderer.getClearColor(new THREE.Color());
		const clearAlpha = renderer.getClearAlpha();
		try {
			renderer.setRenderTarget(this.capture);
			renderer.setClearColor(0x000000, 0);
			renderer.clear();
			drawRear();
			for (const key of new Set(active.map(([, entry]) => entry.blur))) {
				const blur = this.blurs.get(key)!;
				if (blur.target.width !== width || blur.target.height !== height) {
					blur.target.setSize(width, height);
					this.resizes++;
				}
				renderer.setRenderTarget(blur.target);
				renderer.clear();
				blur.quad.render(renderer);
			}
			renderer.setRenderTarget(original);
			// Rear geometry, including defocus, is submitted once and reused by the glass and output.
			this.composite!.render(renderer);
			renderer.clearDepth();
			if (active.some(([, entry]) => entry.focusBlur >= 0.05)) {
				for (const [, entry] of active) entry.glass.group.visible = false;
				for (const [, entry] of active) {
					const group = entry.glass.group;
					group.visible = true;
					group.updateWorldMatrix(true, false);
					const corners = [-1, 1].flatMap((x) => [-1, 1].map((y) =>
						new THREE.Vector3(x * (entry.width / 2 + 48), y * (entry.height / 2 + 48), 0)
							.applyMatrix4(group.matrixWorld).project(camera)));
					const xs = corners.map((p) => (p.x + 1) * width / 2);
					const ys = corners.map((p) => (1 - p.y) * height / 2);
					this.depthBlur.render(renderer, camera,
						{ left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) },
						entry.focusBlur, (projection) => {
							const view = projection.view;
							if (view?.enabled) entry.glass.setBackdropUvTransform(
								view.offsetX / view.fullWidth, view.offsetY / view.fullHeight,
								view.width / view.fullWidth, view.height / view.fullHeight);
							try { renderer.render(this.scene, projection); }
							finally { entry.glass.setBackdropUvTransform(0, 0, 1, 1); }
						});
					group.visible = false;
				}
				for (const [, entry] of active) entry.glass.group.visible = true;
			} else renderer.render(this.scene, camera);
			this.passes++;
			for (const [card] of active) card.setAttribute('data-carousel-glass-ready', '');
		} finally {
			renderer.setRenderTarget(original);
			renderer.setClearColor(clearColor, clearAlpha);
		}
	}

	dispose() {
		for (const [card, entry] of this.panels) {
			card.removeAttribute('data-carousel-glass-ready');
			entry.glass.dispose();
		}
		this.panels.clear();
		this.scene.clear();
		this.capture?.dispose();
		this.compositeMaterial?.dispose();
		for (const blur of this.blurs.values()) {
			blur.target.dispose();
			blur.material.dispose();
			blur.effect.dispose();
		}
		this.blurs.clear();
	}
}
