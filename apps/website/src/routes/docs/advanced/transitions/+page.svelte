<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'ts',
			code: "const readingItem = {\n  ...item,\n  href: `${item.href}#reading`,\n  targetPresentation: 'dock' as const\n};\n\nconst carouselItem = {\n  ...item,\n  summary: {\n    ...item.summary,\n    sectionLink: {\n      href: `${item.href}#reading`,\n      label: 'Read the details',\n      targetPresentation: 'dock' as const\n    }\n  }\n};\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Transitions' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Transitions',
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
				A known destination should not require a complete destination page just to begin moving. The
				same layout resolver that positions the detail page supplies its model fit and panel anchor
				before that page exists. Natural text height remains a separate content concern.
			</p>
			<p>
				<strong>Current activation:</strong> the source-first path requires
				<code>?stagedNavigation=1</code> on the source page and an enhanced, prepared source. It remains
				an experimental opt-in while the production performance gate is being evaluated. Without the flag,
				ordinary transitions continue to work. The endpoint declaration below does not enable this experimental
				path by itself.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'movement-holding-and-content',
			title: 'Movement, holding and content',
			headline: 'Movement, holding and content',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p><img src="/documentation/images/transition-phases.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The phase widths are illustrative. Loading can extend the hold; it does not require a
					second source movement or an empty intermediate page.</em
				>
			</p>
			<p>
				Forward navigation from a prepared card or the selected carousel element has three stages:
			</p>
			<ol>
				<li>
					<strong>Move the source.</strong> The existing model and live panel move toward the resolved
					endpoint. Their source content width and line wrapping stay fixed. Other collection content
					fades. The destination route has not mounted, and this phase does not prepare GPU resources.
				</li>
				<li>
					<strong>Hold and bind.</strong> Keep that presentation visible at its endpoint while the router
					mounts the detail page, restores its scroll position and binds its prepared model. A slow request
					extends this still interval; it does not remove the source or restart the movement.
				</li>
				<li>
					<strong>Reveal content.</strong> Additional detail content, natural summary height and the background
					appear. A retained carousel summary transfers its actual component and DOM into the destination
					slot, preserving local form state. No screenshot clone substitutes for it.
				</li>
			</ol>
			<p>
				The router can preload code and data during movement. Downloading is asynchronous, but
				module execution and application <code>load</code> work can still occupy the main thread. Keep
				those functions small, preload likely destinations and measure cold routes separately from warm
				ones. A resolved Promise alone does not prove that work ran outside animation frames.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'hero-and-compact-destinations',
			title: 'Hero and compact destinations',
			headline: 'Hero and compact destinations',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				An ordinary detail URL, or <code>#overview</code>, opens the overview. At smaller widths the
				panel and model follow the flow composition; in the 3XL split layout the left stage remains
				fixed and the panel belongs to the right content pane.
			</p>
			<p>
				An arbitrary fragment cannot predict a compact header: the section may still lie within the
				overview, or a short document may clamp scrolling. Such navigation uses the ordinary
				transition after the destination is available. When an application knows that a section
				opens a completely docked view, it can declare that endpoint on a list item or carousel
				section link:
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				This declaration is a contract about the destination, not a request to insert artificial
				scroll space. The actual bound composition is checked. If it disagrees, the hold is released
				and the usable destination appears. In 3XL, a declared dock destination still keeps the
				model on the large fixed left stage; the right pane header receives the moving panel text.
			</p>
			<p>
				Only the existing surface, title and eyebrow move into a compact header. Text scales
				uniformly; it does not stretch with a wide, short background. Other summary content fades,
				and the live summary is adopted after the new header is visible. Custom summaries register
				their text roles as shown in <a href="/docs/sections/summaries/">Summary Panels</a>.
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
				The moving source is temporarily inert. Pointer and sensor effects stop competing with the
				transition; sensor motion resumes from a recalibrated neutral pose. Resizing, scrolling,
				Escape, another navigation or leaving the page cancels obsolete visual ownership. Before the
				router commits, cleanup restores the source and prevents the obsolete destination from
				mounting. After commit, interruption removes the visual hold while the destination finishes
				binding. It does not restore an old scroll position or move focus over the user's new
				interaction. An equal carousel summary renderer still transfers its live instance and form
				values; a newer navigation cancels that pending transfer before it can adopt an obsolete
				slot. A list card uses a different renderer and does not transfer arbitrary card component
				state into the summary.
			</p>
			<p>
				Unprepared sources, unsupported routes, ambiguous occurrences and summaries whose internal
				scroll/clipping cannot be transferred safely keep the ordinary navigation path. Back/Forward
				and the return to a collection retain native URL, history, focus and scroll semantics. Links
				with explicit SvelteKit focus, scroll, replacement or reload policies keep those policies.
				Reduced motion skips the artificial animation interval. No JavaScript and unavailable WebGPU
				continue to use ordinary links and poster-based layout.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'what-timing-measurements-mean',
			title: 'What timing measurements mean',
			headline: 'What timing measurements mean',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				First source movement, GPU submission and total content readiness are different
				measurements. The production tests record all three phases, DOM ownership, resource creation
				and frame intervals. Repeated warm and cold measurements must state the browser and machine;
				they cannot guarantee identical timing on every phone or every application's data loader.
				The layout removes destination measurement from the early path, while the production
				performance report records what the implementation achieves on the tested environment.
			</p>
		</div></Section
	>
</WebsitePage>
