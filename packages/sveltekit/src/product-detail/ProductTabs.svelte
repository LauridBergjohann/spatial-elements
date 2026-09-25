<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Panel from '../stage/Panel.svelte';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import ProductTabList from './ProductTabList.svelte';
	import { useProductBrand } from './brandContext.js';
	import type { ProductSectionNavigationItem } from '@spatial-elements/core/product-detail/types';

	let {
		activeSectionId,
		sections
	}: {
		activeSectionId?: string;
		sections: ProductSectionNavigationItem[];
	} = $props();
	let anchorElement: HTMLDivElement;
	const theme = useProductBrand();

	onMount(() => {
		let resizeObserver: ResizeObserver | undefined;
		let mutationObserver: MutationObserver | undefined;
		let measureFrame = 0;
		let measuredNaturalWidth = 0;
		let disposed = false;

		const measure = () => {
			measureFrame = 0;
			const frame = anchorElement.querySelector<HTMLElement>('[data-stage-panel-fallback]');
			const tabList = anchorElement.querySelector<HTMLElement>('[data-product-tab-list="panel"]');
			const links = tabList?.querySelector<HTMLElement>('[data-product-tab-links]');
			if (!frame || !tabList || !links) return;

			const linksWidth = links.scrollWidth;
			if (linksWidth < 1) return;
			measuredNaturalWidth = Math.max(measuredNaturalWidth, Math.ceil(linksWidth));
			const currentHeight = Math.max(frame.getBoundingClientRect().height, 52);

			anchorElement.style.setProperty('--product-tabs-natural-width', `${measuredNaturalWidth}px`);
			anchorElement.style.setProperty('--product-tabs-height', `${Math.ceil(currentHeight)}px`);
			anchorElement.toggleAttribute('data-product-tabs-measured', true);
			window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
		};

		const scheduleMeasure = () => {
			if (disposed || measureFrame) return;
			measureFrame = requestAnimationFrame(measure);
		};

		void tick().then(() => {
			if (disposed) return;
			measure();
			const tabList = anchorElement.querySelector<HTMLElement>('[data-product-tab-list="panel"]');
			if ('ResizeObserver' in window && tabList) {
				resizeObserver = new ResizeObserver(scheduleMeasure);
				resizeObserver.observe(tabList);
			}
			if ('MutationObserver' in window && tabList) {
				mutationObserver = new MutationObserver(scheduleMeasure);
				mutationObserver.observe(tabList, {
					childList: true,
					characterData: true,
					subtree: true
				});
			}
		});
		window.addEventListener('resize', scheduleMeasure, { passive: true });

		return () => {
			disposed = true;
			window.removeEventListener('resize', scheduleMeasure);
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			if (measureFrame) cancelAnimationFrame(measureFrame);
		};
	});
</script>

<div bind:this={anchorElement} class="product-tabs-anchor" data-product-tabs-panel-anchor>
	<Panel
		transitionGroup="enter"
		class="product-tabs-panel"
		pointerReactive={false}
		shape={{ ...theme.panelShape, contentInset: 0 }}
		theme={theme.panelTheme}
		contentClass="product-tabs-panel-content"
	>
		<ProductTabList {activeSectionId} {sections} variant="panel" />
	</Panel>
</div>

<style>
	.product-tabs-anchor {
		position: relative;
		z-index: 4;
		width: fit-content;
		max-width: 100%;
		height: var(--product-tabs-height, 52px);
		pointer-events: auto;
	}

	.product-tabs-anchor:global([data-product-tabs-measured]) {
		width: min(var(--product-tabs-natural-width), 100%);
	}

	:global(.product-tabs-panel) {
		width: max-content;
		max-width: 100%;
		height: var(--product-tabs-height, 52px);
		min-height: var(--product-tabs-height, 52px);
		pointer-events: auto;
	}

	.product-tabs-anchor:global([data-product-tabs-measured]) :global(.product-tabs-panel) {
		width: 100%;
	}

	:global(.product-tabs-panel-content) {
		display: flex;
		align-items: center;
		border-radius: inherit;
		overflow: hidden;
	}
</style>
