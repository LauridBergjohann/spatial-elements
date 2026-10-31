import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { MINIMAP_MODEL_RENDER_ORDER } from '../stageConstants.js';
import {
	addMinimapBlurLights,
	disposeMinimapModelMaterials,
	prepareMinimapModel
} from './MinimapModel.js';

describe('minimap model preparation', () => {
	it('isolates material state from the main spatialElement model', () => {
		const first = new THREE.MeshBasicMaterial({
			opacity: 0.65,
			transparent: true,
			depthWrite: false
		});
		const second = new THREE.MeshBasicMaterial({ opacity: 0.8 });
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [first, second]);
		const model = new THREE.Group();
		model.add(mesh);

		const states = prepareMinimapModel(model);
		const clones = mesh.material as THREE.Material[];

		expect(states).toHaveLength(2);
		expect(clones[0]).not.toBe(first);
		expect(clones[1]).not.toBe(second);
		expect(states[0]).toMatchObject({
			material: clones[0],
			opacity: 0.65,
			transparent: true,
			depthWrite: false
		});
		expect(mesh.frustumCulled).toBe(false);
		expect(mesh.renderOrder).toBe(MINIMAP_MODEL_RENDER_ORDER);

		clones[0].opacity = 0.1;
		expect(first.opacity).toBe(0.65);
	});

	it('disposes minimap material clones without disposing source materials', () => {
		const source = new THREE.MeshBasicMaterial();
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
		const model = new THREE.Group();
		model.add(mesh);
		prepareMinimapModel(model);
		const clone = mesh.material as THREE.Material;
		const cloneDispose = vi.spyOn(clone, 'dispose');
		const sourceDispose = vi.spyOn(source, 'dispose');

		disposeMinimapModelMaterials(model);

		expect(cloneDispose).toHaveBeenCalledOnce();
		expect(sourceDispose).not.toHaveBeenCalled();
	});

	it('retains distinct fade and authored pipeline owners across repeated endpoints', () => {
		const geometry = new THREE.BoxGeometry();
		const source = [new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial({
			transparent: true, opacity: 0.7, depthWrite: false
		})];
		const mesh = new THREE.Mesh(geometry, source);
		const model = new THREE.Group().add(mesh);
		const states = prepareMinimapModel(model);
		const rest = mesh.material;
		const restVersions = rest.map(material => material.version);
		states.forEach(state => state.setOpacity(0.5));
		const fade = mesh.material;
		const fadeVersions = fade.map(material => material.version);
		expect(fade).not.toBe(rest);
		expect(fade.map(material => material.opacity)).toEqual([0.5, 0.35]);
		expect(fade.every(material => material.transparent && !material.depthWrite)).toBe(true);
		for (const opacity of [1, 0, 0.2, 1, 0.75, 1]) {
			states.forEach(state => state.setOpacity(opacity));
			expect(mesh.material).toBe(opacity === 1 ? rest : fade);
			expect(states.map(state => state.material)).toEqual(mesh.material);
		}
		expect(rest.map(material => material.version)).toEqual(restVersions);
		expect(fade.map(material => material.version)).toEqual(fadeVersions);
		expect(rest[0]).toMatchObject({ transparent: false, opacity: 1, depthWrite: true });
		expect(rest[1]).toMatchObject({ transparent: true, opacity: 0.7, depthWrite: false });
		expect(mesh.geometry).toBe(geometry);
		const ownedDisposals = [...rest, ...fade].map(material => vi.spyOn(material, 'dispose'));
		const sourceDisposals = source.map(material => vi.spyOn(material, 'dispose'));
		disposeMinimapModelMaterials(model);
		expect(ownedDisposals.every(dispose => dispose.mock.calls.length === 1)).toBe(true);
		expect(sourceDisposals.every(dispose => dispose.mock.calls.length === 0)).toBe(true);
		geometry.dispose();
		source.forEach(material => material.dispose());
	});

	it('adds stable neutral lighting to the isolated capture scene', () => {
		const scene = new THREE.Scene();

		addMinimapBlurLights(scene);

		const directional = scene.children.find(
			(child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight
		);
		const ambient = scene.children.find(
			(child): child is THREE.AmbientLight => child instanceof THREE.AmbientLight
		);
		expect(directional?.intensity).toBeCloseTo(2.2);
		expect(directional?.position.toArray()).toEqual([-2, 3, 8]);
		expect(ambient?.intensity).toBeCloseTo(0.7);
	});
});
