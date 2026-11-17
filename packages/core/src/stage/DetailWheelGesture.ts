export const DETAIL_WHEEL_IDLE_MS = 500;
/** Keep one wheel burst with its original owner, including inertial samples. */
export class DetailWheelGesture {
	private lastTime = -Infinity;
	private owner?: 'scroll' | 'zoom';
	private immersive = false;
	reset() { this.lastTime = -Infinity; this.owner = undefined; this.immersive = false; }
	zooming(now: number) { return this.owner === 'zoom' && now - this.lastTime < DETAIL_WHEEL_IDLE_MS; }
	resolve(now: number, hit: boolean, down: boolean, atOverview: boolean, pinch = false, immersive = false) {
		const recent = now - this.lastTime < DETAIL_WHEEL_IDLE_MS;
		const previous = recent ? this.owner : undefined;
		this.immersive = immersive || (recent && this.immersive);
		this.owner = pinch ? 'zoom' : previous === 'scroll' ? 'scroll' :
			!hit && !this.immersive ? 'scroll' : previous ?? (!hit || (down && atOverview) ? 'scroll' : 'zoom');
		this.lastTime = now;
		return this.owner;
	}
}
