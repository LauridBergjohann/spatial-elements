import { expect, test } from 'vitest';
import { TrackpadGesture } from './TrackpadGesture.js';

const sample = (deltaY: number, deltaX = 0, ctrlKey = false) =>
	({ deltaX, deltaY, ctrlKey, shiftKey: false, deltaMode: 0 });
function pinch(detector: TrackpadGesture) {
	for (const [i, y] of [-1.2, -2.4, -3.1, -2.6].entries())
		expect(detector.resolve(i * 16, sample(y, 0, true), false)).toBe('pinch');
}

test.each([false, true])('ambiguous input never starts panning (immersive=%s)', immersive => {
	const detector = new TrackpadGesture();
	for (const [i, y] of [12, 12, 12, 12, 12].entries())
		expect(detector.resolve(i * 16, sample(y), immersive)).toBe('wheel');
	expect(detector.resolve(600, sample(12, 8), immersive)).toBe('wheel');
});

test('a single small Ctrl-wheel event does not classify the next gesture', () => {
	const detector = new TrackpadGesture();
	expect(detector.resolve(0, sample(-1, 0, true), false)).toBe('pinch');
	expect(detector.resolve(16, sample(8, 4), true)).toBe('wheel');
});

test('confirmed trackpad scrolls before immersion and pans after, while pinch always zooms', () => {
	const detector = new TrackpadGesture();
	pinch(detector);
	expect(detector.resolve(64, sample(8), false)).toBe('scroll');
	expect(detector.resolve(80, sample(9, 3), true)).toBe('scroll');
	expect(detector.resolve(500, sample(8), true)).toBe('pan');
	expect(detector.resolve(516, sample(9), false)).toBe('pan');
	expect(detector.resolve(532, sample(2.1, 0, true), true)).toBe('pinch');
	expect(detector.resolve(548, sample(9), false)).toBe('scroll');
});

test('evidence never changes a running wheel zoom into panning, even when panels clear', () => {
	const detector = new TrackpadGesture();
	for (const [i, y] of [8.2, 9.4, 10.8, 11.6, 9.5].entries())
		expect(detector.resolve(i * 16, sample(y, y / 2), i > 1)).toBe('wheel');
	expect(detector.resolve(700, sample(9.5, 4.2), true)).toBe('pan');
});

test('vertical fractional scroll can establish confidence without horizontal drift', () => {
	const detector = new TrackpadGesture();
	for (const [i, y] of [8.2, 9.4, 10.8, 11.6].entries()) detector.resolve(i * 16, sample(y), false);
	expect(detector.resolve(500, sample(8.5), false)).toBe('scroll');
});

test.each([{ deltaMode: 1 }, { deltaMode: 2 }, { deltaY: 120 }, { shiftKey: true }])(
	'mouse evidence overrides recent trackpad use: %j', override => {
		const detector = new TrackpadGesture();
		pinch(detector);
		expect(detector.resolve(64, sample(8), true)).toBe('pan');
		expect(detector.resolve(80, { ...sample(8), ...override }, true)).toBe('wheel');
		expect(detector.resolve(500, sample(8), true)).toBe('wheel');
	});

test('slow or regular mouse notches do not confirm a trackpad', () => {
	for (const gap of [16, 120]) {
		const detector = new TrackpadGesture();
		for (let i = 0; i < 8; i++) detector.resolve(i * gap, sample(gap === 16 ? 12 : 8.2 + i), false);
		expect(detector.resolve(2000, sample(8), true)).toBe('wheel');
	}
});

test('native inertia keeps its original action even across a long event gap', () => {
	const detector = new TrackpadGesture();
	pinch(detector);
	expect(detector.resolve(64, sample(8), false)).toBe('scroll');
	expect(detector.resolve(800, { ...sample(2), momentum: true }, true)).toBe('scroll');
	expect(detector.resolve(816, { ...sample(8), momentum: false }, true)).toBe('pan');
});

test('old confidence and released page state do not permanently classify a device', () => {
	const detector = new TrackpadGesture();
	pinch(detector);
	expect(detector.resolve(31_000, sample(8), true)).toBe('wheel');
	pinch(detector);
	detector.reset();
	expect(detector.resolve(64, sample(8), true)).toBe('wheel');
});
