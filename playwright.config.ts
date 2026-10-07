import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const port = Number(process.env.SPATIAL_E2E_PORT ?? 4174);
const baseURL = `http://127.0.0.1:${port}`;
// Development builds retain component boundaries that can affect binding cleanup order.
const serverMode = process.env.SPATIAL_E2E_DEV ? 'dev' : 'preview';
export default defineConfig({testDir:'tests',testMatch:'**/*.e2e.ts',workers:1,timeout:90000,expect:{timeout:30000},use:{baseURL,viewport:{width:1440,height:900},trace:'retain-on-failure',reducedMotion:'no-preference'},projects:[{name:'chrome',use:{browserName:'chromium',channel:process.env.CI ? undefined : 'chrome'}}],webServer:{command:process.env.SPATIAL_CONSUMER_ROOT ? `node node_modules/vite/bin/vite.js ${serverMode} --host 127.0.0.1 --port ${port}` : `node ../../node_modules/vite/bin/vite.js ${serverMode} --host 127.0.0.1 --port ${port}`,cwd:process.env.SPATIAL_CONSUMER_ROOT ?? fileURLToPath(new URL('./apps/sveltekit-demo/', import.meta.url)),url:baseURL,reuseExistingServer:false,timeout:120000}});
