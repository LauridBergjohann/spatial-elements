import { describe, expect, it } from 'vitest';
import { carouselDistance, carouselPose, carouselResident, carouselEmphasis, CarouselDragEmphasis, resolveCarouselPoseLayout } from './catalogPose.js';
import { resolveCarouselLayout } from '../spatial-element/responsiveLayout.js';

describe('shared carousel framing', () => {
	for (const [width, ringLeft, ringWidth] of [[390, 12, 366], [600, 16, 568], [840, 16, 808], [1440, 24, 1392], [1600, 160, 1280], [1940, 226, 1488], [2300, 406, 1488]]) {
		it(`anchors the selected seat and panel to the resolver at ${width}px`, () => {
			const input = { width, height: 900, hasHeadline: true, hasEyebrow: true };
			const resolved = resolveCarouselLayout(input);
			const layout = resolveCarouselPoseLayout(input, { left: ringLeft, width: ringWidth });
			const frame = layout.framing!;
			expect(frame.fit.x + ringLeft).toBeCloseTo(resolved.mediaFit.x);
			expect(frame.fit.width).toBeCloseTo(resolved.mediaFit.width);
			expect(frame.fit.height).toBeCloseTo(resolved.mediaFit.height);
			expect(frame.summary.x + ringLeft).toBeCloseTo(resolved.summary.x);
			expect(frame.summary.width).toBeCloseTo(resolved.summary.width);
			const pose = carouselPose(2, 2, 5, {}, layout);
			expect(pose.x * ringWidth).toBeCloseTo(frame.fit.x + frame.fit.width / 2);
			expect(pose.y * layout.height).toBeCloseTo(frame.fit.y + frame.fit.height / 2);
			expect(pose.depth).toBeCloseTo(0);
			expect(pose.framing).toBe(frame);
		});
	}
	it('reserves the same compact frame with and without an eyebrow', () => {
		for (const hasEyebrow of [false, true]) {
			const layout = resolveCarouselPoseLayout({ width: 390, height: 900, hasHeadline: true, hasEyebrow }, { left: 12, width: 366 });
			expect(layout.framing).toEqual({ compact: true, fit: { x: 36, y: 66, width: 294, height: 300 }, summary: { x: 36, width: 294, anchorY: 66, alignment: 'end' } });
			expect(layout.height).toBe(366);
		}
	});
	it('preserves the depth-only foreground advance with the new fit target', () => {
		const layout = resolveCarouselPoseLayout({ width: 1940, height: 900 }, { left: 226, width: 1488 });
		for (const amount of [0, 0.25, 0.5, 1]) {
			const pose = carouselPose(1, 1, 3, {}, layout, { advance: amount, panel: amount });
			expect(pose.orbit!.x).toBe(0);
			expect(pose.framing).toBe(layout.framing);
		}
	});
});

describe('drag presentation', () => {
	it('advances only in depth and restores defocus with the foreground selection', () => {
		for (const phase of [0, 0.4, 1]) {
			for (const index of [0, 1, 2]) {
				const resting = carouselPose(index, phase, 4);
				for (const focus of [0, 0.25, 0.5, 1]) {
					const pose = carouselPose(index, phase, 4, {}, undefined,
						{ advance: focus, panel: focus }, focus);
					expect(pose.orbit!.x).toBe(resting.orbit!.x);
					expect(pose.blur).toBeCloseTo(resting.blur! * focus);
				}
			}
		}
	});
	it('withdraws the initial panel and never reveals passing or revisited seats before release', () => {
		const drag = new CarouselDragEmphasis(1, [0, 1, 2, 3].map(i => carouselEmphasis(i - 1)));
		expect(drag.move(1)[1]).toEqual({ advance: 1, panel: 1 });
		const partial = drag.move(1.5);
		expect(partial[1].panel).toBe(0.25);
		expect(partial[2]).toEqual({ advance: 0, panel: 0 });
		for (const phase of [2, 3, 2.5, 1, 0]) {
			const values = drag.move(phase);
			expect(values.every(v => v.advance === 0 && v.panel === 0)).toBe(true);
			for (let i = 0; i < values.length; i++) {
				const pose = carouselPose(i, phase, 4, {}, undefined, values[i]);
				const radius = 560 * 3.4;
				const recession = -pose.depth / Math.cos(pose.orbit!.pitch);
				expect(pose.orbit!.x ** 2 + (radius - recession + 700) ** 2)
					.toBeCloseTo(radius ** 2, 5);
			}
		}
	});
	it('captures an interrupted presentation without a discontinuity', () => {
		const initial = [carouselEmphasis(-0.4), carouselEmphasis(0.6)];
		const drag = new CarouselDragEmphasis(0.4, initial);
		expect(drag.move(0.4)).toEqual(initial);
		for (const value of drag.move(1.4)) {
			expect(value.advance).toBeCloseTo(0);
			expect(value.panel).toBeCloseTo(0);
		}
	});
});

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
	it('shows only the front arc even on ultrawide screens and long catalogs', () => {
		const layout = { width: 1320, height: 600, left: 840, viewportWidth: 3000 };
		const poses = Array.from({ length: 100 }, (_, i) => carouselPose(i, 50, 100, {}, layout));
		expect(poses.filter(pose => pose.visible).length).toBe(7);
		expect(poses[46].visible).toBe(false);
		expect(poses[54].visible).toBe(false);
	});
	it('puts the unselected seats on one circle and advances the selection smoothly', () => {
		const radius = 560 * 3.4;
		const pull = 560 * 1.25;
		for (const distance of [1, 1.25, 1.5, 2]) {
			const pose = carouselPose(0, distance, 20);
			const recession = -pose.depth / Math.cos(pose.orbit!.pitch);
			expect(pose.orbit!.x ** 2 + (radius - recession + pull) ** 2).toBeCloseTo(radius ** 2);
		}
		const front = carouselPose(0, 0, 20);
		expect(front.orbit!.pitch).toBeCloseTo(10 * Math.PI / 180);
		expect(front.depth).toBeCloseTo(0);
		expect(front.size).toBeCloseTo(0.82);
		let previousDepth = front.depth;
		for (let distance = 0.01; distance <= 1; distance += 0.01) {
			const pose = carouselPose(0, distance, 20);
			expect(pose.depth).toBeLessThan(previousDepth);
			expect(pose.size).toBeCloseTo(0.82 * 2500 / (2500 - pose.depth));
			expect(pose.orbit!.y).toBeGreaterThan(0);
			previousDepth = pose.depth;
		}
		const z = (distance: number) => carouselPose(0, distance, 20).depth;
		expect(Math.abs((z(1) - z(0.999)) - (z(1.001) - z(1)))).toBeLessThan(0.01);
	});
	it('moves both spatialElements monotonically along the same circular arc without a wrap', () => {
		for (const count of [2, 20]) {
			for (const index of [0, 1]) {
				let previous = carouselPose(index, 0, count).x;
				for (let phase = 0.01; phase <= 1; phase += 0.01) {
					const pose = carouselPose(index, phase, count);
					expect(pose.x).toBeLessThan(previous);
					expect(Math.abs(pose.yaw)).toBeLessThan(0.59);
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

it('rotates the products with their turntable seats', () => {
	expect((carouselPose(0, 1, 3).yaw * 180) / Math.PI).toBeCloseTo(-0.4 * 180 / Math.PI);
	expect(carouselPose(1, 1, 3).yaw).toBeCloseTo(0);
	expect((carouselPose(2, 1, 3).yaw * 180) / Math.PI).toBeCloseTo(0.4 * 180 / Math.PI);
	expect(carouselPose(2, 1, 3).x - carouselPose(1, 1, 3).x).toBeGreaterThan(0.24);
});
