import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.SPATIAL_PANE_PORT ?? 4193);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: ['detail-pane.e2e.ts'], outputDir: '.artifacts/detail-pane', workers: 1, timeout: 120000,
	expect: { timeout: 30000 }, use: { baseURL, viewport: { width: 2456, height: 900 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node ../../node_modules/vite/bin/vite.js ${process.env.SPATIAL_E2E_DEV ? 'dev' : 'preview'} --host 127.0.0.1 --port ${port}`, cwd: fileURLToPath(new URL('./apps/sveltekit-demo/', import.meta.url)), url: `${baseURL}/demo/layout-pane`, reuseExistingServer: false, timeout: 120000 }
});
