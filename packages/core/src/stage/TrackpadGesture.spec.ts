import { expect, test } from 'vitest';
import { TrackpadGesture } from './TrackpadGesture.js';

const sample = (deltaY: number, deltaX = 0, ctrlKey = false) =>
	({ deltaX, deltaY, ctrlKey, shiftKey: false, deltaMode: 0 });

test.each([false, true])('vertical gestures retain wheel navigation without learning a device (pan eligible=%s)', eligible => {
	const gesture = new TrackpadGesture();
	for (let burst = 0; burst < 4; burst++) {
		for (const [i, y] of [8.2, 9.4, 10.8, 11.6, -12].entries())
			expect(gesture.resolve(burst * 500 + i * 16, sample(y, y / 2), eligible)).toBe('wheel');
	}
});

test.each([1, -1])('a horizontal start pans both axes for the entire gesture (direction=%s)', sign => {
	const gesture = new TrackpadGesture();
	expect(gesture.resolve(0, sample(4, 16 * sign), true)).toBe('pan');
	expect(gesture.resolve(16, sample(20, 0), true)).toBe('pan');
	expect(gesture.resolve(32, sample(-20, -10), true)).toBe('pan');
	expect(gesture.resolve(48, sample(0, -8), true)).toBe('pan');
	// A new vertical gesture restores wheel zoom, including zoom-out.
	expect(gesture.resolve(428, sample(12), true)).toBe('wheel');
});

test.each([[1, 0.2], [8, 12], [8, 16], [12, 2]])('vertical or ambiguous starts never turn into pan later (%j)', (y, x) => {
	const gesture = new TrackpadGesture();
	expect(gesture.resolve(0, sample(y, x), true)).toBe('wheel');
	expect(gesture.resolve(16, sample(2, 20), true)).toBe('wheel');
});

test('a slowly starting horizontal gesture chooses pan without a device-dependent pixel threshold', () => {
	const gesture = new TrackpadGesture();
	expect(gesture.resolve(0, sample(0.1, 0.4), true)).toBe('pan');
	expect(gesture.resolve(16, sample(8), true)).toBe('pan');
});

test('a gesture starting with visible panels or outside the stage cannot acquire pan on entering it', () => {
	const gesture = new TrackpadGesture();
	expect(gesture.resolve(0, sample(2, 20), false)).toBe('wheel');
	expect(gesture.resolve(16, sample(2, 20), true)).toBe('wheel');
	expect(gesture.resolve(396, sample(2, 20), true)).toBe('pan');
});

test('pinch always interrupts pan or wheel, without affecting later vertical gestures', () => {
	const gesture = new TrackpadGesture();
	expect(gesture.resolve(0, sample(2, 20), true)).toBe('pan');
	expect(gesture.resolve(16, sample(-2, 0, true), true)).toBe('pinch');
	expect(gesture.resolve(32, sample(2, 0, true), false)).toBe('pinch');
	expect(gesture.resolve(48, sample(-8), true)).toBe('wheel');
	expect(gesture.resolve(64, sample(2, 0, true), true)).toBe('pinch');
	expect(gesture.resolve(80, sample(2, 20), true)).toBe('pan');
});

test.each([{ deltaMode: 1 }, { deltaMode: 2 }, { shiftKey: true }])(
	'line/page and shifted wheel starts retain normal navigation: %j', override => {
		const gesture = new TrackpadGesture();
		expect(gesture.resolve(0, { ...sample(2, 20), ...override }, true)).toBe('wheel');
	});

test('native inertia keeps its action across a long gap, fresh physical input chooses again', () => {
	const gesture = new TrackpadGesture();
	expect(gesture.resolve(0, sample(2, 20), true)).toBe('pan');
	expect(gesture.resolve(800, { ...sample(2), momentum: true }, true)).toBe('pan');
	expect(gesture.resolve(816, { ...sample(8), momentum: false }, true)).toBe('wheel');
	expect(gesture.resolve(1600, { ...sample(1, 4), momentum: true }, true)).toBe('wheel');
	expect(gesture.resolve(1616, { ...sample(2, 20), momentum: false }, true)).toBe('pan');
});

test('empty samples neither choose a direction nor prolong the current gesture', () => {
	const gesture = new TrackpadGesture();
	gesture.resolve(0, sample(0), true);
	expect(gesture.resolve(16, sample(2, 20), true)).toBe('pan');
	gesture.resolve(300, sample(0), true);
	expect(gesture.resolve(396, sample(8), true)).toBe('wheel');
});

test('releasing the page clears the pan gesture', () => {
	const gesture = new TrackpadGesture();
	expect(gesture.resolve(0, sample(2, 20), true)).toBe('pan');
	gesture.reset();
	expect(gesture.resolve(16, sample(8), true)).toBe('wheel');
});
