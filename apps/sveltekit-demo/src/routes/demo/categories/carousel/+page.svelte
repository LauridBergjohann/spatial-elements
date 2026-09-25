<script lang="ts">
 import { ContentPage, Section, ListSection, CarouselSection } from '@spatial-elements/sveltekit';
 import type { PageData } from './$types';let { data }: { data:PageData } = $props();
 </script>
 <ContentPage page={{ title:'A study of form', eyebrow:'SPATIAL ELEMENTS', breadcrumbs:[{label:'Collection',href:'/demo/categories/list'}] }}>

 <CarouselSection section={{id:"featured",title:"Forms in space"}} list={data.products} />

 </ContentPage>
