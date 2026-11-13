<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Layout tokens' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Layout tokens',
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
				Generated from <code>@page-sections/core</code> and the spatial-only
				<code>layoutTokens.json</code>, as consumed by the pure resolvers and CSS generator. Values
				are CSS pixels unless a field explicitly describes a ratio, count, span or font weight.
				Regenerate with <code>node docs/wiki/export.mjs --write</code>.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'contentmax',
			title: 'contentMax',
			headline: 'contentMax',
			background: { color: 'standard', size: 'standard' }
		}}><div class="prose"><p>1536</p></div></Section
	>
	<Section
		section={{
			id: 'layoutminwidths',
			title: 'layoutMinWidths',
			headline: 'layoutMinWidths',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>xs</td>
						<td>0</td>
					</tr>
					<tr>
						<td>s</td>
						<td>600</td>
					</tr>
					<tr>
						<td>m</td>
						<td>840</td>
					</tr>
					<tr>
						<td>l</td>
						<td>1200</td>
					</tr>
					<tr>
						<td>xl</td>
						<td>1600</td>
					</tr>
					<tr>
						<td>2xl</td>
						<td>1809</td>
					</tr>
					<tr>
						<td>3xl</td>
						<td>2300</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'grid',
			title: 'grid',
			headline: 'grid',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>minWidth</th>
						<th>columns</th>
						<th>gap</th>
						<th>headlineSize</th>
						<th>headlineLineHeight</th>
						<th>bodySize</th>
						<th>bodyLineHeight</th>
						<th>headlineGap</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>xs</td>
						<td>0</td>
						<td>4</td>
						<td>12</td>
						<td>18</td>
						<td>28</td>
						<td>14</td>
						<td>20</td>
						<td>8</td>
					</tr>
					<tr>
						<td>s</td>
						<td>600</td>
						<td>6</td>
						<td>16</td>
						<td>18</td>
						<td>28</td>
						<td>14</td>
						<td>20</td>
						<td>8</td>
					</tr>
					<tr>
						<td>m</td>
						<td>840</td>
						<td>8</td>
						<td>16</td>
						<td>20</td>
						<td>32</td>
						<td>14</td>
						<td>20</td>
						<td>12</td>
					</tr>
					<tr>
						<td>l</td>
						<td>1200</td>
						<td>12</td>
						<td>24</td>
						<td>24</td>
						<td>40</td>
						<td>16</td>
						<td>24</td>
						<td>16</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'cards',
			title: 'cards',
			headline: 'cards',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>span</th>
						<th>titleSize</th>
						<th>titleWeight</th>
						<th>eyebrowSize</th>
						<th>eyebrowWeight</th>
						<th>lineHeight</th>
						<th>rows</th>
						<th>gridSSpan</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>s</td>
						<td>2</td>
						<td>12</td>
						<td>500</td>
						<td>0</td>
						<td>400</td>
						<td>18</td>
						<td>2</td>
						<td>—</td>
					</tr>
					<tr>
						<td>m</td>
						<td>2</td>
						<td>14</td>
						<td>500</td>
						<td>12</td>
						<td>400</td>
						<td>20</td>
						<td>2</td>
						<td>—</td>
					</tr>
					<tr>
						<td>l</td>
						<td>4</td>
						<td>18</td>
						<td>500</td>
						<td>14</td>
						<td>400</td>
						<td>24</td>
						<td>3</td>
						<td>3</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'cardtextinset',
			title: 'cardTextInset',
			headline: 'cardTextInset',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>inline</td>
						<td>12</td>
					</tr>
					<tr>
						<td>block</td>
						<td>12</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'xlcontentinset',
			title: 'xlContentInset',
			headline: 'xlContentInset',
			background: { color: 'standard', size: 'standard' }
		}}><div class="prose"><p>136</p></div></Section
	>
	<Section
		section={{
			id: 'menu',
			title: 'menu',
			headline: 'menu',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>height</td>
						<td>66</td>
					</tr>
					<tr>
						<td>wideHeight</td>
						<td>64</td>
					</tr>
					<tr>
						<td>wideTop</td>
						<td>16</td>
					</tr>
					<tr>
						<td>scrollThreshold</td>
						<td>32</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'satellite',
			title: 'satellite',
			headline: 'satellite',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>width</td>
						<td>80</td>
					</tr>
					<tr>
						<td>height</td>
						<td>40</td>
					</tr>
					<tr>
						<td>inset</td>
						<td>28</td>
					</tr>
					<tr>
						<td>top</td>
						<td>28</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'breadcrumb',
			title: 'breadcrumb',
			headline: 'breadcrumb',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>fontSize</th>
						<th>height</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>xs</td>
						<td>10</td>
						<td>24</td>
					</tr>
					<tr>
						<td>s</td>
						<td>10</td>
						<td>24</td>
					</tr>
					<tr>
						<td>m</td>
						<td>12</td>
						<td>30</td>
					</tr>
					<tr>
						<td>l</td>
						<td>14</td>
						<td>40</td>
					</tr>
					<tr>
						<td>xl</td>
						<td>14</td>
						<td>40</td>
					</tr>
					<tr>
						<td>2xl</td>
						<td>14</td>
						<td>40</td>
					</tr>
					<tr>
						<td>3xl</td>
						<td>14</td>
						<td>40</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'cardmediainset',
			title: 'cardMediaInset',
			headline: 'cardMediaInset',
			background: { color: 'standard', size: 'standard' }
		}}><div class="prose"><p>8</p></div></Section
	>
	<Section
		section={{
			id: 'pane',
			title: 'pane',
			headline: 'pane',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>centerGap</td>
						<td>8</td>
					</tr>
					<tr>
						<td>rightInset</td>
						<td>20</td>
					</tr>
					<tr>
						<td>top</td>
						<td>96</td>
					</tr>
					<tr>
						<td>bottom</td>
						<td>16</td>
					</tr>
					<tr>
						<td>submenuHeight</td>
						<td>44</td>
					</tr>
					<tr>
						<td>headerHeight</td>
						<td>86</td>
					</tr>
					<tr>
						<td>minUsableHeight</td>
						<td>512</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'stagecontrols',
			title: 'stageControls',
			headline: 'stageControls',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>buttonSize</td>
						<td>40</td>
					</tr>
					<tr>
						<td>groupButtons</td>
						<td>2</td>
					</tr>
					<tr>
						<td>gap</td>
						<td>8</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'hero',
			title: 'hero',
			headline: 'hero',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>minHeight</th>
						<th>heightOffset</th>
						<th>maxHeight</th>
						<th>railSize</th>
						<th>railGap</th>
						<th>railInset</th>
						<th>railStageGap</th>
						<th>summaryColumns</th>
						<th>summaryInset</th>
						<th>summaryGap</th>
						<th>dockHeight</th>
						<th>submenuHeight</th>
						<th>submenuGap</th>
						<th>submenuAfterGap</th>
						<th>submenuLeft</th>
						<th>submenuRight</th>
						<th>zoomMinimap</th>
						<th>zoomInset</th>
						<th>railWidthRatio</th>
						<th>railMinInset</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>xs</td>
						<td>150</td>
						<td>214</td>
						<td>400</td>
						<td>80</td>
						<td>8</td>
						<td>8</td>
						<td>8</td>
						<td>4</td>
						<td>8</td>
						<td>8</td>
						<td>76</td>
						<td>0</td>
						<td>0</td>
						<td>0</td>
						<td>8</td>
						<td>8</td>
						<td>112</td>
						<td>8</td>
						<td>—</td>
						<td>—</td>
					</tr>
					<tr>
						<td>s</td>
						<td>150</td>
						<td>214</td>
						<td>500</td>
						<td>80</td>
						<td>8</td>
						<td>8</td>
						<td>8</td>
						<td>6</td>
						<td>8</td>
						<td>8</td>
						<td>76</td>
						<td>0</td>
						<td>0</td>
						<td>0</td>
						<td>8</td>
						<td>8</td>
						<td>112</td>
						<td>8</td>
						<td>—</td>
						<td>—</td>
					</tr>
					<tr>
						<td>m</td>
						<td>300</td>
						<td>180</td>
						<td>500</td>
						<td>80</td>
						<td>12</td>
						<td>8</td>
						<td>8</td>
						<td>3</td>
						<td>8</td>
						<td>8</td>
						<td>80</td>
						<td>40</td>
						<td>8</td>
						<td>8</td>
						<td>8</td>
						<td>8</td>
						<td>168</td>
						<td>8</td>
						<td>—</td>
						<td>—</td>
					</tr>
					<tr>
						<td>l</td>
						<td>340</td>
						<td>194</td>
						<td>600</td>
						<td>80</td>
						<td>16</td>
						<td>8</td>
						<td>8</td>
						<td>4</td>
						<td>24</td>
						<td>8</td>
						<td>86</td>
						<td>44</td>
						<td>8</td>
						<td>8</td>
						<td>8</td>
						<td>24</td>
						<td>178</td>
						<td>8</td>
						<td>—</td>
						<td>—</td>
					</tr>
					<tr>
						<td>xl</td>
						<td>400</td>
						<td>236</td>
						<td>700</td>
						<td>112</td>
						<td>16</td>
						<td>12</td>
						<td>12</td>
						<td>4</td>
						<td>12</td>
						<td>8</td>
						<td>86</td>
						<td>44</td>
						<td>12</td>
						<td>12</td>
						<td>0</td>
						<td>0</td>
						<td>220</td>
						<td>12</td>
						<td>—</td>
						<td>—</td>
					</tr>
					<tr>
						<td>2xl</td>
						<td>400</td>
						<td>216</td>
						<td>800</td>
						<td>138</td>
						<td>24</td>
						<td>0</td>
						<td>24</td>
						<td>4</td>
						<td>0</td>
						<td>24</td>
						<td>86</td>
						<td>44</td>
						<td>12</td>
						<td>12</td>
						<td>0</td>
						<td>0</td>
						<td>242</td>
						<td>16</td>
						<td>0.07</td>
						<td>8</td>
					</tr>
					<tr>
						<td>3xl</td>
						<td>400</td>
						<td>112</td>
						<td>800</td>
						<td>138</td>
						<td>24</td>
						<td>28</td>
						<td>12</td>
						<td>4</td>
						<td>0</td>
						<td>16</td>
						<td>86</td>
						<td>44</td>
						<td>0</td>
						<td>0</td>
						<td>0</td>
						<td>0</td>
						<td>242</td>
						<td>28</td>
						<td>—</td>
						<td>—</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
	<Section
		section={{
			id: 'carousel',
			title: 'carousel',
			headline: 'carousel',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Token</th>
						<th>Value</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>dotsHeight</td>
						<td>32</td>
					</tr>
					<tr>
						<td>nextPreviewHeight</td>
						<td>28</td>
					</tr>
					<tr>
						<td>compactTitleHeight</td>
						<td>40</td>
					</tr>
					<tr>
						<td>compactEyebrowHeight</td>
						<td>66</td>
					</tr>
				</tbody>
			</table>
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>minHeight</th>
						<th>maxHeight</th>
						<th>sideAllowance</th>
						<th>fitStartColumn</th>
						<th>fitColumns</th>
						<th>summaryStartColumn</th>
						<th>summaryColumns</th>
						<th>dotsGap</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>xs</td>
						<td>150</td>
						<td>300</td>
						<td>36</td>
						<td>1</td>
						<td>4</td>
						<td>1</td>
						<td>4</td>
						<td>0</td>
					</tr>
					<tr>
						<td>s</td>
						<td>150</td>
						<td>400</td>
						<td>72</td>
						<td>1</td>
						<td>6</td>
						<td>1</td>
						<td>6</td>
						<td>0</td>
					</tr>
					<tr>
						<td>m</td>
						<td>300</td>
						<td>500</td>
						<td>0</td>
						<td>2</td>
						<td>3</td>
						<td>5</td>
						<td>3</td>
						<td>12</td>
					</tr>
					<tr>
						<td>l</td>
						<td>340</td>
						<td>600</td>
						<td>0</td>
						<td>3</td>
						<td>5</td>
						<td>8</td>
						<td>4</td>
						<td>16</td>
					</tr>
					<tr>
						<td>xl</td>
						<td>400</td>
						<td>700</td>
						<td>0</td>
						<td>2</td>
						<td>5</td>
						<td>7</td>
						<td>4</td>
						<td>16</td>
					</tr>
					<tr>
						<td>2xl</td>
						<td>400</td>
						<td>800</td>
						<td>0</td>
						<td>2</td>
						<td>6</td>
						<td>8</td>
						<td>4</td>
						<td>16</td>
					</tr>
				</tbody>
			</table>
		</div></Section
	>
</WebsitePage>
