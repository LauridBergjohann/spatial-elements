import base from './playwright.staged-production.config';
import { defineConfig } from '@playwright/test';
export default defineConfig(base, {
	testMatch: ['ground-shadow-cache.e2e.ts'], outputDir: '.artifacts/ground-shadow-cache', timeout: 120000,
	use: { trace: 'retain-on-failure' }
});
