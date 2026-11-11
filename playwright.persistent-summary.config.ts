import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.SPATIAL_E2E_PORT ?? 4187);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: 'persistent-summary.e2e.ts',
	outputDir: '.artifacts/persistent-summary-proof', workers: 1, timeout: 45000,
	expect: { timeout: 15000 },
	use: { baseURL, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: {
		command: `node ../../node_modules/vite/bin/vite.js ${process.env.SPATIAL_E2E_DEV ? 'dev' : 'preview'} --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)),
		url: `${baseURL}/proof/persistent-summary/source`, reuseExistingServer: false, timeout: 120000
	}
});
