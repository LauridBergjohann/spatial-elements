import { defineConfig } from 'vitest/config';
export default defineConfig({
	// Node tests import shared website data without loading SvelteKit's virtual $app/tsconfig.
	tsconfig: './tsconfig.base.json',
	test: {
		include: ['packages/core/src/**/*.{spec,test}.ts', 'tooling/**/*.spec.ts'],
		environment: 'node'
	}
});
