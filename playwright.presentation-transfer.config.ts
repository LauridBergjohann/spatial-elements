import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = 4195;
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
 testDir: 'tests', testMatch: ['presentation-transfer.e2e.ts','card-grid.e2e.ts','carousel-projection.e2e.ts'], outputDir: '.artifacts/presentation-transfer', workers: 1, timeout: 90000,
 expect: { timeout: 30000 }, use: { baseURL, viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
 projects: [{ name: 'chrome', use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome' } }],
 webServer: { command: `node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`, cwd: fileURLToPath(new URL('./apps/sveltekit-demo/', import.meta.url)), url: `${baseURL}/proof/presentation-transfer/summary`, reuseExistingServer: false, timeout: 120000 }
});
