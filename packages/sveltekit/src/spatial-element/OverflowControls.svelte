<script lang="ts">
	import ChevronUp from 'lucide-svelte/icons/chevron-up';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
	import ChevronLeft from 'lucide-svelte/icons/chevron-left';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	let {
		target,
		responsive = false,
		label,
		hidden = false
	}: {
		target?: HTMLElement;
		responsive?: boolean;
		label: string;
		hidden?: boolean;
	} = $props();
	let vertical = $state(false);
	let before = $state(false);
	let after = $state(false);
	$effect(() => {
		if (!target) return;
		const element = target;
		const breakpoint = matchMedia('(min-width: 840px)');
		const measure = () => {
			vertical = responsive && breakpoint.matches;
			const position = vertical ? element.scrollTop : element.scrollLeft;
			const size = vertical ? element.clientHeight : element.clientWidth;
			const extent = vertical ? element.scrollHeight : element.scrollWidth;
			before = position > 1;
			after = position + size < extent - 1;
		};
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		for (const child of element.children) observer.observe(child);
		element.addEventListener('scroll', measure, { passive: true });
		breakpoint.addEventListener('change', measure);
		measure();
		return () => {
			observer.disconnect();
			element.removeEventListener('scroll', measure);
			breakpoint.removeEventListener('change', measure);
		};
	});
	function move(direction: number) {
		if (!target) return;
		const amount = direction * (vertical ? target.clientHeight : target.clientWidth) * 0.8;
		target.scrollBy({
			left: vertical ? 0 : amount,
			top: vertical ? amount : 0,
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
		});
	}
</script>

<div class="overflow-controls" class:vertical class:hidden data-overflow-controls={label}>
	{#if before}<button
			class="before"
			type="button"
			aria-label={`Previous ${label}`}
			onclick={() => move(-1)}
			tabindex={hidden ? -1 : 0}
		>
			{#if vertical}<ChevronUp size={18} />{:else}<ChevronLeft size={18} />{/if}
		</button>{/if}
	{#if after}<button
			class="after"
			type="button"
			aria-label={`Next ${label}`}
			onclick={() => move(1)}
			tabindex={hidden ? -1 : 0}
		>
			{#if vertical}<ChevronDown size={18} />{:else}<ChevronRight size={18} />{/if}
		</button>{/if}
</div>

<style>
	.overflow-controls {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
	}
	.hidden {
		visibility: hidden;
	}
	button {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--ps-border, transparent);
		border-radius: 50%;
		background: var(--ps-section-standard, #fff);
		color: var(--spatial-element-navigation-ink, var(--spatial-element-ink));
		box-shadow: 0 2px 8px #0003;
		cursor: pointer;
		pointer-events: auto;
	}
	.before {
		left: 2px;
	}
	.after {
		right: 2px;
	}
	.vertical button {
		left: 50%;
		right: auto;
		transform: translateX(-50%);
	}
	.vertical .before {
		top: 2px;
	}
	.vertical .after {
		top: auto;
		bottom: 2px;
	}
	button:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
		outline-offset: 2px;
	}
</style>
