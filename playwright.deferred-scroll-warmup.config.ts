import base from './playwright.staged-production.config';
import { defineConfig } from '@playwright/test';
export default defineConfig(base, {
	testMatch: ['deferred-scroll-warmup.e2e.ts', 'deferred-scroll-warmup.navigation.e2e.ts'],
	outputDir: '.artifacts/deferred-scroll-warmup', timeout: 120000
});
