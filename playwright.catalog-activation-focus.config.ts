import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = 4211, baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: ['catalog-activation-focus.e2e.ts'], outputDir: '.artifacts/catalog-activation-focus', workers: 1,
	timeout: 120000, expect: { timeout: 30000 }, use: { baseURL, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)), url: `${baseURL}/demo/categories/carousel`, reuseExistingServer: false, timeout: 120000 }
});
