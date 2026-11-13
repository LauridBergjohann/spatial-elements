import base from './playwright.staged-production.config';
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const port = 4208, baseURL = `http://127.0.0.1:${port}`;
export default defineConfig(base, {
	testMatch: ['background-output-stage.e2e.ts'], outputDir: '.artifacts/background-output-stage',
	timeout: 180000, retries: 0,
	use: { baseURL, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
	webServer: {
		command: `node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)),
		url: `${baseURL}/demo/categories/list`, reuseExistingServer: false, timeout: 120000
	}
});
