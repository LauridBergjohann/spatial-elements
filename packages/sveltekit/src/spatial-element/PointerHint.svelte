<script lang="ts">
	import { onMount } from 'svelte';
	import { MoveHorizontal, Search, Rotate3D } from 'lucide-svelte';
	import { carouselTextHit } from './carouselTextHit.js';
	let badge: HTMLDivElement;
	let action = $state<'move' | 'details' | 'rotate' | undefined>();
	onMount(() => {
		let frame = 0, x = 0, y = 0, buttons = 0;
		let text: HTMLElement | undefined;
		const clearText = () => { text?.removeAttribute('data-carousel-text-hit'); text = undefined; };
		const hide = () => { cancelAnimationFrame(frame); frame = 0; action = undefined; clearText(); };
		const update = () => {
			frame = 0;
			clearText();
			const target = document.elementFromPoint(x, y);
			const shell = badge.closest('.brand-stage-shell');
			if (!target || !shell?.contains(target) || target.closest('[data-catalog-transition]')) { action = undefined; return; }
			const section = target.closest('.carousel-drag-section');
			const dragging = section?.hasAttribute('data-carousel-dragging');
			if (section?.querySelector('.carousel.interactive')) {
				text = !dragging ? carouselTextHit(target, x, y) : undefined;
				text?.setAttribute('data-carousel-text-hit', '');
				const geometry = target.closest('.spatial-element-target');
				action = dragging ? 'move' : text || (buttons & 1) || (!geometry && target.closest('a, button, input, textarea, select, [contenteditable]'))
					? undefined : geometry?.closest('.selected') ? 'details' : 'move';
			} else {
				const cursor = target instanceof HTMLCanvasElement ? target.style.cursor : '';
				action = cursor === 'grab' || cursor === 'grabbing' ? 'rotate' : undefined;
			}
		};
		const move = (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') { hide(); return; }
			x = event.clientX; y = event.clientY; buttons = event.buttons;
			// Position immediately, independently of the frame-batched hit testing.
			// No reactive update or interpolation between the pointer and its hint.
			badge.style.transform = `translate3d(${Math.max(0, Math.min(x + 10, innerWidth - 22))}px, ${Math.max(0, Math.min(y + 14, innerHeight - 22))}px, 0)`;
			if (!frame) frame = requestAnimationFrame(update);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerdown', move);
		window.addEventListener('pointerup', move);
		window.addEventListener('blur', hide);
		window.addEventListener('pointercancel', hide);
		window.addEventListener('keydown', hide);
		window.addEventListener('scroll', hide, true);
		document.documentElement.addEventListener('pointerleave', hide);
		const observer = new MutationObserver(hide);
		observer.observe(badge.closest('.brand-stage-shell')!, {subtree:true, attributes:true, attributeFilter:['data-catalog-transition']});
		return () => {
			hide();
			observer.disconnect();
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerdown', move);
			window.removeEventListener('pointerup', move);
			window.removeEventListener('blur', hide);
			window.removeEventListener('pointercancel', hide);
			window.removeEventListener('keydown', hide);
			window.removeEventListener('scroll', hide, true);
			document.documentElement.removeEventListener('pointerleave', hide);
		};
	});
</script>

<div bind:this={badge} class="pointer-hint" data-pointer-hint={action} hidden={!action} aria-hidden="true">
	{#if action === 'move'}<MoveHorizontal size={20} strokeWidth={1.8} />
	{:else if action === 'details'}<Search size={20} strokeWidth={1.8} />
	{:else if action === 'rotate'}<Rotate3D size={20} strokeWidth={1.8} />{/if}
</div>

<style>
	.pointer-hint { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
		display: grid; place-items: center; width: 20px; height: 20px;
		color: var(--spatial-element-ink); will-change: transform;
		/* Contrast follows the strokes only, without a button-like surface. */
		filter: drop-shadow(0 0 1px var(--spatial-element-background))
			drop-shadow(0 0 1px var(--spatial-element-background)); }
	.pointer-hint[hidden] { display: none; }
</style>
