import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['packages/core/src/**/*.{spec,test}.ts','tooling/**/*.spec.ts'],environment:'node'}});
