<script lang="ts">
	import { getContext, onMount, tick, untrack } from 'svelte';
	import Section from './Section.svelte';
	import CarouselSpatialElement from './CarouselSpatialElement.svelte';
	import { CATALOG_POSE_CHANGED } from '@spatial-elements/core/catalog/catalogPose';
	import type { CarouselLayout, CarouselPresentation } from '@spatial-elements/core/catalog/catalogPose';
	import type { SpatialListItem, SpatialElementSectionDefinition } from '@spatial-elements/core/spatial-element/types';
	import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import {
		carouselKey,
		resolveCarouselSelection,
		stepCarouselSelection
	} from '@spatial-elements/core/catalog/carouselSelection';
	import {
		CarouselDrag,
		CarouselScrollDrag,
		clampCarouselPhase,
		sampleCarouselSpring,
		sampleCarouselScrollMomentum
	} from '@spatial-elements/core/catalog/carouselMotion';
	import { markStageScrollInput } from '@spatial-elements/core/stage/scrollFrame';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';

	let {
		section,
		presentation,
		list,
		initialItemKey,
		onselectionchange
	}: {
		/** Unique page-local anchor, heading and optional CSS appearance overrides. */
		section: SpatialElementSectionDefinition;
		/** Project element documents with getSpatialListItems; assets register automatically. */
		list: SpatialListItem[];
		/** Spacing (normalized around 0.48) and depth (default 700 CSS-world pixels). */
		presentation?: CarouselPresentation;
		/** Initially selected itemKey (or element ID); defaults to the first item. */
		initialItemKey?: string;
		/** Reports selection changes; URL and application state remain host-owned. */
		onselectionchange?: (selection: { itemKey: string; spatialElementId: string }) => void;
	} = $props();
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);

	let requested = $state<string>();
	const interactive = $derived(stage?.isEnhanced?.() ?? false);
	let phase = $state(0);
	let windowPhase = $state(0);
	$effect(() => {
		if (Math.abs(phase - windowPhase) > 0.75) windowPhase = Math.round(phase);
	});
	let ring: HTMLDivElement;
	let layout = $state<CarouselLayout>({ width: 1320, height: 560, left: 60, viewportWidth: 1440 });
	function measureLayout() {
		const { width, height, left } = ring.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		if (width > 0 && height > 0 && (width !== layout.width || height !== layout.height ||
			left !== layout.left || viewportWidth !== layout.viewportWidth)) {
			layout = { width, height, left, viewportWidth };
			void tick().then(invalidate);
		}
	}
	let frame = 0;
	let scrollFrame = 0;
	let nativeFrame = 0;
	let visible = true;
	let suppressClick = false;
	let clickTimer: ReturnType<typeof setTimeout>;
	let announced = $state<string>();
	let selectionDirty = false;
	let previousKeys: string | undefined;
	let wasInteractive = false;
	function rememberSelection() {
		if (!selectionDirty) return;
		selectionDirty = false;
		sections?.remember();
	}
	let drag: { id: number; kind: 'pointer' | 'touch'; motion: CarouselDrag; scroll?: CarouselScrollDrag } | undefined;
	function writeScroll(position: number) {
		markStageScrollInput('touch');
		window.scrollTo({ top: position, behavior: 'instant' });
	}
	function stopScrollMomentum() {
		cancelAnimationFrame(scrollFrame);
		scrollFrame = 0;
		window.removeEventListener('touchstart', stopScrollMomentum, true);
		window.removeEventListener('pointerdown', stopScrollMomentum, true);
		window.removeEventListener('wheel', stopScrollMomentum, true);
		window.removeEventListener('keydown', stopScrollMomentum, true);
		window.removeEventListener('popstate', stopScrollMomentum);
	}
	function scrollMomentum(scroll: CarouselScrollDrag, velocity: number) {
		stopScrollMomentum();
		if (Math.abs(velocity) < 0.02 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const start = scroll.position;
		const started = performance.now();
		for (const name of ['touchstart', 'pointerdown', 'wheel', 'keydown'])
			window.addEventListener(name, stopScrollMomentum, { capture: true, passive: true });
		window.addEventListener('popstate', stopScrollMomentum);
		const advance = (now: number) => {
			if (ring?.closest('[data-catalog-transition]')) {
				stopScrollMomentum();
				return;
			}
			const sample = sampleCarouselScrollMomentum(start, velocity, now - started, scroll.maximum);
			writeScroll(sample.position);
			if (sample.finished) stopScrollMomentum();
			else scrollFrame = requestAnimationFrame(advance);
		};
		scrollFrame = requestAnimationFrame(advance);
	}
	function invalidate() {
		window.dispatchEvent(new Event(CATALOG_POSE_CHANGED));
	}
	function releaseDrag() {
		const current = drag;
		drag = undefined;
		window.removeEventListener('pointerup', pointerup);
		window.removeEventListener('touchstart', multitouch);
		window.removeEventListener('touchmove', touchmove);
		window.removeEventListener('touchend', touchend);
		window.removeEventListener('touchcancel', touchcancel);
		if (current?.kind === 'pointer' && ring?.hasPointerCapture(current.id))
			ring.releasePointerCapture(current.id);
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
	function animate(target: number, velocity?: number) {
		cancelAnimationFrame(frame);
		frame = 0;
		const start = phase;
		const started = performance.now();
		if (
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
			const elapsed = now - started;
			const spring = velocity === undefined ? undefined : sampleCarouselSpring(start, velocity, target, elapsed);
			const duration = Math.min(700, 320 + Math.max(0, Math.abs(target - start) - 1) * 70);
			const t = Math.min(1, elapsed / duration);
			const finished = spring
				? (Math.abs(spring.phase - target) < 0.001 && Math.abs(spring.velocity) < 0.00005) || elapsed >= 1000
				: t >= 1;
			phase = finished ? target : spring
				? clampCarouselPhase(spring.phase, keys.length)
				: start + (target - start) * (1 - (1 - t) ** 2);
			void tick().then(invalidate);
			if (!finished) frame = requestAnimationFrame(advance);
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
			!interactive ||
			event.pointerType === 'touch' ||
			drag ||
			list.length < 2 ||
			event.button !== 0 ||
			!(event.target as Element).closest('.spatial-element-visual')
		)
			return;
		beginDrag(event.pointerId, 'pointer', event.clientX);
		window.addEventListener('pointerup', pointerup);
	}
	function pointermove(event: PointerEvent) {
		if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
		moveDrag(event.clientX);
		if (drag.motion.active && !ring.hasPointerCapture(event.pointerId)) ring.setPointerCapture(event.pointerId);
	}
	function pointerup(event: PointerEvent) {
		if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
		endDrag(false, event.clientX);
	}
	function beginDrag(id: number, kind: 'pointer' | 'touch', x: number, y?: number) {
		cancelAnimationFrame(frame);
		stopScrollMomentum();
		frame = 0;
		clearTimeout(clickTimer);
		suppressClick = false;
		const now = performance.now();
		drag = {
			id, kind, motion: new CarouselDrag(x, phase, now),
			scroll: y === undefined ? undefined : new CarouselScrollDrag(y, window.scrollY,
				Math.max(0, document.documentElement.scrollHeight - window.innerHeight), now)
		};
	}
	function moveDrag(x: number, y?: number) {
		if (!drag) return;
		const now = performance.now();
		drag.motion.move(x, now, keys.length);
		if (y !== undefined) drag.scroll?.move(y, now);
		if (!drag.motion.active && !drag.scroll?.active) return;
		suppressClick = true;
		// Touch input can arrive faster than rendering. Commit only once per animation frame.
		if (!frame) frame = requestAnimationFrame(() => {
			frame = 0;
			if (!drag) return;
			phase = drag.motion.phase;
			if (drag.scroll?.active) writeScroll(drag.scroll.position);
			void tick().then(invalidate);
		});
	}
	function endDrag(cancelled = false, x?: number, y?: number) {
		if (!drag) return;
		const { motion, kind, scroll } = drag;
		const now = performance.now();
		const release = motion.release(now, keys.length, x);
		const scrollVelocity = scroll?.release(now, y) ?? 0;
		if (motion.active || scroll?.active) suppressClick = true;
		cancelAnimationFrame(frame);
		frame = 0;
		phase = motion.phase;
		if (scroll?.active) writeScroll(scroll.position);
		releaseDrag();
		const momentum = !cancelled && !matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (motion.active) select(keys[momentum ? release.target : Math.round(phase)], momentum ? release.velocity : 0);
		else animate(Math.max(0, keys.indexOf(selected ?? '')));
		if (!cancelled && scroll?.active) scrollMomentum(scroll, scrollVelocity);
		clearTimeout(clickTimer);
		// Cover compatibility clicks after touch release; a new gesture always clears this.
		clickTimer = setTimeout(() => (suppressClick = false), kind === 'touch' ? 400 : 0);
	}
	function pointercancel(event?: PointerEvent) {
		// Native pinch zoom may cancel PointerEvents; TouchEvents own gesture cleanup.
		if (event?.pointerType === 'touch') return;
		stopScrollMomentum();
		releaseDrag();
		clearTimeout(clickTimer);
		clickTimer = setTimeout(() => (suppressClick = false), 400);
		animate(Math.max(0, keys.indexOf(selected ?? '')));
	}
	function touchstart(event: TouchEvent) {
		if (!interactive || drag || event.touches.length !== 1 ||
			!(event.target as Element).closest('.spatial-element-visual')) return;
		const touch = event.touches[0];
		beginDrag(touch.identifier, 'touch', touch.clientX, touch.clientY);
		window.addEventListener('touchstart', multitouch, { passive: true });
		window.addEventListener('touchmove', touchmove, { passive: true });
		window.addEventListener('touchend', touchend, { passive: true });
		window.addEventListener('touchcancel', touchcancel, { passive: true });
	}
	function multitouch(event: TouchEvent) {
		if (drag?.kind === 'touch' && event.touches.length > 1) endDrag(true);
	}
	function touchmove(event: TouchEvent) {
		if (drag?.kind !== 'touch') return;
		if (event.touches.length !== 1) return endDrag(true);
		const touch = event.touches[0];
		if (touch.identifier === drag.id) moveDrag(touch.clientX, touch.clientY);
	}
	function touchend(event: TouchEvent) {
		if (drag?.kind !== 'touch') return;
		const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === drag?.id);
		if (touch) endDrag(false, touch.clientX, touch.clientY);
	}
	function touchcancel() {
		if (drag?.kind === 'touch') endDrag(true);
	}
	const keys = $derived(list.map(carouselKey));
	const selected = $derived(resolveCarouselSelection(keys, requested ?? initialItemKey));
	const initialIndex = $derived(Math.max(0, keys.indexOf(resolveCarouselSelection(keys, initialItemKey) ?? '')));
	// The authored initial item is first in the native rail, including before hydration.
	const orderedItems = $derived([...list.entries()].slice(initialIndex).concat([...list.entries()].slice(0, initialIndex)));
	// Navigation keeps its destination identity; the dots follow the visible seat during motion.
	const indicated = $derived(keys[Math.round(clampCarouselPhase(phase, keys.length))]);
	$effect(() => {
		// Data reordering/removal changes indices, never the stable selection identity.
		const signature = JSON.stringify(keys);
		if (interactive)
			untrack(() => {
				wasInteractive = true;
				// Preserve the selection made while loading, then release the native scroll offset.
				if (nativeFrame) cancelAnimationFrame(nativeFrame);
				nativeFrame = 0;
				if (ring) ring.scrollLeft = 0;
				if (previousKeys !== undefined && previousKeys !== signature) selectionDirty = true;
				previousKeys = signature;
				settle();
			});
		else if (wasInteractive) untrack(() => {
			wasInteractive = false;
			for (const panel of ring.querySelectorAll<HTMLElement>('.summary')) panel.style.removeProperty('transform');
			for (const target of ring.querySelectorAll<HTMLElement>('.spatial-element-target')) {
				for (const property of ['left', 'top', 'width', 'height', 'max-width']) target.style.removeProperty(property);
			}
			void tick().then(() => scrollNative(selected));
		});
	});
	function select(key: string | undefined, velocity?: number) {
		selectionDirty = true;
		requested = key;
		// Persist in the current entry before a possible popstate changes the history index.
		rememberSelection();
		const target = Math.max(0, keys.indexOf(key ?? ''));
		if (interactive) animate(target, velocity);
		else {
			phase = target;
			windowPhase = target;
			announced = key;
			scrollNative(key, true);
		}
		const spatialElement = list.find((item) => carouselKey(item) === selected);
		if (spatialElement && selected) onselectionchange?.({ itemKey: selected, spatialElementId: spatialElement.id });
	}
	function scrollNative(key: string | undefined, smooth = false) {
		if (!ring || !keys.length) return;
		const index = Math.max(0, keys.indexOf(key ?? ''));
		const seat = (index - initialIndex + keys.length) % keys.length;
		ring.scrollTo({ left: seat * ring.clientWidth,
			behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
	}
	function nativeScroll() {
		if (interactive || nativeFrame || !keys.length) return;
		nativeFrame = requestAnimationFrame(() => {
			nativeFrame = 0;
			if (interactive) return;
			const seat = Math.round(ring.scrollLeft / Math.max(1, ring.clientWidth));
			const index = (seat + initialIndex) % keys.length;
			const key = keys[index];
			if (key === selected) return;
			requested = announced = key;
			phase = windowPhase = index;
			selectionDirty = true;
			rememberSelection();
			onselectionchange?.({ itemKey: key, spatialElementId: list[index].id });
		});
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
		// Section's child snippet can clear bind:this before this mount cleanup runs.
		const carouselRing = ring;
		measureLayout();
		// Read metrics only after layout changes; never during drag or render frames.
		const layoutObserver = new ResizeObserver(measureLayout);
		layoutObserver.observe(carouselRing);
		const nativeSeat = Math.round(carouselRing.scrollLeft / Math.max(1, carouselRing.clientWidth));
		const nativeInitialKey = keys[(nativeSeat + initialIndex) % Math.max(1, keys.length)];
		let restored = false;
		// The model owns both single-finger axes; passive events still allow native pinch zoom.
		carouselRing.addEventListener('touchstart', touchstart, { passive: true });
		const release = sections?.register(section.id, {
			read: () => selected,
			restore: (key) => {
				stopScrollMomentum();
				selectionDirty = false;
				requested = resolveCarouselSelection(keys, key ?? (!restored && !interactive ? nativeInitialKey : initialItemKey));
				restored = true;
				cancelAnimationFrame(frame);
				frame = 0;
				releaseDrag();
				phase = Math.max(0, keys.indexOf(requested ?? ''));
				announced = requested;
				if (!interactive) void tick().then(() => scrollNative(requested));
			}
		});
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			// The same touch must keep scrolling after carrying the carousel out of view.
			if (interactive && !visible && drag?.kind !== 'touch') {
				settle();
			}
		});
		observer.observe(carouselRing);
		const stop = () => { if (interactive) pointercancel(); };
		let viewportWidth = window.innerWidth;
		const resize = () => {
			measureLayout();
			// Mobile browser chrome resizes the height during scrolling; keep that gesture alive.
			if (window.innerWidth !== viewportWidth) stop();
			viewportWidth = window.innerWidth;
		};
		window.addEventListener('resize', resize);
		window.addEventListener('blur', stop);
		const hidden = () => {
			if (document.hidden) {
				stopScrollMomentum();
				settle();
			}
		};
		document.addEventListener('visibilitychange', hidden);
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') stop();
		};
		window.addEventListener('keydown', escape);
		return () => {
			cancelAnimationFrame(frame);
			cancelAnimationFrame(nativeFrame);
			stopScrollMomentum();
			clearTimeout(clickTimer);
			releaseDrag();
			carouselRing.removeEventListener('touchstart', touchstart);
			observer.disconnect();
			layoutObserver.disconnect();
			release?.();
			window.removeEventListener('resize', resize);
			window.removeEventListener('blur', stop);
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
			onscroll={nativeScroll}
			onpointerdown={pointerdown}
			onpointermove={pointermove}
			onpointerup={pointerup}
			onpointercancel={pointercancel}
			onlostpointercapture={() => {
				if (drag?.kind === 'pointer') pointercancel();
			}}
			role="group"
			aria-label={section.title}
		>
			{#each orderedItems as [index, spatialElement] (carouselKey(spatialElement))}
				<CarouselSpatialElement
					{spatialElement}
					sectionId={section.id}
					{presentation}
					{layout}
					{index}
					count={list.length}
					{phase}
					{windowPhase}
					selected={selected === carouselKey(spatialElement)}
					{interactive}
					onselect={() => {
						if (!suppressClick) select(carouselKey(spatialElement));
					}}
					canActivate={() => !suppressClick}
				/>
			{/each}
		</div>
		{#if list.length > 1}
			<div class="controls" role="group" aria-label={`${section.title}: element selection`}>
				{#each list as spatialElement, index (carouselKey(spatialElement))}
					{#if interactive}
					<button
						onkeydown={keydown}
						aria-label={spatialElement.eyebrow}
						aria-pressed={indicated === carouselKey(spatialElement)}
						onclick={() => select(carouselKey(spatialElement))}><span aria-hidden="true"></span></button
					>
					{:else}
						<a href={`#${encodeURIComponent(`carousel-${section.id}-${index}`)}`}
							onkeydown={keydown}
							aria-label={spatialElement.eyebrow}
							aria-current={selected === carouselKey(spatialElement) ? 'true' : undefined}
							onclick={(event) => { event.preventDefault(); select(carouselKey(spatialElement)); }}
							><span aria-hidden="true"></span></a>
					{/if}
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
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 100%;
		position: relative;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		touch-action: manipulation;
	}
	.ring::-webkit-scrollbar { display: none; }
	.interactive .ring {
		grid-auto-flow: row;
		grid-template-columns: 100%;
		overflow: visible;
		scroll-snap-type: none;
	}
	.controls {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 16px;
	}
	.controls button,
	.controls a {
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
		border: 1px solid var(--spatial-element-accent);
		border-radius: 50%;
	}
	.controls button[aria-pressed='true'] span,
	.controls a[aria-current='true'] span {
		background: var(--spatial-element-accent);
	}
	.controls button:focus-visible,
	.controls a:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
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
