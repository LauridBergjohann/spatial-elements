import { expect, test } from 'vitest';
import { Group, PerspectiveCamera, Scene, Texture } from 'three/webgpu';
import { HeldSceneCapture } from './HeldSceneCapture.js';

test('held pixels invalidate for camera, sensor pose, asset, environment, dimensions and appearance changes', () => {
	const scene = new Scene(), camera = new PerspectiveCamera(), model = new Group();
	scene.add(model);
	scene.updateMatrixWorld(true);
	const snapshot = new HeldSceneCapture();
	const capture = () => snapshot.capture(scene, camera, 3, 700, 900, 1);
	const current = () => snapshot.matches(scene, camera, 3, 700, 900, 1);
	capture();
	expect(current()).toBe(true);
	for (const mutate of [
		() => { camera.position.x = 2; camera.updateMatrixWorld(true); },
		() => { camera.fov = 35; camera.updateProjectionMatrix(); },
		() => { model.rotation.y = 0.1; scene.updateMatrixWorld(true); },
		() => { scene.environment = new Texture(); },
		() => { scene.remove(model); scene.add(new Group()); },
		() => { scene.add(new Group()); },
		() => { scene.remove(scene.children[0]); }
	]) {
		mutate();
		expect(current()).toBe(false);
		capture();
		expect(current()).toBe(true);
	}
	expect(snapshot.matches(scene, camera, 4, 700, 900, 1)).toBe(false);
	expect(snapshot.matches(scene, camera, 3, 701, 900, 1)).toBe(false);
	expect(snapshot.matches(scene, camera, 3, 700, 901, 1)).toBe(false);
	expect(snapshot.matches(scene, camera, 3, 700, 900, 0.5)).toBe(false);
	scene.environment?.dispose();
});
