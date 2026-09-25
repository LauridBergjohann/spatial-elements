<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProductBreadcrumb } from '@spatial-elements/core/product-detail/types';

	let {
		items,
		transition = 'enter'
	}: { items: ProductBreadcrumb[]; transition?: 'enter' | 'exit' } = $props();
</script>

<nav
	class="breadcrumbs"
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
		width: calc(100vw - var(--product-content-inline-inset) - var(--product-content-inline-inset));
		margin: 8px 0 12px calc(50% - 50vw + var(--product-content-inline-inset));
		color: color-mix(in srgb, var(--product-body) 72%, transparent);
		font-size: 13px;
		line-height: 16px;
	}

	ol {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li:not(:last-child)::after {
		margin-inline: 0.45rem;
		content: '/';
	}

	a {
		color: inherit;
		text-decoration: none;
		pointer-events: auto;
	}

	a:hover {
		text-decoration: underline;
	}

	@media (max-width: 1100px) {
		.breadcrumbs {
			width: 100%;
			margin-left: 0;
		}
	}
</style>
