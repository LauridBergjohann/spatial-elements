import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { recreateOrbitControlsForExternalNavigation } from './OrbitControlsInterop.js';

describe('OrbitControls SpaceMouse interoperability', () => {
	it('clears damped mouse deltas before an external camera pose is applied', () => {
		const canvas = createCanvasStub();
		const staleCamera = createCamera();
		const staleControls = createDampedControls(staleCamera, canvas);
		staleControls.rotateLeft(Math.PI / 2);

		const externalPosition = new THREE.Vector3(8, 2, 1);
		staleCamera.position.copy(externalPosition);
		staleCamera.lookAt(staleControls.target);
		staleControls.update();
		expect(staleCamera.position.distanceTo(externalPosition)).toBeGreaterThan(0.01);

		const synchronizedCamera = createCamera();
		let synchronizedControls = createDampedControls(synchronizedCamera, canvas);
		synchronizedControls.minDistance = 2;
		synchronizedControls.maxDistance = 20;
		synchronizedControls.rotateLeft(Math.PI / 2);
		synchronizedControls = recreateOrbitControlsForExternalNavigation(synchronizedControls, () =>
			createDampedControls(synchronizedCamera, canvas)
		);

		synchronizedCamera.position.copy(externalPosition);
		synchronizedCamera.lookAt(synchronizedControls.target);
		synchronizedControls.update();

		expect(synchronizedCamera.position.distanceTo(externalPosition)).toBeLessThan(0.000001);
		expect(synchronizedControls.minDistance).toBe(2);
		expect(synchronizedControls.maxDistance).toBe(20);
	});
});

function createCamera() {
	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
	camera.position.set(0, 0, 10);
	camera.lookAt(0, 0, 0);
	return camera;
}

function createDampedControls(camera: THREE.PerspectiveCamera, canvas: HTMLElement) {
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.06;
	controls.target.set(0, 0, 0);
	controls.update();
	return controls;
}

function createCanvasStub() {
	const documentStub = {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	};
	return {
		style: {},
		ownerDocument: documentStub,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		getRootNode: () => documentStub
	} as unknown as HTMLElement;
}
