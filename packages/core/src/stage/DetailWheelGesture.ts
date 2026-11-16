/** Keep one wheel burst with its original owner, including inertial samples. */
export class DetailWheelGesture {
	private lastTime = -Infinity;
	private owner?: 'scroll' | 'zoom';
	reset() { this.lastTime = -Infinity; this.owner = undefined; }
	zooming(now: number) { return this.owner === 'zoom' && now - this.lastTime < 800; }
	resolve(now: number, hit: boolean, down: boolean, atOverview: boolean, pinch = false) {
		const recent = now - this.lastTime < 800;
		const previous = recent ? this.owner : undefined;
		this.owner = pinch ? 'zoom' : previous === 'scroll' || !hit ||
			(down && atOverview && previous !== 'zoom') ? 'scroll' : 'zoom';
		this.lastTime = now;
		return this.owner;
	}
}
