import { expect, test } from 'vitest';
import { createBackgroundCheckpoints } from '../apps/sveltekit-demo/src/routes/proof/background-layer-output/checkpoints';

test('screenshots own monotonically identified phases; stale release cannot advance the next one', async () => {
	const controller = createBackgroundCheckpoints(); let done = 0;
	const source = controller.wait({ phase: 'source', width: 160, height: 120, dpr: 1 }).then(() => done++);
	const copy = controller.getCurrent()!; copy.phase = 'external mutation';
	expect(controller.getCurrent()?.phase).toBe('source');
	await expect(controller.wait({ phase: 'overlap', width: 1, height: 1, dpr: 1 })).rejects.toThrow('already pending');
	expect(controller.release(2)).toBe(false); await Promise.resolve(); expect(done).toBe(0);
	expect(controller.release(1)).toBe(true); await source;
	const held = controller.wait({ phase: 'held', width: 200, height: 144, dpr: 1.5 }).then(() => done++);
	expect(controller.release(1)).toBe(false); await Promise.resolve(); expect(done).toBe(1);
	expect(controller.getCurrent()).toEqual({ id: 2, phase: 'held', width: 200, height: 144, dpr: 1.5 });
	expect(controller.release(2)).toBe(true); await held; expect(done).toBe(2);
});

test('unmount rejects a held screenshot and forbids later phases', async () => {
	const controller = createBackgroundCheckpoints();
	const pending = controller.wait({ phase: 'held', width: 160, height: 120, dpr: 1 });
	const rejected = expect(pending).rejects.toThrow('disposed'); controller.dispose(); await rejected;
	expect(controller.getCurrent()).toBeUndefined(); expect(controller.release(1)).toBe(false);
	await expect(controller.wait({ phase: 'late', width: 160, height: 120, dpr: 1 })).rejects.toThrow('disposed');
});
