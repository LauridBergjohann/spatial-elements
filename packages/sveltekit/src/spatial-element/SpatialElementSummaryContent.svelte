<script lang="ts">
 import { catalogActionSemantic } from '@spatial-elements/core/catalog/catalogAction';
 import type { CatalogEndpointAddress, CatalogEndpointRole } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
 import type { SpatialElementFeature, SpatialElementAction } from '@spatial-elements/core/spatial-element/types';
 import { ShoppingCart } from 'lucide-svelte';
 import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
 let { spatialElement, address, contentInset, heading = 'h3', element = $bindable() }: {
  spatialElement: { id: string; eyebrow: string; title: string; features: SpatialElementFeature[]; action?: SpatialElementAction };
  address: (role: CatalogEndpointRole) => CatalogEndpointAddress | undefined;
  contentInset: number;
  heading?: 'h1' | 'h3';
  element?: HTMLDivElement;
 } = $props();
 const catalogEndpoint = createCatalogEndpointAction();
</script>
		<div bind:this={element} class="summary-presentation" style:min-height={`${Math.max(504 - contentInset * 2, 0)}px`}>
			<div class="panel-copy">
				<p
					class="panel-kicker"
					data-shared-role="eyebrow"
					data-spatial-element-id={spatialElement.id}
					use:catalogEndpoint={address('eyebrow')}
				>
					{spatialElement.eyebrow}
				</p>
				<svelte:element this={heading} class="summary-title"
					id={heading === 'h1' ? 'spatial-element-title' : undefined}
					tabindex={heading === 'h1' ? -1 : undefined}
					data-shared-role="title"
					data-spatial-element-id={spatialElement.id}
					use:catalogEndpoint={address('title')}
				>
					{spatialElement.title}
				</svelte:element>
			</div>

			<ul
				class="feature-list"
				aria-label="SpatialElement highlights"
				use:catalogEndpoint={address('features')}
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
						use:catalogEndpoint={address('primary-action')}
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
						use:catalogEndpoint={address('primary-action')}
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
<style>
	.summary-presentation {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 24px;
		pointer-events: auto;
	}

	.summary-title {
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

</style>
