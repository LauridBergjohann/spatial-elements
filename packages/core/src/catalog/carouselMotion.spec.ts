import { expect, it } from 'vitest';
import { CarouselDrag, CarouselScrollDrag, CarouselTouchDirection, clampCarouselPhase, sampleCarouselSpring, sampleCarouselScrollMomentum } from './carouselMotion.js';

it('damps only the weaker touch axis, preserving diagonal travel and direction changes', () => {
	for (const horizontal of [true, false]) {
		const direction = new CarouselTouchDirection(0, 0);
		for (let i = 1; i <= 10; i++) direction.move(horizontal ? i * 20 : i * 4, horizontal ? i * 4 : i * 20);
		expect(horizontal ? direction.x : direction.y).toBe(200);
		expect(horizontal ? direction.y : direction.x).toBeCloseTo(4.8);
		const before = { x: direction.x, y: direction.y };
		for (let i = 1; i <= 10; i++) direction.move(horizontal ? 200 : 40 + i * 20, horizontal ? 40 + i * 20 : 200);
		expect(horizontal ? direction.y - before.y : direction.x - before.x).toBeGreaterThan(150);
	}
	const diagonal = new CarouselTouchDirection(0, 0);
	expect(diagonal.move(100, 100)).toEqual({ x: 100, y: 100 });
	expect(diagonal.move(100, 100)).toEqual({ x: 100, y: 100 });
});

it('ignores tap jitter, then tracks horizontal movement without a direction lock', () => {
	const drag = new CarouselDrag(300, 1, 0);
	drag.move(295, 100, 5);
	expect(drag.active).toBe(false);
	// Scrolling first must not discard the gesture: later horizontal motion still rotates.
	drag.move(190, 300, 5);
	expect(drag.active).toBe(true);
	expect(drag.phase).toBe(1.5);
	drag.move(410, 450, 5);
	expect(drag.phase).toBe(0.5);
});

it('carries a flick forward, but removes momentum after holding before release', () => {
	const drag = new CarouselDrag(300, 0, 0);
	drag.move(270, 30, 5);
	drag.move(230, 60, 5);
	expect(drag.phase).toBeLessThan(0.5);
	expect(drag.release(60, 5).target).toBe(1);
	expect(drag.release(200, 5)).toEqual({ target: 0, velocity: 0 });
});

it('respects both ends and empty or single-item carousels', () => {
	const drag = new CarouselDrag(300, 1, 0);
	drag.move(-1000, 50, 3);
	expect(drag.phase).toBeGreaterThan(2);
	expect(drag.phase).toBeLessThan(2.35);
	expect(drag.release(50, 3).target).toBe(2);
	drag.move(1000, 100, 3);
	expect(drag.phase).toBeLessThan(0);
	expect(drag.phase).toBeGreaterThan(-0.35);
	expect(drag.release(100, 3).target).toBe(0);
	expect(clampCarouselPhase(5, 0)).toBe(0);
	expect(clampCarouselPhase(5, 1)).toBe(0);
});

it('resists overscroll symmetrically and springs back without selecting another seat', () => {
	for (const [start, direction] of [[0, 1], [4, -1]]) {
		const drag = new CarouselDrag(300, start, 0);
		drag.move(300 + direction * 110, 50, 5);
		const offset = Math.abs(drag.phase - start);
		expect(offset).toBeGreaterThan(0.1);
		expect(offset).toBeLessThan(0.25);
		expect(drag.release(50, 5)).toEqual({ target: start, velocity: 0 });
		const spring = sampleCarouselSpring(drag.phase, 0, start, 100);
		expect(Math.abs(spring.phase - start)).toBeLessThan(offset);
		expect(Math.abs(spring.phase - start)).toBeGreaterThan(0);
		drag.move(300, 100, 5);
		expect(drag.phase).toBe(start);
	}
});

it('includes a coalesced final position without inventing velocity on an unchanged release', () => {
	const drag = new CarouselDrag(300, 0, 0);
	drag.move(220, 100, 4);
	const release = drag.release(120, 4, 160);
	expect(drag.phase).toBeCloseTo(140 / 220);
	expect(release.target).toBeGreaterThan(0);
	expect(drag.release(125, 4, 160).velocity).toBe(release.velocity);
});

it('continues with release velocity and settles without frame-rate-dependent integration', () => {
	const start = 0.35, velocity = 0.003, target = 1;
	expect(sampleCarouselSpring(start, velocity, target, 0)).toEqual({ phase: start, velocity });
	const first = sampleCarouselSpring(start, velocity, target, 16);
	expect(first.phase).toBeGreaterThan(start);
	expect(first.phase).toBeLessThan(target);
	// Advancing from an intermediate sample produces the same result as one elapsed-time sample.
	const continued = sampleCarouselSpring(first.phase, first.velocity, target, 240);
	const direct = sampleCarouselSpring(start, velocity, target, 256);
	expect(continued.phase).toBeCloseTo(direct.phase, 10);
	expect(continued.velocity).toBeCloseTo(direct.velocity, 10);
	const settled = sampleCarouselSpring(start, velocity, target, 1000);
	expect(settled.phase).toBeCloseTo(target, 3);
	expect(Math.abs(settled.velocity)).toBeLessThan(0.00001);
});

it('scrolls vertically after any horizontal-only interval and reverses immediately at bounds', () => {
	const drag = new CarouselScrollDrag(500, 0, 200, 0);
	drag.move(500, 100);
	expect(drag.active).toBe(false);
	drag.move(400, 200);
	expect(drag.position).toBe(100);
	drag.move(200, 250);
	expect(drag.position).toBe(200);
	drag.move(210, 270);
	expect(drag.position).toBe(190);
	expect(drag.release(500)).toBe(0);
});

it('keeps tap jitter inert, includes final Y, and damps scroll momentum to bounded rest', () => {
	const drag = new CarouselScrollDrag(500, 100, 1000, 0);
	drag.move(496, 20);
	expect(drag.active).toBe(false);
	expect(drag.position).toBe(100);
	const velocity = drag.release(100, 400);
	expect(drag.active).toBe(true);
	expect(drag.position).toBe(200);
	expect(velocity).toBeGreaterThan(0);
	const moving = sampleCarouselScrollMomentum(200, velocity, 100, 1000);
	expect(moving.position).toBeGreaterThan(200);
	expect(moving.finished).toBe(false);
	expect(sampleCarouselScrollMomentum(200, velocity, 1600, 1000).finished).toBe(true);
	expect(sampleCarouselScrollMomentum(990, 3, 100, 1000)).toEqual({ position: 1000, finished: true });
	expect(sampleCarouselScrollMomentum(10, -3, 100, 1000)).toEqual({ position: 0, finished: true });
});
