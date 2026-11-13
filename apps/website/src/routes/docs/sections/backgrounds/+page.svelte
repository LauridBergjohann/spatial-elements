<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'svelte',
			code: "\u003cSection section={{ id: 'details', title: 'Details', headline: 'Made for everyday use',\n  background: { color: 'standard', size: 'standard' } }}>\n  \u003cp>Section content.\u003c/p>\n\u003c/Section>\n"
		},
		{
			language: 'ts',
			code: "createSpatialTheme({\n  id: 'collection', name: 'Collection',\n  background: '#e7ebef',\n  sectionBackgrounds: { standard: '#ffffff', muted: '#f3f5f7' },\n  radii: { control: 12, panel: 16 }\n});\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Section backgrounds' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Section backgrounds',
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
				A Section owns its anchor, optional visible headline, grid padding and background. A
				navigation label and a displayed heading are different authoring choices.
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				<code>id</code> stays stable for links and history. <code>title</code> labels generated
				navigation and accessibility. <code>headline</code> creates the visible heading. Omit
				<code>headline</code> to omit both the heading and its gap; padding remains. A section without
				a visible heading still has an accessible name.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'background-roles',
			title: 'Background roles',
			headline: 'Background roles',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p><img src="/documentation/images/background-matrix.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>An illustrative light palette. Only effective full-width backgrounds support the six
					gradients; the theme supplies the actual standard and muted colors.</em
				>
			</p>
			<table>
				<thead>
					<tr>
						<th><code>color</code></th>
						<th>Result</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>transparent</code></td>
						<td>Actual transparency</td>
					</tr>
					<tr>
						<td><code>standard</code></td>
						<td>Theme's standard section color</td>
					</tr>
					<tr>
						<td><code>muted</code></td>
						<td>Theme's muted section color</td>
					</tr>
					<tr>
						<td><code>transparentToStandard</code>, <code>transparentToMuted</code></td>
						<td>Top transparent, bottom named color</td>
					</tr>
					<tr>
						<td><code>standardToTransparent</code>, <code>mutedToTransparent</code></td>
						<td>Top named color, bottom transparent</td>
					</tr>
					<tr>
						<td><code>standardToMuted</code>, <code>mutedToStandard</code></td>
						<td>Vertical color-to-color gradient</td>
					</tr>
				</tbody>
			</table>
			<p>
				The default is transparent, standard width. <code>size: 'full'</code> extends only the background
				across the page; content stays on its capped grid. It does not introduce horizontal scrolling
				or stretch interactive content.
			</p>
			<p>
				Detail sections always constrain backgrounds to standard width, including inside the 3XL
				pane. A gradient is valid only when its <strong>effective</strong> background is full-width.
				An invalid gradient becomes its end color and produces a deduplicated development
				diagnostic. For example, <code>transparentToMuted/full</code> on a detail page becomes solid muted.
				This deterministic fallback is an engineering choice, not a hidden change to the theme palette.
			</p>
			<p><img src="/documentation/images/section-groups.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>Changing opaque color does not split a group. Transparency and full-width backgrounds do.</em
				>
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'corners-and-spacing',
			title: 'Corners and spacing',
			headline: 'Corners and spacing',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				At XL, 2XL and ordinary ContentPage 3XL, contiguous opaque standard-width sections share
				outer panel corners. Only the first top corners and last bottom corners are rounded. Each
				section contributes its own grid padding; there is no extra automatic outer gap.
			</p>
			<p>
				The 3XL detail pane owns its outer corners, so its sections have no detached grouping
				corners. Transparent and effectively full-width sections also do not acquire these corners.
				Grouping follows registered section order, not arbitrary helper elements in the DOM.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'theme-roles-and-compatibility',
			title: 'Theme roles and compatibility',
			headline: 'Theme roles and compatibility',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<CodeBlock
				code={examples[1].code}
				language={examples[1].language}
				highlighted={data.highlights[1]}
			/>
			<p>
				Use a matching dark palette when supplying dark text/background roles. Section colors do not
				change the glass material's tint. <code>ContentPage background=&quot;...&quot;</code> overrides
				that page's flat background for native and enhanced rendering while preserving lighting.
			</p>
			<p>
				Legacy <code>section.style</code> is retained as an explicit compatibility path. Do not
				silently replace a custom tint or blur with the closest named role. An explicit
				<code>background</code>
				takes precedence over legacy tint, opacity and blur; legacy width and text color still apply.
				There is no diagnostic for combining those paths. The development diagnostic described above is
				specifically for unsupported gradients. See
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/wiki/Migration-and-Reference.md"
					>Migration and Reference</a
				>.
			</p>
		</div></Section
	>
</WebsitePage>
