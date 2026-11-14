import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const production = !process.env.SPATIAL_E2E_DEV;
test.skip(!production, 'Import graphs and emitted SDK mocks require a production build.');
const manifest = (
	production
		? JSON.parse(readFileSync('apps/website/.svelte-kit/output/client/.vite/manifest.json', 'utf8'))
		: {}
) as Record<string, { file: string; name?: string; isEntry?: boolean; imports?: string[] }>;
const optional = Object.entries(manifest)
	.filter(([key, entry]) =>
		/three[./]|StageExperience|SpaceMouseAdapter|3dconnexion|GLTFLoader|DRACOLoader|meshopt_decoder/.test(
			key + ' ' + entry.name
		)
	)
	.map(([, entry]) => '/' + entry.file);
const driverFiles = Object.entries(manifest)
	.filter(([key]) => /SpaceMouseAdapter|3dconnexion/.test(key))
	.map(([, entry]) => '/' + entry.file);
const sdkFile =
	Object.entries(manifest).find(([key]) => key.includes('3dconnexion.module.js'))?.[1].file ?? '';
const detail = '/showcase/consumer/logitech-z407/';

async function permission(page: Page, initial = 'prompt') {
	await page.addInitScript((initial) => {
		const status = Object.assign(new EventTarget(), { state: initial });
		Object.assign(window, {
			loopbackPermission: status,
			driverConnects: 0,
			driverCloses: 0,
			driverMode: 'success'
		});
		const query = navigator.permissions.query.bind(navigator.permissions);
		navigator.permissions.query = (descriptor) =>
			String(descriptor.name) === 'loopback-network'
				? Promise.resolve(status as PermissionStatus)
				: query(descriptor);
	}, initial);
}
async function fakeDriver(page: Page, mode = 'success') {
	await page.addInitScript((mode) => {
		Object.assign(window, { driverMode: mode });
	}, mode);
	await page.route('**/' + sdkFile, (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `
 export default class {
  constructor(client) { this.client = client; window.driverDisconnect = () => client.onDisconnect(); }
  connect() {
   window.driverConnects++;
   if (window.driverMode === 'permission') throw new DOMException('Denied', 'SecurityError');
   if (window.driverMode === 'missing') return 0;
   if (window.driverMode !== 'pending') queueMicrotask(() => this.client.onConnect());
   return 1;
  }
  create3dmouse() { this.client.on3dmouseCreated(); }
  update3dcontroller() { return Promise.resolve(); }
  delete3dmouse() { this.close(); }
  close() { window.driverCloses++; }
 }
 `
		})
	);
	await page.route(/https?:\/\/(localhost|127\.0\.0\.1):8181\//, (route) => route.abort());
}
async function ready(page: Page) {
	await page.goto(detail);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', {
		timeout: 60000
	});
}

test('HTML entry points do not statically import optional renderers or device adapters', () => {
	expect(driverFiles).toHaveLength(2);
	const seen = new Set<string>();
	function visit(key: string) {
		if (seen.has(key)) return;
		seen.add(key);
		const entry = manifest[key];
		expect(optional, 'unexpected eager optional chunk: ' + key).not.toContain('/' + entry.file);
		for (const dependency of entry.imports ?? []) visit(dependency);
	}
	for (const [key, entry] of Object.entries(manifest)) if (entry.isEntry) visit(key);
});

for (const capability of ['missing', 'null', 'rejected'])
	test('fallback downloads no 3D or SpaceMouse code: ' + capability, async ({ page }) => {
		await permission(page, 'granted');
		await page.addInitScript(
			(capability) =>
				Object.defineProperty(navigator, 'gpu', {
					value:
						capability === 'missing'
							? undefined
							: {
									requestAdapter: () =>
										capability === 'null'
											? Promise.resolve(null)
											: Promise.reject(new Error('GPU disabled'))
								}
				}),
			capability
		);
		const requested: string[] = [];
		page.on('request', (request) => requested.push(new URL(request.url()).pathname));
		await page.goto(detail);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
		await expect(page.getByRole('heading', { name: 'Z407 Speakers' }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'SpaceMouse', exact: true })).not.toBeVisible();
		await page.getByRole('link', { name: 'Documentation', exact: true }).first().click();
		await expect(page).toHaveURL(/\/docs\//);
		expect(requested.filter((path) => optional.includes(path))).toEqual([]);
	});

if (process.env.SPATIAL_GPU) {
	test('desktop connects on first click, toasts, toggles and reflects a lost driver connection', async ({
		page
	}) => {
		await permission(page);
		await fakeDriver(page);
		const requested: string[] = [];
		page.on('request', (request) => requested.push(new URL(request.url()).pathname));
		await ready(page);
		expect(requested.filter((path) => driverFiles.includes(path))).toEqual([]);
		const idle = page.getByRole('button', { name: 'SpaceMouse', exact: true });
		await expect(idle).toHaveCSS('width', '40px');
		await expect(idle.locator('svg')).toHaveAttribute('fill', 'currentColor');
		await idle.focus();
		await page.keyboard.press('Enter');
		const connected = page.getByRole('button', { name: 'SpaceMouse connected', exact: true });
		await expect(connected).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect(page.locator('.connection-toast')).toContainText('You can now navigate');
		await page.screenshot({ path: '.artifacts/spacemouse-connected.png' });
		await expect(page.locator('.connection-toast')).not.toBeVisible({ timeout: 6000 });
		await connected.click();
		await expect(idle).toHaveAttribute('aria-pressed', 'false');
		await expect.poll(() => page.evaluate(() => (window as any).driverCloses)).toBe(1);
		await idle.click();
		await expect(connected).toBeVisible();
		await expect.poll(() => page.evaluate(() => (window as any).driverConnects)).toBe(2);
		await page.evaluate(() => (window as any).driverDisconnect());
		await expect(idle).toHaveAttribute('aria-pressed', 'false');
		await expect(page.getByRole('dialog')).not.toBeVisible();
	});
	test('permission failure explains access and OK retries; help only links to SpaceMouse', async ({
		page
	}) => {
		await permission(page, 'denied');
		await fakeDriver(page, 'permission');
		await ready(page);
		await page.getByRole('button', { name: 'SpaceMouse', exact: true }).click();
		await expect(page.getByRole('dialog')).toContainText('allow this website');
		await page.evaluate(() => {
			(window as any).driverMode = 'success';
			(window as any).loopbackPermission.state = 'granted';
		});
		await page.getByRole('button', { name: 'OK', exact: true }).click();
		await expect(
			page.getByRole('button', { name: 'SpaceMouse connected', exact: true })
		).toBeVisible();
		await page.getByRole('button', { name: '3D controls', exact: true }).click();
		await expect(page.getByRole('dialog')).toContainText(
			'Alternatively, use a SpaceMouse to navigate.'
		);
		await expect(
			page.getByRole('dialog').getByRole('link', { name: 'SpaceMouse' })
		).toHaveAttribute('href', 'https://3dconnexion.com/');
		await expect(page.getByRole('dialog').getByRole('button')).toHaveCount(1);
	});
	test('missing driver explains availability and links to the manufacturer', async ({ page }) => {
		await permission(page);
		await fakeDriver(page, 'missing');
		await ready(page);
		await page.getByRole('button', { name: 'SpaceMouse', exact: true }).click();
		await expect(page.getByRole('dialog')).toContainText('No SpaceMouse found');
		await expect(page.getByRole('dialog').getByRole('link')).toHaveAttribute(
			'href',
			'https://3dconnexion.com/'
		);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'SpaceMouse', exact: true })).toBeFocused();
	});
	for (const mode of ['success', 'missing'])
		test('existing grant reconnects silently: ' + mode, async ({ page }) => {
			await permission(page, 'granted');
			await fakeDriver(page, mode);
			await ready(page);
			await expect.poll(() => page.evaluate(() => (window as any).driverConnects)).toBe(1);
			await expect(page.getByRole('dialog')).not.toBeVisible();
			await expect(page.locator('.connection-toast')).not.toBeVisible();
			const label = mode === 'success' ? 'SpaceMouse connected' : 'SpaceMouse';
			await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
				'aria-pressed',
				String(mode === 'success')
			);
			if (mode === 'missing') {
				await page.evaluate(() => {
					(window as any).driverMode = 'success';
				});
				await page.getByRole('button', { name: label, exact: true }).click();
				await expect(
					page.getByRole('button', { name: 'SpaceMouse connected', exact: true })
				).toBeVisible();
			}
		});
	test('mobile never offers or imports SpaceMouse even with a previous grant', async ({ page }) => {
		await permission(page, 'granted');
		await fakeDriver(page);
		await page.addInitScript(() =>
			Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 15)' })
		);
		const requested: string[] = [];
		page.on('request', (request) => requested.push(new URL(request.url()).pathname));
		await ready(page);
		await expect(page.getByRole('button', { name: /SpaceMouse/ })).toHaveCount(0);
		await page.getByRole('button', { name: '3D controls', exact: true }).click();
		await expect(page.getByRole('dialog').getByRole('link', { name: 'SpaceMouse' })).toHaveCount(0);
		expect(requested.filter((path) => driverFiles.includes(path))).toEqual([]);
	});
}
