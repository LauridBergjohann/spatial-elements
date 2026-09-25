<script lang="ts">
	import { catalogActionSemantic } from '@spatial-elements/core/catalog/catalogAction';
	import { ShoppingCart } from 'lucide-svelte';
	import Panel from '../stage/Panel.svelte';
	import { useProductBrand } from './brandContext.js';
	import type { ProductDetailData } from '@spatial-elements/core/product-detail/types';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';

	let { product }: { product: ProductDetailData } = $props();
	const theme = useProductBrand();
	const catalogEndpoint = createCatalogEndpointAction();
</script>

<div class="product-aside">
	<Panel
		catalogEndpoint={{
			brandId: theme.id,
			productId: product.id,
			slot: 'pdp.summary',
			role: 'summary-surface'
		}}
		transitionGroup="shared"
		class="product-detail-panel"
		shape={theme.panelShape}
		theme={theme.panelTheme}
		contentClass="stage-panel-content product-detail-content"
		aria-labelledby="product-title"
		data-product-hero-panel-content
		data-shared-role="summary-surface"
		data-product-id={product.id}
	>
		<div class="summary-presentation">
			<div class="panel-copy">
				<p
					class="panel-kicker"
					data-shared-role="eyebrow"
					data-product-id={product.id}
					use:catalogEndpoint={{
						brandId: theme.id,
						productId: product.id,
						slot: 'pdp.summary',
						role: 'eyebrow'
					}}
				>
					{product.eyebrow}
				</p>
				<h1
					id="product-title"
					tabindex="-1"
					data-shared-role="title"
					data-product-id={product.id}
					use:catalogEndpoint={{
						brandId: theme.id,
						productId: product.id,
						slot: 'pdp.summary',
						role: 'title'
					}}
				>
					{product.title}
				</h1>
			</div>

			<ul
				class="feature-list"
				aria-label="Product highlights"
				use:catalogEndpoint={{
					brandId: theme.id,
					productId: product.id,
					slot: 'pdp.summary',
					role: 'features'
				}}
				data-catalog-rich-shared="features"
				data-catalog-semantic={JSON.stringify(product.features)}
			>
				{#each product.features as feature (feature.label)}
					<li>
						<span class="feature-content" data-catalog-secondary>
							<span class="feature-marker" aria-hidden="true">{feature.marker ?? 'Link'}</span>
							<span>{feature.label}</span>
						</span>
					</li>
				{/each}
			</ul>

			{#if product.action.href}
				<a
					use:catalogEndpoint={{
						brandId: theme.id,
						productId: product.id,
						slot: 'pdp.summary',
						role: 'primary-action'
					}}
					data-catalog-rich-shared="primary-action"
					data-catalog-semantic={catalogActionSemantic(product.action)}
					class="product-action product-action-expanded"
					href={product.action.href}
					rel="external"
					aria-label={product.action.ariaLabel}
				>
					<span class="product-action-surface" data-catalog-secondary>
						<ShoppingCart
							class="product-action-icon"
							size={27}
							strokeWidth={2}
							aria-hidden="true"
						/>
						<span class="product-action-label">{product.action.label}</span>
					</span>
				</a>
			{:else}
				<button
					use:catalogEndpoint={{
						brandId: theme.id,
						productId: product.id,
						slot: 'pdp.summary',
						role: 'primary-action'
					}}
					data-catalog-rich-shared="primary-action"
					data-catalog-semantic={catalogActionSemantic(product.action)}
					class="product-action product-action-expanded"
					type="button"
					aria-label={product.action.ariaLabel}
				>
					<span class="product-action-surface" data-catalog-secondary>
						<ShoppingCart
							class="product-action-icon"
							size={27}
							strokeWidth={2}
							aria-hidden="true"
						/>
						<span class="product-action-label">{product.action.label}</span>
					</span>
				</button>
			{/if}
		</div>
	</Panel>
</div>

<style>
	@property --summary-feature-hover-progress {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}

	@property --summary-action-hover-progress {
		syntax: '<number>';
		inherits: false;
		initial-value: 0;
	}

	.product-aside {
		min-height: inherit;
	}

	:global(.product-detail-panel) {
		position: relative;
		top: 0;
		width: min(494px, 100%);
		height: 504px;
		min-height: 504px;
		pointer-events: auto;
	}

	:global(.product-detail-content) {
		position: relative;
		display: block;
		overflow: visible;
		color: color-mix(in srgb, var(--product-ink) 92%, transparent);
		transform-style: preserve-3d;
	}

	.summary-presentation {
		--summary-depth-progress: var(--stage-panel-pointer-proximity, 0);
		--summary-shadow-strength: var(--stage-panel-shadow-strength, 0.18);
		--summary-feature-depth: 40;
		--summary-feature-hover-depth: 48;
		--summary-eyebrow-depth: 60;
		--summary-title-depth: 96;
		--summary-action-depth: 76;
		--summary-action-hover-depth: 24;

		position: absolute;
		inset: 0;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 24px;
		pointer-events: auto;
		transform-style: preserve-3d;
	}

	.panel-copy {
		transform-style: preserve-3d;
	}

	.summary-presentation h1 {
		max-width: 390px;
		margin: 10px 0 0;
		font-size: clamp(30px, 3vw, 40px);
		font-weight: 780;
		line-height: 1.16;
		transform-origin: left center;
		will-change: transform;
	}

	.panel-kicker {
		margin: 0;
		font-size: 14px;
		font-weight: 720;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		transform-origin: left center;
		will-change: transform;
	}

	.feature-list {
		display: grid;
		gap: 20px;
		margin: 0;
		padding: 0;
		color: var(--product-body);
		font-size: 18px;
		list-style: none;
		transform-style: preserve-3d;
	}

	.feature-list li {
		transform-style: preserve-3d;
	}

	.feature-content {
		--summary-feature-hover-progress: 0;
		--summary-feature-effective-depth: calc(
			var(--summary-feature-depth) * var(--summary-depth-progress) +
				var(--summary-feature-hover-depth) * var(--summary-feature-hover-progress)
		);
		--summary-feature-shadow-depth: calc(
			var(--summary-feature-depth) * var(--summary-depth-progress)
		);

		display: flex;
		align-items: baseline;
		gap: 14px;
		text-shadow:
			0 calc(0.055px * var(--summary-feature-shadow-depth))
				calc(0.055px * var(--summary-feature-shadow-depth))
				rgb(
					0 0 0 /
						calc(0.0168 * var(--summary-shadow-strength) * var(--summary-feature-shadow-depth))
				),
			0 calc(0.194px * var(--summary-feature-shadow-depth))
				calc(0.278px * var(--summary-feature-shadow-depth))
				rgb(
					0 0 0 /
						calc(0.00936 * var(--summary-shadow-strength) * var(--summary-feature-shadow-depth))
				);
		transform: translateZ(calc(1px * var(--summary-feature-effective-depth)));
		transform-origin: left center;
		transition: --summary-feature-hover-progress 260ms cubic-bezier(0.22, 0.75, 0.25, 1);
		will-change: transform;
	}

	.feature-list li:hover .feature-content {
		--summary-feature-hover-progress: 1;
	}

	.feature-marker {
		color: var(--product-accent);
		font-weight: 800;
	}

	.product-action {
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
		transform-style: preserve-3d;
	}

	.product-action:is(:hover, :focus-visible) .product-action-surface {
		--summary-action-hover-progress: 1;
	}

	.product-action-surface {
		--summary-action-hover-progress: 0;

		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		box-sizing: border-box;
		width: 100%;
		min-height: 62px;
		border-radius: 7px;
		color: var(--product-on-accent);
		background: var(--product-accent);
		font:
			760 22px/1 system-ui,
			sans-serif;
		transform-origin: center;
		transition: --summary-action-hover-progress 260ms cubic-bezier(0.22, 0.75, 0.25, 1);
		will-change: transform;
	}

	.panel-kicker {
		--summary-eyebrow-effective-depth: calc(
			var(--summary-eyebrow-depth) * var(--summary-depth-progress)
		);

		text-shadow:
			0 calc(0.055px * var(--summary-eyebrow-effective-depth))
				calc(0.04px * var(--summary-eyebrow-effective-depth))
				rgb(
					0 0 0 /
						calc(0.0134 * var(--summary-shadow-strength) * var(--summary-eyebrow-effective-depth))
				),
			0 calc(0.117px * var(--summary-eyebrow-effective-depth))
				calc(0.167px * var(--summary-eyebrow-effective-depth))
				rgb(
					0 0 0 /
						calc(0.0074 * var(--summary-shadow-strength) * var(--summary-eyebrow-effective-depth))
				);
		transform: translateZ(calc(1px * var(--summary-eyebrow-effective-depth)));
	}

	.summary-presentation h1 {
		--summary-title-effective-depth: calc(
			var(--summary-title-depth) * var(--summary-depth-progress)
		);

		text-shadow:
			0 calc(0.055px * var(--summary-title-effective-depth))
				calc(0.04px * var(--summary-title-effective-depth))
				rgb(
					0 0 0 /
						calc(0.007 * var(--summary-shadow-strength) * var(--summary-title-effective-depth))
				),
			0 calc(0.156px * var(--summary-title-effective-depth))
				calc(0.203px * var(--summary-title-effective-depth))
				rgb(
					0 0 0 /
						calc(0.0039 * var(--summary-shadow-strength) * var(--summary-title-effective-depth))
				);
		transform: translateZ(calc(1px * var(--summary-title-effective-depth)));
	}

	.product-action-surface {
		--summary-action-effective-depth: calc(
			var(--summary-action-depth) * var(--summary-depth-progress) +
				var(--summary-action-hover-depth) * var(--summary-action-hover-progress)
		);

		box-shadow:
			0 calc(0.078px * var(--summary-action-effective-depth))
				calc(0.094px * var(--summary-action-effective-depth))
				rgb(
					0 0 0 /
						calc(0.0105 * var(--summary-shadow-strength) * var(--summary-action-effective-depth))
				),
			0 calc(0.237px * var(--summary-action-effective-depth))
				calc(0.316px * var(--summary-action-effective-depth))
				rgb(
					0 0 0 /
						calc(0.0068 * var(--summary-shadow-strength) * var(--summary-action-effective-depth))
				);
		transform: translateZ(calc(1px * var(--summary-action-effective-depth)));
	}

	:global(.product-action-icon) {
		flex: none;
	}

	.product-action-label {
		white-space: nowrap;
	}

	/* Zero-depth transforms still promote text to composited layers in Chromium.
	 * Remove those layers while the complete panel is in its native DOM rest mode. */
	:global([data-stage-panel-render-mode='native']) .summary-presentation,
	:global([data-stage-panel-render-mode='native']) .panel-copy,
	:global([data-stage-panel-render-mode='native']) .feature-list,
	:global([data-stage-panel-render-mode='native']) .feature-list li,
	:global([data-stage-panel-render-mode='native']) .product-action {
		transform-style: flat;
	}

	:global([data-stage-panel-render-mode='native']) .panel-kicker,
	:global([data-stage-panel-render-mode='native']) .summary-presentation h1,
	:global([data-stage-panel-render-mode='native']) .feature-content,
	:global([data-stage-panel-render-mode='native']) .product-action-surface {
		transform: none;
		will-change: auto;
	}

	@media (prefers-reduced-motion: reduce) {
		.summary-presentation {
			--summary-depth-progress: 0;
		}

		.feature-content,
		.feature-list li:hover .feature-content,
		.product-action-surface,
		.product-action:is(:hover, :focus-visible) .product-action-surface {
			--summary-feature-hover-progress: 0;
			--summary-action-hover-progress: 0;
			transition: none;
		}
	}

	@media (max-width: 1100px) {
		:global(.product-detail-panel) {
			top: auto;
		}
	}
</style>
