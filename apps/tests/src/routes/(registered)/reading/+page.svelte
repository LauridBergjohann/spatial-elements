<script lang="ts">
	import { ContentPage } from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'Reading' }}>
	<HeadingSection section={{ id: 'heading', title: 'Reading', headingLevel: 1 }} />
	<Section section={{ id: 'text', title: 'Ordinary content' }}
		><p>No spatial elements on this page.</p>
		<a href="/curated">Collection</a></Section
	>
</ContentPage>
