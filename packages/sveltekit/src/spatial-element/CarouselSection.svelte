<script lang="ts">
	import { getContext, onMount, tick, untrack } from 'svelte';
	import Section from './Section.svelte';
	import { retainListDeviceOrientation } from '@spatial-elements/core/catalog/listDeviceOrientation';
	import { carouselTextHit } from './carouselTextHit.js';
	import CarouselSpatialElement from './CarouselSpatialElement.svelte';
	import { CATALOG_POSE_CHANGED, carouselEmphasis, CarouselDragEmphasis, type CarouselEmphasis, type CarouselLayout, type CarouselPresentation } from '@spatial-elements/core/catalog/catalogPose';
	import type { SpatialListItem, SpatialElementSectionDefinition } from '@spatial-elements/core/spatial-element/types';
	import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import { carouselKey, resolveCarouselSelection, stepCarouselSelection } from '@spatial-elements/core/catalog/carouselSelection';
	import { CarouselDrag, CarouselWheelInput, clampCarouselPhase, sampleCarouselInertia } from '@spatial-elements/core/catalog/carouselMotion';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';

	let { section, presentation, list, initialItemKey, onselectionchange }: {
		section: SpatialElementSectionDefinition;
		presentation?: CarouselPresentation;
		list: SpatialListItem[];
		initialItemKey?: string;
		onselectionchange?: (selection: { itemKey: string; spatialElementId: string }) => void;
	} = $props();
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const interactive = $derived(stage?.isEnhanced?.() ?? false);
	const keys = $derived(list.map(carouselKey));
	let requested = $state<string>();
	const selected = $derived(resolveCarouselSelection(keys, requested ?? initialItemKey));
	const initialIndex = $derived(Math.max(0, keys.indexOf(resolveCarouselSelection(keys, initialItemKey) ?? '')));
	const orderedItems = $derived(interactive ? [...list.entries()] : [...list.entries()].slice(initialIndex).concat([...list.entries()].slice(0, initialIndex)));
	let phase = $state(0);
	let windowPhase = $state(0);
	let emphasis = $state<CarouselEmphasis[] | undefined>();
	const focus = $derived(emphasis ? Math.max(0, ...emphasis.map(value => value.advance)) : 1);
	const arrowOpacity = $derived(Math.max(0, ...list.map((_, i) => emphasis?.[i]?.panel ?? carouselEmphasis(i - phase).panel)));
	const indicated = $derived(keys[Math.round(clampCarouselPhase(phase, keys.length))]);
	let announced = $state<string>();
	let ring: HTMLDivElement;
	$effect(() => {
		if (interactive && ring) return retainListDeviceOrientation(ring, () => {});
	});
	let layout = $state<CarouselLayout>({ width: 1320, height: 600, left: 60, viewportWidth: 1440 });
	let frame = 0;
	let nativeFrame = 0;
	let mounted = false;
	let generation = 0;
	let suppressClick = false;
	let clickTimer: ReturnType<typeof setTimeout>;
	let wheelTimer: ReturnType<typeof setTimeout>;
	let drag: { id: number; kind: 'pointer' | 'wheel'; motion: CarouselDrag; emphasis: CarouselDragEmphasis; x: number; y: number; time: number; touch: boolean } | undefined;
	let wheelInput: CarouselWheelInput | undefined;
	const currentEmphasis = () => keys.map((_, i) => emphasis?.[i] ?? carouselEmphasis(i - phase));
	const blocked = () => !!ring?.closest('[data-catalog-transition]');
	function invalidate() {
		if (Math.abs(phase - windowPhase) > 0.75) windowPhase = Math.round(phase);
		void tick().then(() => { if (mounted) window.dispatchEvent(new Event(CATALOG_POSE_CHANGED)); });
	}
	function measureLayout() {
		if (!ring) return;
		const { width, height, left } = ring.getBoundingClientRect();
		layout = { width, height, left, viewportWidth: document.documentElement.clientWidth };
		invalidate();
	}
	function commit(key: string | undefined) {
		const changed = key !== selected;
		requested = key;
		if (changed) {
			sections?.remember();
			const item = list.find(item => carouselKey(item) === key);
			if (item && key) onselectionchange?.({ itemKey: key, spatialElementId: item.id });
		}
	}
	function releaseDrag() {
		ring?.closest('section')?.removeAttribute('data-carousel-dragging');
		clearTimeout(wheelTimer);
		const current = drag;
		drag = undefined;
		wheelInput = undefined;
		window.removeEventListener('pointermove', pointermove);
		window.removeEventListener('pointerup', pointerup);
		window.removeEventListener('pointercancel', pointercancel);
		if (current?.kind === 'pointer' && ring?.hasPointerCapture(current.id)) ring.releasePointerCapture(current.id);
	}
	// One clock drives the turntable and foreground reveal. No scrollLeft writes,
	// snap handoff or velocity overshoot can move the destination sideways first.
	function animate(target: number, reveal = false, velocity = 0) {
		cancelAnimationFrame(frame);
		const start = phase, initial = reveal ? currentEmphasis() : undefined;
		if (!reveal) emphasis = undefined;
		const started = performance.now();
		const duration = reveal ? 240 : Math.min(600, 280 + Math.abs(target - start) * 40);
		const reduced = document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches;
		const advance = (now: number) => {
			frame = 0;
			if (blocked()) return;
			// A queued frame timestamp can precede the release event within that frame.
			const t = reduced ? 1 : Math.max(0, Math.min(1, (now - started) / duration));
			const inertia = !reduced && velocity * (target - start) > 0
				? sampleCarouselInertia(start, velocity, target, now - started) : undefined;
			const amount = inertia?.progress ?? 1 - (1 - t) ** 2;
			// A nearby endpoint can absorb the horizontal speed in one frame. Keep
			// foreground travel continuous, starting now, even in that limiting case.
			const revealAmount = inertia ? Math.min(amount, 1 - (1 - t) ** 2) : amount;
			const finished = inertia ? inertia.finished && t === 1 : t === 1;
			phase = inertia?.phase ?? start + (target - start) * amount;
			if (initial) emphasis = initial.map((value, i) => ({
				advance: value.advance * (1 - revealAmount) + (i === target ? revealAmount : 0),
				panel: value.panel * (1 - revealAmount) + (i === target ? revealAmount : 0)
			}));
			if (finished) { emphasis = undefined; announced = selected; }
			invalidate();
			if (!finished) frame = requestAnimationFrame(advance);
		};
		if (reduced) advance(started); else frame = requestAnimationFrame(advance);
	}
	function beginDrag(id: number, kind: 'pointer' | 'wheel', x: number, y = 0, touch = false) {
		// A tap or zero wheel sample must not interrupt a running selection.
		const time = performance.now();
		drag = { id, kind, x, y, touch, time, motion: new CarouselDrag(x, phase, time), emphasis: new CarouselDragEmphasis(phase, currentEmphasis()) };
		clearTimeout(clickTimer);
		suppressClick = false;
	}
	function moveDrag(x: number) {
		if (!drag) return;
		if (!drag.motion.active) {
			drag.motion = new CarouselDrag(drag.x, phase, drag.time);
			drag.emphasis = new CarouselDragEmphasis(phase, currentEmphasis());
		}
		drag.motion.move(x, performance.now(), keys.length);
		if (!drag.motion.active) return;
		if (drag.kind === 'pointer' && !drag.touch) ring.closest('section')?.setAttribute('data-carousel-dragging', '');
		cancelAnimationFrame(frame);
		suppressClick = true;
		phase = drag.motion.phase;
		emphasis = drag.emphasis.move(phase);
		invalidate();
	}
	function endDrag(x?: number, inertia = false) {
		if (!drag) return;
		const { motion, touch, kind } = drag;
		// An idle timeout detects wheel release after the fact; use the final
		// sample's time so this bookkeeping delay does not discard its velocity.
		const wheelRelease = kind === 'wheel' && inertia && (wheelInput?.samples ?? 0) > 1;
		const release = motion.release(wheelRelease ? wheelInput!.lastTime! : performance.now(), keys.length, x);
		const active = motion.active;
		if (active) {
			phase = motion.phase;
			emphasis = drag.emphasis.move(phase);
		}
		const velocity = inertia && (kind === 'pointer' || wheelRelease) && Math.abs(release.velocity) >= 0.0005 &&
			!matchMedia('(prefers-reduced-motion: reduce)').matches ? release.velocity : 0;
		releaseDrag();
		if (active) {
			const target = velocity ? release.target : Math.round(clampCarouselPhase(phase, keys.length));
			commit(keys[target]);
			animate(target, true, velocity);
		}
		clearTimeout(clickTimer);
		clickTimer = setTimeout(() => { suppressClick = false; }, touch ? 400 : 0);
	}
	function canStartDrag(target: EventTarget | null, touch = false) {
		if (!(target instanceof Element) || target.closest('.controls, .carousel-arrows, input, textarea, select, [contenteditable]')) return false;
		return touch || !target.closest('a, button') || !!target.closest('.spatial-element-target');
	}
	function pointerdown(event: PointerEvent) {
		if (!interactive || blocked() || list.length < 2) return;
		if (!event.isPrimary) { if (drag?.kind === 'pointer') endDrag(); return; }
		if (drag?.kind === 'wheel') endDrag();
		const touch = event.pointerType !== 'mouse';
		if (!touch && carouselTextHit(event.target, event.clientX, event.clientY)) return;
		if (drag || event.button !== 0 || !canStartDrag(event.target, touch)) return;
		if (!touch) event.preventDefault();
		beginDrag(event.pointerId, 'pointer', event.clientX, event.clientY, touch);
		window.addEventListener('pointermove', pointermove);
		window.addEventListener('pointerup', pointerup);
		window.addEventListener('pointercancel', pointercancel);
	}
	function pointermove(event: PointerEvent) {
		if (drag?.kind !== 'pointer' || drag.id !== event.pointerId || blocked()) return;
		if (drag.touch && !drag.motion.active && Math.abs(event.clientX - drag.x) <= Math.abs(event.clientY - drag.y) * 1.2) return;
		moveDrag(event.clientX);
		if (drag?.motion.active && !ring.hasPointerCapture(event.pointerId)) ring.setPointerCapture(event.pointerId);
	}
	function pointerup(event: PointerEvent) {
		if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
		// Do not turn a native vertical gesture or a tap into a horizontal release.
		endDrag(drag.motion.active ? event.clientX : undefined, true);
	}
	function pointercancel(event: PointerEvent) {
		if (drag?.kind === 'pointer' && drag.id === event.pointerId) endDrag();
	}
	function wheel(event: WheelEvent) {
		if (!interactive || blocked() || list.length < 2 || event.ctrlKey || (drag && drag.kind !== 'wheel')) return;
		const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? ring.clientWidth : 1;
		const dx = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * scale;
		const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY * scale;
		if (!drag && (!dx || Math.abs(dx) <= Math.abs(dy) * 1.2)) return;
		if (event.cancelable) event.preventDefault();
		// Newer browsers identify the platform's inertial tail. Finish once and
		// ignore that tail; never add a second fling or reopen the withdrawn panel.
		if ((event as WheelEvent & { momentum?: boolean }).momentum === true) {
			if (drag?.kind === 'wheel') endDrag(undefined, true);
			return;
		}
		if (!dx && !drag) return;
		if (!drag) { beginDrag(0, 'wheel', 0); wheelInput = new CarouselWheelInput(); }
		if (!wheelInput) return;
		wheelInput.move(dx, performance.now());
		moveDrag(wheelInput.x);
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => { if (drag?.kind === 'wheel') endDrag(undefined, true); }, wheelInput.idleMs);
	}
	function select(key: string | undefined) {
		releaseDrag();
		commit(key);
		if (interactive) animate(Math.max(0, keys.indexOf(key ?? '')));
		else scrollNative(key, true);
	}
	function scrollNative(key: string | undefined, smooth = false) {
		if (!ring || !keys.length || interactive) return;
		const index = Math.max(0, keys.indexOf(key ?? ''));
		const seat = (index - initialIndex + keys.length) % keys.length;
		ring.scrollTo({ left: seat * ring.clientWidth, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
	}
	function nativeScroll() {
		if (interactive || nativeFrame || !keys.length) return;
		nativeFrame = requestAnimationFrame(() => {
			nativeFrame = 0;
			if (interactive) return;
			const seat = Math.round(ring.scrollLeft / Math.max(1, ring.clientWidth));
			const index = (seat + initialIndex) % keys.length;
			phase = windowPhase = index;
			announced = keys[index];
			commit(keys[index]);
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
	function resetMotion() {
		cancelAnimationFrame(frame);
		cancelAnimationFrame(nativeFrame);
		frame = nativeFrame = 0;
		releaseDrag();
		phase = windowPhase = Math.max(0, keys.indexOf(selected ?? ''));
		emphasis = undefined;
		announced = selected;
		invalidate();
	}
	$effect(() => {
		const enhanced = interactive, signature = JSON.stringify(keys);
		untrack(() => {
			if (!mounted) return;
			const token = ++generation;
			resetMotion();
			void tick().then(() => {
				if (!mounted || token !== generation) return;
				if (enhanced) ring.scrollLeft = 0;
				else {
					for (const panel of ring.querySelectorAll<HTMLElement>('.summary')) panel.style.removeProperty('transform');
					for (const target of ring.querySelectorAll<HTMLElement>('.spatial-element-target'))
						for (const property of ['left', 'top', 'width', 'height', 'max-width']) target.style.removeProperty(property);
					scrollNative(selected);
				}
				measureLayout();
			});
		});
	});
	onMount(() => {
		mounted = true;
		const carouselRing = ring;
		const nativeSeat = Math.round(ring.scrollLeft / Math.max(1, ring.clientWidth));
		const nativeInitialKey = keys[(nativeSeat + initialIndex) % Math.max(1, keys.length)];
		let restored = false;
		const release = sections?.register(section.id, {
			read: () => selected,
			restore: key => {
				requested = resolveCarouselSelection(keys, key ?? (!restored && !interactive ? nativeInitialKey : initialItemKey));
				restored = true;
				resetMotion();
				void tick().then(() => { if (mounted) scrollNative(requested); });
			}
		});
		measureLayout();
		const observer = new ResizeObserver(measureLayout);
		observer.observe(carouselRing);
		const dragSection = ring.closest('section')!;
		dragSection.addEventListener('wheel', wheel, { passive: false });
		const stop = () => { if (drag) endDrag(); };
		const hidden = () => { if (document.hidden) resetMotion(); };
		const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') stop(); };
		window.addEventListener('blur', stop);
		window.addEventListener('keydown', escape);
		window.addEventListener('resize', measureLayout);
		document.addEventListener('visibilitychange', hidden);
		return () => {
			mounted = false;
			generation++;
			cancelAnimationFrame(frame);
			cancelAnimationFrame(nativeFrame);
			clearTimeout(clickTimer);
			releaseDrag();
			observer.disconnect();
			release?.();
			dragSection.removeEventListener('wheel', wheel);
			window.removeEventListener('blur', stop);
			window.removeEventListener('keydown', escape);
			window.removeEventListener('resize', measureLayout);
			document.removeEventListener('visibilitychange', hidden);
		};
	});
</script>

<Section {section} presentation="list" class="carousel-drag-section"
	ondragstart={(event) => { if (interactive && canStartDrag(event.target)) event.preventDefault(); }}
	onpointerdown={pointerdown}
	onclickcapture={(event) => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); } }}
	onlostpointercapture={(event) => {
		// Touch starts with implicit capture on its hit target. Moving capture to
		// the ring must not be mistaken for the end of that same gesture.
		if (event.target === ring && drag?.kind === 'pointer' && drag.id === event.pointerId) endDrag();
	}}>
	{#if interactive}
		<div class="drag-surface" aria-hidden="true" style:left={`${-layout.left}px`} style:width={`${layout.viewportWidth}px`}></div>
	{/if}
	<div
		class="carousel"
		class:interactive
		class:populated={list.length > 0}
		data-carousel-section={section.id}
		data-device-orientation=""
	>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (The native scroll rail must be keyboard-scrollable without JavaScript.) -->
		<div
			class="ring"
			id={`carousel-ring-${section.id}`}
			tabindex={interactive ? undefined : 0}
			bind:this={ring}
			onscroll={nativeScroll}
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
					emphasis={emphasis?.[index]}
					{focus}
					{windowPhase}
					selected={selected === carouselKey(spatialElement)}
					{interactive}
					onselect={() => {
						if (!suppressClick) select(carouselKey(spatialElement));
					}}
					canActivate={() => !suppressClick}
				/>
			{/each}
			{#if interactive && list.length > 1}
				<div class="carousel-arrows" role="group" aria-label="Carousel navigation"
					style:opacity={arrowOpacity} inert={arrowOpacity < 0.05}>
					<button type="button" class="previous" hidden={selected === keys[0]}
						aria-label="Previous product" aria-controls={`carousel-ring-${section.id}`}
						onclick={() => select(stepCarouselSelection(keys, selected, -1))}>
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
					</button>
					<button type="button" class="next" hidden={selected === keys.at(-1)}
						aria-label="Next product" aria-controls={`carousel-ring-${section.id}`}
						onclick={() => select(stepCarouselSelection(keys, selected, 1))}>
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
					</button>
				</div>
			{/if}
		</div>
		{#if interactive && list.length > 1}
			<div class="controls" role="group" aria-label={`${section.title}: element selection`}>
				{#each list as spatialElement (carouselKey(spatialElement))}
					<button
						onkeydown={keydown}
						aria-label={spatialElement.eyebrow}
						aria-pressed={indicated === carouselKey(spatialElement)}
						onclick={() => select(carouselKey(spatialElement))}><span aria-hidden="true"></span></button
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
	:global(.carousel-drag-section) { position: relative; }
	:global(.carousel-drag-section:has(.interactive)) { touch-action: pan-y pinch-zoom; }
	:global(.carousel-drag-section > .section-kicker) { pointer-events: none; }
	.drag-surface {
		position: absolute;
		top: 0;
		bottom: 0;
		pointer-events: auto;
		touch-action: pan-y pinch-zoom;
		cursor: grab;
	}
	:global(.carousel.interactive .summary) { cursor: grab; }
	:global(.carousel.interactive .summary a),
	:global(.carousel.interactive .summary button) { cursor: pointer; }
	:global(.carousel.interactive [data-carousel-text-hit]) { cursor: text; }
	:global(.carousel-drag-section[data-carousel-dragging]),
	:global(.carousel-drag-section[data-carousel-dragging] *) { cursor: grabbing !important; user-select: none; }
	.carousel.interactive { pointer-events: none; }
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
		scrollbar-width: auto;
		scrollbar-color: var(--spatial-element-accent) transparent;
		touch-action: manipulation;
	}
	.ring:focus-visible { outline: 2px solid var(--spatial-element-accent); outline-offset: 4px; }
	.interactive .ring {
		scrollbar-width: none;
		grid-auto-flow: row;
		grid-template-columns: 100%;
		overflow: visible;
		scroll-snap-type: none;
	}
	.carousel-arrows {
		position: absolute;
		left: 12%;
		right: 50%;
		top: 50%;
		transform: translateY(-50%);
		z-index: 1500;
		display: flex;
		justify-content: space-between;
		pointer-events: none;
	}
	.carousel-arrows button {
		pointer-events: auto;
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		padding: 8px;
		border: 0;
		border-radius: 50%;
		color: var(--spatial-element-accent);
		background: transparent;
		cursor: pointer;
	}
	.carousel-arrows button[hidden] { visibility: hidden; pointer-events: none; }
	.carousel-arrows button:hover { background: color-mix(in srgb, var(--spatial-element-accent) 12%, transparent); }
	.carousel-arrows button:focus-visible { outline: 2px solid var(--spatial-element-accent); }
	.carousel-arrows svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
	@container (max-width: 700px) {
		.carousel-arrows { left: 0; right: 0; top: 180px; }
	}
	.controls {
		position: relative;
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 16px;
	}
	.controls button {
		pointer-events: auto;
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
	.controls button[aria-pressed='true'] span {
		background: var(--spatial-element-accent);
	}
	.controls button:focus-visible {
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
