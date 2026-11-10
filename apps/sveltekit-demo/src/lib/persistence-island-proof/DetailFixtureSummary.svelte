<script lang="ts">
	import type { SpatialSummaryContext } from '@spatial-elements/sveltekit';
	let { context, long }: { context: SpatialSummaryContext; long: boolean } = $props();
	let quantity = $state(1);
	let inscription = $state('');
</script>

<div data-custom-detail-summary>
	<h1 id="spatial-element-title">{context.spatialElement.title}</h1>
	<div class="fields" data-detail-summary-fields>
		<label>Inscription <input bind:value={inscription} /></label>
		<div>
			<button type="button" onclick={() => quantity++}>Add quantity</button><output
				data-detail-quantity>{quantity}</output
			>
		</div>
		<p data-detail-reactive>{inscription || 'Custom summary'}, quantity {quantity}</p>
	</div>
	{#if long}{#each Array(18) as _, index}<p>
				Additional specification {index + 1}: variable content contributes its natural height and
				remains reachable inside the bounded summary.
			</p>{/each}{/if}
</div>

<style>
	h1 {
		margin: 0 0 12px;
		font-size: 22px;
	}
	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
	}
	label {
		display: grid;
		min-width: 0;
	}
	input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	@container spatial-summary (min-width: 400px) {
		.fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@container spatial-summary (min-width: 800px) {
		.fields {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
