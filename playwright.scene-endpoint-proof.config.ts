import { defineConfig } from '@playwright/test';
const port = 4207;
export default defineConfig({
	testDir: 'tests', testMatch: ['scene-endpoint-proof.e2e.ts'], outputDir: '.artifacts/scene-endpoint-proof', workers: 1,
	timeout: 240000, expect: { timeout: 30000 }, use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node node_modules/vite/bin/vite.js tooling/scene-endpoint-proof --host 127.0.0.1 --port ${port} --strictPort`,
		url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120000 }
});
