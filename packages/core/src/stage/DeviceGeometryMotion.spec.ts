import { expect, it } from 'vitest';
import { Euler, Object3D, Quaternion, Vector3 } from 'three/webgpu';
import { DeviceGeometryMotion } from './DeviceGeometryMotion.js';

it('counter-rotates in camera space without accumulating or losing the authored pose', () => {
	const motion = new DeviceGeometryMotion();
	const camera = new Object3D();
	camera.rotation.set(0.3, 0.5, -0.2);
	const model = new Object3D();
	model.rotation.set(0.1, -0.2, 0.3);
	model.position.set(2, 1, 0);
	const base = model.quaternion.clone();
	const position = model.position.clone();
	const center = new Vector3(1, 1, 0);
	motion.update(12, 8, 4, 1);
	const expected = new Quaternion().setFromEuler(new Euler(-8 * Math.PI / 180, -12 * Math.PI / 180, -4 * Math.PI / 180, 'ZXY'));
	expect(motion.rotation.angleTo(expected)).toBeLessThan(1e-7);
	motion.apply(model, camera, center);
	const first = model.quaternion.clone();
	const world = camera.quaternion.clone().multiply(expected).multiply(camera.quaternion.clone().invert());
	expect(first.angleTo(world.multiply(base))).toBeLessThan(1e-7);
	expect(model.position.distanceTo(center)).toBeCloseTo(1);
	motion.apply(model, camera, center);
	expect(model.quaternion.angleTo(first)).toBeLessThan(1e-7);
	motion.update(0, 0, 0, 1);
	motion.apply(model, camera, center);
	expect(model.quaternion.angleTo(base)).toBeLessThan(1e-7);
	expect(model.position.distanceTo(position)).toBeLessThan(1e-7);
});
