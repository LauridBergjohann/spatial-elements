import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
export default defineConfig({
	plugins: [sveltekit()],
	resolve: { dedupe: ['svelte', 'three'] },
	// Prebundle on the dev server, but keep the browser import lazy. Discovering this
	// dependency on the first button click otherwise reloads the page mid-connection.
	optimizeDeps: { include: ['@3dconnexion/3dconnexionjs'] }
});
