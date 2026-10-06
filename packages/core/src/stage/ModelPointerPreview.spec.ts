import * as THREE from 'three/webgpu';
import { expect, test } from 'vitest';
import { ModelPointerPreview } from './ModelPointerPreview.js';

function fixture() {
	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
	camera.position.z = 5;
	camera.lookAt(0, 0, 0);
	camera.updateMatrixWorld(true);
	const preview = new ModelPointerPreview();
	preview.capture(camera, new THREE.Vector3());
	const bounds = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
	preview.pointAt(760, 500, camera, bounds, 1000, 1000);
	return { camera, preview };
}

test('subtle orbit preserves distance, converges at varied frame rates and becomes idle', () => {
	for (const rate of [30, 60, 120]) {
		const { camera, preview } = fixture();
		const before = camera.quaternion.clone();
		for (let i = 0; i < rate * 3; i++) preview.advance(camera, 1 / rate);
		expect(before.angleTo(camera.quaternion)).toBeGreaterThan(0.01);
		expect(before.angleTo(camera.quaternion)).toBeLessThanOrEqual(THREE.MathUtils.degToRad(2.51));
		expect(camera.position.length()).toBeCloseTo(5, 8);
		expect(preview.advance(camera, 1 / rate)).toBe(false);
		preview.clear();
		for (let i = 0; i < rate * 3; i++) preview.advance(camera, 1 / rate);
		expect(camera.position.x).toBeCloseTo(0, 8);
		expect(preview.advance(camera, 1 / rate)).toBe(false);
	}
});

test('manual takeover retains the visible pose and reduced motion leaves the initial pose still', () => {
	const { camera, preview } = fixture();
	preview.advance(camera, 0.1);
	const position = camera.position.clone();
	preview.forget();
	preview.clear();
	expect(preview.advance(camera, 1)).toBe(false);
	expect(camera.position.equals(position)).toBe(true);
	const reduced = fixture();
	expect(reduced.preview.advance(reduced.camera, 0.1, true)).toBe(false);
	expect(reduced.camera.position.toArray()).toEqual([0, 0, 5]);
});
