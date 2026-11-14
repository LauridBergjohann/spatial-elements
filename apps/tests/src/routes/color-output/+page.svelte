<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three/webgpu';
	import { texture, uniform, vec4 } from 'three/tsl';
	import {
		inverseAcesToneMapping,
		STAGE_TONE_MAPPING_EXPOSURE
	} from '@spatial-elements/core/stage/LiquidGlassPanel';
	const colors = ['#135a77', '#91b8ff', '#007b5e', '#d5b975', '#285c89', '#ffffff'];
	let direct: HTMLCanvasElement, captured: HTMLCanvasElement;
	let ready = $state(false);
	onMount(() => {
		const renderers: THREE.WebGPURenderer[] = [];
		let disposed = false;
		void (async () => {
			for (const canvas of [direct, captured]) {
				const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
				renderers.push(renderer);
				renderer.setSize(colors.length * 64, 64);
				renderer.toneMapping = THREE.ACESFilmicToneMapping;
				renderer.toneMappingExposure = STAGE_TONE_MAPPING_EXPOSURE;
				await renderer.init();
				if (disposed) return;
				const tint = uniform(new THREE.Color());
				const material = new THREE.MeshBasicNodeMaterial({ toneMapped: false });
				material.fragmentNode = vec4(inverseAcesToneMapping(tint.rgb), 1);
				const quad = new THREE.QuadMesh(material);
				const target =
					canvas === captured
						? new THREE.RenderTarget(colors.length * 64, 64, { type: THREE.HalfFloatType })
						: undefined;
				renderer.setRenderTarget(target ?? null);
				renderer.autoClear = false;
				for (const [index, color] of colors.entries()) {
					tint.value.set(color);
					if (target) target.viewport.set(index * 64, 0, 64, 64);
					else renderer.setViewport(index * 64, 0, 64, 64);
					quad.render(renderer);
				}
				if (target) {
					renderer.setRenderTarget(null);
					renderer.setViewport(0, 0, colors.length * 64, 64);
					const display = new THREE.NodeMaterial();
					display.toneMapped = false;
					display.fragmentNode = vec4(texture(target.texture).rgb, 1);
					new THREE.QuadMesh(display).render(renderer);
					display.dispose();
					target.dispose();
				}
				material.dispose();
			}
			ready = true;
		})();
		return () => {
			disposed = true;
			for (const renderer of renderers) renderer.dispose();
		};
	});
</script>

<h1>Theme color output</h1>
<div data-ready={ready}>
	<div class="swatches">
		{#each colors as color}<span style:background={color} title={color}></span>{/each}
	</div>
	<canvas bind:this={direct} aria-label="Direct canvas colors"></canvas>
	<canvas bind:this={captured} aria-label="Captured scene colors"></canvas>
</div>

<style>
	.swatches {
		display: flex;
	}
	.swatches span {
		width: 64px;
		height: 64px;
	}
	canvas {
		display: block;
	}
</style>
