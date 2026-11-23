<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Appearance and interaction' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Appearance and interaction',
			introduction:
				'Give HTML content and the spatial layer one visual identity, then adapt optional interactions.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'visual-language',
			title: 'Start from a theme',
			headline: 'Start from a theme',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The shared layout supplies a <a href="/docs/reference/types/#spatial-theme">
					<code>SpatialTheme</code>
				</a>, created with
				<a href="/docs/reference/types/#spatial-theme-options"><code>createSpatialTheme</code></a>.
				It controls background colors, panels, text colors and interaction accents. Coordinate it
				with the Page Sections HTML theme so ordinary sections and spatial surfaces belong together.
			</p>
			<p>
				<a href="/showcase/industrial/">Industrial</a> demonstrates compact blue surfaces;
				<a href="/showcase/exclusive/">Exclusive</a> uses a separate gold and glass identity. Switch light
				and dark modes to compare them.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'optional-controls',
			title: 'Then tune the interface',
			headline: 'Then tune the interface',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Continue with <a href="/docs/interaction/themes/">Themes and appearance</a>,
				<a href="/docs/interaction/help/">Interface texts and help</a>
				and <a href="/docs/interaction/orientation/">Device orientation</a>. Media configuration
				belongs to the <a href="/docs/detail-pages/media/">detail-page chapter</a>.
			</p>
		</div>
	</Section>
</WebsitePage>
