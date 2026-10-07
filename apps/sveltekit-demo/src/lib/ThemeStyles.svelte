<script lang="ts">
	import { getSpatialThemeStyle, type SpatialTheme } from '@spatial-elements/sveltekit';
	let { themes }: { themes: Record<'light' | 'dark', SpatialTheme> } = $props();
	// The blocking bootstrap chooses the palette before the first paint. These
	// scoped preview rules bridge SSR until reactive component styles take over.
	function preview(theme: SpatialTheme, scheme: string) {
		const declarations =
			getSpatialThemeStyle(theme).split(';').filter(Boolean).join(' !important;') + ' !important;';
		const tint = String(theme.panelTheme.tint).replace('#', '');
		const hex = tint.length === 3 ? tint.replace(/./g, '$&$&') : tint;
		const rgb = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(' ');
		const root = `html[data-theme-pending][data-theme="${scheme}"]`;
		return `${root} .brand-stage-shell { ${declarations} color-scheme: ${scheme}; }
		${root} [data-stage-panel-fallback], ${root} [data-stage-panel-css-surface] {
			--stage-panel-tint-rgb: ${rgb} !important;
			--stage-panel-tint-opacity: ${theme.panelTheme.tintOpacity} !important;
		}`;
	}
	const css = $derived(preview(themes.light, 'light') + preview(themes.dark, 'dark'));
</script>

<svelte:head>{@html `<style>${css}</style>`}</svelte:head>
