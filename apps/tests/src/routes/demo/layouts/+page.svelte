<script lang="ts">
	import { HeadingSection } from '@page-sections/svelte';

	import { ContentPage, Section, ContentGrid, ContentBlock } from '@spatial-elements/sveltekit';
	import { layoutExamples } from '$lib/layoutExamples';
</script>

<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'Layout examples' }}>
	<HeadingSection section={{ id: 'catalog', title: 'Layout examples', headingLevel: 1 }} />

	<Section
		section={{
			id: 'examples',
			title: 'Explore the layouts',
			introduction:
				'Try the layouts in action. Resize the window, scroll through the examples and use their controls to compare different configurations.'
		}}
	>
		<ContentGrid>
			{#each layoutExamples as example (example.id)}
				<ContentBlock span={{ xs: 4, s: 3, m: 4, l: 4 }}>
					<article>
						<h2><a href={example.href}>{example.title}</a></h2>
						<p>{example.description}</p>
					</article>
				</ContentBlock>
			{/each}
		</ContentGrid>
	</Section>
</ContentPage>

<style>
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
		line-height: 1.4;
	}
	p {
		margin: 0;
		max-width: 55ch;
	}
	a {
		color: var(--spatial-element-accent);
	}
</style>
