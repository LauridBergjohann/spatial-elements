<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import WebsitePage from './WebsitePage.svelte';
	let props: ComponentProps<typeof WebsitePage> = $props();
</script>

<WebsitePage {...props} />
