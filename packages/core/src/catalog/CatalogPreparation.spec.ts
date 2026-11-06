import { expect, test, vi } from 'vitest';
import { CatalogPreparation, preparationKey } from './CatalogPreparation.js';
import { DEFAULT_BACKGROUND } from '../stage/stageConstants.js';
import { PreparationGate } from './PreparationGate.js';
import type { SpatialElementAssetManager } from './assets/SpatialElementAssetManager.js';
import type { EnvironmentCache, PreparedEnvironment } from './EnvironmentCache.js';

test('implicit background defaults reuse the prefetched presentation on detail binding', () => {
 const element = { glb: '/cube.glb', hdr: '/studio.hdr' };
 expect(preparationKey(element)).toBe(preparationKey({ ...element, background: DEFAULT_BACKGROUND, model: {} }));
 expect(preparationKey(element)).not.toBe(preparationKey({ ...element, background: { ...DEFAULT_BACKGROUND, tintIntensity: 0.8 } }));
});

function environment(available = false) {
 const value = {} as PreparedEnvironment;
 let resolve!: (value: PreparedEnvironment) => void, reject!: (error: Error) => void;
 const pending = new Promise<PreparedEnvironment>((yes, no) => { resolve = yes; reject = no; });
 const lease = { value: available ? value : undefined, ready: available ? Promise.resolve(value) : pending, release: vi.fn() };
 return { lease, resolve: () => { lease.value = value; resolve(value); }, reject: () => reject(new Error('environment unavailable')) };
}

function fixture(...environments: ReturnType<typeof environment>[]) {
 const changed = vi.fn(), gate = new PreparationGate();
 const acquire = vi.fn();
 for (const environment of environments) acquire.mockReturnValueOnce(environment.lease);
 const preparation = new CatalogPreparation({} as SpatialElementAssetManager,
  { acquire } as unknown as EnvironmentCache, gate, vi.fn(), changed);
 const prepare = (hdr = '/studio.hdr') => preparation.prepare({ glb: '/cube.glb', hdr });
 return { preparation, changed, gate, acquire, prepare };
}

const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

test('an already cached environment is synchronously ready without a duplicate render notification', async () => {
 const f = fixture(environment(true));
 const entry = f.prepare();
 expect(entry.backgroundState).toBe('ready');
 expect(f.changed).not.toHaveBeenCalled();
 await flush();
 expect(f.changed).not.toHaveBeenCalled();
 expect(f.prepare()).toBe(entry);
 expect(f.acquire).toHaveBeenCalledOnce();
 f.preparation.dispose();
});

test.each(['ready', 'failed'] as const)('a current loading environment still reports its real transition to %s', async state => {
 const env = environment(), f = fixture(env);
 const entry = f.prepare();
 expect(entry.backgroundState).toBe('loading');
 if (state === 'ready') env.resolve(); else env.reject();
 await flush();
 expect(entry.backgroundState).toBe(state);
 expect(f.changed).toHaveBeenCalledOnce();
 f.preparation.dispose();
});

test.each(['ready', 'failed'] as const)('a superseded background cannot notify or change its retired entry (%s)', async state => {
 const old = environment(), next = environment(), f = fixture(old, next);
 const retired = f.prepare(), current = f.prepare('/next.hdr');
 if (state === 'ready') old.resolve(); else old.reject();
 await flush();
 expect(retired.backgroundState).toBe('loading');
 expect(current.backgroundState).toBe('loading');
 expect(f.preparation.current).toBe(current);
 expect(f.changed).not.toHaveBeenCalled();
 next.resolve();
 await flush();
 expect(current.backgroundState).toBe('ready');
 expect(f.changed).toHaveBeenCalledOnce();
 f.preparation.dispose();
});

test.each(['ready', 'failed'] as const)('an aborted current background does not notify or mutate its entry (%s)', async state => {
 const env = environment(), f = fixture(env), entry = f.prepare();
 entry.controller.abort();
 if (state === 'ready') env.resolve(); else env.reject();
 await flush();
 expect(entry.backgroundState).toBe('loading');
 expect(f.changed).not.toHaveBeenCalled();
 f.preparation.dispose();
});

test('a real readiness change waits for the existing gate and is reported after resuming', async () => {
 const env = environment(), f = fixture(env);
 f.gate.setPaused(true);
 const entry = f.prepare(); env.resolve();
 await flush();
 expect(entry.backgroundState).toBe('loading');
 expect(f.changed).not.toHaveBeenCalled();
 f.gate.setPaused(false);
 await flush();
 expect(entry.backgroundState).toBe('ready');
 expect(f.changed).toHaveBeenCalledOnce();
 f.preparation.dispose();
});

test('a disposed background remains retired when its pending promise rejects', async () => {
 const env = environment(), f = fixture(env), entry = f.prepare();
 f.preparation.dispose(); env.reject();
 await flush();
 expect(f.preparation.current).toBeUndefined();
 expect(entry.backgroundState).toBe('loading');
 expect(f.changed).not.toHaveBeenCalled();
 expect(env.lease.release).toHaveBeenCalledOnce();
});
