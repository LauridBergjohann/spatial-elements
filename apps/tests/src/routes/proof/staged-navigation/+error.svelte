<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { trace } from '$lib/staged-navigation-proof/telemetry';
	trace('page-constructor', { slug: 'failure' });
	onMount(() => trace('page-mounted', { slug: 'failure', href: location.href }));
</script>

<section data-proof-page="failure"><h1>{page.status}: {page.error?.message}</h1></section>
