import { afterEach, expect, test, vi } from 'vitest';
import { releasePresentationResources } from '../packages/sveltekit/src/catalog/presentationCleanup.js';

afterEach(() => { vi.restoreAllMocks(); });

test('a failed GPU cleanup still clears presentation state, flushes and releases the Stage owner', () => {
	const calls: string[] = [];
	const failure = new Error('GPU cleanup failed');
	const report = vi.spyOn(console, 'error').mockImplementation(() => { calls.push('reported'); });
	releasePresentationResources('transition cleanup', [
		() => { calls.push('DOM restored'); },
		() => { calls.push('GPU released'); throw failure; },
		() => { calls.push('presentation reset'); },
		() => { calls.push('final flush'); },
		() => { calls.push('Stage owner released'); }
	]);
	expect(calls).toEqual(['DOM restored', 'GPU released', 'presentation reset', 'final flush', 'Stage owner released', 'reported']);
	expect(report).toHaveBeenCalledExactlyOnceWith('transition cleanup', failure);
});

test('independent restore and flush failures cannot prevent later owners from releasing', () => {
	const restoreFailure = new Error('restore failed'), flushFailure = new Error('flush failed');
	const report = vi.spyOn(console, 'error').mockImplementation(() => {});
	const releaseLease = vi.fn(), removeHold = vi.fn(), finish = vi.fn();
	releasePresentationResources('transition cleanup', [
		() => { throw restoreFailure; }, releaseLease, removeHold,
		() => { throw flushFailure; }, finish
	]);
	expect(releaseLease).toHaveBeenCalledOnce();
	expect(removeHold).toHaveBeenCalledOnce();
	expect(finish).toHaveBeenCalledOnce();
	expect(report.mock.calls).toEqual([['transition cleanup', restoreFailure], ['transition cleanup', flushFailure]]);
});

test('rejected component teardown is observed without delaying native-root and registry removal', async () => {
	const failure = new Error('custom summary teardown failed');
	const report = vi.spyOn(console, 'error').mockImplementation(() => {});
	const removeRoot = vi.fn(), forgetRecord = vi.fn();
	let reject!: (error: unknown) => void;
	const unmounted = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
	releasePresentationResources('component cleanup', [() => unmounted, removeRoot, forgetRecord]);
	expect(removeRoot).toHaveBeenCalledOnce();
	expect(forgetRecord).toHaveBeenCalledOnce();
	expect(report).not.toHaveBeenCalled();
	reject(failure);
	await Promise.resolve();
	expect(report).toHaveBeenCalledExactlyOnceWith('component cleanup', failure);
});

test('a synchronous component-unmount exception also releases the detached root and registry', () => {
	const failure = new Error('unmount failed');
	const report = vi.spyOn(console, 'error').mockImplementation(() => {});
	const removeRoot = vi.fn(), forgetRecord = vi.fn();
	releasePresentationResources('component cleanup', [() => { throw failure; }, removeRoot, forgetRecord]);
	expect(removeRoot).toHaveBeenCalledOnce();
	expect(forgetRecord).toHaveBeenCalledOnce();
	expect(report).toHaveBeenCalledExactlyOnceWith('component cleanup', failure);
});
