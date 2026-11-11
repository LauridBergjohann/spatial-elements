<script lang="ts">
	import { onMount } from 'svelte';
	import { telemetry } from './telemetry';
	let { contentRevision }: { contentRevision: number } = $props();
	let quantity = $state(1);
	let variant = $state('blue');
	let engraving = $state('');
	onMount(() => {
		telemetry().mounts++;
		return () => {
			telemetry().destroys++;
		};
	});
	$effect(() => {
		void quantity;
		void variant;
		void engraving;
		void contentRevision;
		telemetry().updates++;
	});
</script>

<article
	data-live-summary
	data-content-revision={contentRevision}
	class:alternate-font={contentRevision > 0}
>
	<h2>Orbit lamp</h2>
	<div class="fields" data-proof-fields>
		<label>Engraving <input name="engraving" bind:value={engraving} /></label>
		<label
			>Variant <select name="variant" bind:value={variant}
				><option value="blue">Blue</option><option value="silver">Silver</option></select
			></label
		>
		<div>
			<button type="button" onclick={() => quantity++}>Add one</button>
			<output data-quantity>{quantity}</output>
		</div>
	</div>
	<p data-reactive-description>
		{variant} lamp, quantity {quantity}{engraving ? `, engraved “${engraving}”` : ''}.
	</p>
	{#if contentRevision > 0}<p data-late-content>
			Additional product information arrived during the movement. Its new typeface and natural
			height are applied after the content handoff.
		</p>{/if}
</article>

<style>
	article {
		padding: 16px;
		border: 1px solid #718198;
		border-radius: 12px;
		background: #f8fafc;
		color: #172033;
	}
	h2 {
		margin: 0 0 16px;
	}
	.fields {
		display: grid;
		gap: 12px;
		grid-template-columns: minmax(0, 1fr);
	}
	label {
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	input,
	select {
		min-width: 0;
		width: 100%;
		box-sizing: border-box;
	}
	.alternate-font {
		font-family: Georgia, serif;
	}
	@container proof-summary (min-width: 500px) {
		.fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@container proof-summary (min-width: 900px) {
		.fields {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
