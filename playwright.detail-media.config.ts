import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.SPATIAL_MEDIA_PORT ?? 4195);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: ['detail-media.e2e.ts'], outputDir: '.artifacts/detail-media', workers: 1, timeout: 90000,
	expect: { timeout: 30000 }, use: { baseURL, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node ../../node_modules/vite/bin/vite.js ${process.env.SPATIAL_E2E_DEV ? 'dev' : 'preview'} --host 127.0.0.1 --port ${port}`, cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)), url: `${baseURL}/demo/layout-media`, reuseExistingServer: false, timeout: 120000 }
});
