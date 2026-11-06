import { expect, test } from '@playwright/test';

for (const javaScriptEnabled of [false, true]) {
	test.describe(javaScriptEnabled ? 'enhanced painting' : 'native document', () => {
		test.use({ javaScriptEnabled });
		test('anchors, focus, keyboard and document extent stay native', async ({ page }) => {
			await page.goto('/proof/ultrawide');
			if (javaScriptEnabled) await expect(page.locator('[data-scroll-proof]')).toHaveAttribute('data-enhanced', 'true');
			await page.locator('.submenu a[href="#chapter-6"]').click();
			await expect.poll(() => page.locator('#chapter-6').evaluate(node => node.getBoundingClientRect().top)).toBeCloseTo(182, 0);
			await expect(page).toHaveURL(/#chapter-6$/);
			expect(await page.locator('.pane-header').evaluate(node => node.getBoundingClientRect().top)).toBe(96);
			expect(await page.locator('.stage').evaluate(node => node.getBoundingClientRect().top)).toBe(96);
			await page.reload();
			await expect.poll(() => page.locator('#chapter-6').evaluate(node => node.getBoundingClientRect().top)).toBeCloseTo(182, 0);
			await page.locator('input[name="note-8"]').focus();
			await expect.poll(() => page.locator('input[name="note-8"]').evaluate(node => {
				const rect = node.getBoundingClientRect(); return rect.top >= 182 && rect.bottom <= innerHeight - 60;
			})).toBe(true);
			await page.locator('input[name="note-8"]').blur();
			await page.keyboard.press('Control+Home');
			await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
			await page.keyboard.press('PageDown');
			await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
			await page.keyboard.press('Control+End');
			await expect.poll(() => page.locator('[data-last-line]').evaluate(node => node.getBoundingClientRect().bottom)).toBeCloseTo(840, 0);
			expect(await page.evaluate(() => [...document.querySelectorAll('main, section')].every(node => node.scrollTop === 0))).toBe(true);
			expect(await page.evaluate(() => document.scrollingElement === document.documentElement)).toBe(true);
		});
	});
}

test('pane follows the midpoint and cap, while late content and zoom retain document state', async ({ page }) => {
	await page.goto('/proof/ultrawide');
	await expect(page.locator('[data-scroll-proof]')).toHaveAttribute('data-enhanced', 'true');
	for (const width of [2300, 2456, 3128, 3440]) {
		await page.setViewportSize({ width, height: 900 });
		const box = await page.locator('[data-pane-body]').boundingBox();
		expect(box?.x).toBe(width / 2 + 8);
		expect(box?.width).toBe(Math.min(width / 2 - 28, 1536));
	}
	await page.getByLabel('Retained value').fill('Still alive');
	const before = await page.evaluate(() => ({ document: document.documentElement.scrollHeight,
		summary: document.getElementById('summary')!.getBoundingClientRect().height }));
	await page.getByRole('button', { name: 'Toggle late content' }).click();
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(before.document + 100);
	const after = await page.evaluate(() => ({ document: document.documentElement.scrollHeight,
		summary: document.getElementById('summary')!.getBoundingClientRect().height }));
	expect(after.document - before.document).toBeCloseTo(after.summary - before.summary, 0);
	await page.locator('.submenu a[href="#chapter-5"]').click();
	const position = await page.evaluate(() => scrollY);
	await page.getByRole('button', { name: 'Zoom', exact: true }).click();
	await expect(page.locator('[data-pane-body]')).toHaveAttribute('inert', '');
	await page.getByRole('button', { name: 'Return to content' }).click();
	await expect.poll(() => page.evaluate(() => scrollY)).toBe(position);
	await expect(page.getByLabel('Retained value')).toHaveValue('Still alive');
	await page.setViewportSize({ width: 2456, height: 500 });
	await expect(page.locator('.stage')).toBeHidden();
	await expect(page.locator('[data-pane-body]')).not.toHaveCSS('position', 'fixed');
});
