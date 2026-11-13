<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { islandTelemetry } from './telemetry';
	let { label, extra }: { label: string; extra: boolean } = $props();
	const brand = getContext<{ name: string }>('island-brand');
	const inputId = $props.id();
	let quantity = $state(1);
	let engraving = $state('');
	onMount(() => {
		islandTelemetry().mounts++;
		return () => {
			islandTelemetry().destroys++;
		};
	});
	$effect(() => {
		void label;
		void extra;
		void quantity;
		void engraving;
		islandTelemetry().updates++;
	});
</script>

<article data-live-island>
	<h2>Persistent orbit lamp</h2>
	<p data-host-label>{label}</p>
	<p data-brand-context>{brand.name}</p>
	<div class="fields" data-island-fields>
		<label for={inputId}>Engraving <input id={inputId} bind:value={engraving} /></label>
		<div>
			<button type="button" onclick={() => quantity++}>Add one</button>
			<output data-island-quantity>{quantity}</output>
		</div>
		<p data-island-description>{engraving || 'No engraving'}, quantity {quantity}</p>
	</div>
	{#if extra}<p data-island-extra>
			Additional summary content supplied by the persistent parent. Its height is intrinsic and
			changes the native route flow.
		</p>{/if}
</article>

<style>
	article {
		padding: 17px;
		border: 3px solid rgb(24, 110, 130);
		background: #f5fbff;
		color: #172033;
		border-radius: 12px;
	}
	h2 {
		margin: 0 0 12px;
	}
	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
	}
	label {
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
	}
	@container island-summary (min-width: 500px) {
		.fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@container island-summary (min-width: 900px) {
		.fields {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
