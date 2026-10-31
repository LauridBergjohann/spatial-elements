import * as THREE from 'three/webgpu';
import { expect, test } from 'vitest';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import { createStagedDockGeometry } from './stagedDockGeometry.js';
import { createStagedDetailGeometry } from './stagedDetailGeometry.js';
import { resolveDetailLayout } from '../spatial-element/responsiveLayout.js';
import { prepareSpatialElementFrame } from '../stage/spatialElementFrame.js';
import { getMeshBounds } from '../stage/stageSceneUtils.js';
import type { SpatialElementLodPair } from './spatialElementLodPair.js';
import type { SpatialElementScene } from '../spatial-element/spatialElementScene.js';

function fixture() {
	const actor = { key: 'brand:card:one', spatialElementId: 'one', occurrence: 'card:first', rendered: true,
		root: new THREE.Group(), stage: { camera: { azimuth: 30, elevation: 12 } },
		detailFrame: new THREE.Matrix4().makeScale(0.7, 0.7, 0.7).setPosition(0.1, 0.2, 0.3),
		detailBounds: new THREE.Box3(new THREE.Vector3(-2, -1, -1), new THREE.Vector3(2, 1, 1)),
		detailLowBounds: new THREE.Box3(new THREE.Vector3(-1, -0.4, -0.3), new THREE.Vector3(0.8, 0.6, 0.3)) };
	const layer = Object.assign(Object.create(CatalogSpatialElementLayer.prototype), {
		actors: new Map([[actor.key, actor]]), desired: new Set([actor.key])
	}) as CatalogSpatialElementLayer;
	return { layer, actor };
}

test('catalog Dock target uses actual Low bounds, common pivot, explicit minimap settings and renderer convention', () => {
	const { layer, actor } = fixture();
	const layout = { width: 1809, height: 800, scrollbarWidth: 15 }, viewport = { width: 1809, height: 900 };
	const minimap = { inset: 5, modelScale: 1.4, dockedView: { azimuth: -24, scale: 1.2 } };
	const target = layer.getStagedDetailTarget('one', 'card:first', resolveDetailLayout(layout).mediaFit,
		viewport, { kind: 'dock', layout, minimap }, THREE.WebGLCoordinateSystem)!;
	const expected = createStagedDockGeometry({ layout, viewport, lowBounds: actor.detailLowBounds,
		modelMatrix: actor.detailFrame, center: actor.detailBounds.getCenter(new THREE.Vector3()),
		camera: actor.stage.camera, minimap, coordinateSystem: THREE.WebGLCoordinateSystem })!;
	expect(target.model.matrix.equals(expected.model.matrix)).toBe(true);
	expect(target.camera.projectionMatrix.equals(expected.camera.projectionMatrix)).toBe(true);
	expect(target.camera.coordinateSystem).toBe(THREE.WebGLCoordinateSystem);
	expect('dock' in target.framing).toBe(true);
});

test('explicit Dock intent in real 3XL keeps the fixed main stage; short 3XL retains a Mini-Dock', () => {
	const { layer, actor } = fixture();
	const layout = { width: 2456, height: 900 }, fit = resolveDetailLayout(layout).mediaFit;
	const target = layer.getStagedDetailTarget('one', 'card:first', fit, layout, { kind: 'dock', layout })!;
	const expected = createStagedDetailGeometry(actor.detailBounds, actor.detailFrame, actor.stage.camera, layout, fit);
	expect(target.model.matrix.equals(expected.model.matrix)).toBe(true);
	expect(target.camera.projectionMatrix.equals(expected.camera.projectionMatrix)).toBe(true);
	expect('dock' in target.framing).toBe(false);
	const short = { width: 2456, height: 480 };
	const mini = layer.getStagedDetailTarget('one', 'card:first', resolveDetailLayout(short).mediaFit,
		short, { kind: 'dock', layout: short })!;
	expect('dock' in mini.framing).toBe(true);
});

test('an unclaimed or unrendered occurrence never supplies a Dock endpoint', () => {
	const { layer, actor } = fixture(), layout = { width: 1440, height: 900 }, fit = resolveDetailLayout(layout).mediaFit;
	expect(layer.getStagedDetailTarget('one', 'card:other', fit, layout, { kind: 'dock', layout })).toBeUndefined();
	actor.rendered = false;
	expect(layer.getStagedDetailTarget('one', 'card:first', fit, layout, { kind: 'dock', layout })).toBeUndefined();
});

test('actor initialization stores actual excluded-mesh-aware Low bounds separately from declared shared LOD bounds', () => {
	const source = new THREE.Group();
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 0.4), new THREE.MeshBasicMaterial());
	mesh.position.set(0.4, -0.1, 0.2); source.add(mesh);
	const excluded = mesh.clone(); excluded.name = 'excluded'; excluded.position.x = 100; source.add(excluded);
	const pair: SpatialElementLodPair = { sourceUrl: '/asset.glb', status: 'verified-canonical-frame', revision: 'one',
		low: { url: '/low.glb', format: 'glb', revision: 'one' }, high: { url: '/high.glb', format: 'glb', revision: 'one' },
		assetToFrame: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
		bounds: { min: [-3, -1.5, -1], max: [3, 1.5, 1] } };
	const stage: SpatialElementScene = { glb: pair.sourceUrl, lodPair: pair,
		model: { rotation: { x: 0.2, y: -0.4 }, excludeMeshes: ['excluded'] } };
	const expectedModel = new THREE.Group();
	const expectedBounds = prepareSpatialElementFrame(expectedModel, source.clone(true), pair, stage.model!);
	const expectedLow = getMeshBounds(expectedModel, object => object.name !== 'excluded');
	const create = (CatalogSpatialElementLayer.prototype as unknown as {
		createActor(key: string, brand: string, id: string, stage: SpatialElementScene, instance: { scene: THREE.Group }): {
			detailBounds: THREE.Box3; detailLowBounds: THREE.Box3; detailFrame: THREE.Matrix4; model: THREE.Object3D
		}
	}).createActor;
	const actor = create.call(Object.create(CatalogSpatialElementLayer.prototype), 'brand:one', 'brand', 'one', stage, { scene: source });
	expect(actor.detailBounds.equals(expectedBounds)).toBe(true);
	expect(actor.detailLowBounds.equals(expectedLow)).toBe(true);
	expect(actor.detailLowBounds.equals(actor.detailBounds)).toBe(false);
	expect(actor.detailFrame.equals(expectedModel.matrix)).toBe(true);
	const saved = actor.detailLowBounds.clone();
	actor.model.parent!.position.set(100, 200, 300); actor.model.parent!.updateMatrixWorld(true);
	expect(actor.detailLowBounds.equals(saved)).toBe(true);
	mesh.geometry.dispose(); mesh.material.dispose();
});
