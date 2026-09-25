<script lang="ts">
	import { getContext, onMount, tick, untrack } from 'svelte';
	import Section from './Section.svelte';
	import CarouselProduct from './CarouselProduct.svelte';
	import { CATALOG_POSE_CHANGED } from '@spatial-elements/core/catalog/catalogPose';
	import type { CarouselPresentation } from '@spatial-elements/core/catalog/catalogPose';
	import type { ProductOverviewItem, ProductSectionDefinition } from '@spatial-elements/core/product-detail/types';
	import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import {
		carouselKey,
		resolveCarouselSelection,
		stepCarouselSelection
	} from '@spatial-elements/core/catalog/carouselSelection';

	let {
		section,
		presentation,
		list,
		initialItemKey,
		onselectionchange
	}: {
		section: ProductSectionDefinition;
		list: ProductOverviewItem[];
		presentation?: CarouselPresentation;
		initialItemKey?: string;
		onselectionchange?: (selection: { itemKey: string; productId: string }) => void;
	} = $props();
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);

	let requested = $state<string>();
	let interactive = $state(false);
	let phase = $state(0);
	let windowPhase = $state(0);
	$effect(() => {
		if (Math.abs(phase - windowPhase) > 0.75) windowPhase = Math.round(phase);
	});
	let ring: HTMLDivElement;
	let frame = 0;
	let visible = true;
	let suppressClick = false;
	let clickTimer: ReturnType<typeof setTimeout>;
	let announced = $state<string>();
	let selectionDirty = false;
	let previousKeys: string | undefined;
	function rememberSelection() {
		if (!selectionDirty) return;
		selectionDirty = false;
		sections?.remember();
	}
	let drag: { id: number; x: number; y: number; phase: number; active: boolean } | undefined;
	function invalidate() {
		window.dispatchEvent(new Event(CATALOG_POSE_CHANGED));
	}
	function releaseDrag() {
		const current = drag;
		drag = undefined;
		if (current && ring?.hasPointerCapture(current.id)) ring.releasePointerCapture(current.id);
	}
	function settle() {
		cancelAnimationFrame(frame);
		frame = 0;
		releaseDrag();
		phase = Math.max(0, keys.indexOf(selected ?? ''));
		announced = selected;
		void tick().then(invalidate);
		rememberSelection();
	}
	function animate(target: number) {
		cancelAnimationFrame(frame);
		const start = phase;
		const started = performance.now();
		if (
			Math.abs(target - start) > 1.5 ||
			!visible ||
			document.hidden ||
			matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			phase = target;
			announced = selected;
			invalidate();
			rememberSelection();
			return;
		}
		const advance = (now: number) => {
			if (ring?.closest('[data-catalog-transition]')) {
				frame = 0;
				return;
			}
			const t = Math.min(1, (now - started) / 320);
			phase = start + (target - start) * (1 - (1 - t) ** 2);
			void tick().then(invalidate);
			if (t < 1) frame = requestAnimationFrame(advance);
			else {
				frame = 0;
				announced = selected;
				rememberSelection();
			}
		};
		frame = requestAnimationFrame(advance);
	}
	function pointerdown(event: PointerEvent) {
		if (
			list.length < 2 ||
			event.button !== 0 ||
			!(event.target as Element).closest('.product-visual')
		)
			return;
		drag = { id: event.pointerId, x: event.clientX, y: event.clientY, phase, active: false };
	}
	function pointermove(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		const x = event.clientX - drag.x,
			y = event.clientY - drag.y;
		if (!drag.active) {
			if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
				drag = undefined;
				return;
			}
			if (Math.abs(x) < 10 || Math.abs(x) < Math.abs(y) * 1.2) return;
			drag.active = true;
			suppressClick = true;
			cancelAnimationFrame(frame);
			ring.setPointerCapture(event.pointerId);
		}
		phase = Math.max(0, Math.min(keys.length - 1, drag.phase - x / 220));
		invalidate();
	}
	function pointerup(event: PointerEvent) {
		if (!drag || drag.id !== event.pointerId) return;
		const active = drag.active;
		releaseDrag();
		if (active) select(keys[Math.round(phase)]);
		clearTimeout(clickTimer);
		clickTimer = setTimeout(() => (suppressClick = false), 0);
	}
	function pointercancel() {
		releaseDrag();
		suppressClick = false;
		animate(Math.max(0, keys.indexOf(selected ?? '')));
	}
	const keys = $derived(list.map(carouselKey));
	const selected = $derived(resolveCarouselSelection(keys, requested ?? initialItemKey));
	$effect(() => {
		// Data reordering/removal changes indices, never the stable selection identity.
		const signature = JSON.stringify(keys);
		if (interactive)
			untrack(() => {
				if (previousKeys !== undefined && previousKeys !== signature) selectionDirty = true;
				previousKeys = signature;
				settle();
			});
	});
	function select(key: string | undefined) {
		selectionDirty = true;
		requested = key;
		// Persist in the current entry before a possible popstate changes the history index.
		rememberSelection();
		const target = Math.max(0, keys.indexOf(key ?? ''));
		animate(target);
		const product = list.find((item) => carouselKey(item) === selected);
		if (product && selected) onselectionchange?.({ itemKey: selected, productId: product.id });
	}
	function keydown(event: KeyboardEvent) {
		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (step) select(stepCarouselSelection(keys, selected, step));
		else if (event.key === 'Home') select(keys[0]);
		else if (event.key === 'End') select(keys.at(-1));
		else return;
		event.preventDefault();
	}
	onMount(() => {
		interactive = true;
		const release = sections?.register(section.id, {
			read: () => selected,
			restore: (key) => {
				selectionDirty = false;
				requested = resolveCarouselSelection(keys, key ?? initialItemKey);
				cancelAnimationFrame(frame);
				phase = Math.max(0, keys.indexOf(requested ?? ''));
				announced = requested;
			}
		});
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			if (!visible) {
				settle();
			}
		});
		observer.observe(ring);
		let sizingFrame = 0;
		const measure = () => {
			sizingFrame = 0;
			const heights = [...ring.querySelectorAll<HTMLElement>('.summary')].map(
				(panel) => panel.offsetHeight
			);
			const contentHeight = Math.max(0, ...heights);
			const height =
				ring.clientWidth < 700 ? 408 + contentHeight : Math.max(560, contentHeight + 64);
			const value = height + 'px';
			if (ring.style.getPropertyValue('--carousel-height') !== value)
				ring.style.setProperty('--carousel-height', value);
		};
		const scheduleSize = () => {
			if (!sizingFrame) sizingFrame = requestAnimationFrame(measure);
		};
		const sizing = new ResizeObserver(scheduleSize);
		const contentChanges = new MutationObserver(() => {
			sizing.disconnect();
			sizing.observe(ring);
			for (const panel of ring.querySelectorAll('.summary')) sizing.observe(panel);
			scheduleSize();
		});
		contentChanges.observe(ring, { childList: true, subtree: true });
		sizing.observe(ring);
		for (const panel of ring.querySelectorAll('.summary')) sizing.observe(panel);
		const stop = () => pointercancel();
		window.addEventListener('resize', stop);
		const hidden = () => {
			if (document.hidden) settle();
		};
		document.addEventListener('visibilitychange', hidden);
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') stop();
		};
		window.addEventListener('keydown', escape);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(clickTimer);
			releaseDrag();
			observer.disconnect();
			sizing.disconnect();
			contentChanges.disconnect();
			cancelAnimationFrame(sizingFrame);
			release?.();
			window.removeEventListener('resize', stop);
			window.removeEventListener('keydown', escape);
			document.removeEventListener('visibilitychange', hidden);
		};
	});
</script>

<Section {section} presentation="list">
	<div
		class="carousel"
		class:interactive
		class:populated={list.length > 0}
		data-carousel-section={section.id}
	>
		<div
			class="ring"
			bind:this={ring}
			onpointerdown={pointerdown}
			onpointermove={pointermove}
			onpointerup={pointerup}
			onpointercancel={pointercancel}
			onlostpointercapture={() => {
				if (drag) pointercancel();
			}}
			role="group"
			aria-label={section.title}
		>
			{#each list as product, index (carouselKey(product))}
				<CarouselProduct
					{product}
					sectionId={section.id}
					{presentation}
					{index}
					count={list.length}
					{phase}
					{windowPhase}
					selected={selected === carouselKey(product)}
					{interactive}
					onselect={() => {
						if (!suppressClick) select(carouselKey(product));
					}}
				/>
			{/each}
		</div>
		{#if interactive && list.length > 1}
			<div class="controls" role="group" aria-label={`${section.title}: product selection`}>
				{#each list as product (carouselKey(product))}
					<button
						onkeydown={keydown}
						aria-label={product.eyebrow}
						aria-pressed={selected === carouselKey(product)}
						onclick={() => select(carouselKey(product))}><span aria-hidden="true"></span></button
					>
				{/each}
			</div>
		{/if}
		{#if interactive}<p class="sr-only" role="status">
				{list.find((item) => carouselKey(item) === announced)?.title ?? ''}
			</p>{/if}
	</div>
</Section>

<style>
	.carousel {
		pointer-events: auto;
		margin-top: 24px;
	}
	.ring {
		container-type: inline-size;
		position: relative;
		touch-action: pan-y;
	}
	.interactive.populated .ring {
		min-height: var(--carousel-height, 560px);
	}
	.controls {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 16px;
	}
	.controls button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		background: transparent;
		border-radius: 50%;
		cursor: pointer;
	}
	.controls span {
		width: 10px;
		height: 10px;
		border: 1px solid var(--product-accent);
		border-radius: 50%;
	}
	.controls button[aria-pressed='true'] span {
		background: var(--product-accent);
	}
	.controls button:focus-visible {
		outline: 2px solid var(--product-accent);
		outline-offset: -4px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
