import { describe, expect, it } from 'vitest';
import { carouselDistance, carouselPose, carouselResident } from './catalogPose.js';

describe('bounded carousel groups', () => {
	for (const count of [0, 1, 2, 5, 20]) {
		it(`bounds the visible and prepared window for ${count} real items`, () => {
			for (let phase = -21; phase < 22; phase += 0.125) {
				const indices = Array.from({ length: count }, (_, i) => i);
				expect(
					indices.filter((i) => carouselPose(i, phase, count).visible).length
				).toBeLessThanOrEqual(5);
				expect(indices.filter((i) => carouselResident(i, phase, count)).length).toBeLessThanOrEqual(
					7
				);
			}
		});
	}
	it('moves both spatialElements monotonically along the same shallow arc without a wrap', () => {
		for (const count of [2, 20]) {
			for (const index of [0, 1]) {
				let previous = carouselPose(index, 0, count).x;
				for (let phase = 0.01; phase <= 1; phase += 0.01) {
					const pose = carouselPose(index, phase, count);
					expect(pose.x).toBeLessThan(previous);
					expect(Math.abs(pose.yaw)).toBeLessThan(0.49);
					previous = pose.x;
				}
			}
		}
		expect(carouselDistance(0, 1, 2)).toBe(-1);
		expect(carouselPose(1, 0, 2)).toEqual(carouselPose(1, 0, 20));
	});
	it('fades only the adjacent panels while retaining a single fully visible panel at rest', () => {
		expect(carouselPose(0, 0, 20).panelOpacity).toBe(1);
		expect(carouselPose(1, 0, 20).panelOpacity).toBe(0);
		expect(carouselPose(0, 0.5, 20).panelOpacity).toBeGreaterThan(0);
		expect(carouselPose(1, 0.5, 20).panelOpacity).toBeGreaterThan(0);
		expect(carouselPose(2, 0.5, 20).panelOpacity).toBe(0);
	});
});

it('turns both sides toward the neutral foreground and increases neighbour separation', () => {
	expect((carouselPose(0, 1, 3).yaw * 180) / Math.PI).toBeCloseTo(28);
	expect(carouselPose(1, 1, 3).yaw).toBeCloseTo(0);
	expect((carouselPose(2, 1, 3).yaw * 180) / Math.PI).toBeCloseTo(-28);
	expect(carouselPose(2, 1, 3).x - carouselPose(1, 1, 3).x).toBeGreaterThan(0.24);
});
