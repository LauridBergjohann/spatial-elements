<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { getAllContexts, onMount, setContext } from 'svelte';
	import { IslandController, islandContext, type IslandDescriptor } from '$lib/persistence-island-proof/controller';
	import InteractiveIsland from '$lib/persistence-island-proof/InteractiveIsland.svelte';
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
	let phase = $state('ssr');
	let label = $state('Initial host label');
	let extra = $state(false);
	let projection: HTMLElement;
	let finishPending: (() => void) | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	setContext('island-brand', { name: 'Brand context from persistent layout' });
	const controller = new IslandController(() => summary, getAllContexts(), next => { phase = next; });
	setContext(islandContext, controller);
	const initialDescriptor = $derived(page.data.islandPresentation as IslandDescriptor | undefined);
	onMount(() => {
		controller.projection = projection;
		return () => { clearTimeout(timer); finishPending?.(); controller.destroy(); };
	});
	onNavigate(({ to }) => {
		const slot = to?.url.pathname.match(/\/proof\/persistent-island\/(source|target|wide)$/)?.[1] as IslandDescriptor['slot'] | undefined;
		if (!slot) return;
		finishPending?.();
		clearTimeout(timer);
		const finish = controller.begin(slot);
		return new Promise<() => void>(resolve => {
			finishPending = () => { finishPending = undefined; finish?.(); resolve(() => {}); };
			if (!to?.url.searchParams.has('hold')) timer = setTimeout(() => finishPending?.(), 250);
		});
	});
	const suffix = $derived(page.url.searchParams.has('hold') ? '?hold=1' : '');
</script>
{#snippet summary()}<InteractiveIsland {label} {extra} />{/snippet}
<main data-island-proof data-phase={phase} data-merged-slot={initialDescriptor?.slot}>
	<nav aria-label="Island routes">
		<a href={`/proof/persistent-island/source${suffix}`}>Source</a>
		<a href={`/proof/persistent-island/target${suffix}`}>Detail</a>
		<a href={`/proof/persistent-island/wide${suffix}`}>Wide detail</a>
		<a href="/proof/persistence-exit">Leave proof</a>
	</nav>
	<div class="buttons">
		<button type="button" onclick={() => finishPending?.()} disabled={phase !== 'motion'}>Finish motion</button>
		<button type="button" onclick={() => { label = 'Updated host label'; extra = true; }}>Update persistent host</button>
	</div>
	{@render children()}
	<div data-island-projection bind:this={projection}></div>
</main>
<style>
	:global(body) { margin: 0; font-family: system-ui, sans-serif; }
	main { padding: 24px; }
	nav, .buttons { display: flex; flex-wrap: wrap; gap: 16px; margin-block: 12px; }
	[data-island-projection] { position: fixed; z-index: 10; }
</style>
