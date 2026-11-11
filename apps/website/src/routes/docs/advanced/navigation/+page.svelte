<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'svelte',
			code: "\u003cBrandStageShell {theme} items={[{ id: 'collection', label: 'Collection', href: '/collection' }]}>\n  {#snippet brand()}\u003ca href=\"/\">My collection\u003c/a>{/snippet}\n  {#snippet right()}\u003cSettingsTrigger />{/snippet}\n  {@render children()}\n\u003c/BrandStageShell>\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Persistent navigation' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Persistent navigation',
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
				Put persistent navigation inside the <code>BrandStageShell</code> snippets. The shell supplies
				boxes and surfaces; the host supplies real links, branding and actions.
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				<code>left</code> and <code>right</code> are optional 80 × 40px satellite slots visible from
				XL. Menu height is 66px through L; from XL it is 64px with 16px top space. Omitted snippets
				create no empty interactive panel. Page Sections exposes satellite actions through Settings
				below XL. Navigation items use a native disclosure below L; custom <code>menu</code> snippets
				own their internal mobile behavior. The demo's appearance control uses a trigger and a native
				popover rather than trying to fit three choices inside one satellite.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'the-112px-rule',
			title: 'The 112px rule',
			headline: 'The 112px rule',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p><img src="/documentation/images/menu-scroll.png" alt="" loading="lazy" /></p>
			<p><em>The same position rule drives native sticky layout and enhanced compensation.</em></p>
			<p>
				The ordinary shell stays at its starting position for the first 112px of document scroll.
				Beyond that it moves upward by <code>scrollY − 112</code>. It is not a direction-sensitive
				hide/reveal header. At scroll positions 0, 64, 112 and 160, its offsets are 0, 0, 0 and
				−48px.
			</p>
			<p>
				Detail 3XL is the exception: its menu remains fixed. The native sticky layout and enhanced
				virtual-scroll compensation follow the same equation. Compensation is applied once; the
				renderer does not subtract the document scroll again from a fixed-region panel.
			</p>
			<p>
				The shell is not keyed to the current route and keeps its owner through navigation. When
				both pages are at the top, it stays visible throughout the transition. A declared compact
				dock destination outside split 3XL instead fades the old top menu as the dock header takes
				over. Split 3XL retains the fixed menu. Focusing or zooming into the 3D model also moves and
				fades the native menu with its corresponding spatial surface; the native layout measurement
				stays unchanged.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'breadcrumbs',
			title: 'Breadcrumbs',
			headline: 'Breadcrumbs',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Breadcrumb typography follows the viewport layout, not the inner grid. Breadcrumbs remain
				one line with native horizontal scrolling when necessary; the trailing end is visible
				without JavaScript and semantic reading order remains intact. In a split detail header, only
				the final current-page label is omitted, since the title row already identifies it. The
				preceding separator remains.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'choosing-the-surface',
			title: 'Choosing the surface',
			headline: 'Choosing the surface',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Content behind the surface</th>
						<th>Presentation</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Mixed native DOM and canvas, including ordinary menu/content</td>
						<td>Native Page Sections surface</td>
					</tr>
					<tr>
						<td>Integrated 3XL summary and content pane</td>
						<td>Native DOM surface</td>
					</tr>
					<tr>
						<td>Eligible fixed controls over the spatial scene</td>
						<td>Authored GPU material where supported</td>
					</tr>
					<tr>
						<td>No JavaScript or unavailable WebGPU</td>
						<td>Native accessible fallback</td>
					</tr>
				</tbody>
			</table>
			<p>
				GPU glass cannot refract arbitrary native HTML as though it were a scene texture. Using an
				honest DOM surface over document content keeps text readable and avoids a fake snapshot that
				can drift from live content. Semantic navigation remains native even when the renderer owns
				an eligible decorative surface.
			</p>
			<p>
				Do not add host-level padding, widths or sticky offsets around this shell. Doing so
				duplicates the shared layout contract and can separate DOM from projected panels during
				scroll or transitions.
			</p>
		</div></Section
	>
</WebsitePage>
