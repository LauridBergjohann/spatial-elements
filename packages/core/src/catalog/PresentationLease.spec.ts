import { expect, it, vi } from 'vitest';
import { PresentationLease } from './PresentationLease.js';

it('transfers the exact live resource without disposing it or accepting stale releases', () => {
	const dispose = vi.fn();
	const pose = { matrix: [1, 2, 3], opacity: 0.37 };
	const lease = new PresentationLease(pose, dispose);
	const first = lease.claim();
	const next = lease.claim();
	expect(first.isCurrent()).toBe(false);
	expect(next.value).toBe(pose);
	expect(next.value.opacity).toBe(0.37);
	expect(first.release()).toBe(false);
	expect(dispose).not.toHaveBeenCalled();
	expect(next.release()).toBe(true);
	expect(next.release()).toBe(false);
	expect(dispose).toHaveBeenCalledExactlyOnceWith(pose);
	expect(() => lease.claim()).toThrow('released');
});
