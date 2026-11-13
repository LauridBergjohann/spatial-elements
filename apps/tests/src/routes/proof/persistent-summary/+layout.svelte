<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { onMount, setContext, untrack } from 'svelte';
	import {
		ProofHandoff,
		proofContext,
		proofSlots,
		slotFromPath,
		type ProofState
	} from '$lib/persistence-proof/handoff';
	import { telemetry } from '$lib/persistence-proof/telemetry';
	import InteractiveSummary from '$lib/persistence-proof/InteractiveSummary.svelte';
	import SummaryPresentation from '$lib/persistence-proof/SummaryPresentation.svelte';
	import type { LayoutProps } from './$types';
	let { data, children }: LayoutProps = $props();
	const initialSlot = untrack(() => data.initialSlot);
	let snapshot = $state<ProofState>({
		slot: initialSlot,
		phase: 'settled',
		queryWidth: proofSlots[initialSlot].width,
		contentRevision: 0
	});
	const coordinator = new ProofHandoff(
		initialSlot,
		(next) => {
			snapshot = next;
		},
		() => {
			if (typeof window !== 'undefined') telemetry().leaseDisposals++;
		}
	);
	setContext(proofContext, coordinator);
	let finishPending: (() => void) | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
		return () => {
			clearTimeout(timer);
			finishPending?.();
			coordinator.destroy();
		};
	});
	onNavigate(({ to }) => {
		const target = to && slotFromPath(to.url.pathname);
		if (!target) return;
		// Superseding navigation releases the old wait, but its stale commit cannot win.
		finishPending?.();
		clearTimeout(timer);
		const handoff = coordinator.begin(target);
		return new Promise<() => void>((resolve) => {
			finishPending = () => {
				finishPending = undefined;
				handoff.finishMotion();
				resolve(() => {
					handoff.commit();
				});
			};
			if (!data.holdMotion) timer = setTimeout(() => finishPending?.(), 400);
		});
	});
	const suffix = $derived(data.holdMotion ? '?hold=1' : '');
</script>

<svelte:head><title>Persistent summary ownership proof</title></svelte:head>
<main data-proof-root data-hydrated={hydrated}>
	<nav aria-label="Proof routes">
		<a href={`/proof/persistent-summary/source${suffix}`}>Source</a>
		<a href={`/proof/persistent-summary/target${suffix}`}>Detail</a>
		<a href={`/proof/persistent-summary/wide${suffix}`}>Wide detail</a>
		<a href="/proof/persistence-exit">Leave proof</a>
	</nav>
	{#snippet persistentContent()}<InteractiveSummary
			contentRevision={snapshot.contentRevision}
		/>{/snippet}
	<SummaryPresentation {snapshot} content={persistentContent} />
	{@render children()}
	<div class="test-controls">
		<button type="button" onclick={() => finishPending?.()} disabled={snapshot.phase !== 'motion'}
			>Finish motion</button
		>
		<button type="button" onclick={() => coordinator.queueContentChange()}
			>Queue content and font update</button
		>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
	main {
		padding: 24px;
	}
	nav,
	.test-controls {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}
</style>
