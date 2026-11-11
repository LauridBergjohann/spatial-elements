<script lang="ts">
	import {
		SpatialCardGridSection,
		SpatialCarouselSection,
		type SpatialCardSize,
		type CardMediaAspect,
		type SurfaceTone
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import SpatialDocumentationPage from '$lib/SpatialDocumentationPage.svelte';
	import LiveCode from '$lib/LiveCode.svelte';
	import { overview } from '$lib/forms';
	let view = $state('grid');
	let cardSize = $state<SpatialCardSize>('m');
	let cardTone = $state<SurfaceTone>('muted');
	let mediaAspect = $state<CardMediaAspect>('3/2');
	let surface = $state<'standard' | 'muted' | 'transparent'>('standard');
	let backgroundSize = $state<'standard' | 'full'>('standard');
	const source = $derived(
		view === 'grid'
			? '<SpatialCardGridSection\n  section={{ id: "collection-grid", title: "Collection", background: { color: "' +
					surface +
					'", size: "' +
					backgroundSize +
					'" } }}\n  list={items}\n  cardSize="' +
					cardSize +
					'"\n  cardTone="' +
					cardTone +
					'"\n  mediaAspect="' +
					mediaAspect +
					'"\n/>'
			: '<SpatialCarouselSection\n  section={{ id: "collection-carousel", title: "Collection", background: { color: "' +
					surface +
					'", size: "' +
					backgroundSize +
					'" } }}\n  list={items}\n/>'
	);
	function reset() {
		view = 'grid';
		cardSize = 'm';
		cardTone = 'muted';
		mediaAspect = '3/2';
		surface = 'standard';
		backgroundSize = 'standard';
	}
</script>

<SpatialDocumentationPage
	page={{ title: 'Spatial collection playground' }}
	hdr="/assets/demo/studio.hdr"
	showContentMenu
>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Spatial collection playground',
			headingLevel: 1,
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'settings',
			title: 'Try the options',
			headline: 'Try the options',
			background: { color: 'standard', size: 'standard' }
		}}
		><p>
			Choose a collection layout. The code below reflects the same state as the preview. Supplied
			posters keep the cards readable without WebGPU.
		</p>
		<div class="controls">
			<label
				>View <select bind:value={view}
					><option value="grid">Card grid</option><option value="carousel">Carousel</option></select
				></label
			>
			<label
				>Card size <select bind:value={cardSize} disabled={view !== 'grid'}
					><option>xs</option><option>s</option><option>m</option><option>l</option></select
				></label
			>
			<label
				>Card tone <select bind:value={cardTone} disabled={view !== 'grid'}
					><option>standard</option><option>muted</option></select
				></label
			>
			<label
				>Media aspect <select bind:value={mediaAspect} disabled={view !== 'grid'}
					><option>3/2</option><option>1/1</option><option>4/3</option></select
				></label
			>
			<label
				>Background <select bind:value={surface}
					><option>standard</option><option>muted</option><option>transparent</option></select
				></label
			>
			<label
				>Background size <select bind:value={backgroundSize}
					><option>standard</option><option>full</option></select
				></label
			>
			<button type="button" onclick={reset}>Reset example</button>
		</div></Section
	>
	{#if view === 'grid'}<SpatialCardGridSection
			section={{
				id: 'collection-grid',
				title: 'Live preview',
				headline: 'Live preview',
				background: { color: surface, size: backgroundSize }
			}}
			list={overview}
			{cardSize}
			{cardTone}
			{mediaAspect}
		/>{:else}<SpatialCarouselSection
			section={{
				id: 'collection-carousel',
				title: 'Live preview',
				headline: 'Live preview',
				background: { color: surface, size: backgroundSize }
			}}
			list={overview}
		/>{/if}
	<Section
		section={{
			id: 'source',
			title: 'Use this configuration',
			headline: 'Use this configuration',
			background: { color: 'standard', size: 'standard' }
		}}><LiveCode code={source} /></Section
	>
</SpatialDocumentationPage>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: end;
	}
	label {
		display: grid;
		gap: 0.4rem;
	}
	select,
	button {
		font: inherit;
		padding: 0.5rem;
		border: 1px solid var(--ps-border);
		border-radius: 0.5rem;
		background: var(--ps-section-standard);
		color: var(--ps-ink);
	}
</style>
