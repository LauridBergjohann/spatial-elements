const PIXELS_PER_ITEM = 220;
const DRAG_THRESHOLD = 8;
const MAX_VELOCITY = 0.01;

/** Horizontal carousel motion, independent of the gesture's vertical scrolling. */
export class CarouselDrag {
	active = false;
	phase: number;
	private velocity = 0;
	private lastTime: number;
	private lastX: number;

	constructor(
		private readonly startX: number,
		private readonly startPhase: number,
		now: number
	) {
		this.phase = startPhase;
		this.lastTime = now;
		this.lastX = startX;
	}

	move(x: number, now: number, count: number) {
		this.lastX = x;
		const distance = this.startX - x;
		if (!this.active && Math.abs(distance) < DRAG_THRESHOLD) return;
		this.active = true;
		const next = clampCarouselPhase(this.startPhase + distance / PIXELS_PER_ITEM, count);
		const elapsed = now - this.lastTime;
		if (elapsed > 0) {
			const speed = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, (next - this.phase) / elapsed));
			this.velocity += (speed - this.velocity) * (1 - Math.exp(-elapsed / 40));
		}
		this.phase = next;
		this.lastTime = now;
	}

	release(now: number, count: number, x = this.lastX) {
		// A coalesced final move may arrive only in the release event.
		if (x !== this.lastX) this.move(x, now, count);
		// A held finger has no momentum, even if no move event arrived during the pause.
		const velocity = now - this.lastTime > 100 ? 0 : this.velocity;
		return {
			velocity,
			target: Math.round(clampCarouselPhase(this.phase + velocity * 180, count))
		};
	}
}

export function clampCarouselPhase(phase: number, count: number) {
	return Math.max(0, Math.min(Math.max(0, count - 1), phase));
}

/** Analytic critical damping, independent of refresh rate and dropped frames. */
export function sampleCarouselSpring(start: number, velocity: number, target: number, elapsed: number) {
	const damping = 0.012;
	const offset = start - target;
	const coefficient = velocity + damping * offset;
	const decay = Math.exp(-damping * elapsed);
	return {
		phase: target + (offset + coefficient * elapsed) * decay,
		velocity: (velocity - damping * coefficient * elapsed) * decay
	};
}

/** Page scrolling for the model surface, which owns both single-finger axes. */
export class CarouselScrollDrag {
	active = false;
	private velocity = 0;
	constructor(
		private lastY: number,
		public position: number,
		readonly maximum: number,
		private lastTime: number
	) {}

	move(y: number, now: number) {
		const distance = this.lastY - y;
		if (!this.active && Math.abs(distance) < 6) return;
		this.active = true;
		const next = Math.max(0, Math.min(this.maximum, this.position + distance));
		const elapsed = now - this.lastTime;
		if (elapsed > 0) {
			const speed = Math.max(-3, Math.min(3, (next - this.position) / elapsed));
			this.velocity += (speed - this.velocity) * (1 - Math.exp(-elapsed / 40));
		}
		this.position = next;
		this.lastY = y;
		this.lastTime = now;
	}

	release(now: number, y = this.lastY) {
		if (y !== this.lastY) this.move(y, now);
		return now - this.lastTime > 100 ? 0 : this.velocity;
	}
}

export function sampleCarouselScrollMomentum(start: number, velocity: number, elapsed: number, maximum: number) {
	const decay = Math.exp(-elapsed / 240);
	const position = Math.max(0, Math.min(maximum, start + velocity * 240 * (1 - decay)));
	return {
		position,
		finished: position <= 0 || position >= maximum || Math.abs(velocity * decay) < 0.02 || elapsed >= 1600
	};
}
