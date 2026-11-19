import { DETAIL_WHEEL_IDLE_MS } from './DetailWheelGesture.js';

type Sample = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'shiftKey'> & { momentum?: boolean };
export type TrackpadAction = 'wheel' | 'pinch' | 'scroll' | 'pan';

/** WheelEvent has no device ID. Learn from several consistent samples, never one
 * small delta or Ctrl-wheel event. An uncertain gesture retains mouse behavior
 * through its tail, including zoom-out; evidence only affects the next gesture. */
export class TrackpadGesture {
	private lastTime = -Infinity;
	private confirmedUntil = -Infinity;
	private ctrl = false;
	private nativeTail = false;
	private action: TrackpadAction = 'wheel';
	private count = 0;
	private changes = 0;
	private fractional = 0;
	private diagonal = 0;
	private x = 0;
	private y = 0;
	reset() {
		this.lastTime = this.confirmedUntil = -Infinity;
		this.action = 'wheel';
		this.nativeTail = false;
		this.clearSamples();
	}
	private clearSamples() { this.count = this.changes = this.fractional = this.diagonal = 0; }
	resolve(now: number, sample: Sample, panMode: boolean): TrackpadAction {
		const x = sample.deltaX || 0, y = sample.deltaY || 0;
		const magnitude = Math.max(Math.abs(x), Math.abs(y));
		const gap = now - this.lastTime;
		const ctrl = Boolean(sample.ctrlKey);
		const changedModifier = ctrl !== this.ctrl;
		const fresh = changedModifier || (this.nativeTail && sample.momentum === false) ||
			(gap >= DETAIL_WHEEL_IDLE_MS && sample.momentum !== true);
		// Lines/pages, Shift-wheel and coarse vertical notches are mouse evidence,
		// including when a mouse is used immediately after a trackpad.
		const mouse = sample.deltaMode !== 0 || sample.shiftKey ||
			(x === 0 && Number.isInteger(y) && Math.abs(y) >= 80);
		if (mouse) {
			this.confirmedUntil = -Infinity;
			this.action = ctrl ? 'pinch' : 'wheel';
			this.clearSamples();
		} else if (fresh) {
			this.action = ctrl ? 'pinch' : now < this.confirmedUntil && magnitude < 80 ?
				(panMode ? 'pan' : 'scroll') : 'wheel';
			this.clearSamples();
		}
		// Sample cadence alone also occurs with smooth mice. Require changing pixel
		// deltas together with repeated pinch, fractional, or two-axis evidence.
		if (!mouse && magnitude > 0 && magnitude < 50 && sample.momentum !== true) {
			if (gap > 80 || changedModifier) this.clearSamples();
			if (this.count > 0 && (x !== this.x || y !== this.y)) this.changes++;
			this.count++;
			if (!Number.isInteger(x) || !Number.isInteger(y)) this.fractional++;
			if (x !== 0 && y !== 0) this.diagonal++;
			if (this.count >= 4 && this.changes >= 2 &&
				(ctrl || this.fractional >= 3 || this.diagonal >= 3)) this.confirmedUntil = now + 30_000;
		} else this.clearSamples();
		this.x = x; this.y = y;
		this.ctrl = ctrl;
		this.nativeTail = sample.momentum === true;
		this.lastTime = now;
		return this.action;
	}
}
