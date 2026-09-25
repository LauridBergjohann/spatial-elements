<script lang="ts">
 import { ContentPage, Section, ListSection, CarouselSection } from '@spatial-elements/sveltekit';
 import type { PageData } from './$types';let { data }: { data:PageData } = $props();
 </script>
 <ContentPage page={{ title:'A study of form', eyebrow:'SPATIAL ELEMENTS', breadcrumbs:[{label:'Collection',href:'/demo/categories/list'}] }}>
 <Section section={{id:"introduction",title:"Objects with room to explore"}}><p>A collection of original geometric forms. Move between the list, carousel and detail views.</p><a href="/demo/products/orb#features">Explore the orb features</a></Section>
 <ListSection section={{id:"products",title:"Collection"}} list={data.products} />
 <Section section={{id:"story",title:"Shape, light and movement"}}><img src="/assets/demo/ring.svg" alt="Green ring study" width="320" height="280"/><p>Compose your own text, images and interactive collections in a single content page.</p></Section><CarouselSection section={{id:"featured",title:"Forms in space"}} list={data.products} />
 </ContentPage>
