<script lang="ts">
	import { onMount } from 'svelte';
	import {
		STAGE_ANCHOR_SCROLL_DURATION_MS,
		STAGE_ANCHOR_SCROLL_EASING
	} from '@spatial-elements/core/stage/scrollAnimation';
	import type { ProductSectionNavigationItem } from '@spatial-elements/core/product-detail/types';

	interface Props {
		activeSectionId?: string;
		sections: ProductSectionNavigationItem[];
		variant: 'panel' | 'docked';
	}

	let { activeSectionId, sections, variant }: Props = $props();
	let linksElement: HTMLDivElement;
	let presentationFrame = 0;
	let readyFrame = 0;
	const currentSectionId = $derived(activeSectionId ?? sections[0]?.id);

	function updateActivePresentation() {
		presentationFrame = 0;
		const sectionId = currentSectionId;
		if (!linksElement || !sectionId) return;

		const activeLink = Array.from(
			linksElement.querySelectorAll<HTMLElement>('[data-product-tab-id]')
		).find((element) => element.dataset.productTabId === sectionId);
		if (!activeLink) return;

		linksElement.style.setProperty('--product-tab-active-left', `${activeLink.offsetLeft}px`);
		linksElement.style.setProperty('--product-tab-active-width', `${activeLink.offsetWidth}px`);
		if (!linksElement.hasAttribute('data-product-tab-indicator-ready') && !readyFrame) {
			readyFrame = requestAnimationFrame(() => {
				readyFrame = 0;
				linksElement.toggleAttribute('data-product-tab-indicator-ready', true);
			});
		}

		const containerRect = linksElement.getBoundingClientRect();
		const linkRect = activeLink.getBoundingClientRect();
		const leftOverflow = linkRect.left - containerRect.left;
		const rightOverflow = linkRect.right - containerRect.right;
		if (leftOverflow >= 0 && rightOverflow <= 0) return;

		linksElement.scrollTo({
			left: linksElement.scrollLeft + (leftOverflow < 0 ? leftOverflow - 8 : rightOverflow + 8),
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
		});
	}

	function scheduleActivePresentation() {
		if (!linksElement || presentationFrame) return;
		presentationFrame = requestAnimationFrame(updateActivePresentation);
	}

	$effect(() => {
		void currentSectionId;
		void sections;
		scheduleActivePresentation();
	});

	onMount(() => {
		const resizeObserver =
			'ResizeObserver' in window ? new ResizeObserver(scheduleActivePresentation) : undefined;
		resizeObserver?.observe(linksElement);
		for (const link of linksElement.querySelectorAll('[data-product-tab-id]')) {
			resizeObserver?.observe(link);
		}
		window.addEventListener('resize', scheduleActivePresentation, { passive: true });
		void document.fonts?.ready.then(scheduleActivePresentation);
		scheduleActivePresentation();

		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener('resize', scheduleActivePresentation);
			if (presentationFrame) cancelAnimationFrame(presentationFrame);
			if (readyFrame) cancelAnimationFrame(readyFrame);
		};
	});
</script>

<nav
	class="product-tab-list"
	data-product-tab-list={variant}
	aria-label="Produktbereiche"
	style={`--product-tab-navigation-duration: ${STAGE_ANCHOR_SCROLL_DURATION_MS}ms; --product-tab-navigation-easing: ${STAGE_ANCHOR_SCROLL_EASING}`}
>
	<div bind:this={linksElement} class="product-tab-links" data-product-tab-links>
		<span class="product-tab-selection" data-product-tab-selection aria-hidden="true"></span>
		{#each sections as section (section.id)}
			<a
				href={`#${section.id}`}
				data-product-tab-id={section.id}
				data-product-tab-label={section.title}
				aria-current={currentSectionId === section.id ? 'location' : undefined}
			>
				<span>{section.title}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.product-tab-list {
		--product-tab-font-size: 16px;
		--product-tab-highlight-top-radius: var(
			--product-tabs-dock-top-radius,
			var(--product-panel-radius, 9px)
		);
		--product-tab-highlight-bottom-radius: var(
			--product-tabs-dock-bottom-radius,
			var(--product-panel-radius, 9px)
		);

		display: flex;
		align-items: center;
		box-sizing: border-box;
		width: max-content;
		max-width: 100%;
		height: 100%;
		min-width: 0;
		color: var(--product-body);
		pointer-events: auto;
	}

	.product-tab-list:global([data-product-tab-list-hidden]) {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}

	.product-tab-links {
		display: flex;
		position: relative;
		align-items: center;
		height: 100%;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-inline: contain;
		scrollbar-width: none;
	}

	.product-tab-links::-webkit-scrollbar {
		display: none;
	}

	.product-tab-selection {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		z-index: 0;
		width: var(--product-tab-active-width, 0px);
		border-radius: var(--product-tab-highlight-top-radius) var(--product-tab-highlight-top-radius)
			var(--product-tab-highlight-bottom-radius) var(--product-tab-highlight-bottom-radius);
		background: color-mix(in srgb, var(--product-body) 8%, transparent);
		transform: translate3d(var(--product-tab-active-left, 0px), 0, 0);
		pointer-events: none;
		will-change: border-radius;
	}

	.product-tab-links:global([data-product-tab-indicator-ready]) .product-tab-selection {
		transition:
			width var(--product-tab-navigation-duration) var(--product-tab-navigation-easing),
			transform var(--product-tab-navigation-duration) var(--product-tab-navigation-easing);
	}

	.product-tab-selection::after {
		position: absolute;
		bottom: 3px;
		left: 50%;
		width: 40px;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background: var(--product-accent);
		transform: translateX(-50%);
		content: '';
		visibility: hidden;
	}

	.product-tab-links:global([data-product-tab-indicator-ready]) .product-tab-selection::after {
		visibility: visible;
	}

	a {
		display: grid;
		position: relative;
		z-index: 1;
		flex: 0 0 auto;
		place-items: center;
		box-sizing: border-box;
		height: 100%;
		padding: 0 16px;
		border-radius: var(--product-tab-highlight-top-radius) var(--product-tab-highlight-top-radius)
			var(--product-tab-highlight-bottom-radius) var(--product-tab-highlight-bottom-radius);
		color: var(--product-body);
		background: transparent;
		/* Sturdier glyphs retain more edge contrast in the spatial panel and keep
		 * the source-to-dock handoff typographically identical. */
		font-size: var(--product-tab-font-size);
		font-weight: 600;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		transition: background-color 180ms ease;
	}

	a::before,
	a > span {
		grid-area: 1 / 1;
	}

	a::before {
		font-weight: 600;
		content: attr(data-product-tab-label);
		visibility: hidden;
	}

	a:hover:not([aria-current='location']) {
		background: color-mix(in srgb, var(--product-body) 8%, transparent);
	}

	a[aria-current='location'] {
		font-weight: 600;
	}

	.product-tab-links:not([data-product-tab-indicator-ready]) a[aria-current='location'] {
		background: color-mix(in srgb, var(--product-body) 8%, transparent);
	}

	.product-tab-links:not([data-product-tab-indicator-ready]) a[aria-current='location']::after {
		position: absolute;
		bottom: 3px;
		left: 50%;
		width: 40px;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background: var(--product-accent);
		transform: translateX(-50%);
		content: '';
	}

	a:focus-visible {
		outline: 2px solid var(--product-accent);
		outline-offset: -2px;
	}

	@media (max-width: 620px) {
		.product-tab-list {
			--product-tab-font-size: 15px;
		}

		a {
			padding-inline: 12px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		a,
		.product-tab-selection {
			transition: none;
		}
	}
</style>
