<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'ts',
			code: "media: [\n  { id: 'model', kind: 'minimap', label: '3D view' },\n  { id: 'front', kind: 'image', label: 'Front view', src: '/front.webp',\n    thumbnail: '/front-small.webp', alt: 'Front of the enclosure' },\n  { id: 'assembly', kind: 'video', label: 'Assembly', src: '/assembly.webm', poster: '/assembly.webp',\n    captions: [{ src: '/assembly-en.vtt', language: 'en', label: 'English', default: true }] },\n  { id: 'demo', kind: 'youtube', label: 'Demonstration', videoId: 'M7lc1UVf-VE' }\n]\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Media and controls' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Media and controls',
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
				Every detail page starts with one 3D entry. Add image, native video or YouTube entries with
				unique IDs:
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				An omitted 3D entry is inserted; duplicate minimap entries are ignored for presentation.
				Images need meaningful alt text. Use native WebVTT tracks for relevant audio. Replace the
				old source-less <code>drawing</code> entry with a real <code>image</code>; missing source
				data produces an unavailable message.
			</p>
			<p>
				Provide an optional <code>thumbnail</code> for each image to keep the media selector light.
				The rail loads these previews lazily; selecting an image uses its full <code>src</code>. A
				small <code>poster</code> serves the same purpose for videos. Without a thumbnail, the rail uses
				the image source directly.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'a-shared-fit-separate-media-lifetimes',
			title: 'A shared fit, separate media lifetimes',
			headline: 'A shared fit, separate media lifetimes',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Images and videos preserve proportions in the model's same fit rectangle. Selecting them
				hides the main scene and releases its interaction/sensor participation. Loaded model
				resources and camera state are retained, so returning to 3D does not require a new download.
			</p>
			<p>
				Native video uses ordinary controls, inline playback and metadata preload. It does not
				autoplay. Deselection pauses the video and releases its source. YouTube uses an explicitly
				selected privacy-enhanced iframe without autoplay; leaving removes that iframe. Host code
				cannot control arbitrary cross-origin pointer/wheel events inside the player.
			</p>
			<p>
				Navigation away and back resets media selection to 3D. Media IDs are not a substitute for
				model asset identity or route history. The rail reveals the selected item by adjusting its
				own local scroll position, without scrolling the document.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'gesture-ownership',
			title: 'Gesture ownership',
			headline: 'Gesture ownership',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p><img src="/documentation/images/input-zones.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>White UI controls retain their own input. A gesture keeps its initial owner until
					release.</em
				>
			</p>
			<table>
				<thead>
					<tr>
						<th>State</th>
						<th>Free-area gesture</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Flow detail, 3D</td>
						<td>Model contact rotates; outside scrolls</td>
					</tr>
					<tr>
						<td>Split detail, 3D</td>
						<td>Left of pane controls 3D; pane scrolls</td>
					</tr>
					<tr>
						<td>Split zoom, hidden pane</td>
						<td>Entire free viewport controls 3D</td>
					</tr>
					<tr>
						<td>Image/video</td>
						<td>Free areas scroll the document</td>
					</tr>
					<tr>
						<td>Native or embedded player UI</td>
						<td>Player owns its controls</td>
					</tr>
				</tbody>
			</table>
			<p>
				Ownership is selected at gesture start and does not flip when the finger crosses a region
				boundary. Menu, rail, pane and real player controls always take priority over model
				interaction.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'device-orientation',
			title: 'Device orientation',
			headline: 'Device orientation',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				SpatialCardGridSection and SpatialCarouselSection enable device orientation automatically;
				they have no <code>deviceOrientation</code> prop. Set <code>deviceOrientation</code> on BrandStageShell
				to enable detail geometry and minimaps as well. Access starts automatically where allowed. If
				explicit permission is needed, the framework requests it during a trusted internal navigation
				gesture without delaying navigation. Denial, missing sensors and reduced motion leave ordinary
				interaction available.
			</p>
			<p>
				Device rotation is calibrated, smoothed and bounded. Orientation changes reset the
				reference. Scrolling pauses application, and release establishes a new reference before the
				effect fades back in.
			</p>
			<p>
				The carousel uses a subtle shared view change with stronger rotation of the active item;
				mouse proximity still rotates individual items. Sensor behavior on real Android, Surface and
				iOS hardware requires direct checks. Desktop automation does not prove sensor axes,
				permission prompts or mobile browser-toolbar performance.
			</p>
			<p>
				The executable <code>/docs/examples/media/</code> fixture covers selected-media layout, player
				teardown, failure states and hidden-scene rendering. Its YouTube test uses a controlled iframe
				fixture; it does not claim validation of the remote service.
			</p>
		</div></Section
	>
</WebsitePage>
