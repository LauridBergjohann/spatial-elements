<script lang="ts">
	import type { SpatialElementMediaItem } from '@spatial-elements/core/spatial-element/types';
	import { spatialYoutubeEmbedUrl } from '@spatial-elements/core/spatial-element/spatialElementMedia';
	let { media }: { media: Exclude<SpatialElementMediaItem, { kind: 'minimap' }> } = $props();
	let failed = $state(false);
	const embedUrl = $derived(media.kind === 'youtube' ? spatialYoutubeEmbedUrl(media.videoId) : undefined);
	$effect(() => { media.id; failed = false; });
	function releaseVideo(video: HTMLVideoElement) {
		return { destroy() { video.pause(); video.removeAttribute('src'); video.load(); } };
	}
</script>

<div class="spatial-native-media" data-spatial-native-media={media.kind} data-stage-ui>
	{#if failed || media.kind === 'drawing' || (media.kind === 'youtube' && !embedUrl)}
		<p role="status">{media.label}: media unavailable.</p>
	{:else if media.kind === 'image'}
		<img src={media.src} alt={media.alt} onerror={() => failed = true} />
	{:else if media.kind === 'video'}
		<!-- Captions are supplied through the typed media track collection below. -->
		<!-- svelte-ignore a11y_media_has_caption -->
		<video use:releaseVideo src={media.src} poster={media.poster} controls playsinline preload="metadata" aria-label={media.label} onerror={() => failed = true}>
			{#each media.captions ?? [] as track}
				<track kind="captions" src={track.src} srclang={track.language} label={track.label} default={track.default} />
			{/each}
		</video>
	{:else if media.kind === 'youtube' && embedUrl}
		<iframe src={embedUrl} title={media.label} allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
	{/if}
</div>

<style>
	.spatial-native-media { display: grid; place-items: center; width: 100%; height: 100%; min-width: 0; min-height: 0; pointer-events: auto; }
	img, video { display: block; width: 100%; height: 100%; object-fit: contain; }
	iframe { border: 0; width: 100%; height: 100%; }
	p { max-width: 32rem; padding: 24px; text-align: center; }
</style>
