export const DETAIL_WHEEL_IDLE_MS = 500;
/** Keep one wheel burst with its original owner, including inertial samples. */
export class DetailWheelGesture {
	private lastTime = -Infinity;
	private owner?: 'scroll' | 'zoom';
	reset() { this.lastTime = -Infinity; this.owner = undefined; }
	zooming(now: number) { return this.owner === 'zoom' && now - this.lastTime < DETAIL_WHEEL_IDLE_MS; }
	resolve(now: number, hit: boolean, down: boolean, atOverview: boolean, pinch = false) {
		const recent = now - this.lastTime < DETAIL_WHEEL_IDLE_MS;
		const previous = recent ? this.owner : undefined;
		this.owner = pinch ? 'zoom' : previous ?? (!hit || (down && atOverview) ? 'scroll' : 'zoom');
		this.lastTime = now;
		return this.owner;
	}
}
