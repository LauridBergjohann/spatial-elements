import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3, MathUtils } from 'three/webgpu';
import { DeviceYawFilter, screenOrientation } from './deviceYaw.js';

function settle(filter: DeviceYawFilter, q: Quaternion, start: number, frames = 60) {
	for (let i = 0; i < frames; i++) filter.update(q, start + i * 40);
	return filter.value;
}
function turn(filter: DeviceYawFilter, reference: Quaternion, degrees: number, start = 2440) {
	for (let i = 1; i <= 30; i++) {
		const q = reference.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(degrees * i / 30)));
		filter.update(q, start + i * 40);
	}
	return settle(filter, reference.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(degrees))), start + 1240);
}

describe('list geometry device yaw', () => {
	it.each([0, 90, 180, 270])('keeps roll bounded and independent at screen angle %s', angle => {
		const filter = new DeviceYawFilter();
		const reference = screenOrientation(34, 55, -10, angle);
		filter.update(reference, 0);
		for (let i = 1; i <= 60; i++) {
			filter.update(reference.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), MathUtils.degToRad(Math.min(i, 30)))), i * 40);
			expect(Math.abs(filter.roll)).toBeLessThanOrEqual(6);
			expect(filter.value).toBeCloseTo(0);
			expect(filter.pitch).toBeCloseTo(0);
		}
		expect(filter.roll).toBeGreaterThan(5.8);
		filter.reset();
		expect(filter.roll).toBe(0);
	});
	it.each([0, 90, 180, 270])('maps screen vertical rotation at screen angle %s', angle => {
		const filter = new DeviceYawFilter();
		const reference = screenOrientation(173, 65, -12, angle);
		settle(filter, reference, 0);
		expect(turn(filter, reference, 15)).toBeCloseTo(7.59, 0);
	});
	it('maps upright compass rotation to the same screen yaw in portrait and landscape', () => {
		for (const [beta, gamma, angle] of [[90, 0, 0], [0, -90, 90]]) {
			const filter = new DeviceYawFilter();
			settle(filter, screenOrientation(350, beta, gamma, angle), 0);
			for (let i = 1; i <= 30; i++) filter.update(screenOrientation((350 + i / 2) % 360, beta, gamma, angle), 2400 + i * 40);
			expect(settle(filter, screenOrientation(5, beta, gamma, angle), 3640)).toBeCloseTo(7.59, 0);
		}
	});
	it('keeps resting grip noise asleep', () => {
		const filter = new DeviceYawFilter();
		settle(filter, screenOrientation(0, 90, 0, 0), 0);
		for (let i = 0; i < 300; i++) {
			expect(filter.update(screenOrientation(Math.sin(i) * 0.5, 90, 0, 0), 2400 + i * 40)).toBe(0);
		}
	});
	it.each([-100, 100])('clamps even a large gradual turn (%s)', degrees => {
		const filter = new DeviceYawFilter();
		const reference = screenOrientation(0, 90, 0, 0);
		settle(filter, reference, 0);
		expect(Math.abs(turn(filter, reference, degrees))).toBeLessThanOrEqual(16);
		expect(Math.abs(filter.value)).toBeGreaterThan(15.8);
	});
	it('recalibrates abrupt movement and stale readings', () => {
		const filter = new DeviceYawFilter();
		settle(filter, screenOrientation(0, 90, 0, 0), 0);
		expect(filter.update(screenOrientation(90, 90, 0, 0), 2400)).toBe(0);
		expect(settle(filter, screenOrientation(90, 90, 0, 0), 2440)).toBe(0);
		expect(filter.update(screenOrientation(130, 90, 0, 0), 7000)).toBe(0);
	});
	it('ignores pure screen pitch and roll', () => {
		for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 0, 1)]) {
			const filter = new DeviceYawFilter();
			const reference = screenOrientation(0, 60, 0, 90);
			settle(filter, reference, 0);
			for (let i = 1; i <= 30; i++) {
				expect(filter.update(reference.clone().multiply(new Quaternion().setFromAxisAngle(axis, i / 100)), 2400 + i * 40)).toBe(0);
			}
		}
	});
	it.each([0, 90, 180, 270])('adds bounded pitch at screen angle %s without yaw', angle => {
		const filter = new DeviceYawFilter();
		const reference = screenOrientation(34, 55, -10, angle);
		settle(filter, reference, 0);
		for (let i = 1; i <= 30; i++) {
			filter.update(reference.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), MathUtils.degToRad(i))), 2400 + i * 40);
			expect(filter.value).toBeCloseTo(0);
			expect(Math.abs(filter.pitch)).toBeLessThanOrEqual(10);
		}
		expect(filter.pitch).toBeGreaterThan(9.8);
	});
	it('responds during the first 100 ms without swallowing a normal deliberate turn', () => {
		const filter = new DeviceYawFilter();
		filter.update(screenOrientation(0, 90, 0, 0), 0);
		for (let i = 1; i <= 6; i++) filter.update(screenOrientation(i * 2, 90, 0, 0), i * 100 / 6);
		// 120°/s used to trigger a new neutral reference on every sample.
		expect(filter.value).toBeGreaterThan(3);
	});
	it.each([-1, 1])('maps real portrait and landscape tilt with matching direction (%s)', sign => {
		for (const angle of [0, 90]) {
			const filter = new DeviceYawFilter();
			const orientation = (degrees: number) => angle === 0
				? screenOrientation(34, 60 + degrees, 0, angle)
				: screenOrientation(34, 0, -60 - degrees, angle);
			filter.update(orientation(0), 0);
			for (let i = 1; i <= 30; i++) filter.update(orientation(sign * Math.min(i, 15)), i * 40);
			expect(filter.pitch * sign).toBeGreaterThan(5.2);
			expect(filter.value).toBeCloseTo(0);
		}
	});
	it('retains its reference with slower sensor events', () => {
		const filter = new DeviceYawFilter();
		filter.update(screenOrientation(0, 90, 0, 0), 0);
		filter.update(screenOrientation(10, 90, 0, 0), 600);
		expect(filter.value).toBeGreaterThan(4.7);
	});
});
