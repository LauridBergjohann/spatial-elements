<script lang="ts">
	import { ContentPage, Section } from '@spatial-elements/sveltekit';
</script>

<ContentPage hdr="/assets/studio.hdr" page={{ title: 'Showcase', pageTitle: 'Showcase | Spatial Elements', eyebrow: 'SPATIAL ELEMENTS' }}>
	<Section section={{ id: 'introduction', title: 'A space for new perspectives' }}>
		<div class="introduction">
			<span class="accent-line" aria-hidden="true"></span>
			<h2>A space for<br />new perspectives.</h2>
			<p>Objects, images and stories. A collection of spatial experiences is taking shape here.</p>
		</div>
	</Section>
</ContentPage>

<style>
	.introduction { padding-block: clamp(56px, 12svh, 144px); max-width: 880px; }
	.accent-line { display: block; width: 48px; height: 3px; background: var(--showcase-focus); margin-bottom: 36px; }
	h2 { margin: 0; font-size: clamp(36px, 5.5vw, 80px); font-weight: 500; letter-spacing: -.055em; line-height: 1.06; }
	p { max-width: 460px; margin: 28px 0 0; color: var(--showcase-muted); line-height: 1.7; font-size: clamp(16px, 1.5vw, 19px); }
</style>
