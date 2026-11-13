import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const port = 4189;
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
	testDir: 'tests', testMatch: 'ultrawide-scroll-proof.e2e.ts',
	outputDir: '.artifacts/ultrawide-scroll-proof', workers: 1, timeout: 45000,
	expect: { timeout: 10000 },
	use: { baseURL, viewport: { width: 2456, height: 900 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: {
		command: `node ../../node_modules/vite/bin/vite.js ${process.env.SPATIAL_E2E_DEV ? 'dev' : 'preview'} --host 127.0.0.1 --port ${port}`,
		cwd: fileURLToPath(new URL('./apps/tests/', import.meta.url)),
		url: `${baseURL}/proof/ultrawide`, reuseExistingServer: false, timeout: 120000
	}
});
