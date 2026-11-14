import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
import sharp from 'sharp';

if (process.env.SPATIAL_GPU)
	test('detail tilt updates the main model and minimap after direct and grid entry', async ({
		page
	}) => {
		await page.addInitScript(() => {
			// Test sensor delivery independently of physical hardware and permission UI.
			Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
				configurable: true,
				value: async () => 'granted'
			});
		});
		for (const source of ['direct', 'grid']) {
			if (source === 'direct') await page.goto('/showcase/consumer/logitech-z407/?stage-test=1');
			else {
				await page.goto('/showcase/consumer/?stage-test=1');
				await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', {
					timeout: 60000
				});
				const card = page.locator('[data-catalog-card][data-spatial-element-id="logitech-z407"]');
				const box = (await card.boundingBox())!;
				await page.mouse.wheel(0, box.y + box.height / 2 - 450);
				await expect(card).toHaveAttribute('data-catalog-model-ready', '', { timeout: 60000 });
				await card.click();
				await expect(page).toHaveURL(/\/consumer\/logitech-z407\//);
			}
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', {
				timeout: 60000
			});
			await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
			await page.mouse.move(1800, 50);
			const emit = (tilt: number) =>
				page.evaluate(async (target) => {
					for (let index = 0; index < 36; index++) {
						// A real tilt is gradual. Abrupt jumps correctly recalibrate the travel filter.
						const beta = target * Math.min(1, index / 20);
						window.dispatchEvent(
							new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma: 0 })
						);
						await new Promise((resolve) => setTimeout(resolve, 25));
					}
				}, tilt);
			await emit(0);
			const neutral = await page.evaluate(() => window.__stageVisualTest!.getMinimapOrientation()!);
			await emit(20);
			const tilted = await page.evaluate(() => window.__stageVisualTest!.getMinimapOrientation()!);
			const distance = (a: number[], b: number[]) =>
				Math.min(
					Math.hypot(...a.map((value, index) => value - b[index])),
					Math.hypot(...a.map((value, index) => value + b[index]))
				);
			expect(distance(tilted.live, neutral.live)).toBeGreaterThan(0.015);
			expect(distance(tilted.display, neutral.display)).toBeGreaterThan(0.015);
		}
	});

if (process.env.SPATIAL_GPU)
	test('local driver access starts only after explicitly enabling SpaceMouse', async ({ page }) => {
		await page.addInitScript(() => {
			const requests: string[] = [];
			Object.assign(window, { localDriverRequests: requests });
			const open = XMLHttpRequest.prototype.open;
			XMLHttpRequest.prototype.open = function (...args: Parameters<typeof open>) {
				const address = new URL(String(args[1]), location.href);
				if (
					(address.hostname.startsWith('127.') || address.hostname === 'localhost') &&
					address.port === '8181'
				) {
					requests.push(address.href);
					throw new DOMException('Local driver intercepted by the test', 'NetworkError');
				}
				return Reflect.apply(open, this, args);
			};
		});
		await page.goto('/showcase/consumer/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', {
			timeout: 60000
		});
		await page.goto('/showcase/consumer/logitech-z407/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', {
			timeout: 60000
		});
		const requests = () =>
			page.evaluate(
				() => (window as unknown as { localDriverRequests: string[] }).localDriverRequests
			);
		expect(await requests()).toEqual([]);
		await page.getByRole('button', { name: '3D controls', exact: true }).click();
		await page.getByRole('button', { name: 'Enable SpaceMouse', exact: true }).click();
		await expect.poll(async () => (await requests()).length).toBe(1);
		await page.getByRole('button', { name: 'Disable SpaceMouse', exact: true }).click();
		await expect(
			page.getByRole('button', { name: 'Enable SpaceMouse', exact: true })
		).toHaveAttribute('aria-pressed', 'false');
	});

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
	test(`carousel frosted panels blur the external backdrop and keep theme opacity (enhanced: ${enhanced})`, async ({
		page
	}) => {
		if (!enhanced)
			await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.setViewportSize({ width: 1920, height: 1000 });
		await page.goto('/showcase/consumer/?stage-test=1');
		if (enhanced)
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', {
				timeout: 60000
			});
		const surface = page
			.locator('.carousel-spatial-element')
			.first()
			.locator('.spatial-summary-surface');
		await expect(surface).toBeVisible();
		await expect(page.locator('#new-products')).toHaveCSS('clip-path', 'none');
		await expect(surface).toHaveCSS('backdrop-filter', 'blur(16px)');
		const alpha = await surface.evaluate((node) =>
			Number.parseFloat(getComputedStyle(node).backgroundColor.split('/')[1] ?? '1')
		);
		expect(alpha).toBeCloseTo(0.8);
		const bounds = (await surface.boundingBox())!;
		await page.evaluate((box) => {
			const probe = document.createElement('div');
			Object.assign(probe.style, {
				position: 'fixed',
				left: box.x + 'px',
				top: box.y + 'px',
				width: box.width + 'px',
				height: box.height + 'px',
				zIndex: '2',
				pointerEvents: 'none',
				background: 'repeating-linear-gradient(90deg,black 0px,black 4px,white 4px,white 8px)'
			});
			document.querySelector('.stage')!.append(probe);
		}, bounds);
		const clip = { x: bounds.x + 32, y: bounds.y + 4, width: 128, height: 4 };
		const contrast = async () => {
			const { data, info } = await sharp(await page.screenshot({ clip }))
				.raw()
				.toBuffer({ resolveWithObject: true });
			let sum = 0;
			for (let y = 0; y < info.height; y++)
				for (let x = 1; x < info.width; x++) {
					const index = (y * info.width + x) * info.channels;
					sum += Math.abs(data[index] - data[index - info.channels]);
				}
			return sum / (info.width * info.height);
		};
		const blurred = await contrast();
		await surface.evaluate((node) => ((node as HTMLElement).style.backdropFilter = 'none'));
		const sharpContrast = await contrast();
		expect(sharpContrast).toBeGreaterThan(5);
		expect(blurred).toBeLessThan(sharpContrast * 0.25);
	});
}
