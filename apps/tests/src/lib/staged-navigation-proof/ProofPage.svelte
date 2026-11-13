<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { trace } from './telemetry';
	let { slug }: { slug: string } = $props();
	trace('page-constructor', { slug: untrack(() => slug) });
	onMount(() => {
		trace('page-mounted', { slug, href: location.href });
		return () => trace('page-destroyed', { slug });
	});
</script>

<section data-proof-page={slug}>
	<h1>{slug}</h1>
	<p>The route content is created only when SvelteKit commits this navigation.</p>
	<label>Route-owned input <input value={`state of ${slug}`} /></label>
</section>

<style>
	section {
		padding: 24px;
		background: #eef3f8;
		border: 2px solid #c2d2e2;
	}
	h1 {
		margin-top: 0;
	}
</style>
