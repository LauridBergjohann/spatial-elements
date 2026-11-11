<script lang="ts">
	import { browser } from '$app/environment';
	import { createRawSnippet, getContext, onMount } from 'svelte';
	import { render } from 'svelte/server';
	import { islandContext, type IslandController, type IslandDescriptor } from './controller';
	import { islandTelemetry } from './telemetry';
	import IslandRoot from './IslandRoot.svelte';
	let { descriptor }: { descriptor: IslandDescriptor } = $props();
	const controller = getContext<IslandController>(islandContext);
	const raw = createRawSnippet(() => ({
		render: () => {
			let body = '';
			if (!browser) {
				const result = render(IslandRoot, {
					props: { content: controller.content() },
					context: controller.contexts,
					idPrefix: `proof-${descriptor.slot}`
				});
				body = result.body;
				if (result.head)
					throw new Error(
						'This proof accepts content-only summaries; page-head output needs an explicit host contract'
					);
			}
			const inner = browser
				? ''
				: `<div data-island-root style="width:100%;container-type:inline-size;container-name:island-summary">${body}</div>`;
			return `<div data-native-island-slot="${descriptor.slot}" style="width:${descriptor.width}px;max-width:100%">${inner}</div>`;
		},
		setup: (element) => controller.attach(element as HTMLElement, descriptor)
	}));
	onMount(() => {
		islandTelemetry().routeMounts++;
		return () => {
			islandTelemetry().routeDestroys++;
		};
	});
</script>

{@render raw()}
