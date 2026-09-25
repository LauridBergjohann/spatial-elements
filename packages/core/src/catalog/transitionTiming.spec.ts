import { expect, it } from 'vitest';
import { transitionTiming } from './transitionTiming.js';
import { PreparationGate } from './PreparationGate.js';

it('reveals a prepared background during motion even while High is unavailable', () => {
	let previous = 0;
	for (let time = 0; time <= 1200; time += 10) {
		const timing = transitionTiming(time, 'asynchronous', true);
		expect(timing.background).toBe(transitionTiming(time, 'synchronous').background);
		expect(timing.background).toBeGreaterThanOrEqual(previous);
		if (time < 400) expect(timing.geometry).toBe(0);
		if (time >= 400) expect(timing.background).toBe(1);
		previous = timing.background;
	}
});

it('shares the complete motion path while keeping unprepared reveals behind the final pose', () => {
	expect(transitionTiming(200, 'synchronous').motion).toBe(0.75);
	for (const time of [0, 70, 140, 250, 399]) {
		const warm = transitionTiming(time, 'synchronous');
		const cold = transitionTiming(time, 'asynchronous');
		expect(cold.motion).toBe(warm.motion);
		expect([cold.enter, cold.background, cold.geometry]).toEqual([0, 0, 0]);
	}
	for (const [time, expected] of [
		[0, 0],
		[100, 0.1464466094],
		[200, 0.5],
		[300, 0.8535533906]
	]) {
		const warm = transitionTiming(time, 'synchronous');
		expect(warm.enter).toBeCloseTo(expected, 8);
		expect(warm.background).toBe(warm.enter);
		expect(warm.geometry).toBe(warm.enter);
		expect(warm.complete).toBe(false);
	}
	expect(transitionTiming(400, 'synchronous')).toMatchObject({
		motion: 1,
		enter: 1,
		geometry: 1,
		complete: true
	});
	for (const [time, expected] of [
		[400, 0],
		[475, 0.1464466094],
		[550, 0.5],
		[625, 0.8535533906]
	]) {
		const cold = transitionTiming(time, 'asynchronous');
		expect(cold.motion).toBe(1);
		expect(cold.enter).toBeCloseTo(expected, 8);
		expect(cold.background).toBe(cold.enter);
		expect(cold.geometry).toBe(cold.enter);
		expect(cold.complete).toBe(false);
	}
	expect(transitionTiming(700, 'asynchronous')).toMatchObject({
		enter: 1,
		background: 1,
		geometry: 1,
		complete: true
	});
});

it('does not resume expensive work until motion releases it and discards cancelled waiters', async () => {
	const gate = new PreparationGate();
	gate.setPaused(true);
	const controller = new AbortController();
	const cancelled = gate.wait(controller.signal);
	const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
	let applied = false;
	const active = gate.wait().then(() => {
		applied = true;
	});
	controller.abort();
	await rejected;
	await Promise.resolve();
	expect(applied).toBe(false);
	gate.setPaused(false);
	await active;
	expect(applied).toBe(true);
});
