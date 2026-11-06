import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { CarouselDeviceCamera } from './CarouselDeviceCamera.js';

it('orbits off-centre selected geometry without moving its projection, while background gains parallax', () => {
	const camera = new PerspectiveCamera(45, 1, 1, 6000);
	camera.position.z = 2500;
	camera.updateMatrixWorld();
	const pivot = new Vector3(-350, 180, -100);
	const background = new Vector3(500, 80, -800);
	const before = pivot.clone().project(camera);
	const rearBefore = background.clone().project(camera);
	const motion = new CarouselDeviceCamera();
	motion.update(camera, 12, 8, 4, 1);
	motion.orbit(camera, pivot);
	expect(pivot.clone().project(camera).distanceTo(before)).toBeLessThan(1e-10);
	expect(background.clone().project(camera).distanceTo(rearBefore)).toBeGreaterThan(0.005);
	expect(camera.position.distanceTo(pivot)).toBeCloseTo(new Vector3(0, 0, 2500).distanceTo(pivot), 8);
	const position = camera.position.clone();
	motion.orbit(camera, pivot);
	expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
	motion.update(camera, 0, 0, 0, 1, true);
	motion.orbit(camera, pivot);
	expect(camera.position.toArray()).toEqual([0, 0, 2500]);
});
it('bounds all axes, settles without accumulation and resets for reduced motion', () => {
	const camera = new PerspectiveCamera();
	const motion = new CarouselDeviceCamera();
	motion.update(camera, 1000, -1000, 1000, 1);
	expect(motion.angles.toArray()).toEqual([-2.5, 4, 1.5]);
	const pose = camera.quaternion.clone();
	expect(motion.update(camera, 1000, -1000, 1000, 1)).toBe(false);
	expect(camera.quaternion.angleTo(pose)).toBeLessThan(1e-7);
	motion.update(camera, 12, 8, 4, 0.016, true);
	expect(motion.angles.length()).toBe(0);
	expect(camera.quaternion.w).toBe(1);
});

it('keeps background sensor response at a quarter of the card angles', () => {
	const camera = new PerspectiveCamera();
	const motion = new CarouselDeviceCamera();
	motion.update(camera, 7, 4, 2, 1);
	expect(motion.angles.toArray()).toEqual([1, 1.75, 0.5]);
});
it('smooths changing selection pivots and settles exactly on the new centre', () => {
	const camera = new PerspectiveCamera();
	const motion = new CarouselDeviceCamera();
	motion.update(camera, 12, 0, 0, 1);
	motion.orbit(camera, new Vector3());
	const before = camera.position.clone();
	const next = new Vector3(500, 0, -400);
	expect(motion.orbit(camera, next, 0.016, true)).toBe(true);
	const firstStep = camera.position.distanceTo(before);
	expect(firstStep).toBeGreaterThan(0);
	expect(motion.orbit(camera, next, 2)).toBe(false);
	expect(firstStep).toBeLessThan(camera.position.distanceTo(before) / 4);
});

it('reports the current pivot state without advancing or exposing mutable camera state', () => {
	const camera = new PerspectiveCamera();
	const motion = new CarouselDeviceCamera();
	motion.update(camera, 12, 0, 0, 1);
	motion.orbit(camera, new Vector3());
	motion.orbit(camera, new Vector3(500, 0, -400), 0.016, true);
	const snapshot = motion.getRenderActivity();
	expect(snapshot).toMatchObject({ pivotReady: true, pivotSettling: true, neutral: false });
	const position = camera.position.clone();
	expect(motion.getRenderActivity()).toEqual(snapshot);
	expect(camera.position).toEqual(position);
	snapshot.pivot[0] = 999;
	snapshot.angles[0] = 999;
	expect(motion.getRenderActivity().pivot[0]).not.toBe(999);
	expect(motion.getRenderActivity().angles[0]).not.toBe(999);
});

it('snaps a neutral selection pivot without moving any projection and uses it for subsequent sensor input', () => {
	const camera = new PerspectiveCamera(45, 1, 1, 6000);
	const motion = new CarouselDeviceCamera();
	motion.update(camera, 0, 0, 0, 1);
	motion.orbit(camera, new Vector3());
	const selected = new Vector3(500, 180, -400);
	const background = new Vector3(-600, 80, -800);
	const before = selected.clone().project(camera), rearBefore = background.clone().project(camera);
	expect(motion.orbit(camera, selected, 0.016, true)).toBe(false);
	expect(camera.position.toArray()).toEqual([0, 0, 2500]);
	expect(selected.clone().project(camera).distanceTo(before)).toBeLessThan(1e-12);
	expect(background.clone().project(camera).distanceTo(rearBefore)).toBeLessThan(1e-12);
	expect(motion.getRenderActivity()).toMatchObject({ pivotSettling: false, pivot: selected.toArray() });
	motion.update(camera, 12, 8, 4, 1);
	expect(motion.orbit(camera, selected, 0.016)).toBe(false);
	expect(selected.clone().project(camera).distanceTo(before)).toBeLessThan(1e-12);
	expect(background.clone().project(camera).distanceTo(rearBefore)).toBeGreaterThan(0.005);
});

it('tests the actual camera quaternion rather than the stored sensor angles', () => {
	const camera = new PerspectiveCamera();
	const motion = new CarouselDeviceCamera();
	motion.orbit(camera, new Vector3());
	// Even a small actual rotation must keep the existing smooth-selection path.
	camera.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.00001);
	expect(motion.orbit(camera, new Vector3(500, 0, 0), 0.016, true)).toBe(true);
	motion.update(camera, 12, 0, 0, 1);
	camera.quaternion.set(0, 0, 0, -1); // Equivalent identity despite nonzero stored sensor angles.
	const target = new Vector3(100, 200, -300);
	expect(motion.orbit(camera, target, 0.016, true)).toBe(false);
	expect(motion.getRenderActivity().pivot).toEqual(target.toArray());
	expect(camera.position.toArray()).toEqual([0, 0, 2500]);
});
