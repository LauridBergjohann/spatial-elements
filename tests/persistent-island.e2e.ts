import { expect, test } from '@playwright/test';

test('SPA entry mounts once when there is no server island to hydrate', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/proof/island-entry');
	await expect(page.locator('[data-island-entry-ready]')).toHaveAttribute('data-island-entry-ready', 'true');
	await page.getByRole('link', { name: 'Enter island layout' }).click();
	await expect(page.locator('[data-island-proof]')).toHaveAttribute('data-phase', 'settled');
	await expect(page.locator('[data-live-island]')).toHaveCount(1);
	await page.getByRole('button', { name: 'Add one' }).click();
	await expect(page.locator('[data-island-quantity]')).toHaveText('2');
	expect(await page.evaluate(() => window.__islandProof)).toMatchObject({ mounts: 1, destroys: 0, hydrations: 0 });
	expect(errors).toEqual([]);
});

test('server node, live component, context and parent snippet survive native route-slot handoff', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => { if (message.type() === 'warning' && /hydrat|snippet/i.test(message.text())) errors.push(message.text()); });
	await page.addInitScript(() => {
		const observer = new MutationObserver(() => {
			const panel = document.querySelector('[data-live-island]');
			if (panel && !(window as any).__serverIsland) { (window as any).__serverIsland = panel; observer.disconnect(); }
		});
		observer.observe(document, { childList: true, subtree: true });
	});
	await page.goto('/proof/persistent-island/source?hold=1');
	await expect(page.locator('[data-island-proof]')).toHaveAttribute('data-phase', 'settled');
	expect(await page.evaluate(() => (window as any).__serverIsland === document.querySelector('[data-live-island]'))).toBe(true);
	const original = await page.locator('[data-live-island]').elementHandle();
	await expect(page.locator('[data-brand-context]')).toHaveText('Brand context from persistent layout');
	await page.getByLabel('Engraving').fill('Actual retained input');
	await page.getByRole('button', { name: 'Add one' }).click();
	const afterSourceTop = (await page.locator('[data-after-island]').boundingBox())!.y;
	await page.getByRole('link', { name: 'Detail', exact: true }).click();
	await expect(page.locator('[data-island-proof]')).toHaveAttribute('data-phase', 'motion');
	await expect(page.locator('[data-island-projection] [data-live-island]')).toHaveCount(1);
	await expect(page.locator('[data-island-root]')).toHaveCSS('width', '320px');
	expect((await page.locator('[data-after-island]').boundingBox())!.y).toBe(afterSourceTop);
	await page.getByRole('button', { name: 'Finish motion' }).click();
	await expect(page.getByRole('heading', { name: 'Detail native flow' })).toBeVisible();
	await expect(page.locator('[data-native-island-slot="target"] [data-live-island]')).toHaveCount(1);
	expect(await original!.evaluate(node => node === document.querySelector('[data-live-island]'))).toBe(true);
	await expect(page.getByLabel('Engraving')).toHaveValue('Actual retained input');
	await expect(page.locator('[data-island-quantity]')).toHaveText('2');
	await page.getByRole('button', { name: 'Add one' }).click();
	await expect(page.locator('[data-island-quantity]')).toHaveText('3');
	await page.getByRole('button', { name: 'Update persistent host' }).click();
	await expect(page.locator('[data-host-label]')).toHaveText('Updated host label');
	await expect(page.locator('[data-island-extra]')).toBeVisible();
	await expect(page.locator('[data-live-island]')).toHaveCSS('border-top-width', '3px');
	await expect(page.locator('[data-island-root]')).toHaveCSS('width', '640px');
	const nativeFlow = await page.evaluate(() => {
		const panel = document.querySelector('[data-live-island]')!.getBoundingClientRect();
		const slot = document.querySelector('[data-native-island-slot]')!.getBoundingClientRect();
		const after = document.querySelector('[data-after-island]')!.getBoundingClientRect();
		return { panelHeight: panel.height, slotHeight: slot.height, bottom: panel.bottom, after: after.top };
	});
	expect(nativeFlow.slotHeight).toBe(nativeFlow.panelHeight);
	expect(nativeFlow.after).toBeGreaterThanOrEqual(nativeFlow.bottom);
	await page.getByRole('link', { name: 'Wide detail', exact: true }).click();
	await page.getByRole('button', { name: 'Finish motion' }).click();
	await expect(page.locator('[data-native-island-slot="wide"] [data-live-island]')).toHaveCount(1);
	expect(await page.locator('[data-island-fields]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(3);
	await expect(page.locator('[data-live-island]')).toHaveCount(1);
	expect(await page.evaluate(() => window.__islandProof)).toMatchObject({ mounts: 1, destroys: 0, hydrations: 1, routeMounts: 3, routeDestroys: 2 });
	await page.getByRole('link', { name: 'Leave proof' }).click();
	await expect(page.getByRole('heading', { name: 'Presentation owner destroyed' })).toBeVisible();
	expect(await page.evaluate(() => window.__islandProof)).toMatchObject({ mounts: 1, destroys: 1, hydrations: 1 });
	expect(errors).toEqual([]);
});

for (const [slot, width, columns] of [['source', 320, 1], ['target', 640, 2], ['wide', 960, 3]] as const) {
	test(`direct ${slot} is intrinsically laid out before JavaScript and hydrates the same content`, async ({ browser, baseURL, request }) => {
		const response = await request.get(`/proof/persistent-island/${slot}`);
		expect(response.ok()).toBe(true);
		const html = await response.text();
		expect(html.match(/data-live-island/g)).toHaveLength(1);
		expect(html).toContain(`data-merged-slot="${slot}"`);
		for (const javaScriptEnabled of [false, true]) {
			const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 1440, height: 900 } });
			try {
				const page = await context.newPage();
				await page.goto(`/proof/persistent-island/${slot}`);
				if (javaScriptEnabled) await expect(page.locator('[data-island-proof]')).toHaveAttribute('data-phase', 'settled');
				await expect(page.getByLabel('Engraving')).toHaveCount(1);
				await expect(page.locator('[data-island-root]')).toHaveCSS('width', `${width}px`);
				await expect(page.locator('[data-live-island]')).toHaveCSS('border-top-width', '3px');
				expect(await page.locator('[data-island-fields]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(columns);
				const rects = await page.evaluate(() => [...document.querySelectorAll('[data-before-island],[data-live-island],[data-after-island]')].map(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom })));
				expect(rects[0].bottom).toBeLessThanOrEqual(rects[1].top);
				expect(rects[1].bottom).toBeLessThanOrEqual(rects[2].top);
			} finally { await context.close(); }
		}
	});
}
