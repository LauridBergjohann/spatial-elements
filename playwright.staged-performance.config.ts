import base from './playwright.staged-production.config';
import { defineConfig } from '@playwright/test';

export default defineConfig(base, {
	testMatch: ['staged-performance.e2e.ts'], outputDir: '.artifacts/staged-performance',
	timeout: 900000, use: { trace: 'off', screenshot: 'off', video: 'off' }
});
