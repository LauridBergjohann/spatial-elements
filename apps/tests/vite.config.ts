import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
export default defineConfig({
	plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: adapter() })],
	resolve: { dedupe: ['svelte', 'three'] },
	// Prebundle on the dev server, but keep the browser import lazy. Discovering this
	// dependency on the first button click otherwise reloads the page mid-connection.
	optimizeDeps: { include: ['@3dconnexion/3dconnexionjs'] }
});
