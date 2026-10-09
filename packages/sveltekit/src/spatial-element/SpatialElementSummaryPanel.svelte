<script lang="ts">
	import { onMount } from 'svelte';
	import { catalogActionSemantic } from '@spatial-elements/core/catalog/catalogAction';
	import { ShoppingCart } from 'lucide-svelte';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import type { ResolvedSpatialElementData as SpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';

	let { spatialElement }: { spatialElement: SpatialElementData } = $props();
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const catalogEndpoint = createCatalogEndpointAction();
	const contentInset = $derived(theme.panelShape.contentInset ?? Math.max(16, Math.round(theme.panelShape.radius * 0.7)));
	let presentation: HTMLDivElement;
	let panelHeight = $state<number>();

	onMount(() => {
		// The stage reparents the rendered content. Keep its layout placeholder in
		// sync using untransformed content size, including wrapping and font loads.
		panelHeight = Math.max(504, presentation.offsetHeight + contentInset * 2);
		const observer = new ResizeObserver(([entry]) => {
			const height = entry.borderBoxSize?.[0]?.blockSize ?? presentation.offsetHeight;
			panelHeight = Math.max(504, Math.ceil(height + contentInset * 2));
		});
		observer.observe(presentation);
		return () => observer.disconnect();
	});
</script>

<div class="spatial-element-aside" style:--summary-panel-height={panelHeight === undefined ? undefined : `${panelHeight}px`}>
	<Panel
		catalogEndpoint={{
			brandId: theme.id,
			spatialElementId: spatialElement.id,
			slot: 'detail.summary',
			role: 'summary-surface'
		}}
		pointerReactive={false}
		transitionGroup="shared"
		class="spatial-element-panel"
		shape={theme.panelShape}
		theme={theme.panelTheme}
		contentClass="stage-panel-content spatial-element-content"
		aria-labelledby="spatial-element-title"
		data-spatial-element-hero-panel-content
		data-shared-role="summary-surface"
		data-spatial-element-id={spatialElement.id}
	>
		<div bind:this={presentation} class="summary-presentation" style:min-height={`${Math.max(504 - contentInset * 2, 0)}px`}>
			<div class="panel-copy">
				<p
					class="panel-kicker"
					data-shared-role="eyebrow"
					data-spatial-element-id={spatialElement.id}
					use:catalogEndpoint={{
						brandId: theme.id,
						spatialElementId: spatialElement.id,
						slot: 'detail.summary',
						role: 'eyebrow'
					}}
				>
					{spatialElement.eyebrow}
				</p>
				<h1
					id="spatial-element-title"
					tabindex="-1"
					data-shared-role="title"
					data-spatial-element-id={spatialElement.id}
					use:catalogEndpoint={{
						brandId: theme.id,
						spatialElementId: spatialElement.id,
						slot: 'detail.summary',
						role: 'title'
					}}
				>
					{spatialElement.title}
				</h1>
			</div>

			<ul
				class="feature-list"
				aria-label="SpatialElement highlights"
				use:catalogEndpoint={{
					brandId: theme.id,
					spatialElementId: spatialElement.id,
					slot: 'detail.summary',
					role: 'features'
				}}
				data-catalog-rich-shared="features"
				data-catalog-semantic={JSON.stringify(spatialElement.features)}
			>
				{#each spatialElement.features as feature (feature.label)}
					<li>
						<span class="feature-content" data-catalog-secondary>
							<span class="feature-marker" aria-hidden="true">{feature.marker ?? 'Link'}</span>
							<span>{feature.label}</span>
						</span>
					</li>
				{/each}
			</ul>

			{#if spatialElement.action}
				{#if spatialElement.action.href}
					<a
						use:catalogEndpoint={{
							brandId: theme.id,
							spatialElementId: spatialElement.id,
							slot: 'detail.summary',
							role: 'primary-action'
						}}
						data-catalog-rich-shared="primary-action"
						data-catalog-semantic={catalogActionSemantic(spatialElement.action)}
						class="spatial-element-action spatial-element-action-expanded"
						href={spatialElement.action.href}
						rel="external"
						aria-label={spatialElement.action.ariaLabel}
					>
						<span class="spatial-element-action-surface" data-catalog-secondary>
							<ShoppingCart
								class="spatial-element-action-icon"
								size={27}
								strokeWidth={2}
								aria-hidden="true"
							/>
							<span class="spatial-element-action-label">{spatialElement.action.label}</span>
						</span>
					</a>
				{:else}
					<button
						use:catalogEndpoint={{
							brandId: theme.id,
							spatialElementId: spatialElement.id,
							slot: 'detail.summary',
							role: 'primary-action'
						}}
						data-catalog-rich-shared="primary-action"
						data-catalog-semantic={catalogActionSemantic(spatialElement.action)}
						class="spatial-element-action spatial-element-action-expanded"
						type="button"
						aria-label={spatialElement.action.ariaLabel}
					>
						<span class="spatial-element-action-surface" data-catalog-secondary>
							<ShoppingCart
								class="spatial-element-action-icon"
								size={27}
								strokeWidth={2}
								aria-hidden="true"
							/>
							<span class="spatial-element-action-label">{spatialElement.action.label}</span>
						</span>
					</button>
				{/if}
			{/if}
		</div>
	</Panel>
</div>

<style>
	.spatial-element-aside {
		position: relative;
		min-height: inherit;
	}

	:global(.spatial-element-panel) {
		position: sticky;
		top: var(--spatial-element-summary-sticky-top, 104px);
		width: min(494px, 100%);
		height: var(--summary-panel-height, auto);
		min-height: 504px;
		pointer-events: auto;
	}

	:global(.spatial-element-content) {
		position: relative;
		display: block;
		overflow: visible;
		color: color-mix(in srgb, var(--spatial-element-ink) 92%, transparent);
	}

	.summary-presentation {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 24px;
		pointer-events: auto;
	}

	.summary-presentation h1 {
		max-width: 390px;
		margin: 10px 0 0;
		font-size: clamp(30px, 3vw, 40px);
		font-weight: 780;
		line-height: 1.16;
	}

	.panel-kicker {
		margin: 0;
		font-size: 14px;
		font-weight: 720;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.feature-list {
		display: grid;
		gap: 20px;
		margin: 0;
		padding: 0;
		color: var(--spatial-element-body);
		font-size: 18px;
		list-style: none;
	}

	.feature-content {
		display: flex;
		align-items: baseline;
		gap: 14px;
	}

	.feature-marker {
		color: var(--spatial-element-accent);
		font-weight: 800;
	}

	.spatial-element-action {
		display: block;
		box-sizing: border-box;
		width: 100%;
		min-height: 62px;
		border: 0;
		padding: 0;
		color: inherit;
		background: transparent;
		text-decoration: none;
		cursor: pointer;
	}

	.spatial-element-action-surface {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		box-sizing: border-box;
		width: 100%;
		min-height: 62px;
		border-radius: 7px;
		color: var(--spatial-element-on-accent);
		background: var(--spatial-element-accent);
		font:
			760 22px/1 system-ui,
			sans-serif;
	}

	:global(.spatial-element-action-icon) {
		flex: none;
	}

	.spatial-element-action-label {
		white-space: nowrap;
	}

	@media (max-width: 1100px) {
		.spatial-element-aside { min-height: 0; }
		:global(.spatial-element-panel) {
			position: relative;
			top: auto;
		}
	}
</style>
