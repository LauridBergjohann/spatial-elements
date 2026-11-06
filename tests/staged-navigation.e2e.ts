import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { ProofEvent } from '../apps/sveltekit-demo/src/lib/staged-navigation-proof/telemetry';

const events = (page: Page) => page.evaluate(() => window.__stagedNavigationProof?.events ?? []);
const kinds = async (page: Page, kind: string) => (await events(page)).filter(event => event.kind === kind);
const destination = (event: ProofEvent) => event.href && new URL(event.href).pathname.split('/').at(-1);

async function open(page: Page, strategy = 'deferred', motion = 500, warm = true) {
	await page.goto(`/proof/staged-navigation/source?strategy=${strategy}&motion=${motion}&ticket=${crypto.randomUUID()}`);
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-ready', 'true');
	if (warm) {
		await page.getByRole('button', { name: 'Warm both targets' }).click();
		await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-warmed', 'true');
	}
	await page.evaluate(() => { window.__stagedNavigationProof!.events = []; });
}

test.afterEach(async ({ page }, info) => {
	const log = await events(page).catch(() => []);
	const body = JSON.stringify(log, null, 2);
	writeFileSync(info.outputPath('events.json'), body);
	await info.attach('navigation-events', { body, contentType: 'application/json' });
});

test('warm data loads during visible source motion and commits afterwards', async ({ page }, info) => {
	await open(page, 'deferred', 700);
	const original = (await page.locator('[data-proof-actor]').boundingBox())!;
	await page.screenshot({ path: info.outputPath('before-click.png') });
	await page.getByRole('link', { name: 'Fast target', exact: true }).click();
	await expect.poll(() => kinds(page, 'first-movement').then(log => log.length)).toBe(1);
	await expect(page.locator('[data-proof-page="source"]')).toBeVisible();
	expect((await page.locator('[data-proof-actor]').boundingBox())!.x).toBeGreaterThan(original.x + 1);
	await page.screenshot({ path: info.outputPath('source-moving.png') });
	await expect(page.locator('[data-proof-page="target"]')).toBeVisible();
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'idle');
	const log = await events(page);
	const click = log.find(event => event.kind === 'click')!;
	const first = log.find(event => event.kind === 'first-movement')!;
	const end = log.find(event => event.kind === 'motion-ended')!;
	const data = log.find(event => event.kind === 'data-ready')!;
	const mount = log.find(event => event.kind === 'page-constructor' && event.slug === 'target')!;
	expect(first.time - click.time).toBeLessThan(100);
	expect(data.time).toBeLessThan(end.time);
	expect(mount.time).toBeGreaterThanOrEqual(end.time);
	expect(log.filter(event => event.kind === 'goto-requested')).toHaveLength(1);
});

test('cold slow data keeps the original source at its endpoint until ready', async ({ page }) => {
	await open(page, 'deferred', 250, false);
	const original = (await page.locator('[data-proof-actor]').boundingBox())!;
	await page.getByRole('link', { name: 'Slow target', exact: true }).click();
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'holding');
	await expect(page.locator('[data-proof-page="source"]')).toBeVisible();
	expect((await page.locator('[data-proof-actor]').boundingBox())!.x).toBeCloseTo(original.x + 120, 0);
	await expect(page.locator('[data-proof-page="target"]')).toBeVisible();
	const log = await events(page);
	const end = log.find(event => event.kind === 'motion-ended')!;
	const data = log.find(event => event.kind === 'data-ready')!;
	const mount = log.find(event => event.kind === 'page-constructor' && event.slug === 'target')!;
	expect(data.time).toBeGreaterThan(end.time);
	expect(mount.time).toBeGreaterThanOrEqual(data.time);
	expect(log.filter(event => event.kind === 'page-constructor' && event.time < end.time)).toHaveLength(0);
});

for (const strategy of ['gate', 'deferred']) {
	test(strategy === 'gate'
		? 'control: the installed Kit onNavigate gate still mounts a superseded warm destination'
		: 'deferred: a second warm navigation prevents every superseded destination mount', async ({ page }) => {
		await open(page, strategy, 800);
		await page.getByRole('link', { name: 'Fast target', exact: true }).click();
		await expect.poll(() => kinds(page, 'data-ready').then(log => log.length)).toBeGreaterThan(0);
		await page.getByRole('link', { name: 'Other target', exact: true }).click();
		await expect(page.locator('[data-proof-page="other"]')).toBeVisible();
		await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'idle');
		const log = await events(page);
		const staleConstructors = log.filter(event => event.kind === 'page-constructor' && event.slug === 'target');
		expect(log.filter(event => event.kind === 'page-mounted' && event.slug === 'other')).toHaveLength(1);
		if (strategy === 'deferred') {
			expect(staleConstructors).toHaveLength(0);
			expect(log.filter(event => event.kind === 'goto-requested').map(destination)).toEqual(['other']);
			expect(log.filter(event => event.kind === 'owner-ended').map(event => event.reason)).toEqual(['superseded', 'committed']);
		} else {
			// This is the explicit control, not the supported implementation. Keep
			// the limitation reproducible when reviewing a SvelteKit upgrade.
			expect(staleConstructors).toHaveLength(1);
			const secondClick = log.find(event => event.kind === 'click' && destination(event) === 'other')!;
			expect(staleConstructors[0].time).toBeGreaterThan(secondClick.time);
			expect(log.some(event => event.kind === 'gate-released' && event.stale)).toBe(true);
		}
	});
}

test('explicit cancellation ignores a late successful preload without navigating', async ({ page }) => {
	await open(page, 'deferred', 600, false);
	await page.getByRole('link', { name: 'Slow target', exact: true }).click();
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'moving');
	await page.getByRole('button', { name: 'Cancel pending movement' }).click();
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'idle');
	await expect.poll(() => kinds(page, 'stale-data-ignored').then(log => log.length)).toBe(1);
	await expect(page.locator('[data-proof-page="source"]')).toBeVisible();
	expect(await kinds(page, 'goto-requested')).toHaveLength(0);
	expect(await page.locator('[data-proof-actor]').evaluate(node => node.getAnimations().length)).toBe(0);
});

test('load errors reach the ordinary error page without an indefinite visual hold', async ({ page }) => {
	await open(page, 'deferred', 300, false);
	await page.getByRole('link', { name: 'Failure', exact: true }).click();
	await expect(page.getByRole('heading', { name: '503: Deliberate navigation proof failure' })).toBeVisible();
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'idle');
	const log = await events(page);
	// Kit's preloadData currently returns status200 for this handled universal
	// load error; only ordinary goto establishes the actual503 error page.
	expect(log.some(event => event.kind === 'load-error' && event.status === 503)).toBe(true);
	const end = log.find(event => event.kind === 'motion-ended')!;
	expect(log.find(event => event.kind === 'page-constructor' && event.slug === 'failure')!.time).toBeGreaterThanOrEqual(end.time);
	expect(log.filter(event => event.kind === 'goto-requested')).toHaveLength(1);
});

test('redirects abandon the wrong predicted target and navigate once to the result', async ({ page }) => {
	await open(page, 'deferred', 800);
	await page.getByRole('link', { name: 'Redirect', exact: true }).click();
	await expect(page.locator('[data-proof-page="other"]')).toBeVisible();
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'idle');
	const log = await events(page);
	expect(log.filter(event => event.kind === 'redirect-followed')).toHaveLength(1);
	expect(log.find(event => event.kind === 'motion-aborted')?.reason).toBe('redirect');
	expect(log.filter(event => event.kind === 'goto-requested').map(destination)).toEqual(['other']);
	expect(log.filter(event => event.kind === 'page-constructor' && event.slug === 'redirect')).toHaveLength(0);
});

test('browser Back interrupts the pending movement without creating a phantom history entry', async ({ page }) => {
	await open(page, 'deferred', 250);
	await page.getByRole('link', { name: 'Other target', exact: true }).click();
	await expect(page.locator('[data-proof-page="other"]')).toBeVisible();
	await page.getByRole('link', { name: 'Slow target', exact: true }).click();
	await expect(page.locator('[data-staged-proof]')).toHaveAttribute('data-phase', 'moving');
	await page.goBack();
	await expect(page.locator('[data-proof-page="source"]')).toBeVisible();
	await expect.poll(() => kinds(page, 'stale-data-ignored').then(log => log.length)).toBe(1);
	const log = await events(page);
	expect(log.some(event => event.kind === 'owner-ended' && event.reason === 'history')).toBe(true);
	expect(log.filter(event => event.kind === 'goto-requested').map(destination)).toEqual(['other']);
});

test('Reduced Motion has no artificial animation delay', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await open(page, 'deferred', 900);
	await page.getByRole('link', { name: 'Fast target', exact: true }).click();
	await expect(page.locator('[data-proof-page="target"]')).toBeVisible();
	const log = await events(page);
	const start = log.find(event => event.kind === 'motion-started')!;
	const end = log.find(event => event.kind === 'motion-ended')!;
	expect(start.reduced).toBe(true);
	expect(end.time - start.time).toBeLessThan(150);
	expect(log.find(event => event.kind === 'page-constructor' && event.slug === 'target')!.time).toBeGreaterThanOrEqual(end.time);
});

test('links still navigate with JavaScript disabled', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await page.goto('/proof/staged-navigation/source');
		await page.getByRole('link', { name: 'Fast target', exact: true }).click();
		await expect(page.locator('[data-proof-page="target"]')).toBeVisible();
	} finally { await context.close(); }
});
