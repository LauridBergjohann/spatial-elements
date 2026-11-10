<script lang="ts">
	import { onMount } from 'svelte';
	import {
		recordCarouselPanel,
		captureCarouselElement
	} from '@spatial-elements/core/catalog/carouselPanelProjection';
	import {
		getProjectiveCssMatrix3d,
		type CssProjectionQuad
	} from '@spatial-elements/core/stage/cssProjection';
	let panel: HTMLDivElement, query: HTMLDivElement;
	const corners: CssProjectionQuad = [
		{ x: 100, y: 100 },
		{ x: 530, y: 125 },
		{ x: 500, y: 480 },
		{ x: 130, y: 420 }
	];
	const transform = getProjectiveCssMatrix3d(corners, 400.5, 340.25)!;
	onMount(() => {
		recordCarouselPanel(panel, corners, 400.5, 340.25);
		(window as any).__captureCarouselProjection = (selector: string) => {
			const element = document.querySelector<HTMLElement>(selector)!;
			const capture = captureCarouselElement(element);
			const actual = Array.from(element.querySelectorAll<HTMLElement>(':scope > .marker')).map(
				(marker) => {
					const r = marker.getBoundingClientRect();
					return { x: r.x, y: r.y };
				}
			);
			return {
				capture,
				actual,
				width: getComputedStyle(element).width,
				height: getComputedStyle(element).height
			};
		};
		(window as any).__scrollCarouselProjection = () => {
			query.scrollTop = 60;
			query.scrollLeft = 7;
		};
	});
</script>

<div data-carousel-spatial-element>
	<div class="summary" bind:this={panel} style:transform>
		<div class="slot">
			<div class="island" data-projection-island>
				<i class="marker tl"></i><i class="marker tr"></i><i class="marker br"></i><i
					class="marker bl"
				></i>
				<div class="query" bind:this={query}>
					<div class="spacer"></div>
					<div class="nested" data-projection-nested>
						<i class="marker tl"></i><i class="marker tr"></i><i class="marker br"></i><i
							class="marker bl"
						></i>Nested content
					</div>
					<div class="spacer"></div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui;
	}
	.summary {
		position: fixed;
		left: 0;
		top: 0;
		width: 400.5px;
		height: 340.25px;
		transform-origin: 0 0;
		transform-style: preserve-3d;
		background: #dde9f5;
	}
	.island {
		position: relative;
		box-sizing: border-box;
		width: 100%;
		height: 340.25px;
		padding: 16px;
		transform-style: preserve-3d;
	}
	.query {
		container: spatial-summary / inline-size;
		position: relative;
		height: 280px;
		overflow: auto;
	}
	.spacer {
		height: 100px;
	}
	.nested {
		position: relative;
		width: 193.25px;
		height: 87.75px;
		box-sizing: border-box;
		margin-left: 24.375px;
		padding: 12px;
		transform: rotateZ(3deg) rotateX(12deg);
		transform-origin: 47.5px 28.125px;
		background: #b9cfe5;
		transform-style: preserve-3d;
	}
	.marker {
		position: absolute;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.tl {
		left: 0;
		top: 0;
	}
	.tr {
		left: 100%;
		top: 0;
	}
	.br {
		left: 100%;
		top: 100%;
	}
	.bl {
		left: 0;
		top: 100%;
	}
</style>
