import { expect, it } from 'vitest';
import { CarouselDrag, CarouselWheelInput, CarouselScrollDrag, CarouselTouchDirection, clampCarouselPhase, sampleCarouselSpring, sampleCarouselScrollMomentum, sampleCarouselInertia } from './carouselMotion.js';

it('tracks wheel travel beyond two seats and reverses immediately', () => {
	const wheel = new CarouselWheelInput();
	for (let i = 0; i < 30; i++) wheel.move(100, i * 16);
	expect(wheel.x).toBe(-3000);
	wheel.move(-110, 500);
	expect(wheel.x).toBe(-2890);
	for (let i = 0; i < 30; i++) wheel.move(-100, 520 + i * 16);
	expect(wheel.x).toBe(110);
});

it('retains wheel release speed across idle detection, while a decaying tail contributes only its residual speed', () => {
	for (const tail of [false, true]) {
		const wheel = new CarouselWheelInput(), drag = new CarouselDrag(0, 0, 0);
		for (let i = 1; i <= 5; i++) {
			wheel.move(40, i * 16);
			drag.move(wheel.x, wheel.lastTime!, 12);
		}
		if (tail) for (let i = 6; i <= 35; i++) {
			wheel.move(40 * Math.exp(-(i - 5) / 3), i * 16);
			drag.move(wheel.x, wheel.lastTime!, 12);
		}
		const release = drag.release(wheel.lastTime!, 12);
		if (tail) expect(Math.abs(release.velocity)).toBeLessThan(0.0005);
		else expect(release.target).toBeGreaterThan(2);
		expect(drag.release(wheel.lastTime! + wheel.idleMs, 12).velocity).toBe(0);
	}
});

it('uses sample cadence rather than velocity for the wheel idle fallback', () => {
	const wheel = new CarouselWheelInput();
	wheel.move(150, 0);
	expect(wheel.idleMs).toBe(110);
	wheel.move(1, 65);
	expect(wheel.idleMs).toBe(162.5);
	wheel.move(0.1, 130);
	expect(wheel.idleMs).toBe(162.5);
	wheel.move(1, 230);
	expect(wheel.idleMs).toBe(220);
	wheel.move(0, 246);
	expect(wheel.idleMs).toBe(110);
	wheel.move(Number.NaN, 260);
	expect(Number.isFinite(wheel.x)).toBe(true);
});

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
	expect(drag.release(60, 5).target).toBe(2);
	expect(drag.release(200, 5)).toEqual({ target: 0, velocity: 0 });
});

it('projects a fast pointer flick beyond two seats, with the same travel producing less momentum when slow', () => {
	const fast = new CarouselDrag(500, 0, 0), slow = new CarouselDrag(500, 0, 0);
	for (let i = 1; i <= 5; i++) {
		fast.move(500 - i * 40, i * 16, 12);
		slow.move(500 - i * 40, i * 120, 12);
	}
	expect(fast.phase).toBe(slow.phase);
	expect(fast.release(80, 12).target).toBeGreaterThan(2);
	expect(fast.release(80, 12).target).toBeGreaterThan(slow.release(600, 12).target);
	expect(fast.release(200, 12).target).toBe(1);
});

it('damps toward the preselected seat and reveals concurrently, preserving speed without overshoot', () => {
	for (const [start, velocity, target] of [[0.8, 0.012, 5], [5.2, -0.012, 1], [6.9, 0.02, 7]]) {
		const first = sampleCarouselInertia(start, velocity, target, 0);
		expect(first.phase).toBeCloseTo(start, 12);
		expect(first.velocity).toBeCloseTo(velocity, 12);
		expect(first.progress).toBeCloseTo(0, 12);
		const next = sampleCarouselInertia(start, velocity, target, 16);
		expect(next.progress).toBeGreaterThan(0);
		expect(next.progress).toBeLessThan(1);
		let previous = first;
		for (let t = 16; t <= 3200; t += 16) {
			const sample = sampleCarouselInertia(start, velocity, target, t);
			expect(sample.progress).toBeGreaterThanOrEqual(previous.progress);
			expect(sample.phase).toBeGreaterThanOrEqual(Math.min(start, target));
			expect(sample.phase).toBeLessThanOrEqual(Math.max(start, target));
			expect(Math.abs(sample.velocity)).toBeLessThanOrEqual(Math.abs(previous.velocity) + 1e-10);
			previous = sample;
		}
		expect(previous).toEqual({ phase: target, velocity: 0, progress: 1, finished: true });
	}
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
