import { cpSync, mkdirSync } from 'node:fs';
const destination = new URL('../apps/sveltekit-demo/static/assets/demo/', import.meta.url);
mkdirSync(destination, { recursive: true });
cpSync(new URL('../fixtures/demo-assets/', import.meta.url), destination, { recursive: true });
