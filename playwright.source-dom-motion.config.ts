import { defineConfig } from '@playwright/test';
const port = 4196;
export default defineConfig({
	testDir: 'tests', testMatch: 'source-dom-motion.e2e.ts', outputDir: '.artifacts/source-dom-motion',
	workers: 1, timeout: 30000, use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1400, height: 900 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
		url: `http://127.0.0.1:${port}/tests/fixtures/source-dom-motion/`, reuseExistingServer: false }
});
