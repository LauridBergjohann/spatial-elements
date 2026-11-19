export const DETAIL_WHEEL_IDLE_MS = 380;
export interface WheelGestureSample {
	deltaX: number;
	deltaY: number;
	deltaMode: number;
	/** Undefined means the browser cannot distinguish physical input from inertia. */
	momentum?: boolean;
}
/** Keep inertia with its original owner, but let a new physical gesture choose again. */
export class DetailWheelGesture {
	private lastTime = -Infinity;
	private lastInputTime = -Infinity;
	private owner?: 'scroll' | 'zoom';
	private immersive = false;
	private tail = false;
	private magnitude = 0;
	private peak = 0;
	private direction = 0;
	private decays = 0;
	reset() {
		this.lastTime = this.lastInputTime = -Infinity;
		this.owner = undefined; this.immersive = this.tail = false;
		this.magnitude = this.peak = this.direction = this.decays = 0;
	}
	zooming(now: number) { return this.owner === 'zoom' && now - this.lastTime < DETAIL_WHEEL_IDLE_MS; }
	resolve(now: number, hit: boolean, down: boolean, atOverview: boolean, pinch = false, immersive = false, sample?: WheelGestureSample) {
		const gap = now - this.lastTime;
		const wasTail = this.tail;
		let tail = sample?.momentum === true;
		if (sample && sample.momentum === undefined && sample.deltaMode === 0 && gap < DETAIL_WHEEL_IDLE_MS) {
			const magnitude = Math.hypot(sample.deltaX, sample.deltaY);
			const direction = Math.sign(Math.abs(sample.deltaY) >= Math.abs(sample.deltaX) ? sample.deltaY : sample.deltaX);
			// Conservative fallback: several decaying samples, then a renewed
			// impulse or reversal. Equal mouse-wheel notches are never inertia.
			const renewed = magnitude > Math.max(this.magnitude * 1.6, this.magnitude + 2) ||
				(direction !== this.direction && magnitude >= 1);
			this.decays = magnitude < this.magnitude * 0.97 && direction === this.direction ? this.decays + 1 : 0;
			tail = !renewed && (wasTail || (this.decays >= 3 && magnitude < this.peak * 0.75));
		}
		const fresh = wasTail && !tail;
		const recent = !fresh && (tail || now - this.lastInputTime < DETAIL_WHEEL_IDLE_MS);
		const previous = recent ? this.owner : undefined;
		this.immersive = immersive || (recent && this.immersive);
		this.owner = pinch ? 'zoom' : previous === 'scroll' ? 'scroll' :
			!hit && !this.immersive ? 'scroll' : previous ?? (!hit || (down && atOverview) ? 'scroll' : 'zoom');
		if (!tail) this.lastInputTime = now;
		if (sample) {
			this.magnitude = Math.hypot(sample.deltaX, sample.deltaY);
			this.direction = Math.sign(Math.abs(sample.deltaY) >= Math.abs(sample.deltaX) ? sample.deltaY : sample.deltaX);
			this.peak = fresh || gap >= DETAIL_WHEEL_IDLE_MS ? this.magnitude : Math.max(this.peak, this.magnitude);
			if (fresh || gap >= DETAIL_WHEEL_IDLE_MS) this.decays = 0;
		}
		this.tail = tail;
		this.lastTime = now;
		return this.owner;
	}
}
