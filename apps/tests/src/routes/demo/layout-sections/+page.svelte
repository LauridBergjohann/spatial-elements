<script lang="ts">
	import { HeadingSection } from '@page-sections/svelte';

	import { ContentPage, Section } from '@spatial-elements/sveltekit';
	let changed = $state(false);
</script>

<ContentPage
	hdr="/assets/demo/studio.hdr"
	background="#c8d8e8"
	page={{ title: 'Section surfaces' }}
>
	<HeadingSection section={{ id: 'catalog', title: 'Section surfaces', headingLevel: 1 }} />

	<Section
		section={{
			id: 'surface-first',
			title: 'First navigation title',
			headline: 'Visible headline',
			background: { color: 'standard' }
		}}
	>
		<p>First surface in a contiguous group.</p>
	</Section>
	<div aria-hidden="true" data-surface-helper></div>
	<Section
		section={{
			id: 'surface-second',
			title: 'Second navigation title',
			background: { color: changed ? 'transparent' : 'muted' }
		}}
	>
		<p>This section has an accessible navigation title and no visible headline.</p>
		<button onclick={() => (changed = !changed)}>Toggle second surface</button>
	</Section>
	<Section
		section={{
			id: 'surface-full',
			title: 'Full gradient',
			background: { color: 'transparentToStandard', size: 'full' }
		}}
	>
		<p>A full-width gradient keeps its content aligned to the same grid.</p>
	</Section>
	<Section
		section={{ id: 'surface-single', title: 'Separate surface', background: { color: 'muted' } }}
	>
		<p>A single detached surface rounds both pairs of corners.</p>
	</Section>
	<Section section={{ id: 'surface-transparent', title: 'Transparent section' }}>
		<p>Transparency exposes the page surface.</p>
	</Section>
	<Section
		section={{
			id: 'surface-normalized',
			title: 'Normalized gradient',
			background: { color: 'transparentToMuted' }
		}}
	>
		<p>A constrained gradient becomes its final solid color.</p>
	</Section>
</ContentPage>

<style>
	p {
		margin: 0;
		min-height: 72px;
	}
</style>
