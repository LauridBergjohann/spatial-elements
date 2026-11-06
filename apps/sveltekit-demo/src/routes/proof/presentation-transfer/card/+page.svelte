<script lang="ts">
 import { ContentPage, ListSection } from '@spatial-elements/sveltekit';
 import { overview } from '$lib/catalog';
</script>
<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'Card source' }}>
<div data-transfer-source style="width:600px; --spatial-grid-columns:6; --spatial-grid-gap:16px;">
 <ListSection section={{id:'transfer-cards',title:'Cards'}} list={[{...overview[0],href:'/proof/presentation-transfer/detail'}]} />
</div>
</ContentPage>
