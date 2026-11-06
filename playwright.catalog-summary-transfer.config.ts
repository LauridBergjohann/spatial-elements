import { defineConfig } from '@playwright/test';
import base from './playwright.staged-production.config';
export default defineConfig({ ...base, testMatch: ['catalog-summary-transfer.e2e.ts'],
	outputDir: '.artifacts/catalog-summary-transfer' });
