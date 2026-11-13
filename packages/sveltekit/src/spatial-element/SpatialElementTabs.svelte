<script lang="ts">
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import { onMount, tick } from 'svelte';
	import Panel from '../stage/Panel.svelte';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import SpatialElementTabList from './SpatialElementTabList.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import './layout.generated.css';
	import type { SpatialElementSectionNavigationItem } from '@spatial-elements/core/spatial-element/types';

	let {
		tabList = $bindable(),
		activeSectionId,
		sections
	}: {
		tabList?: HTMLElement;
		activeSectionId?: string;
		sections: SpatialElementSectionNavigationItem[];
	} = $props();
	let anchorElement: HTMLDivElement | null | undefined;
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const radii = $derived(resolveSpatialThemeRadii(theme));

	onMount(() => {
		let resizeObserver: ResizeObserver | undefined;
		let mutationObserver: MutationObserver | undefined;
		let measureFrame = 0;
		let measuredNaturalWidth = 0;
		let disposed = false;

		const measure = () => {
			// bind:this can already be cleared while a queued measurement still owns
			// this callback. Cleanup cancels pending RAFs, but is not a DOM lease.
			const anchor = anchorElement;
			if (disposed || !anchor?.isConnected) return;
			const frame = anchor.querySelector<HTMLElement>('[data-stage-panel-fallback]');
			// The panel renderer can portal the list before the first measurement.
			// Keep its bound reference instead of searching the emptied frame.
			const links = tabList?.querySelector<HTMLElement>('[data-spatial-element-tab-links]');
			if (!frame || !tabList || !links) return;
			if (getComputedStyle(anchor).display === 'none') return;

			let linksWidth = links.scrollWidth;
			if (linksWidth < 1) {
				// A submenu first opened at XS/S has no intrinsic width yet. Once
				// it enters M, its portaled runtime is still culled by that zero-width
				// source frame. Measure the same nodes without painting them, then
				// restore the exact renderer-owned styles in this synchronous turn.
				const hidden: { node: HTMLElement; display: string; displayPriority: string;
					visibility: string; visibilityPriority: string }[] = [];
				for (let node: HTMLElement | null = tabList; node && !node.classList.contains('stage'); node = node.parentElement) {
					if (getComputedStyle(node).display !== 'none') continue;
					hidden.push({ node, display: node.style.getPropertyValue('display'),
						displayPriority: node.style.getPropertyPriority('display'),
						visibility: node.style.getPropertyValue('visibility'),
						visibilityPriority: node.style.getPropertyPriority('visibility') });
					node.style.setProperty('visibility', 'hidden', 'important');
					node.style.setProperty('display', 'block', 'important');
				}
				try { linksWidth = links.scrollWidth; }
				finally {
					for (const state of hidden) {
						if (state.display) state.node.style.setProperty('display', state.display, state.displayPriority);
						else state.node.style.removeProperty('display');
						if (state.visibility) state.node.style.setProperty('visibility', state.visibility, state.visibilityPriority);
						else state.node.style.removeProperty('visibility');
					}
				}
			}
			if (linksWidth < 1) return;
			const naturalWidth = Math.ceil(linksWidth);
			if (naturalWidth === measuredNaturalWidth) return;
			measuredNaturalWidth = naturalWidth;

			anchor.style.setProperty('--spatial-element-tabs-natural-width', `${measuredNaturalWidth}px`);
			anchor.toggleAttribute('data-spatial-element-tabs-measured', true);
			window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
		};

		const scheduleMeasure = () => {
			if (disposed || measureFrame) return;
			measureFrame = requestAnimationFrame(() => {
				measureFrame = 0;
				measure();
			});
		};

		void tick().then(() => {
			if (disposed) return;
			measure();
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
		void document.fonts?.ready.then(scheduleMeasure);

		return () => {
			disposed = true;
			window.removeEventListener('resize', scheduleMeasure);
			resizeObserver?.disconnect();
			mutationObserver?.disconnect();
			if (measureFrame) cancelAnimationFrame(measureFrame);
		};
	});
</script>

<div bind:this={anchorElement} class="spatial-element-tabs-anchor" data-spatial-element-tabs-panel-anchor>
	<Panel
		transitionGroup="enter"
		class="spatial-element-tabs-panel"
		pointerReactive={false}
		shape={{ ...theme.panelShape, radius: radii.control, contentInset: 0 }}
		theme={theme.panelTheme}
		contentClass="spatial-element-tabs-panel-content"
	>
		<SpatialElementTabList bind:element={tabList} {activeSectionId} {sections} variant="panel" />
	</Panel>
</div>

<style>
	.spatial-element-tabs-anchor {
		position: relative;
		z-index: 4;
		width: fit-content;
		max-width: 100%;
		height: var(--spatial-detail-submenu-height);
		pointer-events: auto;
	}

	.spatial-element-tabs-anchor:global([data-spatial-element-tabs-measured]) {
		width: min(var(--spatial-element-tabs-natural-width), 100%);
	}

	:global(.spatial-element-tabs-panel) {
		width: max-content;
		max-width: 100%;
		height: var(--spatial-detail-submenu-height);
		min-height: var(--spatial-detail-submenu-height);
		pointer-events: auto;
	}

	.spatial-element-tabs-anchor:global([data-spatial-element-tabs-measured]) :global(.spatial-element-tabs-panel) {
		width: 100%;
	}

	:global(.spatial-element-tabs-panel-content) {
		display: flex;
		align-items: center;
		border-radius: inherit;
		overflow: hidden;
	}
	@media (width < 840px) {
		.spatial-element-tabs-anchor { display: none; }
	}
</style>
