<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { weraTheme } from '$lib/showcase/wera';
	import { watchesTheme } from '$lib/showcase/watches';
	import { theme as examplesTheme } from '$lib/forms';
	import { Navigation, PageShell } from '@page-sections/svelte';
	import Menu from 'lucide-svelte/icons/menu';
	import Settings from 'lucide-svelte/icons/settings';
	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import Github from '$lib/GitHubMark.svelte';
	import SiteSearch from '$lib/SiteSearch.svelte';
	import NavigationIcon from '$lib/NavigationIcon.svelte';
	import { navigationTree } from '$lib/navigation';
	import { resolveNavigation } from '@page-sections/core';
	import { version } from '../../../../packages/sveltekit/package.json';
	import '../app.css';
	let { children }: { children: Snippet } = $props();
	let mode = $state<'light' | 'dark'>('light');
	let ready = $state(false);
	onMount(() => {
		ready = true;
		try {
			const stored = localStorage.getItem('spatial-elements-theme');
			if (stored === 'light' || stored === 'dark') mode = stored;
		} catch {
			/* Storage is optional. */
		}
	});
	function setMode(value: string) {
		if (value !== 'light' && value !== 'dark') return;
		mode = value;
		try {
			localStorage.setItem('spatial-elements-theme', value);
		} catch {
			/* The choice still applies in memory. */
		}
	}
	const stageTheme = $derived(
		page.url.pathname.startsWith('/showcase/wera/')
			? weraTheme
			: page.url.pathname.startsWith('/showcase/watches/')
				? watchesTheme
				: page.url.pathname.startsWith('/docs/examples/') ||
					  page.url.pathname.startsWith('/docs/sections/playground/')
					? examplesTheme
					: undefined
	);
	const items = $derived(resolveNavigation(navigationTree, { pathname: page.url.pathname }).items);
</script>

<svelte:head>
	<link rel="canonical" href={'https://spatial-elements.bergjohann.com' + page.url.pathname} />
	<meta property="og:site_name" content="Spatial Elements" />
	<meta property="og:url" content={'https://spatial-elements.bergjohann.com' + page.url.pathname} />
</svelte:head>

{#snippet siteNavigation()}
	<header class="website-header">
		<Navigation {items} closeKey={page.url.pathname}>
			{#snippet itemIcon(item)}<NavigationIcon name={item.icon} />{/snippet}
			{#snippet brand()}
				<a class="skip-link" href="#main-content">Skip to content</a>
				<a class="site-brand" href={base + '/'} aria-label="Spatial Elements home">
					<img src={base + '/spatial-elements-logo.svg'} width="32" height="32" alt="" />
					<span>Spatial Elements</span>
				</a>
			{/snippet}
			{#snippet menuIcon()}<Menu size={20} aria-hidden="true" />{/snippet}
			{#snippet settingsIcon()}<Settings size={20} aria-hidden="true" />{/snippet}
			{#snippet tools()}
				<div class="header-tools">
					<SiteSearch />
					<a
						class="github-link"
						href="https://github.com/LauridBergjohann/spatial-elements"
						aria-label="Spatial Elements on GitHub"
						title="Source on GitHub"><Github /></a
					>
				</div>
			{/snippet}
			{#snippet right()}
				<div class="appearance" role="group" aria-label="Appearance">
					<button
						type="button"
						aria-label="Light"
						title="Light"
						aria-pressed={mode === 'light'}
						disabled={!ready}
						onclick={() => setMode('light')}><Sun size={18} aria-hidden="true" /></button
					>
					<button
						type="button"
						aria-label="Dark"
						title="Dark"
						aria-pressed={mode === 'dark'}
						disabled={!ready}
						onclick={() => setMode('dark')}><Moon size={18} aria-hidden="true" /></button
					>
				</div>
			{/snippet}
		</Navigation>
	</header>
{/snippet}
<PageShell {mode}>
	{#if stageTheme}
		{#key stageTheme.id}
			<BrandStageShell
				theme={stageTheme}
				colorScheme={stageTheme.id.startsWith('showcase/') ? 'dark' : 'light'}
				navigation={siteNavigation}
			>
				<div id="main-content" tabindex="-1">{@render children()}</div>
			</BrandStageShell>
		{/key}
	{:else}
		{@render siteNavigation()}
		<div id="main-content" tabindex="-1">{@render children()}</div>
	{/if}
	<footer class="site-footer">
		<a class="site-brand" href={base + '/'}
			><img src={base + '/spatial-elements-logo.svg'} alt="" width="24" height="24" />Spatial
			Elements
			<span class="version">v{version}</span></a
		>
		<span>Made with Spatial Elements.</span>
		<a href={base + '/about/#impressum'}>Imprint</a>
		<a href={base + '/about/#datenschutz'}>Privacy</a>
		<a href="https://github.com/LauridBergjohann/spatial-elements">Source on GitHub ↗</a>
	</footer>
</PageShell>

<style>
	.header-tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.github-link {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 0.5rem;
		color: var(--ps-ink);
	}
	.github-link:hover {
		background: var(--ps-selection, var(--ps-section-muted));
	}
	@media (min-width: 1200px) {
		.website-header :global(.desktop-menu > ul) {
			justify-content: center;
		}
		.website-header :global(.brand) {
			margin-inline-end: clamp(1.5rem, 3vw, 4rem);
		}
		.website-header :global(.tools) {
			margin-inline-start: 1.5rem;
		}
	}
	.appearance {
		display: flex;
	}
	.appearance button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--ps-ink);
		cursor: pointer;
	}
	.appearance [aria-pressed='true'] {
		color: var(--ps-accent);
		background: var(--ps-selection, var(--ps-section-muted));
	}
	.appearance button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
