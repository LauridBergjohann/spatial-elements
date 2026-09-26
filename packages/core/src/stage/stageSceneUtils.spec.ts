import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
	applyModelMaterialOverrides,
	centerAndScale,
	disposeMaterial,
	disposeMaterialOnly,
	disposeObject,
	getMeshBounds,
	getMeshBoundsPoints,
	getMeshMaterials,
	isMesh
} from './stageSceneUtils.js';

describe('stage scene utilities', () => {
	it('centers a model and normalizes its largest dimension to three units', () => {
		const geometry = new THREE.BoxGeometry(2, 4, 6);
		geometry.translate(10, -3, 5);
		const model = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());

		centerAndScale(model);

		const bounds = new THREE.Box3().setFromObject(model);
		const center = bounds.getCenter(new THREE.Vector3());
		const size = bounds.getSize(new THREE.Vector3());
		expect(center.length()).toBeCloseTo(0);
		expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(3);
	});

	it('replaces configured meshes with physical materials and reports detached sources', () => {
		const sourceMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
		const glass = new THREE.Mesh(new THREE.SphereGeometry(), sourceMaterial);
		glass.name = 'glass';

		const detached = applyModelMaterialOverrides(glass, {
			glass: {
				type: 'physical',
				color: '#020205',
				opacity: 0.8,
				transparent: true,
				metalness: 0,
				roughness: 0,
				iridescence: 0.3,
				clearcoat: 1,
				blending: 'additive'
			}
		});
		const material = glass.material as THREE.MeshPhysicalMaterial;

		expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
		expect(material.opacity).toBeCloseTo(0.8);
		expect(material.transparent).toBe(true);
		expect(material.iridescence).toBeCloseTo(0.3);
		expect(material.clearcoat).toBeCloseTo(1);
		expect(material.blending).toBe(THREE.AdditiveBlending);
		expect(detached).toEqual(new Set([sourceMaterial]));
	});

	it('fits selected spatialElement meshes without hiding or detaching excluded decoration', () => {
		const model = new THREE.Group();
		const spatialElement = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshBasicMaterial());
		const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 30), new THREE.MeshBasicMaterial());
		spatialElement.name = 'spatialElement';
		floor.name = 'floor';
		floor.position.y = -4;
		model.add(spatialElement, floor);

		const isSpatialElement = (mesh: THREE.Mesh) => mesh.name !== 'floor';
		centerAndScale(model, isSpatialElement);

		const spatialElementBounds = getMeshBounds(model, isSpatialElement);
		const spatialElementSize = spatialElementBounds.getSize(new THREE.Vector3());
		const spatialElementCenter = spatialElementBounds.getCenter(new THREE.Vector3());
		const completeSize = getMeshBounds(model).getSize(new THREE.Vector3());

		expect(spatialElementCenter.length()).toBeCloseTo(0);
		expect(Math.max(spatialElementSize.x, spatialElementSize.y, spatialElementSize.z)).toBeCloseTo(3);
		expect(Math.max(completeSize.x, completeSize.y, completeSize.z)).toBeGreaterThan(3);
		expect(floor.visible).toBe(true);
		expect(floor.parent).toBe(model);
	});

	it('keeps individual mesh bounds separate instead of filling a global empty corner', () => {
		const model = new THREE.Group();
		const upperLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
		const lowerRight = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
		upperLeft.position.set(-4, 4, 0);
		lowerRight.position.set(4, -4, 0);
		model.add(upperLeft, lowerRight);

		const points = getMeshBoundsPoints(model);

		expect(points).toHaveLength(16);
		expect(points.some((point) => point.x > 0 && point.y > 0)).toBe(false);
		expect(points.some((point) => point.x < 0 && point.y < 0)).toBe(false);
	});

	it('normalizes single and array mesh materials without mutating them', () => {
		const first = new THREE.MeshBasicMaterial();
		const second = new THREE.MeshBasicMaterial();
		const single = new THREE.Mesh(new THREE.BoxGeometry(), first);
		const multiple = new THREE.Mesh(new THREE.BoxGeometry(), [first, second]);

		expect(isMesh(single)).toBe(true);
		expect(isMesh(new THREE.Group())).toBe(false);
		expect(getMeshMaterials(single)).toEqual([first]);
		expect(getMeshMaterials(multiple)).toEqual([first, second]);
		expect(multiple.material).toEqual([first, second]);
	});

	it('disposes object geometry, material, and material-owned textures', () => {
		const texture = new THREE.Texture();
		const material = new THREE.MeshBasicMaterial({ map: texture });
		const geometry = new THREE.BoxGeometry();
		const root = new THREE.Group();
		root.add(new THREE.Mesh(geometry, material));
		const textureDispose = vi.spyOn(texture, 'dispose');
		const materialDispose = vi.spyOn(material, 'dispose');
		const geometryDispose = vi.spyOn(geometry, 'dispose');

		disposeObject(root);

		expect(textureDispose).toHaveBeenCalledOnce();
		expect(materialDispose).toHaveBeenCalledOnce();
		expect(geometryDispose).toHaveBeenCalledOnce();
	});

	it('can dispose cloned materials while preserving shared textures', () => {
		const texture = new THREE.Texture();
		const first = new THREE.MeshBasicMaterial({ map: texture });
		const second = new THREE.MeshBasicMaterial({ map: texture });
		const textureDispose = vi.spyOn(texture, 'dispose');
		const firstDispose = vi.spyOn(first, 'dispose');
		const secondDispose = vi.spyOn(second, 'dispose');

		disposeMaterialOnly([first, second]);

		expect(firstDispose).toHaveBeenCalledOnce();
		expect(secondDispose).toHaveBeenCalledOnce();
		expect(textureDispose).not.toHaveBeenCalled();
	});

	it('accepts absent and array materials when fully disposing resources', () => {
		const first = new THREE.MeshBasicMaterial();
		const second = new THREE.MeshBasicMaterial();
		const firstDispose = vi.spyOn(first, 'dispose');
		const secondDispose = vi.spyOn(second, 'dispose');

		expect(() => disposeMaterial()).not.toThrow();
		disposeMaterial([first, second]);

		expect(firstDispose).toHaveBeenCalledOnce();
		expect(secondDispose).toHaveBeenCalledOnce();
	});
});
