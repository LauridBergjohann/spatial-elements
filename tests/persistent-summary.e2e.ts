import { expect, test } from '@playwright/test';

test('real component and snippet survive route teardown, projection and content handoff', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/proof/persistent-summary/source?hold=1');
	await expect(page.locator('[data-proof-root]')).toHaveAttribute('data-hydrated', 'true');
	const original = await page.locator('[data-live-summary]').elementHandle();
	await page.getByLabel('Engraving').fill('Kept input');
	await page.getByLabel('Variant').selectOption('silver');
	await page.getByRole('button', { name: 'Add one' }).click();
	await page.getByRole('link', { name: 'Detail', exact: true }).click();
	await expect(page.locator('[data-presentation]')).toHaveAttribute('data-phase', 'motion');
	await expect(page.locator('[data-proof-projection] [data-live-summary]')).toHaveCount(1);
	await expect(page.locator('[data-proof-query]')).toHaveCSS('width', '320px');
	await expect(page.getByRole('heading', { name: 'Source route' })).toBeVisible();
	await page.getByRole('button', { name: 'Queue content and font update' }).click();
	await expect(page.locator('[data-late-content]')).toHaveCount(0);
	await page.getByRole('button', { name: 'Finish motion' }).click();
	await expect(page.getByRole('heading', { name: 'Detail route', exact: true })).toBeVisible();
	await expect(page.locator('[data-presentation]')).toHaveAttribute('data-phase', 'settled');
	expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
	expect(await original!.evaluate(node => node === document.querySelector('[data-live-summary]'))).toBe(true);
	await expect(page.locator('[data-live-summary]')).toHaveCount(1);
	await expect(page.getByLabel('Engraving')).toHaveValue('Kept input');
	await expect(page.getByLabel('Variant')).toHaveValue('silver');
	await expect(page.locator('[data-quantity]')).toHaveText('2');
	await expect(page.locator('[data-proof-query]')).toHaveCSS('width', '640px');
	await expect(page.locator('[data-late-content]')).toBeVisible();
	expect(await page.locator('[data-proof-fields]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(2);
	await page.getByRole('button', { name: 'Add one' }).click();
	await expect(page.locator('[data-reactive-description]')).toContainText('quantity 3');
	await page.getByRole('link', { name: 'Wide detail', exact: true }).click();
	await expect(page.locator('[data-proof-query]')).toHaveCSS('width', '640px');
	await page.getByRole('button', { name: 'Finish motion' }).click();
	await expect(page.locator('[data-proof-query]')).toHaveCSS('width', '960px');
	expect(await page.locator('[data-proof-fields]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(3);
	expect(await original!.evaluate(node => node === document.querySelector('[data-live-summary]'))).toBe(true);
	expect(await page.evaluate(() => window.__persistentSummaryProof)).toMatchObject({ mounts: 1, destroys: 0, leaseDisposals: 0, routeMounts: 3, routeDestroys: 2 });
	await page.getByRole('link', { name: 'Leave proof' }).click();
	await expect(page.getByRole('heading', { name: 'Presentation owner destroyed' })).toBeVisible();
	expect(await page.evaluate(() => window.__persistentSummaryProof)).toMatchObject({ mounts: 1, destroys: 1, leaseDisposals: 1 });
	expect(errors).toEqual([]);
});

test('a later navigation keeps the live owner when an earlier held navigation is superseded', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/proof/persistent-summary/source?hold=1');
	await expect(page.locator('[data-proof-root]')).toHaveAttribute('data-hydrated', 'true');
	const original = await page.locator('[data-live-summary]').elementHandle();
	await page.getByLabel('Engraving').fill('Latest owner');
	await page.getByRole('link', { name: 'Detail', exact: true }).click();
	await expect(page.locator('[data-presentation]')).toHaveAttribute('data-phase', 'motion');
	await page.getByRole('link', { name: 'Wide detail', exact: true }).click();
	await expect(page.locator('[data-presentation]')).toHaveAttribute('data-phase', 'motion');
	await expect(page.locator('[data-proof-query]')).toHaveCSS('width', '320px');
	await page.getByRole('button', { name: 'Finish motion' }).click();
	await expect(page.getByRole('heading', { name: 'Wide detail route', exact: true })).toBeVisible();
	await expect(page.locator('[data-presentation]')).toHaveAttribute('data-owner', 'wide');
	await expect(page.getByLabel('Engraving')).toHaveValue('Latest owner');
	expect(await original!.evaluate(node => node === document.querySelector('[data-live-summary]'))).toBe(true);
	expect(await page.evaluate(() => window.__persistentSummaryProof)).toMatchObject({ mounts: 1, destroys: 0, leaseDisposals: 0 });
	expect(errors).toEqual([]);
});

for (const [slot, width, columns] of [['source', 320, 1], ['target', 640, 2], ['wide', 960, 3]] as const) {
	test(`direct ${slot} has the same single semantic panel before and after hydration`, async ({ browser, baseURL, request }) => {
		const response = await request.get(`/proof/persistent-summary/${slot}`);
		const html = await response.text();
		expect(html).toContain('Orbit lamp');
		expect(html.match(/data-live-summary/g)).toHaveLength(1);
		for (const javaScriptEnabled of [false, true]) {
			const context = await browser.newContext({ baseURL, javaScriptEnabled });
			try {
				const page = await context.newPage();
				await page.goto(`/proof/persistent-summary/${slot}`);
				if (javaScriptEnabled) await expect(page.locator('[data-proof-root]')).toHaveAttribute('data-hydrated', 'true');
				await expect(page.locator('[data-live-summary]')).toHaveCount(1);
				await expect(page.getByRole('heading', { name: 'Orbit lamp' })).toBeVisible();
				await expect(page.getByLabel('Engraving')).toHaveCount(1);
				await expect(page.locator('[data-proof-query]')).toHaveCSS('width', `${width}px`);
				expect(await page.locator('[data-proof-fields]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(columns);
			} finally { await context.close(); }
		}
	});
}
