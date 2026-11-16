import { expect, test } from 'vitest';
import { DetailWheelGesture } from './DetailWheelGesture.js';

test('a document wheel burst keeps scrolling when geometry moves underneath the pointer', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, false, true, true)).toBe('scroll');
	expect(gesture.resolve(600, true, true, true)).toBe('scroll');
	expect(gesture.resolve(1200, true, false, true)).toBe('scroll');
	expect(gesture.resolve(2000, true, false, true)).toBe('zoom');
});

test('overview scrolls down unless the same burst was zooming out', () => {
	const gesture = new DetailWheelGesture();
	expect(gesture.resolve(0, true, true, true)).toBe('scroll');
	expect(gesture.resolve(800, true, false, true)).toBe('zoom');
	expect(gesture.resolve(900, true, true, false)).toBe('zoom');
	expect(gesture.resolve(1200, true, true, true)).toBe('zoom');
	expect(gesture.resolve(1900, true, true, true)).toBe('zoom');
	expect(gesture.resolve(2700, true, true, true)).toBe('scroll');
});

test('pinch explicitly claims zoom even during a document scroll burst', () => {
	const gesture = new DetailWheelGesture();
	gesture.resolve(0, false, true, true);
	expect(gesture.resolve(20, true, false, true, true)).toBe('zoom');
	gesture.reset();
	expect(gesture.resolve(30, true, true, true)).toBe('scroll');
});
