<script lang="ts">
	import type { ResolvedSpatialElementData as SpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	import { catalogActionSemantic } from '@spatial-elements/core/catalog/catalogAction';
	import ShoppingCart from 'lucide-svelte/icons/shopping-cart';
	import './layout.generated.css';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
	const catalogEndpoint = createCatalogEndpointAction();
	import type { SpatialElementSectionNavigationItem } from '@spatial-elements/core/spatial-element/types';

	let {
		spatialElement,
	}: {
		activeSectionId?: string;
		spatialElement: SpatialElementData;
		sections: SpatialElementSectionNavigationItem[];
	} = $props();

	function handleMinimapActionKeydown(event: KeyboardEvent) {
		if (event.key !== ' ') return;
		event.preventDefault();
		(event.currentTarget as HTMLAnchorElement).click();
	}
</script>

<header
	class="spatial-element-sticky-header"
	data-spatial-element-sticky-header
	data-catalog-transition-dom="enter"
	aria-label="Current element"
	aria-hidden="true"
	inert
>
	<div
		class="sticky-header-summary-surface"
		data-catalog-dock-surface
		aria-hidden="true"
		use:catalogEndpoint={{
			brandId: spatialElement.brandId,
			spatialElementId: spatialElement.id,
			slot: 'detail.dock',
			role: 'summary-surface'
		}}
	></div>
	<a
		class="sticky-header-minimap-action"
		data-spatial-element-sticky-minimap-action
		data-spatial-element-section-navigation
		href="#overview"
		aria-label="Zur Übersicht"
		onkeydown={handleMinimapActionKeydown}
	></a>

	<div class="sticky-header-layout">
		<div class="sticky-header-copy">
			{#if spatialElement.eyebrow}
			<p
				class="sticky-header-kicker"
				use:catalogEndpoint={{
					brandId: spatialElement.brandId,
					spatialElementId: spatialElement.id,
					slot: 'detail.dock',
					role: 'eyebrow'
				}}
			>
				{spatialElement.eyebrow}
			</p>
			{/if}
			<p
				class="sticky-header-title"
				use:catalogEndpoint={{
					brandId: spatialElement.brandId,
					spatialElementId: spatialElement.id,
					slot: 'detail.dock',
					role: 'title'
				}}
			>
				{spatialElement.title}
			</p>
		</div>

		{#if spatialElement.action}
			{#if spatialElement.action.href}
				<a
					class="sticky-header-action"
					data-spatial-element-dock-action
					use:catalogEndpoint={{
						brandId: spatialElement.brandId,
						spatialElementId: spatialElement.id,
						slot: 'detail.dock',
						role: 'primary-action'
					}}
					data-catalog-rich-shared="primary-action"
					data-catalog-semantic={catalogActionSemantic(spatialElement.action)}
					href={spatialElement.action.href}
					rel="external"
					aria-label={spatialElement.action.ariaLabel ?? spatialElement.action.label}
				>
					<ShoppingCart size={29} strokeWidth={2} aria-hidden="true" />
				</a>
			{:else}
				<button
					use:catalogEndpoint={{
						brandId: spatialElement.brandId,
						spatialElementId: spatialElement.id,
						slot: 'detail.dock',
						role: 'primary-action'
					}}
					data-catalog-rich-shared="primary-action"
					data-catalog-semantic={catalogActionSemantic(spatialElement.action)}
					class="sticky-header-action"
						data-spatial-element-dock-action
					type="button"
						aria-label={spatialElement.action.ariaLabel ?? spatialElement.action.label}
				>
					<ShoppingCart size={29} strokeWidth={2} aria-hidden="true" />
				</button>
			{/if}
		{/if}
	</div>

	<div
		class="spatial-element-sticky-tabs"
		data-spatial-element-sticky-tabs
		data-catalog-transition-dom="enter"
		aria-hidden="true"
		inert
	>
		<!-- The controller moves the existing live tab list here when it docks. -->
	</div>
</header>

<style>
	.sticky-header-summary-surface {
		position: absolute;
		inset: 0 88px 0 0;
		border-radius: inherit;
		pointer-events: none;
	}
	.spatial-element-sticky-header {
		position: fixed;
		/* SpatialElementDockController portals this element outside the translated document. */
		top: 0;
		left: 0;
		z-index: 20;
		box-sizing: border-box;
		width: 100%;
		height: var(--spatial-detail-dock-height);
		border: 0;
		border-radius: var(--spatial-element-panel-radius);
		visibility: hidden;
		background: transparent;
		box-shadow: none;
		pointer-events: none;
	}

	.spatial-element-sticky-header:global([data-presented]) {
		visibility: visible;
	}

	.spatial-element-sticky-header:global([data-active]) {
		pointer-events: auto;
	}

	.sticky-header-minimap-action {
		position: fixed;
		z-index: 4;
		display: block;
		border-radius: var(--spatial-element-control-radius);
		background: transparent;
		cursor: pointer;
	}

	.sticky-header-minimap-action:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
		outline-offset: -3px;
	}

	.spatial-element-sticky-tabs {
		--spatial-element-tabs-dock-top-radius: var(--spatial-element-control-radius);
		--spatial-element-tabs-dock-bottom-radius: var(--spatial-element-control-radius);

		position: fixed;
		z-index: 19;
		box-sizing: border-box;
		height: var(--spatial-detail-submenu-height);
		padding: 0;
		border: 0;
		border-radius: var(--spatial-element-tabs-dock-top-radius)
			var(--spatial-element-tabs-dock-top-radius) var(--spatial-element-tabs-dock-bottom-radius)
			var(--spatial-element-tabs-dock-bottom-radius);
		overflow: clip;
		opacity: 0;
		visibility: hidden;
		background: transparent;
		box-shadow: var(--spatial-element-docked-panel-box-shadow);
		pointer-events: none;
		will-change: border-radius;
	}

	.spatial-element-sticky-header::before,
	.spatial-element-sticky-header::after,
	.spatial-element-sticky-tabs::before {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		content: '';
		pointer-events: none;
	}

	.spatial-element-sticky-header::before,
	.spatial-element-sticky-tabs::before {
		background: rgb(
			var(--spatial-element-docked-panel-tint-rgb) /
				var(--spatial-element-docked-panel-tint-opacity)
		);
		box-shadow: inset 0 0 0 1px
			rgb(0 0 0 / calc(var(--spatial-element-docked-panel-shadow-strength) * 0.18));
		-webkit-backdrop-filter: blur(var(--spatial-element-docked-panel-backdrop-blur));
		backdrop-filter: blur(var(--spatial-element-docked-panel-backdrop-blur));
	}

	.spatial-element-sticky-header::before {
		z-index: 2;
		opacity: var(--spatial-element-sticky-header-progress, 0);
	}

	.spatial-element-sticky-header::after {
		z-index: 1;
		box-shadow: var(--spatial-element-docked-panel-box-shadow);
		opacity: var(--spatial-element-sticky-header-progress, 0);
	}

	.spatial-element-sticky-tabs::before {
		z-index: 0;
	}

	.spatial-element-sticky-tabs::before {
		/* Shift the filtered surface itself across the physical box overlap. Chrome otherwise
		 * exposes the backdrop-filter edge as a dark one-pixel seam. */
		bottom: -1px;
		transform: translateY(-1px);
	}

	.spatial-element-sticky-tabs:global([data-active]) {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
	}

	.sticky-header-layout {
		display: grid;
		position: relative;
		z-index: 3;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 16px;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 8px 16px 8px var(--spatial-element-sticky-minimap-reserve, 96px);
		opacity: var(--spatial-element-sticky-header-progress, 0);
	}

	.spatial-element-sticky-tabs :global([data-spatial-element-tab-list]) {
		position: relative;
		z-index: 1;
	}

	.sticky-header-copy {
		display: grid;
		gap: 0;
		min-width: 0;
	}

	.sticky-header-kicker,
	.sticky-header-title {
		margin: 0;
		color: var(--spatial-element-ink);
	}

	.sticky-header-kicker {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	}

	.sticky-header-title {
		overflow: hidden;
		font-size: 24px;
		font-weight: 600;
		line-height: 32px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sticky-header-action {
		visibility: hidden;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: var(--spatial-element-control-radius);
		color: var(--spatial-element-on-accent);
		background: var(--spatial-element-accent);
		text-decoration: none;
		cursor: pointer;
	}
	.spatial-element-sticky-header:global([data-action-active]) .sticky-header-action { visibility: visible; }

	@media (width < 840px) {
		.sticky-header-layout {
			gap: 8px;
			padding-right: 8px;
		}
		.sticky-header-title { font-size: 18px; line-height: 24px; }
		.spatial-element-sticky-tabs { display: none; }
	}
</style>
