import { expect, test, vi } from 'vitest';
import { EarlyNavigationCoordinator, type EarlyNavigationData, type EarlyNavigationHandle } from './EarlyNavigationCoordinator.js';

function deferred<T>() {
	let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}
const loaded: EarlyNavigationData = { type: 'loaded', status: 200 };
const target = 'https://example.test/product/a';
const other = 'https://example.test/product/b';
function fixture() {
	const data = deferred<EarlyNavigationData>(), motion = deferred<boolean>();
	const handle: EarlyNavigationHandle = { finished: motion.promise, cancel: vi.fn() };
	const preload = vi.fn(() => data.promise), navigate = vi.fn(async (_href: string) => {});
	const coordinator = new EarlyNavigationCoordinator({ preload, navigate });
	return { coordinator, data, motion, handle, preload, navigate };
}
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

test.each(['data', 'motion'] as const)('commit waits for both data and motion (%s first)', async first => {
	const f = fixture();
	const done = f.coordinator.start(target, f.handle);
	if (first === 'data') f.data.resolve(loaded); else f.motion.resolve(true);
	await flush();
	expect(f.navigate).not.toHaveBeenCalled();
	if (first === 'data') f.motion.resolve(true); else f.data.resolve(loaded);
	await done;
	expect(f.navigate).toHaveBeenCalledExactlyOnceWith(target);
	expect(f.handle.cancel).not.toHaveBeenCalled();
	expect(f.coordinator.pending).toBe(false);
});

test('the own replay permit matches the exact destination and can be consumed only once', async () => {
	const f = fixture();
	f.navigate.mockImplementation(async href => {
		expect(f.coordinator.acceptReplay(other)).toBe(false);
		expect(f.coordinator.acceptReplay(href)).toBe(true);
		expect(f.coordinator.acceptReplay(href)).toBe(false);
	});
	const done = f.coordinator.start(target, f.handle);
	f.data.resolve(loaded); f.motion.resolve(true); await done;
	expect(f.coordinator.acceptReplay(target)).toBe(false);
	expect(f.handle.cancel).not.toHaveBeenCalled();
});

test('a warm successor owns the only commit even when the first data resolves afterwards', async () => {
	const f = fixture(), second = deferred<boolean>();
	const next = { finished: second.promise, cancel: vi.fn() };
	f.preload.mockImplementationOnce(() => f.data.promise).mockResolvedValueOnce(loaded);
	const stale = f.coordinator.start(target, f.handle); await flush();
	const current = f.coordinator.start(other, next);
	await stale;
	expect(f.handle.cancel).toHaveBeenCalledExactlyOnceWith('superseded');
	f.data.resolve(loaded); f.motion.resolve(true); second.resolve(true);
	await current;
	expect(f.navigate).toHaveBeenCalledExactlyOnceWith(other);
	expect(next.cancel).not.toHaveBeenCalled();
});

test.each(['cancelled', 'history', 'leave', 'interaction', 'resize', 'destroyed'] as const)(
	'%s settles immediately and ignores late data or motion', async reason => {
		const f = fixture();
		const done = f.coordinator.start(target, f.handle);
		f.coordinator.cancel(reason); f.coordinator.cancel(reason);
		await done;
		f.data.resolve(loaded); f.motion.resolve(true); await flush();
		expect(f.navigate).not.toHaveBeenCalled();
		expect(f.handle.cancel).toHaveBeenCalledExactlyOnceWith(reason);
		expect(f.coordinator.pending).toBe(false);
	}
);

test('a redirect releases the predicted pose before a single ordinary destination replay', async () => {
	const f = fixture();
	f.navigate.mockImplementation(async href => {
		expect(f.handle.cancel).toHaveBeenCalledExactlyOnceWith('redirect');
		expect(f.coordinator.acceptReplay(href)).toBe(true);
	});
	const done = f.coordinator.start(target, f.handle);
	f.data.resolve({ type: 'redirect', location: '/product/b' }); await done;
	expect(f.navigate).toHaveBeenCalledExactlyOnceWith(other);
});

test.each(['reject', 'status'] as const)('preload failure (%s) releases visuals and delegates the error page to the router', async failure => {
	const f = fixture();
	const done = f.coordinator.start(target, f.handle);
	if (failure === 'reject') f.data.reject(Error('offline')); else f.data.resolve({ type: 'loaded', status: 503 });
	await done;
	expect(f.handle.cancel).toHaveBeenCalledExactlyOnceWith('error');
	expect(f.navigate).toHaveBeenCalledExactlyOnceWith(target);
});

test('a handled load error hidden behind preload status 200 still reaches ordinary navigation', async () => {
	const f = fixture(); const done = f.coordinator.start(target, f.handle);
	f.data.resolve(loaded); f.motion.resolve(true); await done;
	expect(f.navigate).toHaveBeenCalledExactlyOnceWith(target);
});

test('a rejected replay releases the visual owner without retrying', async () => {
	const f = fixture(); f.navigate.mockRejectedValue(Error('router cancelled'));
	const done = f.coordinator.start(target, f.handle);
	f.data.resolve(loaded); f.motion.resolve(true); await done;
	expect(f.handle.cancel).toHaveBeenCalledExactlyOnceWith('error');
	expect(f.navigate).toHaveBeenCalledTimes(1);
});

test('a failed visual promise falls back to ordinary navigation, while false means explicit cancellation', async () => {
	for (const failure of [true, false]) {
		const f = fixture(); const done = f.coordinator.start(target, f.handle);
		if (failure) f.motion.reject(Error('render failed')); else f.motion.resolve(false);
		f.data.resolve(loaded); await done;
		expect(f.navigate).toHaveBeenCalledTimes(failure ? 1 : 0);
		expect(f.handle.cancel).toHaveBeenCalledExactlyOnceWith(failure ? 'error' : 'cancelled');
	}
});

test('Reduced Motion can resolve immediately without any artificial timer or animation gate', async () => {
	const f = fixture();
	const done = f.coordinator.start(target, { finished: Promise.resolve(true), cancel: f.handle.cancel });
	f.data.resolve(loaded); await done;
	expect(f.navigate).toHaveBeenCalledExactlyOnceWith(target);
});

test('a visual cancellation settles even when the data request never finishes', async () => {
	const f = fixture(); const done = f.coordinator.start(target, f.handle);
	f.motion.resolve(false); await done;
	expect(f.coordinator.pending).toBe(false);
	expect(f.navigate).not.toHaveBeenCalled();
	expect(f.handle.cancel).toHaveBeenCalledExactlyOnceWith('cancelled');
});

test('throwing visual cleanup cannot block an ordinary error destination', async () => {
	const f = fixture(); vi.mocked(f.handle.cancel).mockImplementation(() => { throw Error('cleanup'); });
	const done = f.coordinator.start(target, f.handle);
	f.data.reject(Error('offline')); await done;
	expect(f.navigate).toHaveBeenCalledExactlyOnceWith(target);
});

test('cancellation aborts the adapter wait without requiring the public preload to abort', async () => {
	const f = fixture(); let signal: AbortSignal | undefined;
	const coordinator = new EarlyNavigationCoordinator({
		preload: async (_destination, ownedSignal) => { signal = ownedSignal; return f.data.promise; },
		navigate: f.navigate
	});
	const done = coordinator.start(target, f.handle); await flush();
	expect(signal?.aborted).toBe(false);
	coordinator.cancel('interaction'); await done;
	expect(signal?.aborted).toBe(true);
	f.data.resolve(loaded); await flush();
	expect(f.navigate).not.toHaveBeenCalled();
});
