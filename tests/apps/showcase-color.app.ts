import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test('GPU theme colors match CSS in direct and captured output', async ({ page }) => {
	test.skip(!process.env.SPATIAL_GPU, 'Requires WebGPU');
	await page.goto('http://127.0.0.1:4174/color-output/');
	await expect(page.locator('[data-ready]')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
	const { data, info } = await sharp(await page.locator('[data-ready]').screenshot()).raw().toBuffer({ resolveWithObject: true });
	const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
	for (let i = 0; i < 6; i++) {
		const css = pixel(i * 64 + 32, 32);
		for (const y of [96, 160]) {
			const gpu = pixel(i * 64 + 32, y);
			expect(Math.max(...gpu.map((value, channel) => Math.abs(value - css[channel]))), `swatch ${i}, output ${y}: CSS ${css}, GPU ${gpu}`).toBeLessThanOrEqual(3);
		}
	}
});
