<script lang="ts">
	import SpatialSummarySlot from '../../../../../../../packages/sveltekit/dist/spatial-element/SpatialSummarySlot.svelte';
	import { overview, spatialElements, theme } from '$lib/catalog';
	import { resolveSpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	const element = resolveSpatialElementData(spatialElements[0], theme.id);
</script>

<h1>Summary source</h1>
<div
	data-transfer-source
	style="margin-bottom:48px; width:320px; transform:perspective(1000px) rotateY(12deg); --carousel-panel-tint:white; --carousel-panel-radius:16px; --carousel-panel-shadow:0 8px 24px #0002;"
>
	<SpatialSummarySlot
		instanceKey="proof:summary"
		context={{
			spatialElement: element,
			mode: 'carousel',
			heading: 'h3',
			contentInset: 16,
			address: () => undefined,
			carousel: { item: overview[0], occurrence: 'proof:summary', compact: false }
		}}
	/>
</div>
<a href="/proof/presentation-transfer/detail">Navigate to destination</a>
