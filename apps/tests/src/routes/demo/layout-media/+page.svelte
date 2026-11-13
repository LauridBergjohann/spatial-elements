<script lang="ts">
	import { Section, SpatialElementPage } from '@spatial-elements/sveltekit';
	import { spatialElements } from '$lib/catalog';
	const element = {
		...spatialElements[0],
		media: [
			{ id: 'model', kind: 'minimap' as const, label: '3D view' },
			{
				id: 'image',
				kind: 'image' as const,
				label: 'Form illustration',
				src: '/assets/demo/cube.svg',
				alt: 'A blue cube illustration'
			},
			{
				id: 'video',
				kind: 'video' as const,
				label: 'Silent motion study',
				src: '/assets/demo/media-study.webm',
				poster: '/assets/demo/cube.svg',
				captions: [
					{ src: '/assets/demo/media-study.vtt', language: 'en', label: 'English', default: true }
				]
			},
			{
				id: 'youtube',
				kind: 'youtube' as const,
				label: 'YouTube player demonstration',
				videoId: 'M7lc1UVf-VE'
			},
			...Array.from({ length: 5 }, (_, i) => ({
				id: `extra-${i}`,
				kind: 'image' as const,
				label: `Additional illustration ${i + 1}`,
				src: '/assets/demo/orb.svg',
				alt: 'A blue sphere illustration'
			})),
			{
				id: 'unavailable',
				kind: 'image' as const,
				label: 'Unavailable image example',
				src: '/assets/demo/missing-image.png',
				alt: 'Unavailable image'
			}
		]
	};
</script>

<SpatialElementPage spatialElement={element}>
	<Section section={{ id: 'features', title: 'Features', headline: 'One document, several media' }}>
		<p>
			Select a model, illustration or video. The media occupies the same fit area; native video
			controls keep their own input.
		</p>
		<p><a href="/demo/categories/list">Return to the collection</a></p>
		<div style="height: 1800px; background: linear-gradient(#eef4fa, #d9e5f2)">
			Long content for document scrolling and input checks.
		</div>
	</Section>
</SpatialElementPage>
