<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'svelte',
			code: '\u003cSpatialCardGridSection section={{ id: \'collection\', title: \'Collection\', headline: \'Collection\' }}\n  list={items} cardSize="l" mediaAspect="1/1" mediaFit="contain" cardTone="muted" />\n'
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Spatial card grids' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Spatial card grids',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'introduction',
			title: 'Introduction',
			headline: 'Introduction',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Cards use Page Sections 0.3.0. The media frame has its own configurable aspect ratio; the
				text area adds independent height. All cards in a collection have equal heights across rows.
			</p>
			<ul>
				<li>S: 2 columns, 12px title, two title lines, no eyebrow.</li>
				<li>M: 2 columns, 14px title, two title lines.</li>
				<li>L: 4 columns (3 in grid S), 18px title, three title lines.</li>
				<li>
					M/L reserve an additional eyebrow row for every item when any item has a nonblank eyebrow.
				</li>
				<li>Text padding is 12px; contained media has an 8px inset.</li>
			</ul>
			<p>
				Use these options directly on <code>SpatialCardGridSection</code> (not inside
				<code>section</code>): <code>cardSize=&quot;s|m|l&quot;</code>,
				<code>cardTone=&quot;standard|muted&quot;</code>,
				<code>textAlign=&quot;start|center&quot;</code>,
				<code>mediaAspect=&quot;1/1|3/2|4/3&quot;</code>
				and <code>mediaFit=&quot;contain|cover&quot;</code>. <code>SpatialListPage</code> forwards
				all of them. <code>cardVariant=&quot;catalog&quot;</code> (default) uses responsive
				size-based spans; <code>cardVariant=&quot;editorial&quot;</code> uses <code>itemSpan</code>
				(default <code>&#123; xs: 4, s: 3, m: 4, l: 4 &#125;</code>) and a title link. Spatial media
				defaults to <code>1/1</code>; Page Sections defaults to <code>3/2</code>. Keep
				<code>itemKey</code> stable for repeated items and reordering.
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
		</div></Section
	>
	<Section
		section={{
			id: 'measured-media-and-independent-text',
			title: 'Measured media and independent text',
			headline: 'Measured media and independent text',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p><img src="/documentation/images/card-fit.png" alt="" loading="lazy" /></p>
			<p>
				The media frame alone has an aspect ratio. At 320px, an M card is 142px wide, with a 126px
				square inset fitting area. With an eyebrow row the full card is 226px high. Blank eyebrows
				reserve the same line as populated items. Long titles clamp while the native link retains
				the full accessible title.
			</p>
			<p>
				Spatial adapters measure the actual media element for geometry, camera fitting and
				transition targets. Format changes never stretch a model. Persistent card roots and
				occurrence identities survive navigation and keyed moves.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'interaction-and-fallback',
			title: 'Interaction and fallback',
			headline: 'Interaction and fallback',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Cards remain real links with posters and readable labels before hydration or GPU startup.
				Mouse proximity and device orientation remain spatial enhancements; keyboard focus, reduced
				motion and touch navigation retain their behavior.
			</p>
			<p>
				Use <code>/docs/examples/cards/</code> to switch all three media formats, filter labels and reorder
				repeated element occurrences. Its browser checks cover container widths, equal heights and native
				SSR.
			</p>
			<p>
				<img src="/documentation/images/cards-320.png" alt="" loading="lazy" />
				<img src="/documentation/images/cards-840.png" alt="" loading="lazy" />
				<img src="/documentation/images/cards-large-720.png" alt="" loading="lazy" />
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'spatial-component-names-and-carousel-fallback',
			title: 'Spatial component names and carousel fallback',
			headline: 'Spatial component names and carousel fallback',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Use <code>SpatialCardGridSection</code> and <code>SpatialCarouselSection</code> from
				<code>@spatial-elements/sveltekit</code>. The old <code>SpatialCardGridSection</code> and
				<code>SpatialCarouselSection</code> exports remain deprecated aliases for existing consumers.
			</p>
			<p>
				Page Sections 0.3.0 also exports a 2D <code>SpatialCarouselSection</code>.
				SpatialCarouselSection currently retains its own native scroll-snap fallback with posters,
				accessible links, selected-item restoration and persistent interactive summary content. It
				does not instantiate the Page Sections carousel: that component has a different
				item/selection contract and no custom-card hook for the persistent spatial summary. Shared
				section shells and layout tokens still come from Page Sections. SSR, unavailable GPU and
				device loss all use the same native spatial carousel markup.
			</p>
			<p>
				Opaque section backgrounds sit below the rear GPU models. Rendering, shadows and pointer
				regions follow the section surface: <code>background.size: 'standard'</code> clips to the
				section bounds; <code>'full'</code> extends horizontally to the viewport. Both clip vertically
				to the section. This also applies to transparent backgrounds. Layout measurements are cached and
				adjusted numerically while scrolling.
			</p>
		</div></Section
	>
</WebsitePage>
