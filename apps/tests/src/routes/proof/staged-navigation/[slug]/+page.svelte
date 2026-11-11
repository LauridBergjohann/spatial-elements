<script lang="ts">
	import ProofPage from '$lib/staged-navigation-proof/ProofPage.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

{#key data.slug}<ProofPage slug={data.slug} />{/key}
