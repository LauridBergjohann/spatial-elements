import { expect, test } from 'vitest';
import { DetailWheelGesture } from './DetailWheelGesture.js';

test('a document wheel burst keeps scrolling when geometry moves underneath the pointer', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, false, true, true)).toBe('scroll');
	expect(gesture.resolve(200, true, true, true)).toBe('scroll');
	expect(gesture.resolve(519, true, false, true)).toBe('scroll');
	expect(gesture.resolve(839, true, false, true)).toBe('zoom');
});

test('overview scrolls down unless the same burst was zooming out', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, true, true, true)).toBe('scroll');
	expect(gesture.resolve(320, true, false, true)).toBe('zoom');
	expect(gesture.resolve(420, true, true, false, false, true)).toBe('zoom');
	expect(gesture.resolve(720, true, true, true)).toBe('zoom');
	expect(gesture.resolve(1039, false, true, true)).toBe('zoom');
	expect(gesture.resolve(1359, false, true, true)).toBe('scroll');
});

test('a shallow zoom yields immediately on leaving the silhouette', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, true, false, true)).toBe('zoom');
	expect(gesture.resolve(20, false, true, false)).toBe('scroll');
	expect(gesture.resolve(40, true, true, false)).toBe('scroll');
	expect(gesture.resolve(360, true, false, false)).toBe('zoom');
});

test('pinch explicitly claims zoom even during a document scroll burst', () => {
	const gesture = new DetailWheelGesture();
	gesture.resolve(0, false, true, true);
	expect(gesture.resolve(20, true, false, true, true)).toBe('zoom');
	gesture.reset();
	expect(gesture.resolve(30, true, true, true)).toBe('scroll');
});
