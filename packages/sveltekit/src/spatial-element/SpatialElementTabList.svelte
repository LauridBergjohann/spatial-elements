<script lang="ts">
	import { onMount } from 'svelte';
	import {
		STAGE_ANCHOR_SCROLL_DURATION_MS,
		STAGE_ANCHOR_SCROLL_EASING
	} from '@spatial-elements/core/stage/scrollAnimation';
	import type { SpatialElementSectionNavigationItem } from '@spatial-elements/core/spatial-element/types';

	interface Props {
		activeSectionId?: string;
		sections: SpatialElementSectionNavigationItem[];
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
			linksElement.querySelectorAll<HTMLElement>('[data-spatial-element-tab-id]')
		).find((element) => element.dataset.spatialElementTabId === sectionId);
		if (!activeLink) return;

		linksElement.style.setProperty('--spatial-element-tab-active-left', `${activeLink.offsetLeft}px`);
		linksElement.style.setProperty('--spatial-element-tab-active-width', `${activeLink.offsetWidth}px`);
		if (!linksElement.hasAttribute('data-spatial-element-tab-indicator-ready') && !readyFrame) {
			readyFrame = requestAnimationFrame(() => {
				readyFrame = 0;
				linksElement.toggleAttribute('data-spatial-element-tab-indicator-ready', true);
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
		for (const link of linksElement.querySelectorAll('[data-spatial-element-tab-id]')) {
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
	class="spatial-element-tab-list"
	data-spatial-element-tab-list={variant}
	aria-label="Elementbereiche"
	style={`--spatial-element-tab-navigation-duration: ${STAGE_ANCHOR_SCROLL_DURATION_MS}ms; --spatial-element-tab-navigation-easing: ${STAGE_ANCHOR_SCROLL_EASING}`}
>
	<div bind:this={linksElement} class="spatial-element-tab-links" data-spatial-element-tab-links>
		<span class="spatial-element-tab-selection" data-spatial-element-tab-selection aria-hidden="true"></span>
		{#each sections as section (section.id)}
			<a
				href={`#${section.id}`}
				data-spatial-element-tab-id={section.id}
				data-spatial-element-tab-label={section.title}
				aria-current={currentSectionId === section.id ? 'location' : undefined}
			>
				<span>{section.title}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.spatial-element-tab-list {
		--spatial-element-tab-font-size: 16px;
		--spatial-element-tab-highlight-top-radius: var(
			--spatial-element-tabs-dock-top-radius,
			var(--spatial-element-panel-radius, 9px)
		);
		--spatial-element-tab-highlight-bottom-radius: var(
			--spatial-element-tabs-dock-bottom-radius,
			var(--spatial-element-panel-radius, 9px)
		);

		display: flex;
		align-items: center;
		box-sizing: border-box;
		width: max-content;
		max-width: 100%;
		height: 100%;
		min-width: 0;
		color: var(--spatial-element-body);
		pointer-events: auto;
	}

	.spatial-element-tab-list:global([data-spatial-element-tab-list-hidden]) {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}

	.spatial-element-tab-links {
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

	.spatial-element-tab-links::-webkit-scrollbar {
		display: none;
	}

	.spatial-element-tab-selection {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		z-index: 0;
		width: var(--spatial-element-tab-active-width, 0px);
		border-radius: var(--spatial-element-tab-highlight-top-radius) var(--spatial-element-tab-highlight-top-radius)
			var(--spatial-element-tab-highlight-bottom-radius) var(--spatial-element-tab-highlight-bottom-radius);
		background: color-mix(in srgb, var(--spatial-element-body) 8%, transparent);
		transform: translate3d(var(--spatial-element-tab-active-left, 0px), 0, 0);
		pointer-events: none;
		will-change: border-radius;
	}

	.spatial-element-tab-links:global([data-spatial-element-tab-indicator-ready]) .spatial-element-tab-selection {
		transition:
			width var(--spatial-element-tab-navigation-duration) var(--spatial-element-tab-navigation-easing),
			transform var(--spatial-element-tab-navigation-duration) var(--spatial-element-tab-navigation-easing);
	}

	.spatial-element-tab-selection::after {
		position: absolute;
		bottom: 3px;
		left: 50%;
		width: 40px;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background: var(--spatial-element-accent);
		transform: translateX(-50%);
		content: '';
		visibility: hidden;
	}

	.spatial-element-tab-links:global([data-spatial-element-tab-indicator-ready]) .spatial-element-tab-selection::after {
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
		border-radius: var(--spatial-element-tab-highlight-top-radius) var(--spatial-element-tab-highlight-top-radius)
			var(--spatial-element-tab-highlight-bottom-radius) var(--spatial-element-tab-highlight-bottom-radius);
		color: var(--spatial-element-body);
		background: transparent;
		/* Sturdier glyphs retain more edge contrast in the spatial panel and keep
		 * the source-to-dock handoff typographically identical. */
		font-size: var(--spatial-element-tab-font-size);
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
		content: attr(data-spatial-element-tab-label);
		visibility: hidden;
	}

	a:hover:not([aria-current='location']) {
		background: color-mix(in srgb, var(--spatial-element-body) 8%, transparent);
	}

	a[aria-current='location'] {
		font-weight: 600;
	}

	.spatial-element-tab-links:not([data-spatial-element-tab-indicator-ready]) a[aria-current='location'] {
		background: color-mix(in srgb, var(--spatial-element-body) 8%, transparent);
	}

	.spatial-element-tab-links:not([data-spatial-element-tab-indicator-ready]) a[aria-current='location']::after {
		position: absolute;
		bottom: 3px;
		left: 50%;
		width: 40px;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background: var(--spatial-element-accent);
		transform: translateX(-50%);
		content: '';
	}

	a:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
		outline-offset: -2px;
	}

	@media (max-width: 620px) {
		.spatial-element-tab-list {
			--spatial-element-tab-font-size: 15px;
		}

		a {
			padding-inline: 12px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		a,
		.spatial-element-tab-selection {
			transition: none;
		}
	}
</style>
