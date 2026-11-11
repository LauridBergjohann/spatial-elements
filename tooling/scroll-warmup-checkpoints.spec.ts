import { expect, test } from 'vitest';
import { createScrollWarmupCheckpoints } from '../apps/tests/src/routes/proof/deferred-scroll-warmup/checkpoints';

test('each screenshot handshake waits for its own ID and stale acknowledgements cannot advance a later frame', async () => {
	const checkpoints = createScrollWarmupCheckpoints();
	let completed = 0;
	const source = checkpoints.wait('source', 1).then(() => { completed++; });
	const first = checkpoints.getCurrent()!;
	first.name = 'changed outside';
	expect(checkpoints.getCurrent()).toEqual({ id: 1, name: 'source', dpr: 1 });
	await Promise.resolve(); expect(completed).toBe(0);
	expect(checkpoints.release(2)).toBe(false);
	expect(checkpoints.release(1)).toBe(true); await source;
	const retained = checkpoints.wait('retained', 1.5).then(() => { completed++; });
	expect(checkpoints.release(1)).toBe(false);
	await Promise.resolve(); expect(completed).toBe(1);
	expect(checkpoints.getCurrent()).toEqual({ id: 2, name: 'retained', dpr: 1.5 });
	expect(checkpoints.release(2)).toBe(true); await retained;
	expect(completed).toBe(2); expect(checkpoints.getCurrent()).toBeUndefined();
});

test('route teardown rejects a held checkpoint and cannot resurrect it', async () => {
	const checkpoints = createScrollWarmupCheckpoints();
	const pending = checkpoints.wait('after-warm', 1);
	const rejected = expect(pending).rejects.toThrow('disposed');
	checkpoints.dispose(); await rejected;
	expect(checkpoints.release(1)).toBe(false);
	expect(checkpoints.getCurrent()).toBeUndefined();
	await expect(checkpoints.wait('retained', 1)).rejects.toThrow('disposed');
});

test('overlapping capture requests reject rather than silently dropping the pending owner', async () => {
	const checkpoints = createScrollWarmupCheckpoints();
	const source = checkpoints.wait('source', 1);
	await expect(checkpoints.wait('after-warm', 1)).rejects.toThrow('already pending');
	expect(checkpoints.getCurrent()?.name).toBe('source');
	checkpoints.release(1); await source;
});
