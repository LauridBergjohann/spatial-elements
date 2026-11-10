<script lang="ts">
	import { getContext } from 'svelte';
	import { Card, type CardElements } from '@page-sections/svelte';
	import type {
		CardMediaAspect,
		CardMediaFit,
		CardVariant,
		SurfaceTone
	} from '@page-sections/core';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import { catalogViewLink } from '@spatial-elements/core/catalog/catalogViewLink';
	import {
		CATALOG_ENDPOINTS,
		type CatalogEndpointRegistry,
		type CatalogEndpointRole
	} from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import {
		CATALOG_SECTIONS,
		type CatalogSections
	} from '@spatial-elements/core/catalog/CatalogSections';
	import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
	import type { SpatialCardSize } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import { useSpatialTheme } from './brandContext.js';
	import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
	import { truncatedTitle } from './truncatedTitle.js';
	let {
		spatialElement,
		occurrence,
		order = 0,
		cardSize = 'm',
		textAlign = 'start',
		active = true,
		mediaAspect = '1/1',
		mediaFit = 'contain',
		reserveEyebrow = false,
		cardTone = 'standard',
		cardVariant = 'catalog'
	}: {
		spatialElement: SpatialListItem;
		occurrence: string;
		order?: number;
		cardSize?: SpatialCardSize;
		textAlign?: 'start' | 'center';
		active?: boolean;
		mediaAspect?: CardMediaAspect;
		mediaFit?: CardMediaFit;
		reserveEyebrow?: boolean;
		cardTone?: SurfaceTone;
		cardVariant?: CardVariant;
	} = $props();
	const readTheme = useSpatialTheme();
	const brand = $derived(readTheme());
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const { href, prepare, pending } = useCatalogNavigation();
	const item = $derived({ ...spatialElement, href: href(spatialElement.href) });
	let busy = $state(false);
	$effect(() => {
		const target = pending();
		busy = false;
		if (
			!active ||
			!target ||
			new URL(href(spatialElement.href), target).pathname !== target.pathname
		)
			return;
		const timer = setTimeout(() => {
			busy = true;
		}, 150);
		return () => clearTimeout(timer);
	});
	// Resizing keeps the same endpoints: spatial measurement uses the actual media rectangle.
	const ready = $derived.by(() => {
		void reserveEyebrow;
		void cardSize;
		void cardVariant;
		const enabled = active,
			themeId = brand.id,
			current = spatialElement,
			key = occurrence;
		return (parts: CardElements) => {
			const cleanups: (() => void)[] = [];
			const bind = (node: HTMLElement | null, role: CatalogEndpointRole, className?: string) => {
				if (!node) return;
				if (className) node.classList.add(className);
				node.dataset.spatialElementId = current.id;
				if (role !== 'container' && role !== 'geometry') node.dataset.sharedRole = role;
				if (enabled) {
					const stop = endpoints?.register(
						{
							brandId: themeId,
							spatialElementId: current.id,
							slot: 'catalog.card',
							occurrence: key,
							role
						},
						node
					);
					if (stop) cleanups.push(stop);
				}
			};
			bind(parts.root, 'container');
			bind(parts.surface, 'summary-surface', 'spatial-element-card-surface');
			bind(parts.media, 'geometry', 'spatial-element-card-geometry');
			bind(parts.title, 'title');
			bind(
				parts.copy.querySelector('[data-ps-card-part="eyebrow"]'),
				'eyebrow',
				'spatial-element-card-eyebrow'
			);
			parts.copy.classList.add('spatial-element-card-copy');
			parts.media.dataset.catalogGeometry = '';
			parts.media.dataset.catalogOccurrence = key;
			parts.media.dataset.catalogSlot = 'catalog.card';
			cleanups.push(mouseHover(parts.root).destroy);
			const link = parts.root.matches('a')
				? (parts.root as HTMLAnchorElement)
				: parts.title.querySelector('a');
			if (link) {
				link.dataset.catalogFocusKey = 'catalog:' + JSON.stringify([themeId, current.id, key]);
				cleanups.push(
					catalogViewLink(link, {
						spatialElementId: current.id,
						targetPresentation: current.targetPresentation
					}).destroy
				);
			}
			parts.title.removeAttribute('title');
			cleanups.push(truncatedTitle(parts.title, current.title).destroy);
			return () => cleanups.reverse().forEach((stop) => stop());
		};
	});
	function activate(event: MouseEvent) {
		if (!active) {
			event.preventDefault();
			return;
		}
		endpoints?.prefer(brand.id, spatialElement.id, occurrence);
		sections?.activate({
			brandId: brand.id,
			spatialElementId: spatialElement.id,
			occurrence,
			slot: 'catalog.card'
		});
		const link = (event.target as HTMLElement).closest('a');
		link?.focus({ preventScroll: true });
	}
</script>

<Card
	{item}
	{cardSize}
	{textAlign}
	{mediaAspect}
	{mediaFit}
	{reserveEyebrow}
	tone={cardTone}
	variant={cardVariant}
	headingLevel={3}
	class="spatial-element-card"
	onready={ready}
	data-card-size={cardSize}
	data-catalog-card
	data-catalog-order={order}
	data-catalog-occurrence={occurrence}
	data-spatial-element-id={spatialElement.id}
	data-catalog-focus-key={cardVariant === 'catalog'
		? `catalog:${JSON.stringify([brand.id, spatialElement.id, occurrence])}`
		: undefined}
	aria-busy={busy || undefined}
	onclick={activate}
	onpointerenter={() => {
		if (active) prepare(spatialElement);
	}}
	onpointerdown={() => {
		if (active) prepare(spatialElement);
	}}
	onfocus={(event) => {
		if (
			active &&
			!(event.currentTarget as HTMLElement).hasAttribute('data-catalog-restoring-focus')
		)
			prepare(spatialElement);
	}}
>
	{#snippet media()}
		{#if spatialElement.fallbackImage}<img
				class="catalog-poster"
				data-catalog-poster
				loading="lazy"
				decoding="async"
				src={spatialElement.fallbackImage}
				alt=""
			/>{/if}
		{#if busy}<span class="catalog-loading" aria-hidden="true"></span>{/if}
	{/snippet}
</Card>
<span class="catalog-status" role="status">{busy ? 'Opening spatial element…' : ''}</span>

<style>
	:global(.ps-card.spatial-element-card[data-catalog-card]) {
		isolation: auto;
		--ps-radius: var(--spatial-element-control-radius);
		pointer-events: auto;
		transform-origin: center;
		transform-style: preserve-3d;
		transform: perspective(1000px) translate3d(0, var(--catalog-lift, 0px), 0)
			rotateX(var(--catalog-rotate-x, 0deg)) rotateY(var(--catalog-rotate-y, 0deg));
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='media-frame']) {
		overflow: visible;
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='media']),
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='copy']) {
		transform-style: preserve-3d;
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='surface']) {
		box-shadow: 0 12px 32px rgb(0 0 0 / 6%);
		transition: border-color 180ms ease;
	}
	:global(
		.ps-card.spatial-element-card[data-catalog-card]:is([data-mouse-hover], :focus-visible)
			[data-ps-card-part='surface']
	) {
		border-color: var(--ps-accent);
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='surface']::after) {
		content: '';
		position: absolute;
		inset: -1px;
		border-radius: inherit;
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--ps-accent) 25%, transparent),
			0 0 18px color-mix(in srgb, var(--ps-accent) 18%, transparent);
		opacity: 0;
		transition: opacity 180ms ease;
	}
	:global(
		.ps-card.spatial-element-card[data-catalog-card]:is([data-mouse-hover], :focus-visible)
			[data-ps-card-part='surface']::after
	) {
		opacity: 1;
	}
	:global([data-spatial-card-appearance-frozen]::after) {
		opacity: var(--spatial-card-frozen-after-opacity) !important;
		transition-property: none !important;
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='title']) {
		transform: translateZ(var(--card-title-depth, 0px));
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='eyebrow']) {
		transform: translateZ(var(--card-eyebrow-depth, 0px));
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-shared-role='title']),
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-shared-role='eyebrow']) {
		text-shadow: var(--card-text-shadow, 0 0 0 transparent);
		transition:
			transform 260ms ease,
			text-shadow 260ms ease;
	}
	:global(.ps-card.spatial-element-card[data-catalog-card]:is([data-mouse-hover], :focus-visible)) {
		--card-eyebrow-depth: 40px;
		--card-title-depth: 64px;
		--card-model-depth: 96px;
		--card-model-scale: 1.12;
		--card-text-shadow: 0 4px 10px rgb(0 0 0 / 16%);
	}
	.catalog-poster {
		display: block;
		transform: translateZ(var(--card-model-depth, 0px)) scale(var(--card-model-scale, 1));
		transition:
			transform 260ms ease,
			opacity 240ms ease;
	}
	:global([data-catalog-model-ready]) .catalog-poster,
	:global([data-spatial-presentation-model-ready]) .catalog-poster {
		opacity: 0;
	}
	.catalog-loading {
		position: absolute;
		right: 14px;
		top: 14px;
		width: 18px;
		height: 18px;
		border: 2px solid var(--ps-border);
		border-top-color: var(--ps-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	.catalog-status {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.ps-card.spatial-element-card[data-catalog-card]),
		:global(.ps-card.spatial-element-card[data-catalog-card] [data-shared-role]),
		.catalog-poster {
			transform: none;
			transition: none;
			text-shadow: none;
		}
	}
</style>
