<script lang="ts">
	import { Section, SpatialElementPage } from '@spatial-elements/sveltekit';
	import { spatialElements } from '$lib/forms';
	let lateContent = $state(false);
	let note = $state('');
	const element = {
		...spatialElements[0],
		action: { label: 'Read the final chapter', href: '#pane-chapter-6' }
	};
</script>

<SpatialElementPage spatialElement={element}>
	{#each [1, 2, 3, 4, 5, 6] as chapter}
		<Section
			section={{
				id: `pane-chapter-${chapter}`,
				title: `Chapter ${chapter}`,
				headline: `Chapter ${chapter}`,
				background: { color: chapter % 2 ? 'standard' : 'muted' }
			}}
		>
			<div class="pane-fixture-chapter">
				<p>
					Content stays in the document. The media area, title and section links remain in the
					viewport.
				</p>
				<label>Chapter {chapter} note <input name={`chapter-${chapter}`} /></label>
				{#if chapter === 1}
					<label>Retained pane value <input bind:value={note} /></label>
					<p data-pane-reactive>{note}</p>
					<button
						type="button"
						onclick={() => {
							lateContent = !lateContent;
						}}>Toggle late pane content</button
					>
					{#if lateContent}<div class="late-pane-content">
							Late content keeps the same native scroll owner.
						</div>{/if}
				{/if}
				<p>
					Fixed surfaces must never intercept pointer or keyboard interaction with visible content.
				</p>
			</div>
			{#if chapter === 6}<p data-pane-last-line>The final line must remain reachable.</p>{/if}
		</Section>
	{/each}
</SpatialElementPage>

<style>
	.pane-fixture-chapter {
		min-height: 500px;
	}
	label {
		display: block;
		margin-block: 12px;
	}
	input {
		font: inherit;
		padding: 8px;
	}
	.late-pane-content {
		height: 320px;
	}
</style>
