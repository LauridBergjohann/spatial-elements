<script lang="ts">
	import { onMount, setContext, type Snippet } from 'svelte';
	import { SECTION_SURFACES, SectionSurfaceRegistry } from '@spatial-elements/core/spatial-element/SectionSurfaceRegistry';
	let { children }: { children?: Snippet } = $props();
	const componentId = $props.id();
	const scope = componentId.replace(/[^a-zA-Z0-9_-]/g, '_');
	let host: HTMLDivElement;
	let revision = $state(0);
	const surfaces = new SectionSurfaceRegistry(() => { revision += 1; });
	setContext(SECTION_SURFACES, surfaces);
	onMount(() => {
		const reorder = () => surfaces.order(Array.from(host.querySelectorAll<HTMLElement>('[data-spatial-section-surface]'))
			.filter(element => element.closest('[data-spatial-section-group]') === host)
			.map(element => Number(element.dataset.spatialSectionSurface)));
		const observer = new MutationObserver(reorder);
		observer.observe(host, { childList: true, subtree: true });
		reorder();
		return () => observer.disconnect();
	});
	const rules = $derived.by(() => {
		void revision;
		return surfaces.corners.map(({ id, top, bottom }) =>
			`[data-spatial-section-group="${scope}"] [data-spatial-section-surface="${id}"] {` +
			`--spatial-section-top-radius:${top ? 'var(--spatial-element-panel-radius)' : '0px'};` +
			`--spatial-section-bottom-radius:${bottom ? 'var(--spatial-element-panel-radius)' : '0px'};}`
		).join('\n');
	});
</script>

<div bind:this={host} data-spatial-section-group={scope} style="display: contents">
	{@render children?.()}
	<!-- Evaluate after children register during SSR; helper DOM cannot split surface groups. -->
	<svelte:element this={'style'}>{rules}</svelte:element>
</div>
