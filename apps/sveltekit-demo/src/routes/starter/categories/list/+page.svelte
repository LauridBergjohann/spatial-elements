<script lang="ts">
	import { ContentPage, ListSection } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ContentPage hdr="/assets/demo/studio.hdr?category=starter" page={{ title: 'My collection' }}>
	<ListSection section={{ id: 'elements', title: 'Elements' }} list={data.items} />
</ContentPage>
