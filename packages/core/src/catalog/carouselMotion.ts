const PIXELS_PER_ITEM = 220;
const DRAG_THRESHOLD = 8;
const MAX_VELOCITY = 0.025;
const INERTIA_TIME = 320;

/** Wheel adapter only: the carousel controller remains the sole owner of motion.
 * Keep the last input time separate from the idle detection delay: that delay
 * is not a physical hold and must not erase the release velocity.
 */
export class CarouselWheelInput {
	x = 0;
	idleMs = 110;
	lastTime: number | undefined;
	samples = 0;
	move(delta: number, now: number) {
		if (!Number.isFinite(delta) || !Number.isFinite(now)) return;
		if (this.lastTime !== undefined) {
			const interval = Math.max(0, now - this.lastTime);
			// Sparse intentional samples extend the grace period; speed never ends a gesture.
			this.idleMs = Math.max(110, Math.min(220, interval * 2.5));
		}
		this.lastTime = now;
		this.samples++;
		this.x -= delta;
	}
}

/** Soft direction preference based on recent travel; never locks either axis. */
export class CarouselTouchDirection {
	private horizontal = 0;
	private vertical = 0;
	private lastX: number;
	private lastY: number;
	constructor(public x: number, public y: number) {
		this.lastX = x;
		this.lastY = y;
	}
	move(x: number, y: number) {
		const dx = x - this.lastX, dy = y - this.lastY;
		this.lastX = x;
		this.lastY = y;
		const decay = Math.exp(-Math.hypot(dx, dy) / 36);
		this.horizontal = this.horizontal * decay + Math.abs(dx);
		this.vertical = this.vertical * decay + Math.abs(dy);
		const weight = (minor: number, major: number) => {
			const dominance = Math.max(0, Math.min(1, (major / Math.max(minor, 0.001) - 1.3) / 1.7));
			return 1 - 0.88 * dominance;
		};
		this.x += dx * weight(this.horizontal, this.vertical);
		this.y += dy * weight(this.vertical, this.horizontal);
		return { x: this.x, y: this.y };
	}
}

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
		const raw = this.startPhase + distance / PIXELS_PER_ITEM;
		const boundary = clampCarouselPhase(raw, count);
		const excess = raw - boundary;
		// Increasing resistance, with at most a third of a seat beyond either end.
		const next = count < 2 ? 0 : boundary + 0.35 * excess / (0.7 + Math.abs(excess));
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
		const outside = this.phase !== clampCarouselPhase(this.phase, count);
		const velocity = outside || now - this.lastTime > 100 ? 0 : this.velocity;
		return {
			velocity,
			target: Math.round(clampCarouselPhase(this.phase + velocity * INERTIA_TIME, count))
		};
	}
}

export function clampCarouselPhase(phase: number, count: number) {
	return Math.max(0, Math.min(Math.max(0, count - 1), phase));
}

/** Snap the predicted stopping point into a critically damped trajectory.
 * Preserve release speed, but raise damping for a close boundary so there is
 * no overshoot or backwards correction. Progress also drives foreground reveal.
 */
export function sampleCarouselInertia(start: number, velocity: number, target: number, elapsed: number) {
	const distance = target - start;
	if (Math.abs(distance) < 0.000001) return { phase: target, velocity: 0, progress: 1, finished: true };
	const speed = velocity * distance > 0 ? velocity : 0;
	const damping = Math.max(1 / INERTIA_TIME, Math.abs(speed / distance));
	const coefficient = speed - damping * distance;
	const time = Math.max(0, elapsed);
	const decay = Math.exp(-damping * time);
	const phase = target + (-distance + coefficient * time) * decay;
	const remainingSpeed = (speed - damping * coefficient * time) * decay;
	const finished = (Math.abs(phase - target) < 0.001 && Math.abs(remainingSpeed) < 0.00001) || time >= 3200;
	return {
		phase: finished ? target : phase,
		velocity: finished ? 0 : remainingSpeed,
		progress: finished ? 1 : Math.max(0, Math.min(1, (phase - start) / distance)),
		finished
	};
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
