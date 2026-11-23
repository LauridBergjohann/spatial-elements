<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'svelte',
			code: '\u003cBrandStageShell {theme}>\n  {#snippet summary(context)}\u003cCustomSummary {...context} />{/snippet}\n  {@render children()}\n\u003c/BrandStageShell>\n'
		},
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { createCatalogEndpointAction, type SpatialSummaryContext } from '@spatial-elements/sveltekit';\n  let { spatialElement, heading, address }: SpatialSummaryContext = $props();\n  const catalogEndpoint = createCatalogEndpointAction();\n\u003c/script>\n\n\u003cdiv class=\"custom-summary\">\n  \u003csvelte:element this={heading} use:catalogEndpoint={address('title')}\n    id={heading === 'h1' ? 'spatial-element-title' : undefined}\n    tabindex={heading === 'h1' ? -1 : undefined}>\n    {spatialElement.title}\n  \u003c/svelte:element>\n  \u003cp>Custom content for {spatialElement.title}.\u003c/p>\n\u003c/div>\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Summary and actions' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Summary and actions',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/><Section
		section={{
			id: 'start-with-data',
			title: 'Start with the default summary',
			headline: 'Start with the default summary',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The summary is the short introduction beside an object: its title, optional eyebrow, key
				features and a primary action. Start by supplying <a
					href="/docs/reference/types/#spatial-element-data-features"
				>
					<code>features</code>
				</a>
				and <a href="/docs/reference/types/#spatial-element-data-action"><code>action</code></a> on
				<a href="/docs/reference/types/#spatial-element-data"><code>SpatialElementData</code></a>.
				Each feature has a label; an action can have a visible label and a link destination.
			</p>
			<p>
				The default renderer is sufficient for a simple information page. The following
				custom-summary approach is useful when you need stateful controls such as quantity or
				configuration. <a href="/showcase/consumer/logitech-brio-500/">Brio 500</a> demonstrates a quantity
				control shared across the experience.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'introduction',
			title: 'Introduction',
			headline: 'Introduction',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A summary is a real, stateful component. It can contain links, inputs, buttons and ordinary
				semantic content. Moving its presentation must not replace its live DOM with a screenshot or
				a second component instance.
			</p>
			<p>
				<a href="/docs/reference/components/#brand-stage-shell"><code>BrandStageShell</code></a> owns
				the persistent summary renderer. Route pages provide placement slots and data. The default summary
				uses the element title, optional eyebrow, features and action. Define a custom synchronous snippet
				in the persistent brand layout when the default does not fit your content:
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				The snippet receives <a href="/docs/reference/types/#spatial-summary-context-mode">
					<code>mode</code>
				</a>
				(<code>detail</code> or
				<a href="/docs/reference/types/#spatial-summary-context-carousel">
					<code>carousel</code>
				</a>),
				<a href="/docs/reference/types/#spatial-summary-context-heading"><code>heading</code></a>,
				<a href="/docs/reference/types/#spatial-summary-context-content-inset">
					<code>contentInset</code>
				</a>, element data and endpoint-address support. Keep initial output synchronous and
				content-only. Layout, frame and surface belong to the framework. Do not add a competing
				fixed-position outer panel.
			</p>
			<p>
				For example, <code>CustomSummary.svelte</code> can register its real title as a shared endpoint:
			</p>
			<p>
				For a smaller adjustment, render <code>SpatialElementSummaryContent</code> with the context
				props and supply its optional <code>leading</code>, <code>beforeAction</code> and
				<code>actionIcon</code> snippets. The leading content and action details participate in the
				transition alongside the built-in title, features and action. The
				<a href="/showcase/industrial/">Industrial showcase</a> uses this approach for item and Wurm logos
				and an external-link action icon, with an illustrative price and quantity field above the CTA.
				The quantity stays with the live component when moving from carousel to detail. The same renderer
				serves carousel and detail panels; their frosted surfaces, blue accents and corner radii come
				from the route theme.
			</p>

			<CodeBlock
				code={examples[1].code}
				language={examples[1].language}
				highlighted={data.highlights[1]}
			/>
			<p>
				Create the action inside this child component, which is instantiated under the persistent
				summary host. Creating it in the outer layout before <a
					href="/docs/reference/components/#brand-stage-shell"
				>
					<code>BrandStageShell</code>
				</a> cannot read the child's endpoint context. Register only roles that actually exist in the
				custom content; missing roles use the normal fallback instead of pretending a different DOM element
				is the matching title or action.
			</p>
			<p>
				The framework already applies <a
					href="/docs/reference/types/#spatial-summary-context-content-inset"
				>
					<code>contentInset</code>
				</a>; do not add it a second time to the snippet. The detail heading keeps
				<code>id=&quot;spatial-element-title&quot;</code> so the surrounding panel's accessible label
				resolves correctly.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'natural-height-and-responsive-content',
			title: 'Natural height and responsive content',
			headline: 'Natural height and responsive content',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p><img src="/documentation/images/summary-columns.png" alt="" loading="lazy" /></p>
			<p>
				<em>
					A custom snippet chooses its own container-query columns. The framework does not prescribe
					these internal breakpoints or equalize panel heights.
				</em>
			</p>
			<p>
				The framework knows the summary's width and anchor. Text determines a detail summary's
				natural height. Wide flow detail summaries cap local overflow to the hero area; mobile and
				3XL detail summaries contribute their real height to document flow. Custom content can use
				container queries to choose one, two or three internal columns based on the actual summary
				width.
			</p>
			<p>
				The default summary defines its own 24px body line height so moving from a Section into the
				detail layer does not change its height. Custom snippets should likewise own their
				typography instead of depending on styles inherited from the surrounding page. The heading
				and primary action have their own explicit type rules.
			</p>
			<p>
				Compact carousel summaries are different: below 840px they show framework-owned
				title/eyebrow strips of 40px or 66px and hide the full custom-summary content. Do not put an
				essential action exclusively in that hidden compact presentation.
			</p>
			<p>
				From M through 2XL, carousel and detail use the same property content and natural panel
				height. An optional <code>summary.sectionLink</code> is navigation below the carousel surface;
				it adds no row or reserved height to the shared panel. The arrow at the top right opens the detail
				page. Overflow inside a tall panel chains back to document scrolling at its boundaries, including
				touch gestures.
			</p>
			<p>
				Height can change when a font or late content arrives. Those changes trigger layout
				invalidation; they are not a reason to measure every frame. Keep media dimensions reserved
				when possible. Arbitrary external font changes during an animation are still a real layout
				change and must be tested rather than assumed invisible.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'ownership-and-transition-boundaries',
			title: 'Ownership and transition boundaries',
			headline: 'Ownership and transition boundaries',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Optional <code>headerDetails</code> and <code>actionIcon</code> snippets on
				<a href="/docs/reference/components/#spatial-element-page">
					<code>SpatialElementPage</code>
				</a>
				customize the compact scroll header and the fixed 3XL pane header. Use
				<code>headerDetails</code> for quantity and price, and use the same icon as the summary CTA. Keep
				these fields compact enough for a mobile header. Store shared form values in the persistent layout,
				scoped to the current visitor and keyed by element ID, so editing either presentation immediately
				updates the other. The website Showcase demonstrates this with illustrative prices and manufacturer
				links; it is not a shop.
			</p>
			<p>
				To hand a custom field over when the header covers its summary counterpart, give both copies
				the same <code>data-spatial-element-header-field</code> value, such as <code>quantity</code>
				or <code>price</code>. Each header field fades in independently once its source is fully
				covered, and becomes inactive again when scrolling back. The primary action uses this
				behavior automatically. Space remains reserved to avoid moving the title; reduced motion
				disables the animation. This applies to the scroll header and the 3XL pane header.
			</p>
			<p>
				The persistent host gives a summary a lifetime beyond a route's placement node. Placement
				and ownership are different responsibilities: manually reparenting a route-owned Svelte
				subtree does not prevent the route from destroying it.
			</p>
			<p>
				The isolated <code>/proof/persistent-summary</code> fixture demonstrates DOM identity, input value,
				focus, effects and exactly one cleanup across ownership changes. Production carousel-to-detail
				and detail-to-carousel navigation retain the live summary independently of visual-transition eligibility,
				including reduced motion. The ordinary transition captures its decorative actors first, holds
				the live root through route teardown, then adopts that root before measuring the destination panel.
				Staged-navigation handoff uses the same host with its own motion and cancellation lifecycle.
			</p>
			<p>
				This separation keeps the user's ongoing interaction intact and avoids rendering two copies
				of the same form during a visual handoff.
			</p>
		</div>
	</Section>
</WebsitePage>
