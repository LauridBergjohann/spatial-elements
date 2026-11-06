<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.generated.css';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import type { SpatialElementBreadcrumb } from '@spatial-elements/core/spatial-element/types';

	let {
		items,
		transition = 'enter'
	}: { items: SpatialElementBreadcrumb[]; transition?: 'enter' | 'exit' } = $props();
</script>

<nav
	use:mouseHover
	class="breadcrumbs spatial-grid-scope spatial-content-width"
	data-stage-dom-content
	aria-label="Breadcrumb"
	data-catalog-transition-dom={transition}
>
	<ol>
		{#each items as item, index (item.label)}
			<li>
				{#if item.href}
					<a href={resolve(...([item.href] as unknown as Parameters<typeof resolve>))}>{item.label}</a>
				{:else}
					<span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.breadcrumbs {
		box-sizing: border-box;
		height: var(--spatial-breadcrumb-height);
		margin-block: 0;
		padding-inline: var(--spatial-grid-gap, 12px);
		overflow-x: auto;
		overflow-y: hidden;
		/* Start at the trailing end even before hydration; the list keeps its reading order. */
		direction: rtl;
		scrollbar-width: none;
		color: color-mix(in srgb, var(--spatial-element-body) 72%, transparent);
		font-size: var(--spatial-breadcrumb-font-size);
		line-height: var(--spatial-breadcrumb-height);
		pointer-events: auto;
	}

	ol {
		display: flex;
		flex-wrap: nowrap;
		direction: ltr;
		width: max-content;
		min-width: 100%;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li { flex: none; white-space: nowrap; }
	.breadcrumbs::-webkit-scrollbar { display: none; }

	li:not(:last-child)::after {
		margin-inline: 0.45rem;
		content: '/';
	}

	a {
		color: inherit;
		text-decoration: none;
		pointer-events: auto;
	}

	.breadcrumbs:global([data-mouse-hover]) a:hover {
		text-decoration: underline;
	}

</style>
