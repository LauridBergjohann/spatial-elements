<script lang="ts">
	import { getContext } from 'svelte';
	import { Card, type CardElements } from '@page-sections/svelte';
	import type { CardMediaAspect, CardMediaFit, SurfaceTone } from '@page-sections/core';
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
		cardShadow = false
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
		cardShadow?: boolean;
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
			// Register the actual clipped label as the spatial text endpoint.
			const titleLabel = parts.title.querySelector<HTMLElement>('.title-label') ?? parts.title;
			bind(titleLabel, 'title');
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
			// The tilted card can briefly move behind its stationary presentation root.
			// Keep that part of the card's hit area linked as well, without replaying
			// events from the actual link or any nested interactive content.
			const presentation = parts.root.closest<HTMLElement>('.spatial-card-root');
			if (presentation) {
				const activatePresentation = (event: MouseEvent) => {
					if (event.target === presentation) activate(event);
				};
				presentation.addEventListener('click', activatePresentation);
				cleanups.push(() => presentation.removeEventListener('click', activatePresentation));
			}
			const link = parts.title.querySelector('a');
			if (link) {
				// preserve-3d creates containing blocks. Size the stretched hit area from
				// untransformed layout offsets so it still covers the complete card.
				parts.root.dataset.spatialCardLinkReady = '';
				const sizeLink = () => {
					let left = 0,
						top = 0;
					for (
						let node: HTMLElement | null = link;
						node && node !== parts.root;
						node = node.offsetParent as HTMLElement | null
					) {
						left += node.offsetLeft;
						top += node.offsetTop;
					}
					link.style.setProperty('--spatial-card-link-left', -left + 'px');
					link.style.setProperty('--spatial-card-link-top', -top + 'px');
					link.style.setProperty('--spatial-card-link-width', parts.root.offsetWidth + 'px');
					link.style.setProperty('--spatial-card-link-height', parts.root.offsetHeight + 'px');
				};
				const observer = new ResizeObserver(sizeLink);
				for (const node of [parts.root, parts.copy, parts.title, link]) observer.observe(node);
				sizeLink();
				cleanups.push(() => {
					observer.disconnect();
					delete parts.root.dataset.spatialCardLinkReady;
				});
				link.dataset.catalogFocusKey = 'catalog:' + JSON.stringify([themeId, current.id, key]);
				cleanups.push(
					catalogViewLink(link, {
						spatialElementId: current.id,
						targetPresentation: current.targetPresentation
					}).destroy
				);
			}
			parts.title.removeAttribute('title');
			cleanups.push(truncatedTitle(titleLabel, current.title).destroy);
			return () => cleanups.reverse().forEach((stop) => stop());
		};
	});
	function activate(event: MouseEvent) {
		if (!active) {
			event.preventDefault();
			return;
		}

		const target = event.target as HTMLElement;
		if (
			!event.defaultPrevented &&
			event.button === 0 &&
			!target.closest('a, button, input, select, textarea')
		) {
			// A tilted card can move its hit plane between pointerdown and pointerup.
			// The browser then targets their common article instead of its stretched
			// anchor. Replay through the native link, preserving modifier-key behavior.
			const link = (event.currentTarget as HTMLElement).querySelector<HTMLAnchorElement>(
				'a.primary-link'
			);
			if (link) {
				event.preventDefault();
				event.stopPropagation();
				link.dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true,
						button: event.button,
						detail: event.detail,
						ctrlKey: event.ctrlKey,
						metaKey: event.metaKey,
						shiftKey: event.shiftKey,
						altKey: event.altKey,
						clientX: event.clientX,
						clientY: event.clientY,
						view: event.view
					})
				);
				return;
			}
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
	shadow={cardShadow}
	headingLevel={3}
	class="spatial-element-card"
	onready={ready}
	data-card-size={cardSize}
	data-catalog-card
	data-catalog-order={order}
	data-catalog-occurrence={occurrence}
	data-spatial-element-id={spatialElement.id}
	aria-busy={busy || undefined}
	onclick={activate}
	onpointerenter={() => {
		if (active) prepare(spatialElement);
	}}
	onpointerdown={() => {
		if (active) prepare(spatialElement);
	}}
	onfocusin={(event) => {
		if (active && !(event.target as HTMLElement).hasAttribute('data-catalog-restoring-focus'))
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
	:global(
		.ps-card.spatial-element-card[data-catalog-card][data-spatial-card-link-ready]
			[data-ps-card-part='copy']
	),
	:global(
		.ps-card.spatial-element-card[data-catalog-card][data-spatial-card-link-ready]
			[data-ps-card-part='title']
	),
	:global(
		.ps-card.spatial-element-card[data-catalog-card][data-spatial-card-link-ready] .primary-link
	) {
		transform-style: preserve-3d;
	}
	:global(
		.ps-card.spatial-element-card[data-catalog-card][data-spatial-card-link-ready] .primary-link
	) {
		display: block;
	}
	:global(
		.ps-card.spatial-element-card[data-catalog-card][data-spatial-card-link-ready]
			.primary-link::after
	) {
		inset: auto;
		left: var(--spatial-card-link-left);
		top: var(--spatial-card-link-top);
		width: var(--spatial-card-link-width);
		height: var(--spatial-card-link-height);
	}

	:global(.ps-card.spatial-element-card[data-catalog-card]:has(.primary-link:focus-visible)) {
		outline: 3px solid var(--ps-accent);
		outline-offset: 4px;
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] .primary-link:focus-visible::after) {
		outline: none;
	}
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
		pointer-events: none;
		overflow: visible;
	}
	:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='media']) {
		transform-style: preserve-3d;
	}
	:global(
		.ps-card.spatial-element-card[data-catalog-card]:is([data-mouse-hover], :has(:focus-visible))
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
		.ps-card.spatial-element-card[data-catalog-card]:is([data-mouse-hover], :has(:focus-visible))
			[data-ps-card-part='surface']::after
	) {
		opacity: 1;
	}
	:global([data-spatial-card-appearance-frozen]::after) {
		opacity: var(--spatial-card-frozen-after-opacity) !important;
		transition-property: none !important;
	}
	:global(
		.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='title'] .title-label
	) {
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
	:global(
		.ps-card.spatial-element-card[data-catalog-card]:is([data-mouse-hover], :has(:focus-visible))
	) {
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
		:global(.ps-card.spatial-element-card[data-catalog-card] [data-ps-card-part='title'] .title-label),
		.catalog-poster {
			transform: none;
			transition: none;
			text-shadow: none;
		}
	}
</style>
