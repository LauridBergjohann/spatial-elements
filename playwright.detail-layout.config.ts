import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.SPATIAL_DETAIL_PORT ?? 4191);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: ['detail-layout.e2e.ts', 'detail-classic-scrollbar.e2e.ts'], outputDir: '.artifacts/detail-layout', workers: 1, timeout: 90000,
	expect: { timeout: 30000 }, use: { baseURL, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node ../../node_modules/vite/bin/vite.js ${process.env.SPATIAL_E2E_DEV ? 'dev' : 'preview'} --host 127.0.0.1 --port ${port}`, cwd: fileURLToPath(new URL('./apps/sveltekit-demo/', import.meta.url)), url: `${baseURL}/proof/detail-layout/default`, reuseExistingServer: false, timeout: 120000 }
});
