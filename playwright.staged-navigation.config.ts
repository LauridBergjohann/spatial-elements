import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.SPATIAL_E2E_PORT ?? 4194);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: 'staged-navigation.e2e.ts', outputDir: '.artifacts/staged-navigation-proof',
	workers: 1, timeout: 45000, expect: { timeout: 15000 },
	use: { baseURL, viewport: { width: 1200, height: 800 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: {
		command: `node ../../node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)),
		url: `${baseURL}/proof/staged-navigation/source`, reuseExistingServer: false, timeout: 120000
	}
});
