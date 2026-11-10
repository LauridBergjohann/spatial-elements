<script lang="ts">
	import SpatialSummarySlot from '../../../../../../../packages/sveltekit/dist/spatial-element/SpatialSummarySlot.svelte';
	import { spatialElements, theme } from '$lib/catalog';
	import { resolveSpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	const element = resolveSpatialElementData(spatialElements[0], theme.id);
</script>

<h1>Destination native flow</h1>
<div data-transfer-destination style="width:640px">
	<SpatialSummarySlot
		instanceKey="proof:destination"
		context={{
			spatialElement: element,
			mode: 'detail',
			heading: 'h1',
			contentInset: 0,
			address: () => undefined
		}}
	/>
</div>
<p data-transfer-after>Native following content</p>
