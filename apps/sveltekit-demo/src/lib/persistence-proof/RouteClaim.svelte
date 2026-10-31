<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { proofContext, type ProofHandoff, type ProofSlot } from './handoff';
	import { telemetry } from './telemetry';
	let { slot }: { slot: ProofSlot } = $props();
	const coordinator = getContext<ProofHandoff>(proofContext);
	onMount(() => {
		const claim = coordinator.claimRoute(slot);
		telemetry().routeMounts++;
		return () => { telemetry().routeDestroys++; claim.release(); };
	});
</script>

<p data-route-slot={slot}>This route claims the persistent summary's {slot} placement.</p>
