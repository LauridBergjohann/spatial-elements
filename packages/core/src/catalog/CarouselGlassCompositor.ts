import { gaussianTargets } from '../stage/renderTargetInventory.js';
import * as THREE from 'three/webgpu';
import { texture } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { LiquidGlassPanel } from '../stage/LiquidGlassPanel.js';

/** Reuses the stage device/output and glass shader; never samples its own glass output. */
export class CarouselGlassCompositor {
	getRenderTargets() {
		return [
			...(this.capture ? [this.capture] : []),
			...[...this.blurs.values()].flatMap((blur) => [blur.target, ...gaussianTargets(blur.effect)])
		];
	}
	private scene = new THREE.Scene();
	private capture?: THREE.RenderTarget;
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
		{ glass: LiquidGlassPanel; blur: number; active: boolean; seen: boolean }
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

	panel(card: HTMLElement, matrix: THREE.Matrix4, width: number, height: number, opacity: number) {
		if (card.dataset.carouselSurface !== 'glass') return;
		if (!this.capture) this.capture = new THREE.RenderTarget(1, 1);
		let entry = this.panels.get(card);
		if (!entry) {
			const options = JSON.parse(card.dataset.carouselTheme ?? '{}');
			const blur = Math.min(100, Math.max(0, options.backdropBlur ?? 5));
			if (!this.blurs.has(blur)) {
				const target = new THREE.RenderTarget(1, 1, { depthBuffer: false });
				const effect = gaussianBlur(
					texture(this.capture.texture),
					1,
					Math.max(1, Math.round(blur)),
					{ resolutionScale: 1 }
				);
				const material = new THREE.NodeMaterial();
				material.colorNode = blur ? effect : texture(this.capture.texture);
				this.blurs.set(blur, { target, effect, material, quad: new THREE.QuadMesh(material) });
			}
			const glass = new LiquidGlassPanel(this.blurs.get(blur)!.target.texture, {
				...options,
				width,
				height
			});
			glass.group.matrixAutoUpdate = false;
			this.scene.add(glass.group);
			entry = { glass, blur, active: false, seen: false };
			this.panels.set(card, entry);
		}
		entry.seen = true;
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

	render(renderer: THREE.WebGPURenderer, camera: THREE.Camera, drawRear: () => void) {
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
		renderer.setRenderTarget(this.capture);
		renderer.setClearColor(0xffffff, 1);
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
		drawRear();
		renderer.clearDepth();
		renderer.render(this.scene, camera);
		this.passes++;
		for (const [card] of active) card.setAttribute('data-carousel-glass-ready', '');
	}

	dispose() {
		for (const [card, entry] of this.panels) {
			card.removeAttribute('data-carousel-glass-ready');
			entry.glass.dispose();
		}
		this.panels.clear();
		this.scene.clear();
		this.capture?.dispose();
		for (const blur of this.blurs.values()) {
			blur.target.dispose();
			blur.material.dispose();
			blur.effect.dispose();
		}
		this.blurs.clear();
	}
}
