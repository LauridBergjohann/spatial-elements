import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.SPATIAL_ISLAND_PORT ?? 4190);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: 'persistent-island.e2e.ts',
	outputDir: '.artifacts/persistent-island-proof', workers: 1, timeout: 45000,
	expect: { timeout: 15000 },
	use: { baseURL, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: {
		command: `node ../../node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)),
		url: `${baseURL}/proof/persistent-island/source`, reuseExistingServer: false, timeout: 120000
	}
});
