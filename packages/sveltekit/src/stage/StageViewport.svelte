<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import type { CatalogEndpointAddress } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
		class?: string;
		fallbackSrc?: string;
		fallbackAlt?: string;
		catalogEndpoint?: CatalogEndpointAddress;
	};

	let {
		children,
		class: frameClass = '',
		fallbackSrc,
		fallbackAlt = '',
		catalogEndpoint,
		...rest
	}: Props = $props();

	let element: HTMLDivElement;
	const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const registerEndpoint = createCatalogEndpointAction();

	if (!stage) {
		throw new Error('StageViewport must be rendered inside a Stage component');
	}

	const unregister = stage.registerViewport({
		getElement: () => element
	});

	onDestroy(unregister);
</script>

<div
	{...rest}
	bind:this={element}
	use:registerEndpoint={catalogEndpoint}
	data-stage-viewport
	class={[frameClass, 'stage-viewport'].filter(Boolean).join(' ')}
>
	{#if fallbackSrc}
		<img class="stage-viewport-fallback-image" src={fallbackSrc} alt={fallbackAlt} />
	{:else}
		{@render children?.()}
	{/if}
</div>

<style>
	.stage-viewport {
		position: relative;
		box-sizing: border-box;
	}

	.stage-viewport-fallback-image {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	:global(.stage-enhanced) .stage-viewport-fallback-image {
		visibility: hidden;
	}
</style>
