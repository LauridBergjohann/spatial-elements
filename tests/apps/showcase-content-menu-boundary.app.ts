import { expect, test } from '@playwright/test';

for (const width of [390, 1920, 2456])
	for (const detached of [false, true]) {
		for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
			const javaScriptEnabled = true;
			test(`content menu ends with sections at ${width}px, detached=${detached}, enhanced=${enhanced}`, async ({
				browser,
				baseURL
			}, info) => {
				const context = await browser.newContext({
					baseURL,
					javaScriptEnabled,
					viewport: { width, height: 900 }
				});
				const page = await context.newPage();
				if (!enhanced)
					await page.addInitScript(() =>
						Object.defineProperty(navigator, 'gpu', { value: undefined })
					);
				await page.goto('/docs/');
				await expect(page.locator('.stage')).toHaveAttribute(
					'data-stage-state',
					enhanced ? 'enhanced' : 'fallback',
					{ timeout: 60000 }
				);
				if (javaScriptEnabled) await expect(page.locator('.mobile-search')).toBeAttached();
				if (detached)
					await page
						.locator('main .ps-section')
						.first()
						.evaluate((node) => node.setAttribute('data-background-color', 'transparent'));
				const body = page.locator('main .page-body');
				const menu = page.locator(
					width < 1600 ? '.ps-content-menu-slot summary' : '.ps-content-menu-slot > .desktop'
				);
				const initialBody = (await body.boundingBox())!;
				const initialMenu = (await menu.boundingBox())!;
				const inset = width < 1600 ? 12 : 16;
				const gap = width < 1600 || detached ? 0 : 16;
				if (width >= 1600)
					await expect(page.locator('.ps-content-menu-slot')).toHaveCSS(
						'padding-bottom',
						`${gap}px`
					);
				const end = initialBody.y + initialBody.height;
				const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
				for (const y of [200, end - initialMenu.height - gap - inset + 40, end + 40, 0]) {
					await page.evaluate(
						(y) => scrollTo({ top: y, behavior: 'instant' }),
						Math.max(0, Math.min(y, max))
					);
					await expect
						.poll(async () => {
							const b = (await body.boundingBox())!,
								m = (await menu.boundingBox())!;
							const naturalTop = initialMenu.y + b.y - initialBody.y;
							const expected = Math.min(
								Math.max(inset, naturalTop),
								b.y + b.height - gap - m.height
							);
							return Math.abs(m.y - expected);
						})
						.toBeLessThan(1.5);
					if (y > end) {
						await expect
							.poll(async () => {
								const b = (await body.boundingBox())!,
									m = (await menu.boundingBox())!;
								return m.y + m.height + gap - b.y - b.height;
							})
							.toBeLessThanOrEqual(1);
						await page.screenshot({ path: info.outputPath('content-end.png') });
					}
				}
				await context.close();
			});
		}
	}
