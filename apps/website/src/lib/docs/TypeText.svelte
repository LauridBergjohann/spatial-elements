<script lang="ts">
	import { referenceTargets } from './referenceIndex';
	let { value }: { value: string } = $props();
	const tokens = $derived(value.split(/\b([A-Z][A-Za-z0-9_]*)\b/));
</script>

{#each tokens as token}{#if referenceTargets[token]}<a href={referenceTargets[token]}>
			{token}
		</a>{:else}{token}{/if}{/each}
