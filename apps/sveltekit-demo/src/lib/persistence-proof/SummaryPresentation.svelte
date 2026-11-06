<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { ProofState } from './handoff';
	let { snapshot, content }: { snapshot: ProofState; content: Snippet } = $props();
	let home: HTMLDivElement;
	let projection: HTMLDivElement;
	let query: HTMLDivElement;
	let mounted = $state(false);
	let reservedHeight = $state(0);
	onMount(() => {
		mounted = true;
		return () => { if (home && query && query.parentElement !== home) home.append(query); };
	});
	$effect(() => {
		if (!mounted) return;
		if (snapshot.phase === 'settled') {
			if (query.parentElement !== home) home.append(query);
			reservedHeight = 0;
		} else if (query.parentElement !== projection) {
			// The one allowed source measurement. No destination DOM is needed to retain it.
			reservedHeight = query.getBoundingClientRect().height;
			projection.append(query);
		}
	});
</script>

<section class="presentation" data-presentation data-phase={snapshot.phase} data-owner={snapshot.slot}>
	<div class="home" bind:this={home} style:min-height={`${reservedHeight}px`}>
		<div class="query" data-proof-query bind:this={query} style:width={`${snapshot.queryWidth}px`}>
			{@render content()}
		</div>
	</div>
	<div class="projection" data-proof-projection bind:this={projection} class:moving={snapshot.phase !== 'settled'}></div>
</section>

<style>
	.presentation { position: relative; margin-block: 24px; }
	.query { container: proof-summary / inline-size; max-width: calc(100vw - 48px); }
	.projection { position: absolute; left: 0; top: 0; transition: transform 350ms ease; }
	.projection.moving { transform: translate(80px, 16px); }
	@media (prefers-reduced-motion: reduce) { .projection { transition: none; } }
</style>
