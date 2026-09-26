import { expect, test } from 'vitest';
import type { SpatialElementPreparation } from '../catalog/CatalogPreparation.js';
import { PresentationReadiness } from './PresentationReadiness.js';
import { ASYNC_REVEAL_DURATION } from '../catalog/transitionTiming.js';

test('prepared HDR remains on the motion clock when High is late', () => {
	const readiness = new PresentationReadiness();
	const entry = { backgroundState: 'ready', highState: 'loading' } as SpatialElementPreparation;
	readiness.attach(entry);
	expect(readiness.freeze(false, false)).toBe('asynchronous');
	expect(readiness.backgroundPrepared).toBe(true);
	expect(readiness.acceptsClockOpacity()).toBe(true);
	entry.highState = 'ready';
	expect(readiness.advance(1000, false)).toBeUndefined();
	expect(readiness.backgroundPending).toBe(false);
	expect(readiness.mode).toBe('asynchronous');
});

test('late HDR starts its own reveal only when ready and completes without restarting', () => {
	const readiness = new PresentationReadiness();
	const entry = { backgroundState: 'loading', highState: 'ready' } as SpatialElementPreparation;
	readiness.attach(entry);
	readiness.freeze(false, false);
	expect(readiness.advance(500, false)).toBeUndefined();
	expect(readiness.animating).toBe(false);
	entry.backgroundState = 'ready';
	expect(readiness.advance(800, false)).toBe(0);
	expect(readiness.advance(800 + ASYNC_REVEAL_DURATION / 2, false)).toBeCloseTo(0.5);
	expect(readiness.advance(800 + ASYNC_REVEAL_DURATION, false)).toBe(1);
	expect(readiness.advance(2000, false)).toBeUndefined();
	expect(readiness.animating).toBe(false);
});

test('replacement resets readiness and a dock can defer optional resources', () => {
	const readiness = new PresentationReadiness();
	readiness.attach({ backgroundState: 'ready', highState: 'ready' } as SpatialElementPreparation);
	expect(readiness.freeze(false, false)).toBe('synchronous');
	readiness.markApplied();
	readiness.reset(true);
	expect(readiness.backgroundApplied).toBe(false);
	expect(readiness.entry).toBeUndefined();
	expect(readiness.deferred).toBe(true);
	expect(readiness.freeze(true, false)).toBe('synchronous');
});
