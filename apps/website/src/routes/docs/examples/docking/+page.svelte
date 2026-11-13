<script lang="ts">
	import { Section, SpatialElementPage } from '@spatial-elements/sveltekit';
	import { spatialElements } from '$lib/forms';

	let shortSections = $state(false);
	const element = {
		...spatialElements[0],
		title: 'A long translated element title that must stay available when visually ellipsized',
		eyebrow: 'A deliberately long optional eyebrow for the compact detail header',
		action: {
			label: 'Open the final section',
			ariaLabel: 'Open the final section',
			href: '#docking-section-8'
		}
	};
	const titles = [
		'Construction and materials',
		'Measurements and tolerances',
		'Assembly and maintenance',
		'Compatibility and accessories',
		'Operation in demanding environments',
		'Technical references',
		'Frequently asked questions',
		'Further information and documentation'
	];
</script>

<SpatialElementPage spatialElement={element}>
	<Section
		section={{ id: 'options', title: 'Try section lengths', headline: 'Try section lengths' }}
		><label><input type="checkbox" bind:checked={shortSections} /> Short sections</label></Section
	>
	{#each titles as title, index}
		<Section
			section={{
				id: `docking-section-${index + 1}`,
				title,
				headline: title,
				background: { color: index % 2 ? 'muted' : 'standard' }
			}}
		>
			<div class="docking-fixture-section" class:short={shortSections}>
				<p>
					This public fixture checks long navigation labels, document anchors and keyboard focus.
				</p>
				<button type="button" id={`section-focus-${index + 1}`}
					>Focus control in section {index + 1}</button
				>
				<p>
					The submenu keeps its own horizontal scroll position while the page continues to use
					document scrolling.
				</p>
			</div>
		</Section>
	{/each}
</SpatialElementPage>

<style>
	.docking-fixture-section {
		min-height: 560px;
	}
	.docking-fixture-section.short {
		min-height: 0;
	}
</style>
