import { expect, test } from 'vitest';
import { DetailWheelGesture } from './DetailWheelGesture.js';

test('a document wheel burst keeps scrolling when geometry moves underneath the pointer', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, false, true, true)).toBe('scroll');
	expect(gesture.resolve(400, true, true, true)).toBe('scroll');
	expect(gesture.resolve(899, true, false, true)).toBe('scroll');
	expect(gesture.resolve(1399, true, false, true)).toBe('zoom');
});

test('overview scrolls down unless the same burst was zooming out', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, true, true, true)).toBe('scroll');
	expect(gesture.resolve(500, true, false, true)).toBe('zoom');
	expect(gesture.resolve(600, true, true, false, false, true)).toBe('zoom');
	expect(gesture.resolve(900, true, true, true)).toBe('zoom');
	expect(gesture.resolve(1399, false, true, true)).toBe('zoom');
	expect(gesture.resolve(1899, false, true, true)).toBe('scroll');
});

test('a shallow zoom yields immediately on leaving the silhouette', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, true, false, true)).toBe('zoom');
	expect(gesture.resolve(20, false, true, false)).toBe('scroll');
	expect(gesture.resolve(40, true, true, false)).toBe('scroll');
	expect(gesture.resolve(540, true, false, false)).toBe('zoom');
});

test('pinch explicitly claims zoom even during a document scroll burst', () => {
	const gesture = new DetailWheelGesture();
	gesture.resolve(0, false, true, true);
	expect(gesture.resolve(20, true, false, true, true)).toBe('zoom');
	gesture.reset();
	expect(gesture.resolve(30, true, true, true)).toBe('scroll');
});
