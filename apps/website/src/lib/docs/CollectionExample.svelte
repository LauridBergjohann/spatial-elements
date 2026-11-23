<script lang="ts">
	import { tick } from 'svelte';
	import {
		SpatialCardGridSection,
		SpatialCarouselSection,
		type SpatialCardSize,
		type CardMediaAspect,
		type SurfaceTone
	} from '@spatial-elements/sveltekit';
	import { Section } from '@page-sections/svelte';
	import { overview } from '#lib/forms.ts';
	import LiveCode from '#lib/LiveCode.svelte';
	let { kind }: { kind: 'grid' | 'carousel' } = $props();
	let size = $state<SpatialCardSize>('m');
	let tone = $state<SurfaceTone>('muted');
	let aspect = $state<CardMediaAspect>('1/1');
	let shadow = $state(false);
	let descriptions = $state(true);
	let initial = $state(overview[0].id);
	let selection = $state('Use the arrows or select an item.');
	let previewMounted = $state(true);
	async function restartCarousel() {
		// Complete section deregistration before mounting the same page-local anchor again.
		previewMounted = false;
		await tick();
		previewMounted = true;
	}
	const items = $derived(
		overview.slice(0, 4).map((item, index) => ({
			...item,
			description: descriptions
				? [
						'A slender form with a small footprint.',
						'A continuous curved surface.',
						'An open centre and a circular silhouette.',
						'Six faces, one familiar shape.'
					][index]
				: undefined
		}))
	);
	const source = $derived(
		kind === 'grid'
			? `<SpatialCardGridSection\n  section={{ id: 'collection', title: 'Collection', headline: 'Collection' }}\n  list={items}\n  cardSize="${size}" cardTone="${tone}"\n  mediaAspect="${aspect}" cardShadow={${shadow}}\n/>`
			: `<SpatialCarouselSection\n  section={{ id: 'featured', title: 'Featured', headline: 'Featured' }}\n  list={items}\n  initialItemKey="${initial}"\n  onselectionchange={({ spatialElementId }) => console.log(spatialElementId)}\n/>`
	);
	function reset() {
		size = 'm';
		tone = 'muted';
		aspect = '1/1';
		shadow = false;
		descriptions = true;
		initial = overview[0].id;
		selection = 'Use the arrows or select an item.';
		if (kind === 'carousel') void restartCarousel();
	}
</script>

<Section
	section={{
		id: 'try-it-yourself',
		title: 'Try it yourself',
		headline: 'Try it yourself',
		background: { color: 'standard' }
	}}
>
	<p>
		These are real spatial components. Posters and ordinary links remain available without WebGPU.
		Open a form to explore its detail page.
	</p>
	<div class="playground-controls">
		{#if kind === 'grid'}
			<label>
				Card size<select bind:value={size}>
					<option value="s">Small</option><option value="m">Medium</option><option value="l">
						Large
					</option>
				</select>
			</label>
			<label>
				Card tone<select bind:value={tone}><option>standard</option><option>muted</option></select>
			</label>
			<label>
				Media aspect<select bind:value={aspect}>
					<option>1/1</option><option>3/2</option><option>4/3</option>
				</select>
			</label>
			<label>Resting shadow<input type="checkbox" bind:checked={shadow} /></label>
			<label>Descriptions<input type="checkbox" bind:checked={descriptions} /></label>
		{:else}
			<label>
				Start with<select
					bind:value={initial}
					onchange={() => {
						selection = 'Use the arrows or select an item.';
						void restartCarousel();
					}}
				>
					{#each items as item}<option value={item.id}>{item.title}</option>{/each}
				</select>
			</label>
		{/if}
		<button type="button" onclick={reset}>Reset example</button>
	</div>
	{#if kind === 'carousel'}<p aria-live="polite">{selection}</p>{/if}
</Section>
{#if kind === 'grid'}
	<SpatialCardGridSection
		section={{
			id: 'live-grid',
			title: 'Live card grid',
			headline: 'Live card grid',
			background: { color: 'standard' }
		}}
		list={items}
		cardSize={size}
		cardTone={tone}
		mediaAspect={aspect}
		cardShadow={shadow}
	/>
{:else if previewMounted}
	<SpatialCarouselSection
		section={{
			id: 'live-carousel',
			title: 'Live carousel',
			headline: 'Live carousel',
			background: { color: 'standard' }
		}}
		list={items}
		initialItemKey={initial}
		onselectionchange={({ spatialElementId }) => {
			selection = 'Selected: ' + spatialElementId;
		}}
	/>
{/if}
<Section
	section={{
		id: 'example-code',
		title: 'Example code',
		headline: 'Use this configuration',
		background: { color: 'standard' }
	}}
>
	<LiveCode code={source} />
	<p>
		The <a href="/docs/reference/types/#spatial-list-item">items</a> come from
		<a href="/docs/foundations/assets/">your element documents</a>. Descriptions are item data, not
		a separate card type.
	</p>
</Section>
