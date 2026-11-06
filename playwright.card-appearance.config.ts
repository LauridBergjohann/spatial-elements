import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = 4206;
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: 'card-appearance-freeze.e2e.ts', outputDir: '.artifacts/card-appearance-freeze',
	workers: 1, timeout: 120000, expect: { timeout: 30000 },
	use: { baseURL, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/sveltekit-demo/', import.meta.url)), url: `${baseURL}/demo/categories/list`, reuseExistingServer: false, timeout: 120000 }
});
