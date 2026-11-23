import { expect, it } from 'vitest';
import * as THREE from 'three';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import { getSpatialListItems } from '../spatial-element/spatialElement.js';
import type { SpatialElementScene } from '../spatial-element/spatialElementScene.js';

it('keeps grid and carousel poses independent of the detail model frame and camera', () => {
	const source = new THREE.Group();
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1), new THREE.MeshBasicMaterial());
	source.add(mesh);
	const stage: SpatialElementScene = { glb: '/model.glb', camera: { azimuth: 35, elevation: 60 },
		gridView: { azimuth: 20, elevation: 15, scale: 0.8 },
		carouselView: { azimuth: 0, elevation: 0, scale: 1.1 } };
	const create = (CatalogSpatialElementLayer.prototype as unknown as {
		createActor(key: string, brand: string, id: string, stage: SpatialElementScene,
			instance: { scene: THREE.Group }, kind: 'grid' | 'carousel'): {
			viewOrientation: THREE.Quaternion; presentationScale: number; detailFrame: THREE.Matrix4
		}
	}).createActor;
	const actor = (kind: 'grid' | 'carousel', settings = stage) => create.call(
		Object.create(CatalogSpatialElementLayer.prototype), kind, 'brand', 'model', settings, { scene: source.clone(true) }, kind);
	const grid = actor('grid'), carousel = actor('carousel');
	expect(carousel.viewOrientation.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
	expect(grid.viewOrientation.angleTo(carousel.viewOrientation)).toBeGreaterThan(0.1);
	expect(grid.presentationScale).toBe(0.8);
	expect(carousel.presentationScale).toBe(1.1);
	expect(grid.detailFrame.equals(carousel.detailFrame)).toBe(true);
	const legacy = actor('carousel', { glb: stage.glb, camera: stage.camera });
	expect(legacy.viewOrientation.angleTo(carousel.viewOrientation)).toBeGreaterThan(0.5);
	expect(legacy.presentationScale).toBe(1);
	const [item] = getSpatialListItems([{ id: 'model', title: 'Model', ...stage }], '/models');
	expect(item.gridView).toEqual(stage.gridView);
	expect(item.carouselView).toEqual(stage.carouselView);
	expect(stage.camera).toEqual({ azimuth: 35, elevation: 60 });
	mesh.geometry.dispose(); mesh.material.dispose();
});
