<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Fallback and accessibility' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Fallback and accessibility',
			introduction: 'The content and its navigation must work before the spatial layer starts.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'posters',
			title: 'Supply a readable fallback',
			headline: 'Supply a readable fallback',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A model alone does not describe an object to every visitor. Give each element a clear <a
					href="/docs/reference/types/#spatial-element-data-title"
				>
					<code>title</code>
				</a>, useful content and a
				<a href="/docs/reference/types/#spatial-element-data-fallback-image">
					<code>fallbackImage</code>
				</a>. Add its dimensions in
				<a href="/docs/reference/types/#spatial-element-data-fallback-image-size">
					<code>fallbackImageSize</code>
				</a> to reserve space. Text and native links remain available without JavaScript or WebGPU.
			</p>
			<p>
				Try disabling JavaScript and reloading <a href="/showcase/consumer/logitech-brio-500/">
					the Brio 500 detail page
				</a>. The supplied content and poster still communicate what the page is about.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'input',
			title: 'Check more than the mouse',
			headline: 'Check more than the mouse',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Use Tab to reach links and controls, Enter to follow a link and the visible media selector
				to change media. Keep a logical heading order and meaningful section titles. Provide alt
				text for image media and captions for video.
			</p>
			<p>
				The library respects reduced-motion preferences in its transitions. Device orientation is
				optional and may require permission; it must never be the only way to access content. See <a
					href="/docs/interaction/orientation/"
				>
					Device orientation
				</a>.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'verify',
			title: 'Review your own content',
			headline: 'Review your own content',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<ul>
				<li>Can someone understand the item using its title, features and poster?</li>
				<li>Do links have useful labels and real destinations?</li>
				<li>Does the reading order still make sense on a narrow screen?</li>
				<li>Can someone reach the action and media controls using a keyboard?</li>
				<li>Are captions and alternatives available for media that carries meaning?</li>
			</ul>
		</div>
	</Section>
</WebsitePage>
