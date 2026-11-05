import { defineConfig } from '@playwright/test';
import base from './playwright.staged-production.config';

export default defineConfig(base, {
	testMatch: ['catalog-responsive-transition.e2e.ts', 'detail-feedback.e2e.ts', 'detail-pane.e2e.ts', 'catalog-summary-transfer.e2e.ts'],
	outputDir: '.artifacts/layout-feedback'
});
