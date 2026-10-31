import base from './playwright.staged-production.config';
import { defineConfig } from '@playwright/test';
export default defineConfig(base, {
	testMatch: ['stage-display-clear.e2e.ts'], outputDir: '.artifacts/stage-display-clear', timeout: 120000,
	use: { trace: 'retain-on-failure' }
});
