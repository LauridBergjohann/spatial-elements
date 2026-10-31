import { MathUtils, PerspectiveCamera, Vector3 } from 'three/webgpu';

/** Small camera orbit around the selected geometry; UI uses a separate fixed camera. */
export class CarouselDeviceCamera {
	readonly angles = new Vector3();
	private readonly sensorAngles = new Vector3();
	private readonly pivot = new Vector3();
	private pivotReady = false;
	private pivotSettling = false;
	/** Read-only; a neutral camera can still have an internally settling pivot. */
	getRenderActivity() {
		return { pivotReady: this.pivotReady, pivotSettling: this.pivotSettling,
			neutral: this.angles.x === 0 && this.angles.y === 0 && this.angles.z === 0,
			pivot: this.pivot.toArray(), angles: this.angles.toArray() };
	}
	orbit(camera: PerspectiveCamera, pivot: Vector3, delta = 1, smooth = false) {
		const rotation = camera.quaternion;
		if (rotation.x === 0 && rotation.y === 0 && rotation.z === 0 && Math.abs(rotation.w) === 1) {
			// P + I(C - P) = C: changing the pivot cannot change the neutral camera.
			// Keep the current selection for the next sensor input without scheduling
			// invisible settling frames. Non-neutral camera damping is unchanged.
			this.pivot.copy(pivot);
			this.pivotSettling = false;
		} else if (this.pivotReady && (smooth || this.pivotSettling)) {
			this.pivot.lerp(pivot, 1 - Math.exp(-12 * delta));
			this.pivotSettling = this.pivot.distanceTo(pivot) > 0.01;
			if (!this.pivotSettling) this.pivot.copy(pivot);
		} else this.pivot.copy(pivot);
		this.pivotReady = true;
		// C' = P + Q(C - P) preserves P's camera-space position, even off-centre.
		camera.position.set(0, 0, 2500).sub(this.pivot).applyQuaternion(camera.quaternion).add(this.pivot);
		camera.updateMatrixWorld(true);
		return this.pivotSettling;
	}
	update(camera: PerspectiveCamera, yaw: number, pitch: number, roll: number, delta: number, reduced = false) {
		const target = [pitch, yaw, roll];
		let animating = false;
		for (let i = 0; i < 3; i++) {
			const limit = [10, 16, 6][i];
			// Camera orbits amplify background parallax; keep sensor motion below card strength.
			const value = reduced ? 0 : MathUtils.clamp(target[i], -limit, limit) * 0.25;
			let next = reduced ? 0 : MathUtils.damp(this.sensorAngles.getComponent(i), value, 40, delta);
			if (Math.abs(next - value) < 0.001) next = value;
			this.sensorAngles.setComponent(i, next);
			animating ||= next !== value;
			this.angles.setComponent(i, next);
		}
		// Rotating the observer has the inverse visual effect of rotating the scene.
		camera.rotation.set(...this.angles.toArray().map(MathUtils.degToRad) as [number, number, number], 'ZXY');
		camera.updateMatrixWorld(true);
		return animating;
	}
}
