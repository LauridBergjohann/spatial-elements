import base from './playwright.staged-production.config';
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = 4205, baseURL = `http://127.0.0.1:${port}`;
export default defineConfig(base, {
	testMatch: ['background-layer-output.e2e.ts'], outputDir: '.artifacts/background-layer-output', timeout: 150000,
	use: { baseURL, trace: 'retain-on-failure' },
	webServer: { command: `node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)), url: `${baseURL}/proof/background-layer-output`, reuseExistingServer: false, timeout: 120000 }
});
