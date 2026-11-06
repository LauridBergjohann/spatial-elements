import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const destination of ['hero', 'dock']) for (const activation of ['pointer', 'keyboard']) {
	test(`${destination} preserves a mid-${activation === 'pointer' ? 'hover' : 'focus'} card appearance through focus loss and cancellation`, async ({ page }, testInfo) => {
		let release!: () => void;
		let blockedRequests = 0;
		const blocked = new Promise<void>(resolve => { release = resolve; });
		await page.route('**/elements/*/__data.json*', async route => {
			const response = await route.fetch(); blockedRequests++; await blocked;
			await route.fulfill({ response }).catch(() => {});
		});
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		const brand = 'staged';
		try {
			await page.goto(`/${brand}/categories/list?stage-test=1&stagedNavigation=1`);
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
			await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
			const link = page.locator('[data-catalog-card][data-spatial-element-id="column"]').first();
			if (destination === 'hero') await link.evaluate((node: HTMLAnchorElement) => {
				// Both variants need the server fixture, so the request can genuinely
				// remain uncommitted. Its hashless variant declares the Hero endpoint.
				const url = new URL(node.href); url.hash = ''; node.href = url.href;
				node.dataset.catalogView = JSON.stringify({ ...JSON.parse(node.dataset.catalogView!), targetPresentation: 'hero' });
			});
			await link.evaluate((card, destination) => {
				const root = document.querySelector<HTMLElement>('.stage')!;
				const surface = card.querySelector<HTMLElement>('.spatial-element-card-surface')!;
				const title = card.querySelector<HTMLElement>('[data-shared-role="title"]')!;
				const eyebrow = card.querySelector<HTMLElement>('[data-shared-role="eyebrow"]');
				const poster = card.querySelector<HTMLElement>('[data-catalog-poster]');
				const nodes = [card, surface, title, eyebrow, poster].filter((node): node is HTMLElement => Boolean(node));
				const properties = ['transform', 'text-shadow', 'outline-color', 'outline-style', 'outline-width', 'outline-offset',
					'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
					'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'transition-behavior',
					'--spatial-card-frozen-after-opacity'];
				const inline = () => nodes.map(node => properties.map(name => [name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]));
				const original = inline();
				const paint = () => ({ titleShadow: getComputedStyle(title).textShadow,
					eyebrowShadow: eyebrow ? getComputedStyle(eyebrow).textShadow : null,
					titleTransform: destination === 'hero' ? getComputedStyle(title).transform : null,
					eyebrowTransform: destination === 'hero' && eyebrow ? getComputedStyle(eyebrow).transform : null,
					border: getComputedStyle(surface).borderColor, glow: getComputedStyle(surface, '::after').opacity,
					posterTransform: poster ? getComputedStyle(poster).transform : null,
					posterOpacity: poster ? getComputedStyle(poster).opacity : null,
					outline: [getComputedStyle(card).outlineColor, getComputedStyle(card).outlineStyle,
						getComputedStyle(card).outlineWidth, getComputedStyle(card).outlineOffset] });
				const frames: { phase: string; paint: ReturnType<typeof paint>; focused: boolean; hover: boolean }[] = [];
				let stopped = false;
				const sample = () => {
					const phase = root.dataset.catalogStagedPhase;
					if (phase && surface.hasAttribute('data-spatial-card-appearance-frozen')) {
						frames.push({ phase, paint: paint(), focused: document.activeElement === card, hover: card.hasAttribute('data-mouse-hover') });
					}
					if (!stopped) requestAnimationFrame(sample);
				};
				requestAnimationFrame(sample);
				Object.assign(window, { cardAppearanceProbe: { frames, original, inline, card, surface,
					stop() { stopped = true; } } });
			}, destination);
			if (activation === 'pointer') {
				const rect = (await link.boundingBox())!;
				await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
			} else {
				await page.keyboard.press('Tab');
				await link.focus();
				expect(await link.evaluate(node => node.matches(':focus-visible'))).toBe(true);
			}
			// Real CSS transition, deliberately before its 260ms endpoint; no test CSS.
			await page.waitForTimeout(40);
			const before = await link.evaluate(card => ({ depth: new DOMMatrix(getComputedStyle(card.querySelector('[data-shared-role="title"]')!).transform).m43,
				hover: card.hasAttribute('data-mouse-hover'), focused: document.activeElement === card }));
			expect(before.depth).toBeGreaterThan(0);
			expect(before.depth).toBeLessThan(64);
			if (activation === 'pointer') { await page.mouse.down(); await page.mouse.up(); }
			else await page.keyboard.press('Enter');
			await page.mouse.move(2, 2);
			await expect(page.locator('.stage')).toHaveAttribute('data-catalog-staged-phase', 'held');
			await expect.poll(() => blockedRequests).toBeGreaterThan(0);
			await expect(page.locator('[data-spatial-element-root]')).toHaveCount(0);
			await page.evaluate(() => {
				const probe = (window as any).cardAppearanceProbe;
				probe.card.blur();
			});
			await page.waitForTimeout(80);
			const held = await page.evaluate(() => {
				const probe = (window as any).cardAppearanceProbe;
				return { frames: probe.frames, frozen: probe.surface.hasAttribute('data-spatial-card-appearance-frozen') };
			});
			expect(held.frozen).toBe(true);
			expect(held.frames.filter((frame: any) => frame.phase === 'moving').length).toBeGreaterThan(1);
			expect(held.frames.filter((frame: any) => frame.phase === 'held').length).toBeGreaterThan(1);
			for (const frame of held.frames) expect(frame.paint).toEqual(held.frames[0].paint);
			expect(held.frames.some((frame: any) => !frame.focused && !frame.hover)).toBe(true);
			await page.keyboard.press('Escape');
			await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
			await expect(page).toHaveURL(/\/staged\/categories\/list\?/);
			const after = await page.evaluate(() => {
				const probe = (window as any).cardAppearanceProbe; probe.stop();
				return { inline: probe.inline(), original: probe.original,
					connected: probe.card.isConnected, frozen: probe.surface.hasAttribute('data-spatial-card-appearance-frozen') };
			});
			expect(after.connected).toBe(true);
			expect(after.frozen).toBe(false);
			expect(after.inline).toEqual(after.original);
			expect(errors).toEqual([]);
			const path = testInfo.outputPath('appearance-frames.json');
			await writeFile(path, JSON.stringify({ before, held, after }, null, 2));
			await testInfo.attach('appearance-frames', { path, contentType: 'application/json' });
		} finally { release(); }
	});
}
