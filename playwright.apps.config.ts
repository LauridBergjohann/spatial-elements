import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const mode = process.env.SPATIAL_E2E_DEV ? 'dev' : 'preview';
const server = (directory: string, port: number) => ({
	command: `node ../../node_modules/vite/bin/vite.js ${mode} --host 127.0.0.1 --port ${port} --strictPort`,
	cwd: fileURLToPath(new URL(`./apps/${directory}/`, import.meta.url)),
	url: `http://127.0.0.1:${port}`,
	reuseExistingServer: false,
	timeout: 120_000
});

export default defineConfig({
	testDir: './tests/apps',
	workers: 1,
	// A cold dev server transforms the linked library modules on first request.
	// Keep production assertions strict; allow that initial work in dev mode.
	timeout: process.env.SPATIAL_E2E_DEV ? 120_000 : 90_000,
	expect: { timeout: process.env.SPATIAL_E2E_DEV ? 60_000 : 15_000 },
	outputDir: `.artifacts/apps-${mode}`,
	use: {
		browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome',
		viewport: { width: 1700, height: 900 }, trace: 'retain-on-failure'
	},
	projects: [
		{ name: 'basics', testMatch: 'basics.app.ts', use: { baseURL: 'http://127.0.0.1:4174' } },
		{ name: 'showcase', testMatch: 'showcase.app.ts', use: { baseURL: 'http://127.0.0.1:4175' } }
	],
	webServer: [server('tests', 4174), server('website', 4175), server('demo', 4173)]
});
