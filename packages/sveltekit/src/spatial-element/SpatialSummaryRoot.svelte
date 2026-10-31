<script lang="ts">
	import type { SpatialSummaryContext, SpatialSummarySnippet } from './spatialSummary.js';
	let { content, model }: { content: SpatialSummarySnippet; model: { current: SpatialSummaryContext } } = $props();
</script>
{@render content(model.current)}
