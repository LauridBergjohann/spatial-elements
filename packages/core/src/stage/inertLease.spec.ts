import { expect, it } from 'vitest';
import { setInertLease } from './inertLease.js';

it.each([true, false])('releases overlapping transition and focus locks in either order (%s)', transitionFirst => {
	const element = { inert: false } as HTMLElement;
	const transition = {}, focus = {};
	setInertLease(element, transition, true);
	setInertLease(element, focus, true);
	setInertLease(element, focus, true);
	const first = transitionFirst ? transition : focus;
	const last = transitionFirst ? focus : transition;
	setInertLease(element, first, false);
	expect(element.inert).toBe(true);
	setInertLease(element, last, false);
	expect(element.inert).toBe(false);
});

it('preserves authored inert and ignores releases by an unrelated owner', () => {
	const element = { inert: true } as HTMLElement;
	const owner = {};
	setInertLease(element, owner, true);
	setInertLease(element, {}, false);
	expect(element.inert).toBe(true);
	setInertLease(element, owner, false);
	expect(element.inert).toBe(true);
});
