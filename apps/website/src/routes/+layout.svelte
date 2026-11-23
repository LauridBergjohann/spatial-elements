<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve, asset } from '$app/paths';
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import {
		resolveSpatialSectionBackgrounds,
		resolveSpatialThemeRadii
	} from '@spatial-elements/core/spatial-element/spatialTheme';
	import ShowcaseSummary from '#lib/showcase/ShowcaseSummary.svelte';
	import { provideShowcaseOrders } from '#lib/showcase/showcaseOrders.svelte.ts';
	const orders = provideShowcaseOrders();
	import { websitePageTheme, websiteTheme } from '#lib/theme.ts';
	import { Header, PageShell } from '@page-sections/svelte';
	import Menu from '@lucide/svelte/icons/menu';
	import Settings from '@lucide/svelte/icons/settings';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Github from '#lib/GitHubMark.svelte';
	import BrandMark from '#lib/BrandMark.svelte';
	import SiteSearch from '#lib/SiteSearch.svelte';
	import NavigationIcon from '#lib/NavigationIcon.svelte';
	import { getNavigationTree } from '#lib/navigation.ts';
	import { resolveNavigation } from '@page-sections/core';
	import SiteFooter from '#lib/SiteFooter.svelte';
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
	const namespace = $derived(page.url.pathname.startsWith('/docs/') ? 'docs/examples' : 'showcase');
	const exclusive = $derived(/^\/showcase\/exclusive(?:\/|$)/.test(page.url.pathname));
	const industrial = $derived(/^\/showcase\/industrial(?:\/|$)/.test(page.url.pathname));
	const stageTheme = $derived(
		websiteTheme(mode, namespace, exclusive ? 'exclusive' : industrial ? 'industrial' : 'default')
	);
	const sectionBackgrounds = $derived(resolveSpatialSectionBackgrounds(stageTheme));
	const pageTheme = $derived(
		exclusive || industrial
			? {
					...websitePageTheme(mode),
					fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
					background: stageTheme.background,
					standard: sectionBackgrounds.standard,
					muted: sectionBackgrounds.muted,
					ink: stageTheme.colors.ink,
					body: stageTheme.colors.body,
					accent: stageTheme.colors.accent,
					onAccent: stageTheme.colors.onAccent,
					radius: resolveSpatialThemeRadii(stageTheme).panel + 'px',
					footerBackground:
						exclusive || mode === 'dark' ? sectionBackgrounds.standard : stageTheme.colors.accent,
					footerInk:
						exclusive || mode === 'dark' ? stageTheme.colors.ink : stageTheme.colors.onAccent,
					footerBarBackground: sectionBackgrounds.muted,
					footerBarInk: stageTheme.colors.body
				}
			: websitePageTheme(mode)
	);
	// Both Exclusive palettes use dark surfaces.
	const surfaceScheme = $derived(exclusive ? 'dark' : mode);
	const items = $derived(
		resolveNavigation(getNavigationTree(page.url), { pathname: page.url.pathname }).items
	);
</script>

<svelte:head>
	<link rel="canonical" href={'https://spatial-elements.bergjohann.com' + page.url.pathname} />
	<meta property="og:site_name" content="Spatial Elements" />
	<meta property="og:url" content={'https://spatial-elements.bergjohann.com' + page.url.pathname} />
</svelte:head>

{#snippet siteNavigation()}
	<div class="website-header">
		<Header scrollBehavior="static" {items} closeKey={page.url.pathname}>
			{#snippet itemIcon(item)}<NavigationIcon name={item.icon} />{/snippet}
			{#snippet brand()}
				<a class="skip-link" href="#main-content">Skip to content</a>
				<a class="site-brand" href={resolve('/')} aria-label="Spatial Elements home">
					<img src={asset('spatial-elements-logo.svg')} width="32" height="32" alt="" />
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
						title="Source on GitHub"
						target="_blank"
						rel="noopener noreferrer"
					>
						<Github />
					</a>
					<a
						class="github-link"
						href="https://www.npmjs.com/package/@spatial-elements/sveltekit"
						aria-label="Spatial Elements on npm"
						title="Package on npm"
						target="_blank"
						rel="noopener noreferrer"
					>
						<BrandMark kind="npm" />
					</a>
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
						onclick={() => setMode('light')}
					>
						<Sun size={18} aria-hidden="true" />
					</button>
					<button
						type="button"
						aria-label="Dark"
						title="Dark"
						aria-pressed={mode === 'dark'}
						disabled={!ready}
						onclick={() => setMode('dark')}
					>
						<Moon size={18} aria-hidden="true" />
					</button>
				</div>
			{/snippet}
		</Header>
	</div>
{/snippet}
<div data-website-theme={exclusive || industrial ? 'showcase' : 'default'}>
	<PageShell mode={surfaceScheme} theme={pageTheme}>
		<BrandStageShell
			theme={stageTheme}
			colorScheme={surfaceScheme}
			navigation={siteNavigation}
			deviceOrientation
		>
			{#snippet footer()}<SiteFooter />{/snippet}
			{#snippet summary(context)}<ShowcaseSummary
					{...context}
					{orders}
					appearance={surfaceScheme}
				/>{/snippet}
			<div id="main-content" tabindex="-1">{@render children()}</div>
		</BrandStageShell>
	</PageShell>
</div>

<style>
	.header-tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.github-link {
		outline: 1px solid var(--ps-border);
		outline-offset: -1px;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 0.5rem;
		color: var(--ps-ink);
	}
	.github-link:focus-visible {
		outline: 2px solid var(--ps-accent);
		outline-offset: 2px;
	}
	.github-link:hover {
		background: var(--ps-selection, var(--ps-section-muted));
	}
	.github-link :global(svg) {
		width: 24px;
		height: 24px;
	}
	@media (max-width: 599.98px) {
		.github-link {
			display: none;
		}
		.website-header :global(.header) {
			gap: 0.25rem;
		}
		.website-header .site-brand {
			gap: 0.5rem;
			font-size: 0.875rem;
		}
	}
	@media (min-width: 1200px) {
		.website-header :global(.desktop-menu > ul) {
			justify-content: center;
		}
		.website-header :global(.brand) {
			margin-inline-end: 0.75rem;
		}
		.website-header :global(.tools) {
			margin-inline-start: 0.5rem;
		}
	}
	.appearance {
		outline: 1px solid var(--ps-border);
		outline-offset: -1px;
		display: flex;
		border-radius: var(--spatial-element-control-radius);
		overflow: clip;
	}
	.appearance button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 0;
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
