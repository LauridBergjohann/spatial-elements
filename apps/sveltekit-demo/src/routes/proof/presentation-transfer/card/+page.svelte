<script lang="ts">
import { HeadingSection } from '@page-sections/svelte';

	import { ContentPage, SpatialCardGridSection } from '@spatial-elements/sveltekit';
	import { overview } from '$lib/catalog';
</script>

<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'Card source' }}>
<HeadingSection section={{ id: 'catalog', title: 'Card source', headingLevel: 1 }} />

	<div data-transfer-source style="width:600px; --spatial-grid-columns:6; --spatial-grid-gap:16px;">
		<SpatialCardGridSection
			section={{ id: 'transfer-cards', title: 'Cards' }}
			list={[{ ...overview[0], href: '/proof/presentation-transfer/detail' }]}
		/>
	</div>
</ContentPage>
