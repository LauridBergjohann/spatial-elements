import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import type { PreparationGate } from './PreparationGate.js';

export interface PreparedEnvironment {
	url: string;
	source: THREE.DataTexture;
	target: THREE.RenderTarget;
}
interface Entry {
	controller: AbortController;
	refs: number;
	value?: PreparedEnvironment;
	promise: Promise<PreparedEnvironment>;
}

/** Renderer-owned HDR cache. References pin environments used by live or speculative elements. */
export class EnvironmentCache {
	getRenderTargets() {
		return [...this.entries.values()].flatMap((entry) => (entry.value ? [entry.value.target] : []));
	}
	private entries = new Map<string, Entry>();
	constructor(
		private renderer: THREE.WebGPURenderer,
		private gate: PreparationGate
	) {}
	acquire(url: string) {
		let entry = this.entries.get(url);
		if (!entry) {
			const controller = new AbortController();
			entry = { controller, refs: 0, promise: undefined! };
			const owned = entry;
			entry.promise = this.load(url, controller.signal).then((value) => {
				owned.value = value;
				return value;
			});
			void entry.promise.catch(() => {
				if (this.entries.get(url) === owned) this.entries.delete(url);
			});
			this.entries.set(url, entry);
		}
		entry.refs++;
		let released = false;
		return {
			ready: entry.promise,
			get value() {
				return entry.value;
			},
			release: () => {
				if (released) return;
				released = true;
				entry.refs--;
				if (!entry.refs && !entry.value) {
					entry.controller.abort();
					if (this.entries.get(url) === entry) this.entries.delete(url);
				}
				const idle = [...this.entries].filter(([, item]) => !item.refs);
				for (const [key, item] of idle.slice(0, Math.max(0, idle.length - 1))) {
					this.entries.delete(key);
					this.disposeEntry(item);
				}
			}
		};
	}

	/** Pin the precise texture already used by a moving representation; never start new work. */
	pinTexture(texture: THREE.Texture | null | undefined) {
		const entry = [...this.entries].find(([, value]) => value.value?.target.texture === texture);
		return entry ? this.acquire(entry[0]) : undefined;
	}
	private async load(url: string, signal: AbortSignal): Promise<PreparedEnvironment> {
		const response = await fetch(url, { signal });
		if (!response.ok) throw new Error(`Unable to load environment (${response.status})`);
		const bytes = await response.arrayBuffer();
		return this.gate.run(async () => {
			const parsed = new HDRLoader().setDataType(THREE.HalfFloatType).parse(bytes);
			const source = new THREE.DataTexture(
				parsed.data,
				parsed.width,
				parsed.height,
				THREE.RGBAFormat,
				THREE.HalfFloatType
			);
			source.mapping = THREE.EquirectangularReflectionMapping;
			source.colorSpace = THREE.LinearSRGBColorSpace;
			source.minFilter = source.magFilter = THREE.LinearFilter;
			source.generateMipmaps = false;
			source.flipY = true;
			source.needsUpdate = true;
			const generator = new THREE.PMREMGenerator(this.renderer);
			let target: THREE.RenderTarget | undefined;
			try {
				target = generator.fromEquirectangular(source);
				const destination = this.renderer.getRenderTarget();
				const probe = new THREE.RenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
				const scene = new THREE.Scene();
				const camera = new THREE.PerspectiveCamera();
				try {
					this.renderer.setRenderTarget(probe);
					for (const background of [source, target.texture]) {
						scene.background = background;
						scene.backgroundBlurriness = background === source ? 0 : 0.2;
						this.renderer.render(scene, camera);
					}
				} finally {
					this.renderer.setRenderTarget(destination);
					probe.dispose();
				}
				const device = (this.renderer.backend as unknown as { device?: GPUDevice }).device;
				await device?.queue.onSubmittedWorkDone();
				signal.throwIfAborted();
				return { url, source, target };
			} catch (error) {
				target?.dispose();
				source.dispose();
				throw error;
			} finally {
				generator.dispose();
			}
		}, signal);
	}
	private disposeEntry(entry: Entry) {
		entry.controller.abort();
		if (entry.value) {
			entry.value.target.dispose();
			entry.value.source.dispose();
		} else
			void entry.promise.then(
				(value) => {
					value.target.dispose();
					value.source.dispose();
				},
				() => {}
			);
	}
	dispose() {
		for (const entry of this.entries.values()) this.disposeEntry(entry);
		this.entries.clear();
	}
}
