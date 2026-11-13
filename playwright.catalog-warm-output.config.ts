import base from './playwright.staged-production.config';
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = 4207, baseURL = `http://127.0.0.1:${port}`;
export default defineConfig(base, {
	testMatch: ['catalog-warm-output.e2e.ts'], outputDir: '.artifacts/catalog-warm-output', timeout: 180000,
	use: { baseURL, viewport: { width: 960, height: 640 }, trace: 'retain-on-failure' },
	webServer: { command: `node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)), url: `${baseURL}/proof/catalog-warm-output`, reuseExistingServer: false, timeout: 120000 }
});
