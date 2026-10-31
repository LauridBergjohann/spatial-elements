<script lang="ts">
 import SpatialSummarySlot from '../../../../../../../packages/sveltekit/dist/spatial-element/SpatialSummarySlot.svelte';
 import { spatialElements } from '$lib/catalog';
</script>
<h1>Destination native flow</h1>
<div data-transfer-destination style="width:640px">
 <SpatialSummarySlot instanceKey="proof:destination" context={{spatialElement:spatialElements[0],mode:'detail',heading:'h1',contentInset:0,address:()=>undefined}}/>
</div>
<p data-transfer-after>Native following content</p>
