<script lang="ts">
	import { onMount, setContext } from 'svelte';
	import { Panel } from '@spatial-elements/sveltekit';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import { runBackgroundLayerProof } from './proof';
	import { createBackgroundCheckpoints } from './checkpoints';
	// Real Panel CSS/markup, without creating a second production GPU Stage in this isolated proof.
	setContext(STAGE_CONTEXT_KEY, { registerPanel: () => () => {} } as unknown as StageContext);
	let reference: HTMLDivElement, candidate: HTMLDivElement;
	let state = $state('preparing');
	onMount(() => {
		let active = true, dispose: (() => void) | undefined;
		const checkpoints = createBackgroundCheckpoints();
		const enabled = new URL(location.href).searchParams.get('lifecycle-checkpoints') === '1';
		const api = { getCurrent: checkpoints.getCurrent, release: checkpoints.release };
		if (enabled) Object.assign(window, { __backgroundLayerCheckpoints: api });
		void runBackgroundLayerProof([reference, candidate], enabled ? value => checkpoints.wait(value) : undefined).then(proof => {
			dispose = proof.dispose;
			if (!active) { dispose(); return; }
			Object.assign(window, { __backgroundLayerProof: proof.result }); state = 'ready';
		}, error => {
			if (active) {
				Object.assign(window, { __backgroundLayerProof: { error: String(error), stack: error instanceof Error ? error.stack ?? null : null } });
				state = 'error';
			}
		});
		return () => {
			active = false; checkpoints.dispose(); dispose?.();
			const target = window as unknown as { __backgroundLayerCheckpoints?: typeof api };
			if (target.__backgroundLayerCheckpoints === api) delete target.__backgroundLayerCheckpoints;
		};
	});
</script>

<h1>Experimental Background layer output proof</h1>
<p data-background-layer-proof-state={state}>{state}</p>
<div class="outputs">
	<div class="output" bind:this={reference} data-background-layer-reference>
		<div class="frosted"><Panel shape={{ radius: 12, contentInset: 8 }} surface="frosted" theme={{ backdropBlur: 5, tintOpacity: 0.28 }} pointerReactive={false}>Frosted</Panel></div>
	</div>
	<div class="output" bind:this={candidate} data-background-layer-candidate>
		<div class="frosted"><Panel shape={{ radius: 12, contentInset: 8 }} surface="frosted" theme={{ backdropBlur: 5, tintOpacity: 0.28 }} pointerReactive={false}>Frosted</Panel></div>
	</div>
</div>

<style>
	.outputs { position: fixed; left: 8px; top: 100px; display: flex; gap: 20px; align-items: start; }
	.output { position: relative; isolation: isolate; width: 160px; height: 120px; overflow: hidden; }
	.output :global(canvas) { position: absolute; inset: 0; display: block; }
	.frosted { position: absolute; width: 90px; height: 36px; left: 17px; bottom: 11px; font: 11px/20px Arial, sans-serif; color: #182030; }
</style>
