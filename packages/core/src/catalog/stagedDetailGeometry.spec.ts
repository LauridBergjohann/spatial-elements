import * as THREE from 'three/webgpu';
import { expect, test } from 'vitest';
import { createStagedDetailGeometry } from './stagedDetailGeometry.js';
import { resolveDetailLayout } from '../spatial-element/responsiveLayout.js';

test.each([390, 600, 840, 1200, 1600, 1809, 2300, 3440])('pre-route camera frames the shared detail fit at %ipx without DOM', width => {
	const viewport = { width, height: 900 };
	const fit = resolveDetailLayout(viewport).mediaFit;
	const bounds = new THREE.Box3(new THREE.Vector3(-1.5, -0.9, -0.7), new THREE.Vector3(1.5, 0.9, 0.7));
	const { camera, model, framing } = createStagedDetailGeometry(bounds, new THREE.Matrix4(), {}, viewport, fit);
	const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
		[bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z).project(camera))));
	for (const point of corners) {
		const x = (point.x + 1) * width / 2, y = (1 - point.y) * viewport.height / 2;
		expect(x).toBeGreaterThanOrEqual(fit.x - 0.001); expect(x).toBeLessThanOrEqual(fit.x + fit.width + 0.001);
		expect(y).toBeGreaterThanOrEqual(fit.y - 0.001); expect(y).toBeLessThanOrEqual(fit.y + fit.height + 0.001);
	}
	const center = framing.center.clone().project(camera);
	expect((center.x + 1) * width / 2).toBeCloseTo(fit.x + fit.width / 2, 5);
	expect((1 - center.y) * viewport.height / 2).toBeCloseTo(fit.y + fit.height / 2, 5);
	expect(model.children).toHaveLength(0);
	expect(camera.near).toBeGreaterThan(0);
});

test('authored pose, padding and fit scale remain independent of source interaction pose', () => {
	const bounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
	const viewport = { width: 1440, height: 900 }, fit = resolveDetailLayout(viewport).mediaFit;
	const matrix = new THREE.Matrix4().makeScale(0.5, 0.5, 0.5).setPosition(0.1, 0.2, 0.3);
	const first = createStagedDetailGeometry(bounds, matrix, { azimuth: 20, elevation: 10, fitPadding: 30 }, viewport, fit);
	const second = createStagedDetailGeometry(bounds, matrix, { azimuth: 20, elevation: 10, fitPadding: 30, fitScale: 2 }, viewport, fit);
	expect(first.model.matrix.equals(matrix)).toBe(true);
	expect(first.model.matrix).not.toBe(matrix);
	expect(first.framing.distance / second.framing.distance).toBeCloseTo(2);
	expect(first.camera.position.distanceTo(first.framing.center)).toBeCloseTo(first.framing.distance);
});
