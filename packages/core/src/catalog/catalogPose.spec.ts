import { describe, expect, it } from 'vitest';
import { carouselDistance, carouselPose, carouselResident, type CarouselLayout } from './catalogPose.js';

describe('bounded carousel groups', () => {
	it('keeps the focused geometry sharp and increases defocus smoothly with distance', () => {
		expect(carouselPose(2, 2, 5).blur).toBe(0);
		let previous = 0;
		for (let distance = 0; distance <= 2.5; distance += 0.05) {
			const blur = carouselPose(0, distance, 5).blur!;
			expect(blur).toBeGreaterThanOrEqual(previous);
			expect(blur - previous).toBeLessThan(0.4);
			expect(blur).toBeLessThanOrEqual(7);
			previous = blur;
		}
	});
	for (const viewportWidth of [390, 1440, 3000]) {
		it(`prepares visible models throughout fractional dragging at ${viewportWidth}px`, () => {
			const width = Math.min(viewportWidth - 40, 1320);
			const layout = { width, height: 600, left: (viewportWidth - width) / 2, viewportWidth };
			for (let phase = 0; phase < 30; phase += 0.125) {
				const indices = Array.from({ length: 30 }, (_, i) => i);
				const visible = indices.filter(i => carouselPose(i, phase, 30, {}, layout).visible);
				if (viewportWidth === 390) expect(visible.length).toBeLessThanOrEqual(3);
				for (const i of visible) for (const windowPhase of [phase - 0.75, phase + 0.75])
					expect(carouselResident(i, windowPhase, 30, {}, layout)).toBe(true);
				expect(indices.filter(i => carouselResident(i, phase, 30, {}, layout)).length).toBeLessThan(20);
			}
		});
	}
	it('uses a wide viewport beyond a centered section without a five-item cutoff', () => {
		const visible = (layout: CarouselLayout) => Array.from({ length: 30 }, (_, i) =>
			carouselPose(i, 15, 30, {}, layout)).filter(pose => pose.visible).length;
		expect(visible({ width: 1320, height: 600, left: 840, viewportWidth: 3000 })).toBeGreaterThan(5);
		expect(visible({ width: 350, height: 800, left: 20, viewportWidth: 390 })).toBeLessThanOrEqual(3);
	});
	for (const layout of [
		{ width: 1320, height: 600, left: 840, viewportWidth: 3000 },
		{ width: 350, height: 800, left: 20, viewportWidth: 390 }
	]) it(`keeps model envelopes separated and ordered at ${layout.viewportWidth}px`, () => {
		const frame = Math.min(layout.width, layout.width < 700 ? 360 : layout.height);
		for (let phase = 10; phase < 11; phase += 0.125) {
			const poses = Array.from({ length: 30 }, (_, i) => carouselPose(i, phase, 30, {}, layout));
			for (let i = 1; i < poses.length; i++) {
				const gap = (poses[i].x - poses[i - 1].x) * layout.width;
				const halfWidths = frame * (poses[i].size + poses[i - 1].size) / 2;
				expect(gap - halfWidths).toBeGreaterThan(12);
			}
		}
	});
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
