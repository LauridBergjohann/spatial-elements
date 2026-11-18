import { expect, test } from 'vitest';
import { carouselRenderClip } from './carouselRenderClip.js';
const surface = { left: 400, top: 500, width: 1536, height: 600 };
test('standard carousel surfaces can overflow across transparent and inset neighbours', () => {
	expect(carouselRenderClip(surface, [], 2400, -100, 3000, false))
		.toEqual({ left: 0, top: -100, width: 2400, height: 3100 });
});
test('nearest full backgrounds bound overflow, including after scrolling', () => {
	const backgrounds = [
		{ left: 0, top: -100, width: 2400, height: 100 },
		{ left: 0, top: 200, width: 2400, height: 150 },
		{ left: 0, top: 1500, width: 2400, height: 200 }
	];
	expect(carouselRenderClip(surface, backgrounds, 2400, -100, 3000, false))
		.toEqual({ left: 0, top: 350, width: 2400, height: 1150 });
	expect(carouselRenderClip(surface, backgrounds, 2400, -100, 3000, true)).toEqual(surface);
});
