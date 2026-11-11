<script lang="ts">
	import { page as route } from '$app/state';
	import type { ComponentProps } from 'svelte';
	import { SidebarNavigation } from '@page-sections/svelte';
	import { ContentPage } from '@spatial-elements/sveltekit';
	import { resolveNavigation, type MenuItem } from '@page-sections/core';
	import { navigationTree, readingNeighbors } from './navigation';
	import NavigationIcon from './NavigationIcon.svelte';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	let {
		page,
		children,
		showContentMenu = false,
		showSidebar,
		...rest
	}: ComponentProps<typeof ContentPage> & { showSidebar?: boolean } = $props();
	const navigation = $derived(resolveNavigation(navigationTree, { pathname: route.url.pathname }));
	const neighbors = $derived(readingNeighbors(route.url.pathname));
	const sidebar = $derived(showSidebar ?? navigation.root?.id === 'docs');
	const find = (items: MenuItem[], id?: string): MenuItem | undefined => {
		for (const item of items) {
			if (item.id === id) return item;
			const child = find(item.children ?? [], id);
			if (child) return child;
		}
	};
	const childPages = $derived(find(navigation.items, navigation.activeId)?.children ?? []);
</script>

{#snippet sidebarContent()}
	<SidebarNavigation
		items={navigation.sidebarItems}
		activeId={navigation.activeId}
		label="Documentation chapters"
	>
		{#snippet icon(item)}<NavigationIcon name={item.icon} />{/snippet}
		{#snippet disclosureIcon()}<ChevronDown size={16} />{/snippet}
	</SidebarNavigation>
{/snippet}

<ContentPage
	{...rest}
	page={{
		...page,
		breadcrumbs: navigation.breadcrumbs
	}}
	{showContentMenu}
	leftSidebar={sidebar ? sidebarContent : undefined}
>
	{@render children?.()}
	{#snippet footer()}
		{#if childPages.length}
			<nav class="child-pages" aria-label={`Pages in ${page.title}`}>
				<h2>Explore {page.title}</h2>
				<ul>
					{#each childPages as item}<li>
							<a href={item.href}>
								{#if item.icon}<NavigationIcon name={item.icon} />{/if}{item.label}<span
									aria-hidden="true">→</span
								>
							</a>
						</li>{/each}
				</ul>
			</nav>
		{/if}
		{#if neighbors.previous || neighbors.next}
			<nav class="reading-path" aria-label="Reading order">
				{#if neighbors.previous}<a rel="prev" href={neighbors.previous.href}
						><small>← Previous</small>{neighbors.previous.label}</a
					>{/if}
				{#if neighbors.next}<a rel="next" href={neighbors.next.href}
						><small>Next →</small>{neighbors.next.label}</a
					>{/if}
			</nav>
		{/if}
	{/snippet}
</ContentPage>

<style>
	.child-pages,
	.reading-path {
		padding: 1.5rem;
	}
	.child-pages h2 {
		font-size: 1.25rem;
	}
	ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
	}
	.child-pages a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 100%;
		padding: 1rem;
		background: var(--ps-section-standard);
		border: 1px solid var(--ps-border);
		border-radius: 0.75rem;
		text-decoration: none;
	}
	.child-pages a span {
		margin-inline-start: auto;
	}
	.reading-path {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		border-top: 1px solid var(--ps-border);
		margin-top: 2rem;
	}
	.reading-path a {
		display: grid;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 0.75rem;
		text-decoration: none;
	}
	.reading-path a:hover,
	.child-pages a:hover {
		background: var(--ps-section-muted);
	}
	[rel='next'] {
		margin-inline-start: auto;
		text-align: end;
	}
	small {
		color: var(--ps-body);
	}
</style>
