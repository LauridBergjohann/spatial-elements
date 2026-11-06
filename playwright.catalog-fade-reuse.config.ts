import base from './playwright.catalog-warm-output.config';
import { defineConfig } from '@playwright/test';

export default defineConfig(base, {
	testMatch: ['catalog-fade-reuse.e2e.ts'],
	outputDir: '.artifacts/catalog-fade-reuse',
	timeout: 240000
});
