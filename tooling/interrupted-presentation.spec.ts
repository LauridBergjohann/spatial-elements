import { expect, test, vi } from 'vitest';
import { finishInterruptedPresentation } from '../packages/sveltekit/src/catalog/interruptedPresentation.js';

function fixture() {
	const steps: (() => void)[] = [];
	const measure = vi.fn();
	const adopt = vi.fn(() => ({ dispatchEvent: measure }) as unknown as HTMLElement);
	const release = vi.fn();
	const owner = finishInterruptedPresentation({
		settle: () => new Promise<void>(resolve => steps.push(resolve)), adopt, release
	});
	const step = async () => { steps.shift()!(); await Promise.resolve(); };
	return { owner, adopt, release, measure, step };
}

test('a late visual cancellation transfers the live owner before its new intrinsic measurement', async () => {
	const f = fixture();
	expect(f.adopt).not.toHaveBeenCalled();
	await f.step(); expect(f.adopt).toHaveBeenCalledOnce();
	expect(f.measure).not.toHaveBeenCalled(); expect(f.release).not.toHaveBeenCalled();
	await f.step(); expect(f.measure).toHaveBeenCalledOnce();
	expect(f.measure.mock.calls[0][0].type).toBe('spatial-summary-measure');
	await f.step(); await f.owner.finished;
	f.owner.cancel(); expect(f.release).toHaveBeenCalledOnce();
});

test.each([false, true])('superseding during a pending tick cannot adopt or measure a stale destination (already adopted=%s)', alreadyAdopted => {
	return (async () => {
		const f = fixture();
		if (alreadyAdopted) await f.step();
		f.owner.cancel(); f.owner.cancel();
		expect(f.release).toHaveBeenCalledOnce();
		await f.step(); await f.owner.finished;
		expect(f.adopt).toHaveBeenCalledTimes(alreadyAdopted ? 1 : 0);
		expect(f.measure).not.toHaveBeenCalled();
		expect(f.release).toHaveBeenCalledOnce();
	})();
});

test('a missing destination releases the retained owner and reports failure to the binding owner', async () => {
	const f = fixture(); f.adopt.mockImplementation(() => { throw new Error('missing destination'); });
	await f.step();
	await expect(f.owner.finished).rejects.toThrow('missing destination');
	f.owner.cancel(); expect(f.release).toHaveBeenCalledOnce();
});
