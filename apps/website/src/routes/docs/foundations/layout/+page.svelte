<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'svelte',
			code: '\u003cContentGrid>\n  \u003cContentBlock span={{ xs: 4, s: 3, m: 4, l: 8 }}>Main\u003c/ContentBlock>\n  \u003cContentBlock span={{ xs: 4, s: 3, m: 4, l: 4 }}>Related\u003c/ContentBlock>\n\u003c/ContentGrid>\n'
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Responsive layout' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Responsive layout',
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
				Viewport layout controls the overall page. Container width controls its content grid.
				Keeping these separate lets a wide screen contain a narrower detail pane without forcing
				desktop-sized columns into it.
			</p>
			<p><img src="/documentation/images/layout-and-grid.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The grid measures its unpadded container. Section padding is the grid's single outer
					gutter; it is not added a second time.</em
				>
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'viewport-composition',
			title: 'Viewport composition',
			headline: 'Viewport composition',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>All dimensions are CSS pixels. Device pixel ratio does not choose a breakpoint.</p>
			<table>
				<thead>
					<tr>
						<th>Viewport width</th>
						<th>Layout</th>
						<th>Ordinary content width</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Below 600</td>
						<td>XS</td>
						<td>Available width</td>
					</tr>
					<tr>
						<td>600–839</td>
						<td>S</td>
						<td>Available width</td>
					</tr>
					<tr>
						<td>840–1199</td>
						<td>M</td>
						<td>Available width</td>
					</tr>
					<tr>
						<td>1200–1599</td>
						<td>L</td>
						<td>Available width, capped at 1536</td>
					</tr>
					<tr>
						<td>1600–1808</td>
						<td>XL</td>
						<td>Available width minus two 136px insets, capped at 1536</td>
					</tr>
					<tr>
						<td>1809–2299</td>
						<td>2XL</td>
						<td>1536 maximum</td>
					</tr>
					<tr>
						<td>2300 and wider</td>
						<td>3XL</td>
						<td>Ordinary ContentPages remain capped at 1536; detail uses a separate pane</td>
					</tr>
				</tbody>
			</table>
			<p>
				Scrollbar and safe-area insets reduce usable space. A 3XL viewport shorter than 512 usable
				pixels uses the 2XL detail flow composition. The <a href="/docs/advanced/reading-pane/"
					>ultra-wide guide</a
				> gives pane geometry.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'four-container-grids',
			title: 'Four container grids',
			headline: 'Four container grids',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>&lt;!-- layout-grid-table:start --&gt;</p>
			<table>
				<thead>
					<tr>
						<th>Container width</th>
						<th>Grid</th>
						<th>Columns</th>
						<th>Padding / gap</th>
						<th>Headline size / line height</th>
						<th>Body size / line height</th>
						<th>Headline gap</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>&lt; 600</td>
						<td>XS</td>
						<td>4</td>
						<td>12</td>
						<td>18 / 28</td>
						<td>14 / 20</td>
						<td>8</td>
					</tr>
					<tr>
						<td>600–839</td>
						<td>S</td>
						<td>6</td>
						<td>16</td>
						<td>18 / 28</td>
						<td>14 / 20</td>
						<td>8</td>
					</tr>
					<tr>
						<td>840–1199</td>
						<td>M</td>
						<td>8</td>
						<td>16</td>
						<td>20 / 32</td>
						<td>14 / 20</td>
						<td>12</td>
					</tr>
					<tr>
						<td>1200–1536</td>
						<td>L</td>
						<td>12</td>
						<td>24</td>
						<td>24 / 40</td>
						<td>16 / 24</td>
						<td>16</td>
					</tr>
					<tr>
						<td>&lt;!-- layout-grid-table:end --&gt;</td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
					</tr>
				</tbody>
			</table>
			<p>
				Headlines use weight 600; body text uses 400. Font family belongs to the host theme. The
				grid uses the width <strong>before</strong> section padding: an 840px container selects M, even
				though the padded content is 808px wide.
			</p>
			<p>
				For container width <code>c</code>, column count <code>n</code> and gutter <code>g</code>,
				one column is <code>(c - 2g - (n - 1)g) / n</code>. A span of <code>s</code> columns is
				<code>s * columnWidth + (s - 1)g</code>. Fractional pixels are retained. This matters when
				GPU text must align with native text on the first enhanced frame.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'explicit-blocks',
			title: 'Explicit blocks',
			headline: 'Explicit blocks',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				<code>ContentGrid</code> adds no second section padding. Put <code>ContentBlock</code>
				components inside it. <code>span</code> accepts a number or an object keyed by
				<code>xs</code>, <code>s</code>, <code>m</code>, <code>l</code>:
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				Omitted spans fill a row. Responsive spans inherit the last smaller defined value; before
				the first defined value they fill a row. Invalid values fall back to a row and oversized
				spans clamp to the active column count, with development diagnostics. Blocks keep DOM and
				keyboard order. There is no dense backfilling that visually reorders content.
			</p>
			<p>
				Arbitrary Section children remain ordinary HTML. Opt into blocks deliberately; the framework
				does not distribute paragraphs into columns automatically.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'inspect-it',
			title: 'Inspect it',
			headline: 'Inspect it',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Open <code>/docs/examples/grid/</code> and resize the container independently of the window. Boundary
				tests cover fractional widths around 600, 840 and 1200, classic scrollbars, embedded containers
				and the 1536px cap. The tokens are the source of truth; generated CSS and the reference tables
				must be regenerated together when they change.
			</p>
		</div></Section
	>
</WebsitePage>
