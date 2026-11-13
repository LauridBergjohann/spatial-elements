<script lang="ts">
	let { kind }: { kind: 'detail' | 'fullscreen' } = $props();
	// Authored layout icons: assets/box-details.svg and assets/box-fullscreen.svg.
	const detail = [
		'M10.504 19.23 L13.504 17.49', 'M10.505 8.771 A2 2 0 0 0 8.613 8.707',
		'M13.504 17.49 A2 2 0 0 0 14.5 15.76', 'M13.505 10.513 L10.505 8.771',
		'M14.5 12.243 A2 2 0 0 0 13.505 10.513', 'M14.5 15.76 L14.5 12.243',
		'M19.5 17.5 L19.5 8.5', 'M2 5 L22 5', 'M4.5 12.244 L4.5 15.76',
		'M4.5 15.76 A2 2 0 0 0 5.496 17.49', 'M4.764 11.252 L9.5 14',
		'M5.495 10.514 A2 2 0 0 0 4.5 12.244', 'M5.496 17.49 L8.496 19.23',
		'M8.496 19.23 A2 2 0 0 0 10.504 19.23', 'M8.613 8.707 L5.495 10.514',
		'M9.5 14 L14.237 11.252', 'M9.5 14 L9.5 19.5'
	];
	const fullscreen = [
		'M11.333 18.819 A1.33 1.33 0 0 0 12.667 18.819', 'M11.333 5.846 L6.667 8.513',
		'M12 12.333 L17.8 9', 'M12 19 L12 12.333', 'M12.667 18.819 L17.333 16.153',
		'M12.667 5.846 A1.33 1.33 0 0 0 11.333 5.846', 'M17.333 16.153 A1.33 1.33 0 0 0 18 15',
		'M17.333 8.513 L12.667 5.846', 'M18 15 L18 9.666',
		'M18 9.666 A1.33 1.33 0 0 0 17.333 8.513', 'M6 15 A1.33 1.33 0 0 0 6.667 16.153',
		'M6 9.666 L6 15', 'M6.2 9 L12 12.333', 'M6.667 16.153 L11.333 18.819',
		'M6.667 8.513 A1.33 1.33 0 0 0 6 9.666'
	];
</script>

<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
	stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-spatial-view-icon={kind}>
	{#each kind === 'detail' ? detail : fullscreen as path}<path d={path} />{/each}
	<rect x="1" y="2" width="22" height="20" rx="2" />
</svg>
