<script lang="ts">
	import { ContentPage, ListSection } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'Card layout reference' }}>
	<ListSection section={{ id: 'cards-small', title: 'Small cards', headline: 'Small cards' }} cardSize="s" list={data.items} />
	<ListSection section={{ id: 'cards-medium', title: 'Medium cards', headline: 'Medium cards' }} cardSize="m" list={data.items} />
	<ListSection section={{ id: 'cards-large', title: 'Large cards', headline: 'Large centered cards' }} cardSize="l" textAlign="center" list={data.items} />
</ContentPage>
