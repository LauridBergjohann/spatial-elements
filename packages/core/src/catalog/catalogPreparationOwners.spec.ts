import * as THREE from 'three/webgpu';
import { expect, test, vi } from 'vitest';
import RenderObjects from 'three/src/renderers/common/RenderObjects.js';
import NodeManager from 'three/src/renderers/common/nodes/NodeManager.js';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';

/** Actual installed Three owner/cache policy; GPU submission is deliberately absent. */
function fixture() {
	const scene = new THREE.Scene(), fog = new THREE.Fog(0xffffff, 1200, 2500); scene.fog = fog;
	const camera = new THREE.PerspectiveCamera(), carouselCamera = new THREE.PerspectiveCamera();
	const material = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry();
	const actors = [false, true, true].map((carousel, index) => {
		const root = new THREE.Group(), model = new THREE.Mesh(geometry, material);
		root.add(model); scene.add(root); root.visible = index < 2;
		return { root, model, pose: carousel ? {} : undefined };
	});
	const renderer = {
		backend: { isWebGPUBackend: true }, lighting: { enabled: false }, info: { calls: 0 },
		getOutputRenderTarget: () => null, contextNode: { id: 0, version: 0 }, _currentSourceMaterial: null,
		render: vi.fn()
	};
	const nodes = new NodeManager(renderer, renderer.backend), released = vi.fn();
	const owners = new RenderObjects(renderer, nodes, {}, { delete: vi.fn() }, { deleteForRender: released }, {});
	const context = { id: 1 }, lights = {};
	const seen: { model: THREE.Mesh; camera: THREE.Camera; fog: THREE.Fog | THREE.FogExp2 | null; owner: object }[] = [];
	renderer.render.mockImplementation((input: THREE.Scene, view: THREE.Camera) => {
		renderer.info.calls++;
		input.traverseVisible(object => {
			if (!(object instanceof THREE.Mesh)) return;
			const owner = owners.get(object, object.material, input, view, lights, context, null);
			seen.push({ model: object, camera: view, fog: input.fog, owner });
		});
	});
	const fade = { render: vi.fn((_renderer: unknown, _opacity: number, draw: () => void) => draw()) };
	const layer = Object.assign(Object.create(CatalogSpatialElementLayer.prototype), {
		scene, camera, carouselCamera, actors: new Map(actors.map((actor, i) => [String(i), actor])), geometryFade: fade
	}) as CatalogSpatialElementLayer;
	const production = () => {
		actors[1].root.visible = false; renderer.render(scene, camera);
		actors[0].root.visible = false; actors[1].root.visible = true; scene.fog = null;
		renderer.render(scene, carouselCamera);
		scene.fog = fog; actors[0].root.visible = true;
	};
	return { scene, fog, camera, carouselCamera, actors, renderer, layer, production, seen, released, fade,
		dispose() { material.dispose(); geometry.dispose(); nodes.dispose(); owners.dispose(); } };
}

test('legacy High preparation replaces the Carousel owner through fog, while a camera change alone does not', () => {
	const f = fixture();
	try {
		f.production(); const original = f.seen.at(-1)!.owner;
		f.actors[0].root.visible = false; f.scene.fog = null;
		f.renderer.render(f.scene, f.camera);
		expect(f.seen.at(-1)!.owner).toBe(original); expect(f.released).not.toHaveBeenCalled();
		// Exact old renderForPreparation scene/camera choice, without any scratch context.
		f.scene.fog = f.fog; f.renderer.render(f.scene, f.camera);
		expect(f.seen.at(-1)!.owner).not.toBe(original); expect(f.released).toHaveBeenCalledTimes(1);
		f.scene.fog = null; f.renderer.render(f.scene, f.carouselCamera);
		expect(f.seen.at(-1)!.owner).not.toBe(original); expect(f.released).toHaveBeenCalledTimes(2);
	} finally { f.dispose(); }
});

test('High preparation preserves actual List and Carousel Three owners for the next productive draw', () => {
	const f = fixture();
	try {
		f.production(); const [list, carousel] = f.seen;
		f.layer.renderForPreparation(f.renderer as unknown as THREE.WebGPURenderer);
		expect(f.fade.render).toHaveBeenCalledOnce();
		expect(f.seen.slice(2)).toEqual([
			{ model: f.actors[0].model, camera: f.camera, fog: f.fog, owner: list.owner },
			{ model: f.actors[1].model, camera: f.carouselCamera, fog: null, owner: carousel.owner }
		]);
		f.production(); expect(f.seen.at(-2)!.owner).toBe(list.owner); expect(f.seen.at(-1)!.owner).toBe(carousel.owner);
		expect(f.released).not.toHaveBeenCalled(); expect(f.actors.map(actor => actor.root.visible)).toEqual([true, true, false]);
		expect(f.scene.fog).toBe(f.fog);
	} finally { f.dispose(); }
});

test.each([0, 1])('failed preparation band %s restores the original fog and every actor visibility', band => {
	const f = fixture(); let draw = 0;
	try {
		f.renderer.render.mockImplementation(() => { if (draw++ === band) throw Error('prepare failed'); });
		expect(() => f.layer.renderForPreparation(f.renderer as unknown as THREE.WebGPURenderer)).toThrow('prepare failed');
		expect(f.scene.fog).toBe(f.fog); expect(f.actors.map(actor => actor.root.visible)).toEqual([true, true, false]);
	} finally { f.dispose(); }
});
