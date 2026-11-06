import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = 4200, baseURL = `http://127.0.0.1:${port}`;
const examples = Boolean(process.env.SPATIAL_PIPELINE_EXAMPLES);
export default defineConfig({
	testDir: 'tests', testMatch: 'staged-pipeline-diagnostic.e2e.ts', outputDir: `.artifacts/staged-pipeline${examples ? '-watches' : ''}`,
	workers: 1, timeout: 120000, expect: { timeout: 30000 },
	use: { baseURL, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
	projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
	webServer: { command: `node ${examples ? './' : '../../'}node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
		cwd: fileURLToPath(new URL(examples ? '../spatial-elements-brand-examples/' : './apps/sveltekit-demo/', import.meta.url)),
		url: `${baseURL}/${examples ? 'watches' : 'demo'}/categories/list`, reuseExistingServer: false, timeout: 120000 }
});
