import type { ProductAssetResource } from '../productAssets.js';
import type { PreparationGate } from '../PreparationGate.js';
import { estimateAssetBytes } from './assetCosts.js';
import {
	createProductAssetInstance,
	disposeLoadedProductAsset,
	type LoadedProductAsset,
	type ProductAssetInstance
} from './productAssetResources.js';

export type { LoadedProductAsset, ProductAssetInstance } from './productAssetResources.js';

export interface ProductAssetLoader {
	load(
		resource: ProductAssetResource,
		options: { signal: AbortSignal }
	): Promise<LoadedProductAsset>;
	dispose?(): void;
}

export interface ProductAssetLease {
	readonly key: string;
	/** Decoded CPU readiness only; the renderer separately establishes GPU readiness. */
	readonly ready: Promise<LoadedProductAsset>;
	/** A live instance pins shared resources independently of this lease. */
	createInstance(): Promise<ProductAssetInstance>;
	release(): void;
}

interface AssetEntry {
	key: string;
	controller: AbortController;
	promise: Promise<LoadedProductAsset>;
	resolve: (asset: LoadedProductAsset) => void;
	reject: (error: unknown) => void;
	status: 'loading' | 'ready' | 'failed';
	asset?: LoadedProductAsset;
	leases: number;
	instances: number;
	lastUsed: number;
	retired: boolean;
	estimatedBytes: number;
}

export function getProductAssetResourceKey(resource: ProductAssetResource) {
	if (!resource.url || !resource.revision) {
		throw new Error('Product asset requests require a URL and revision');
	}
	return JSON.stringify([
		resource.format,
		resource.url,
		resource.revision,
		[...new Set(resource.requirements?.decoders ?? [])].sort(),
		[...new Set(resource.requirements?.extensions ?? [])].sort()
	]);
}

function abortError(message = 'Product asset operation was cancelled') {
	return new DOMException(message, 'AbortError');
}

/** Runtime-owned cache with separate lease, instance, and decoded-resource lifetimes. */
export class ProductAssetManager {
	private readonly cache = new Map<string, AssetEntry>();
	private readonly entries = new Set<AssetEntry>();
	private readonly loader: ProductAssetLoader;
	private readonly maxIdleEntries: number;
	private readonly maxIdleBytes: number;
	private clock = 0;
	private loadingCount = 0;
	private disposed = false;
	private loaderDisposed = false;
	private readonly loads: { url: string; fetchMs: number; decodeMs: number; gateWaitMs: number }[] =
		[];

	constructor(
		options: {
			loader?: ProductAssetLoader;
			dracoDecoderPath?: string;
			maxIdleEntries?: number;
			maxIdleBytes?: number;
			preparationGate?: PreparationGate;
		} = {}
	) {
		this.loader = options.loader ?? new GltfProductAssetLoader(options.preparationGate, options.dracoDecoderPath);
		this.preparationGate = options.preparationGate;
		this.maxIdleEntries = Math.max(0, Math.floor(options.maxIdleEntries ?? 6));
		this.maxIdleBytes = Math.max(0, options.maxIdleBytes ?? 96 * 1024 * 1024);
	}
	private readonly preparationGate?: PreparationGate;

	setDracoDecoderPath(path: string) {
		if (this.loader instanceof GltfProductAssetLoader) this.loader.setDracoDecoderPath(path);
	}

	acquire(
		resource: ProductAssetResource,
		options: { signal?: AbortSignal } = {}
	): ProductAssetLease {
		if (this.disposed) throw new Error('ProductAssetManager has been disposed');
		if (options.signal?.aborted) throw abortError();
		const key = getProductAssetResourceKey(resource);
		const entry = this.cache.get(key) ?? this.startLoad(key, resource);
		entry.leases += 1;
		entry.lastUsed = ++this.clock;
		let released = false;
		let rejectReady: (error: unknown) => void = () => {};
		const release = () => {
			if (released) return;
			released = true;
			options.signal?.removeEventListener('abort', release);
			rejectReady(abortError());
			entry.leases -= 1;
			entry.lastUsed = ++this.clock;
			this.releaseUnused(entry);
		};
		const ready = new Promise<LoadedProductAsset>((resolve, reject) => {
			rejectReady = reject;
			entry.promise.then(
				(asset) => {
					if (released || entry.retired) {
						reject(abortError());
						release();
					} else resolve(asset);
				},
				(error: unknown) => {
					reject(error);
					release();
				}
			);
		});
		// A caller may release speculative work without ever awaiting it.
		void ready.catch(() => {});
		options.signal?.addEventListener('abort', release, { once: true });
		return {
			key,
			ready,
			createInstance: async () => {
				const asset = await ready;
				if (released || entry.retired) throw abortError();
				const create = () => {
					if (released || entry.retired) throw abortError();
					const instance = createProductAssetInstance(asset, () => {
						entry.instances -= 1;
						entry.lastUsed = ++this.clock;
						this.releaseUnused(entry);
					});
					entry.instances += 1;
					return instance;
				};
				return this.preparationGate ? this.preparationGate.run(create, options.signal) : create();
			},
			release
		};
	}

	/** Replaces one resource generation; existing instances retain their owned resources. */
	invalidate(resource: ProductAssetResource) {
		const entry = this.cache.get(getProductAssetResourceKey(resource));
		if (entry) this.retire(entry);
	}

	/** Evicts least-recently-used idle assets without touching active leases or instances. */
	trim(maxIdleEntries = this.maxIdleEntries) {
		const idle = [...this.cache.values()]
			.filter((entry) => entry.status === 'ready' && entry.leases === 0 && entry.instances === 0)
			.sort((a, b) => a.lastUsed - b.lastUsed);
		let bytes = idle.reduce((sum, entry) => sum + entry.estimatedBytes, 0);
		let count = idle.length;
		for (const entry of idle) {
			if (count <= Math.max(0, Math.floor(maxIdleEntries)) && bytes <= this.maxIdleBytes) break;
			bytes -= entry.estimatedBytes;
			count--;
			this.retire(entry);
		}
	}

	getStats() {
		let activeLeases = 0;
		let activeInstances = 0;
		for (const entry of this.entries) {
			activeLeases += entry.leases;
			activeInstances += entry.instances;
		}
		return {
			estimatedResidentBytes: [...this.entries].reduce(
				(sum, entry) => sum + entry.estimatedBytes,
				0
			),
			loadTimings: [...this.loads],
			estimatedIdleBytes: [...this.cache.values()]
				.filter((entry) => entry.status === 'ready' && !entry.leases && !entry.instances)
				.reduce((sum, entry) => sum + entry.estimatedBytes, 0),
			cachedResources: this.cache.size,
			pendingLoads: this.loadingCount,
			activeLeases,
			activeInstances,
			idleResources: [...this.cache.values()].filter(
				(entry) => entry.status === 'ready' && entry.leases === 0 && entry.instances === 0
			).length
		};
	}

	/** Closes the cache; live instances remain valid until their owners release them. */
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const entry of [...this.entries]) this.retire(entry);
		this.disposeLoaderWhenIdle();
	}

	private startLoad(key: string, resource: ProductAssetResource) {
		let resolve!: AssetEntry['resolve'];
		let reject!: AssetEntry['reject'];
		const promise = new Promise<LoadedProductAsset>((accept, fail) => {
			resolve = accept;
			reject = fail;
		});
		const entry: AssetEntry = {
			key,
			controller: new AbortController(),
			promise,
			resolve,
			reject,
			status: 'loading',
			leases: 0,
			instances: 0,
			lastUsed: ++this.clock,
			retired: false,
			estimatedBytes: 0
		};
		this.cache.set(key, entry);
		this.entries.add(entry);
		this.loadingCount += 1;
		// Defer invocation so synchronous loader failures use the same cleanup path.
		void Promise.resolve()
			.then(() => {
				if (entry.controller.signal.aborted) throw abortError();
				return this.loader.load(resource, { signal: entry.controller.signal });
			})
			.then((asset) => {
				if (entry.retired || this.cache.get(key) !== entry) {
					disposeLoadedProductAsset(asset);
					entry.status = 'failed';
					entry.reject(abortError('A newer product asset generation replaced this load'));
					return;
				}
				entry.asset = asset;
				entry.estimatedBytes = estimateAssetBytes(asset.scene, ...(asset.scenes ?? []));
				if (asset.timings) {
					this.loads.push({ url: resource.url, ...asset.timings });
					if (this.loads.length > 20) this.loads.shift();
				}
				entry.status = 'ready';
				entry.resolve(asset);
			})
			.catch((error: unknown) => {
				entry.status = 'failed';
				entry.reject(error);
				this.retire(entry);
			})
			.finally(() => {
				this.loadingCount -= 1;
				this.releaseUnused(entry);
				this.disposeLoaderWhenIdle();
			});
		return entry;
	}

	private retire(entry: AssetEntry) {
		entry.retired = true;
		if (this.cache.get(entry.key) === entry) this.cache.delete(entry.key);
		if (entry.status === 'loading') {
			entry.reject(abortError());
			entry.controller.abort();
		}
		this.disposeEntryWhenUnused(entry);
	}

	private releaseUnused(entry: AssetEntry) {
		if (entry.leases || entry.instances) return;
		if (entry.status === 'loading' || this.disposed || entry.retired) this.retire(entry);
		else this.trim();
	}

	private disposeEntryWhenUnused(entry: AssetEntry) {
		if (entry.leases || entry.instances || entry.status === 'loading') return;
		if (entry.asset) {
			const asset = entry.asset;
			entry.asset = undefined;
			disposeLoadedProductAsset(asset);
		}
		this.entries.delete(entry);
	}

	private disposeLoaderWhenIdle() {
		if (!this.disposed || this.loadingCount || this.loaderDisposed) return;
		this.loaderDisposed = true;
		this.loader.dispose?.();
	}
}

/** Lazy shared decoder setup; network cancellation does not pretend to cancel GLTF decoding. */
export class GltfProductAssetLoader implements ProductAssetLoader {
	constructor(private readonly gate?: PreparationGate, private decoderPath = '/assets/draco/gltf/') {}
 setDracoDecoderPath(path: string) {
  if (this.setup) throw new Error('Configure the Draco decoder path before loading assets');
  this.decoderPath = path;
 }
	private setup?: Promise<{
		gltf: import('three/addons/loaders/GLTFLoader.js').GLTFLoader;
		draco: import('three/addons/loaders/DRACOLoader.js').DRACOLoader;
	}>;

	async load(resource: ProductAssetResource, { signal }: { signal: AbortSignal }) {
		if (resource.requirements?.decoders.includes('ktx2')) {
			throw new Error('KTX2 assets require renderer capability configuration');
		}
		this.setup ??= Promise.all([
			import('three/addons/loaders/GLTFLoader.js'),
			import('three/addons/loaders/DRACOLoader.js'),
			import('three/addons/libs/meshopt_decoder.module.js')
		]).then(([{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }]) => {
			const draco = new DRACOLoader().setDecoderPath(this.decoderPath);
			const gltf = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
			return { gltf, draco };
		});
		const { gltf } = await this.setup;
		signal.throwIfAborted();
		const fetchStarted = performance.now();
		const response = await fetch(resource.url, { signal });
		if (!response.ok) throw new Error(`Unable to load product asset (${response.status})`);
		const data = resource.format === 'gltf' ? await response.text() : await response.arrayBuffer();
		const fetched = performance.now();
		signal.throwIfAborted();
		const base = new URL('.', new URL(resource.url, location.href)).href;
		let parseStarted = fetched;
		const parse = () => {
			parseStarted = performance.now();
			return gltf.parseAsync(data, base);
		};
		const loaded = this.gate ? await this.gate.run(parse, signal) : await parse();
		// The manager disposes the decoded result if the request became stale during parse.
		return {
			scene: loaded.scene,
			scenes: loaded.scenes,
			animations: loaded.animations,
			timings: {
				fetchMs: fetched - fetchStarted,
				decodeMs: performance.now() - parseStarted,
				gateWaitMs: parseStarted - fetched
			}
		};
	}

	dispose() {
		void this.setup?.then(
			({ draco }) => draco.dispose(),
			() => {}
		);
	}
}
