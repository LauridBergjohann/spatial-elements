<script lang="ts">
	import { ContentPage, ContentGrid, ContentBlock } from '@spatial-elements/sveltekit';
	const widths = [356, 600, 840, 1200, 1536];
</script>

<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'Content grid reference' }}>
	<p class="introduction">
		The same viewport contains independently sized grids. Blocks follow their authored order.
	</p>
	{#each widths as width}
		<section
			class="sample spatial-content-container"
			style:width={`${width}px`}
			data-grid-sample={width}
			aria-label={`${width}px grid`}
		>
			<div class="sample-inset ps-grid-scope">
				<h2>{width}px container</h2>
				<ContentGrid data-grid>
					<ContentBlock span={{ xs: 4, s: 3, m: 4, l: 6 }} data-block="first"
						><a href="#grid-end">First block</a></ContentBlock
					>
					<ContentBlock span={{ xs: 4, s: 3, m: 4, l: 6 }} data-block="second"
						><a href="#grid-end">Second block</a></ContentBlock
					>
					<ContentBlock span={{ xs: 2, m: 3 }} data-block="inherited"
						>A span inherited from the last smaller grid.</ContentBlock
					>
					<ContentBlock data-block="full">Omitting the span fills one row.</ContentBlock>
					<ContentBlock span={99} data-block="clamped"
						>Oversized spans clamp to the current column count.</ContentBlock
					>
					<ContentBlock span={0} data-block="invalid"
						>Invalid spans fall back to one full row.</ContentBlock
					>
				</ContentGrid>
			</div>
		</section>
	{/each}
	<section class="sample spatial-content-container order-sample" aria-label="Reading order sample">
		<div class="sample-inset ps-grid-scope">
			<h2>No dense backfilling</h2>
			<ContentGrid data-order-grid>
				<ContentBlock span={3}><a id="order-first" href="#grid-end">First</a></ContentBlock>
				<ContentBlock span={4}><a id="order-second" href="#grid-end">Second</a></ContentBlock>
				<ContentBlock span={1}><a id="order-third" href="#grid-end">Third</a></ContentBlock>
			</ContentGrid>
		</div>
	</section>
	<p id="grid-end">End of the grid examples.</p>
</ContentPage>

<style>
	.sample {
		max-width: 100%;
		margin: 0 auto 24px;
		background: color-mix(in srgb, var(--spatial-element-background) 70%, white);
		pointer-events: auto;
	}
	.sample-inset {
		padding: var(--spatial-grid-gap);
	}
	h2 {
		margin: 0 0 var(--spatial-grid-headline-gap);
		font-size: var(--spatial-grid-headline-size);
		line-height: var(--spatial-grid-headline-line-height);
	}
	.sample :global(.spatial-content-block) {
		background: color-mix(in srgb, var(--spatial-element-accent) 12%, transparent);
		min-height: 48px;
	}
	.order-sample {
		width: 356px;
	}
	.introduction,
	#grid-end {
		margin: 16px;
	}
	a {
		color: var(--spatial-element-accent);
	}
</style>
