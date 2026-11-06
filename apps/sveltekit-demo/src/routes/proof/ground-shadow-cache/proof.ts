import * as THREE from 'three/webgpu';
import { CarouselGround } from '@spatial-elements/core/catalog/CarouselGround';

/** Isolated correctness proof; timing under readback is deliberately not a performance metric. */
export async function runGroundCacheProof(container: HTMLElement) {
	const renderer = new THREE.WebGPURenderer({ antialias: true });
	const ground = new CarouselGround();
	const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 4000);
	const models = [-22, 25].map((x, index) => {
		const geometry = new THREE.BoxGeometry(145, 155 + index * 35, 100);
		const material = new THREE.MeshBasicMaterial();
		const model = new THREE.Group(); model.add(new THREE.Mesh(geometry, material));
		model.position.set(x, 80, index * 12); model.updateMatrixWorld(true);
		return { key: {}, geometry, material, model, opacity: index ? 0.23 : 0.14 };
	});
	const background = new THREE.Color(0.61, 0.74, 0.87);
	const targets: THREE.RenderTarget[] = [];
	const rows: { format: string; opacity: number; maxError: number; cacheDraws: number; liveDraws: number }[] = [];
	const mutations: { kind: string; maxError: number; cacheDraws: number; liveDraws: number }[] = [];
	const scissorRows: { format: string; maxError: number; restored: boolean }[] = [];
	let overlapPixels = 0, incorrectMergedFadeError = 0;
	const update = () => {
		ground.beginFrame();
		for (const entry of models) ground.shadow(entry.key, entry.model, new THREE.Matrix4(), entry.opacity);
		ground.endFrame();
	};
	const difference = (a: number[], b: number[]) => a.reduce((max, value, index) => Math.max(max, Math.abs(value - b[index])), 0);
	try {
		await renderer.init();
		renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
		renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping;
		container.append(renderer.domElement);
		camera.coordinateSystem = renderer.coordinateSystem;
		camera.position.set(0, 380, 1000); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
		update();
		for (const type of [THREE.HalfFloatType, THREE.UnsignedByteType]) {
			const format = type === THREE.HalfFloatType ? 'rgba16float' : 'rgba8unorm';
			const target = new THREE.RenderTarget(360, 250, { type, depthBuffer: false, samples: 0 }); targets.push(target);
			const read = async (opacity: number, cached: boolean) => {
				renderer.setRenderTarget(target); renderer.setClearColor(background, 1); renderer.clear();
				ground.draw(renderer, camera, opacity, cached, format);
				const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
				return Array.from(pixels, value => type === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat(value) : value / 255);
			};
			renderer.setRenderTarget(target);
			ground.prepareCaches(renderer, camera, format);
			let combinedOne: number[] = [], combinedHalf: number[] = [], empty: number[] = [];
			for (const opacity of [1, 0.75, 0.5, 0.2, 0.01, 0]) {
				const live = await read(opacity, false), before = ground.getStats();
				const cached = await read(opacity, true), after = ground.getStats();
				rows.push({ format, opacity, maxError: difference(live, cached),
					cacheDraws: after.cacheDraws - before.cacheDraws, liveDraws: after.liveDraws - before.liveDraws });
				if (opacity === 1) combinedOne = live;
				if (opacity === 0.5) combinedHalf = live;
				if (opacity === 0) empty = live;
			}
			renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true);
			const clippedLive = await read(0.5, false), clippedCached = await read(0.5, true);
			scissorRows.push({ format, maxError: difference(clippedLive, clippedCached), restored: renderer.getScissorTest() });
			renderer.setScissorTest(false);
			if (type === THREE.HalfFloatType) {
				incorrectMergedFadeError = difference(combinedHalf, empty.map((value, index) => (value + combinedOne[index]) / 2));
				models[1].opacity = 0; update(); const first = await read(1, false);
				models[0].opacity = 0; models[1].opacity = 0.23; update(); const second = await read(1, false);
				for (let index = 0; index < empty.length; index += 4)
					if (empty[index] - first[index] > 0.01 && empty[index] - second[index] > 0.01) overlapPixels++;
				models[0].opacity = 0.14; update();
			}
			if (type === THREE.UnsignedByteType) {
				for (const kind of ['pose', 'camera'] as const) {
					if (kind === 'pose') { models[0].model.position.x += 40; models[0].model.updateMatrixWorld(true); update(); }
					else { camera.position.x += 30; camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true); }
					const live = await read(0.5, false), before = ground.getStats(), cached = await read(0.5, true), after = ground.getStats();
					mutations.push({ kind, maxError: difference(live, cached),
						cacheDraws: after.cacheDraws - before.cacheDraws, liveDraws: after.liveDraws - before.liveDraws });
				}
			}
		}
		return { rows, mutations, scissorRows, overlapPixels, incorrectMergedFadeError, stats: ground.getStats() };
	} finally {
		ground.dispose(); targets.forEach(target => target.dispose());
		models.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose(); });
		renderer.dispose(); renderer.domElement.remove();
	}
}
