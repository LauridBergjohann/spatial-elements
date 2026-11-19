import { DETAIL_WHEEL_IDLE_MS } from './DetailWheelGesture.js';

type Sample = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'shiftKey'> & { momentum?: boolean };
export type TrackpadAction = 'wheel' | 'pinch' | 'pan';

/** Choose a command from the gesture's initial direction, never a device type.
 * A clearly horizontal start opts into two-axis pan in an eligible stage. Every
 * other start retains ordinary wheel navigation until this gesture ends. */
export class TrackpadGesture {
	private lastTime = -Infinity;
	private ctrl = false;
	private nativeTail = false;
	private action: TrackpadAction = 'wheel';
	reset() {
		this.lastTime = -Infinity;
		this.action = 'wheel';
		this.ctrl = false;
		this.nativeTail = false;
	}
	resolve(now: number, sample: Sample, canStartPan: boolean): TrackpadAction {
		const x = sample.deltaX || 0, y = sample.deltaY || 0;
		if (x === 0 && y === 0) return this.action;
		const gap = now - this.lastTime;
		const ctrl = Boolean(sample.ctrlKey);
		const changedModifier = ctrl !== this.ctrl;
		const fresh = changedModifier || (this.nativeTail && sample.momentum === false) ||
			(gap >= DETAIL_WHEEL_IDLE_MS && sample.momentum !== true);
		if (fresh) {
			// Ignore minor sideways drift and ambiguous diagonal starts. Line/page
			// wheels and Shift-wheel keep their existing behavior. No later sample
			// can promote a running scroll/zoom gesture to pan, even as panels clear.
			const horizontal = sample.deltaMode === 0 && !sample.shiftKey &&
				Math.abs(x) > Math.abs(y) * 2;
			this.action = ctrl ? 'pinch' : canStartPan && horizontal ? 'pan' : 'wheel';
		}
		this.ctrl = ctrl;
		this.nativeTail = sample.momentum === true;
		this.lastTime = now;
		return this.action;
	}
}
