<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Advanced' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Advanced',
			introduction:
				'Understand the lifecycle and rendering choices behind a complete spatial experience.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'prerequisites',
			title: 'Build a collection and detail page first',
			headline: 'Build a collection and detail page first',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				These topics assume you have a shared shell, a working collection and a detail route. You
				can use the high-level components without managing the renderer yourself.
			</p>
			<p>
				<a href="/docs/advanced/navigation/">Persistent navigation</a> explains why the stage
				belongs in a layout. <a href="/docs/advanced/transitions/">Transitions</a> explains how
				prepared collection and detail views connect.
				<a href="/docs/advanced/performance/">Performance</a> covers model preparation and rendering budgets.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'scrolling',
			title: 'Looking for scrolling behavior?',
			headline: 'Looking for scrolling behavior?',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The <a href="/docs/detail-pages/responsive-layout/">detail layout chapter</a> explains the user-facing
				behavior, including the ultrawide reading pane and footer. Start there before investigating lower-level
				implementation details.
			</p>
		</div>
	</Section>
</WebsitePage>
