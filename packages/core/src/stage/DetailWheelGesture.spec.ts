import { expect, test } from 'vitest';
import { DetailWheelGesture } from './DetailWheelGesture.js';

test('a document wheel burst keeps scrolling when geometry moves underneath the pointer', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, false, true, true)).toBe('scroll');
	expect(gesture.resolve(200, true, true, true)).toBe('scroll');
	expect(gesture.resolve(579, true, false, true)).toBe('scroll');
	expect(gesture.resolve(959, true, false, true)).toBe('zoom');
});

test('overview scrolls down unless the same burst was zooming out', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, true, true, true)).toBe('scroll');
	expect(gesture.resolve(380, true, false, true)).toBe('zoom');
	expect(gesture.resolve(480, true, true, false, false, true)).toBe('zoom');
	expect(gesture.resolve(780, true, true, true)).toBe('zoom');
	expect(gesture.resolve(1159, false, true, true)).toBe('zoom');
	expect(gesture.resolve(1539, false, true, true)).toBe('scroll');
});

test('a shallow zoom yields immediately on leaving the silhouette', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, true, false, true)).toBe('zoom');
	expect(gesture.resolve(20, false, true, false)).toBe('scroll');
	expect(gesture.resolve(40, true, true, false)).toBe('scroll');
	expect(gesture.resolve(420, true, false, false)).toBe('zoom');
});

test('pinch explicitly claims zoom even during a document scroll burst', () => {
	const gesture = new DetailWheelGesture();
	gesture.resolve(0, false, true, true);
	expect(gesture.resolve(20, true, false, true, true)).toBe('zoom');
	gesture.reset();
	expect(gesture.resolve(30, true, true, true)).toBe('scroll');
});

test('native inertia cannot prolong the lock against a new physical gesture', () => {
	const gesture = new DetailWheelGesture();
	const sample = (momentum: boolean) => ({ deltaX: 0, deltaY: 4, deltaMode: 0, momentum });
	gesture.resolve(0, true, true, false, false, true, sample(false));
	for (const time of [20, 200, 400, 800, 1200])
		expect(gesture.resolve(time, false, true, true, false, false, sample(true))).toBe('zoom');
	expect(gesture.resolve(1210, true, true, true, false, false, sample(false))).toBe('scroll');
	gesture.resolve(1220, false, true, true, false, false, sample(true));
	expect(gesture.resolve(1230, true, false, true, false, false, sample(false))).toBe('zoom');
});

test.each([30, -2])('fallback recognizes a fresh impulse (%s) after a declining tail', delta => {
	const gesture = new DetailWheelGesture();
	const sample = (deltaY: number) => ({ deltaX: 0, deltaY, deltaMode: 0 });
	gesture.resolve(0, true, true, false, false, true, sample(50));
	for (const [i, value] of [40, 30, 20, 12, 8, 4, 2, 1].entries())
		expect(gesture.resolve(16 * (i + 1), false, true, true, false, false, sample(value))).toBe('zoom');
	expect(gesture.resolve(145, false, delta > 0, true, false, false, sample(delta))).toBe('scroll');
});

test('regular wheel notches and slowing physical input keep the current burst', () => {
	const gesture = new DetailWheelGesture();
	gesture.resolve(0, false, true, false);
	for (let time = 20; time < 1200; time += 20)
		expect(gesture.resolve(time, true, false, false, false, false,
			{ deltaX: 0, deltaY: -100, deltaMode: 0 })).toBe('scroll');
	for (const [i, deltaY] of [-80, -60, -40, -20, -10, -100].entries())
		expect(gesture.resolve(1200 + i * 20, true, false, false, false, false,
			{ deltaX: 0, deltaY, deltaMode: 0, momentum: false })).toBe('scroll');
});

test('inertia outside a shallow zoom still yields to the document immediately', () => {
	const gesture = new DetailWheelGesture();
	gesture.resolve(0, true, false, false, false, false, { deltaX: 0, deltaY: -20, deltaMode: 0, momentum: false });
	expect(gesture.resolve(20, false, false, false, false, false,
		{ deltaX: 0, deltaY: -10, deltaMode: 0, momentum: true })).toBe('scroll');
});
