<script lang="ts">
import { HeadingSection } from '@page-sections/svelte';

	import { ContentPage, SpatialCardGridSection } from '@spatial-elements/sveltekit';
	import type { CardMediaAspect, CardVariant, SurfaceTone } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let mediaAspect = $state<CardMediaAspect>('1/1');
	let cardTone = $state<SurfaceTone>('standard');
	let cardVariant = $state<CardVariant>('catalog');
	let withoutEyebrows = $state(false);
	let reversed = $state(false);
	const items = $derived(
		(withoutEyebrows ? data.items.filter((item) => !item.eyebrow) : data.items)
			.slice()
			.sort((a, b) =>
				reversed ? b.itemKey.localeCompare(a.itemKey) : a.itemKey.localeCompare(b.itemKey)
			)
	);
</script>

<div class="card-options">
	<label
		>Card tone <select bind:value={cardTone}><option>standard</option><option>muted</option></select
		></label
	>
	<label
		>Card variant <select bind:value={cardVariant}
			><option>catalog</option><option>editorial</option></select
		></label
	>
	<label
		>Media aspect <select bind:value={mediaAspect}
			><option>1/1</option><option>3/2</option><option>4/3</option></select
		></label
	>
	<label><input type="checkbox" bind:checked={withoutEyebrows} /> Only items without eyebrows</label
	>
	<label><input type="checkbox" bind:checked={reversed} /> Reverse items</label>
</div>
<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'Card layout reference' }}>
<HeadingSection section={{ id: 'catalog', title: 'Card layout reference', headingLevel: 1 }} />

	<SpatialCardGridSection
		section={{ id: 'cards-small', title: 'Small cards', headline: 'Small cards' }}
		cardSize="s"
		list={items}
		{mediaAspect}
		{cardTone}
		{cardVariant}
	/>
	<SpatialCardGridSection
		section={{ id: 'cards-medium', title: 'Medium cards', headline: 'Medium cards' }}
		cardSize="m"
		list={items}
		{mediaAspect}
		{cardTone}
		{cardVariant}
	/>
	<SpatialCardGridSection
		section={{ id: 'cards-large', title: 'Large cards', headline: 'Large centered cards' }}
		cardSize="l"
		textAlign="center"
		list={items}
		{mediaAspect}
		{cardTone}
		{cardVariant}
	/>
</ContentPage>

<style>
	.card-options {
		pointer-events: auto;
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		padding: 16px;
	}
</style>
