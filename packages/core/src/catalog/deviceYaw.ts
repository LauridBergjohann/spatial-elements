import { Euler, Quaternion, Vector3, MathUtils } from 'three/webgpu';

/** W3C intrinsic Z-X-Y orientation, expressed in the current screen frame. */
export function screenOrientation(alpha: number, beta: number, gamma: number, angle: number) {
	return new Quaternion().setFromEuler(new Euler(
		MathUtils.degToRad(beta), MathUtils.degToRad(gamma), MathUtils.degToRad(alpha), 'ZXY'
	)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -MathUtils.degToRad(angle)));
}

/** Bounded screen-relative yaw, pitch and roll, in degrees, without a render loop. */
export class DeviceYawFilter {
	private reference?: Quaternion;
	private previous?: Quaternion;
	private time = 0;
	private quietUntil = 0;
	private filtered = 0;
	private filteredPitch = 0;
	private filteredRoll = 0;
	value = 0;
	pitch = 0;
	roll = 0;
	reset() {
		this.reference = this.previous = undefined;
		this.filtered = this.value = 0;
		this.filteredPitch = this.pitch = 0;
		this.filteredRoll = this.roll = 0;
	}
	/** Preserve the neutral grip/output across a scroll pause, ignoring the unobserved jump. */
	resume(q: Quaternion, now: number) {
		this.previous = q.clone();
		this.time = now - 16;
		this.quietUntil = 0;
	}
	update(q: Quaternion, now: number, smoothingMs = 60) {
		const dt = now - this.time;
		if (!this.reference || !this.previous || dt > 1500 || dt <= 0) {
			this.reference = q.clone();
			this.previous = q.clone();
			this.time = now;
			this.quietUntil = now;
			this.filteredPitch = this.pitch = 0;
			this.filteredRoll = this.roll = 0;
			return this.value = this.filtered = 0;
		}
		const step = MathUtils.radToDeg(this.previous.angleTo(q));
		const speed = step / (dt / 1000);
		this.previous.copy(q);
		this.time = now;
		// Re-anchor after abrupt movement; wait for a quiet grip before responding again.
		// Do not mistake an ordinary deliberate turn or a small noisy sample for travel.
		if (speed > 240 && step > 12) this.quietUntil = now + 400;
		let target = 0;
		let pitchTarget = 0;
		let rollTarget = 0;
		if (now < this.quietUntil) this.reference.copy(q);
		else {
			const relative = this.reference.clone().invert().multiply(q);
			if (relative.w < 0) relative.set(-relative.x, -relative.y, -relative.z, -relative.w);
			const yaw = MathUtils.radToDeg(2 * Math.atan2(relative.y, relative.w));
			const pitch = MathUtils.radToDeg(2 * Math.atan2(relative.x, relative.w));
			const roll = MathUtils.radToDeg(2 * Math.atan2(relative.z, relative.w));
			// Preserve a noise floor while making small intentional turns clearly visible.
			target = Math.sign(yaw) * Math.min(16, Math.max(0, Math.abs(yaw) - 1.2) * 0.55);
			pitchTarget = Math.sign(pitch) * Math.min(10, Math.max(0, Math.abs(pitch) - 1.5) * 0.4);
			rollTarget = Math.sign(roll) * Math.min(6, Math.max(0, Math.abs(roll) - 2) * 0.25);
		}
		const blend = 1 - Math.exp(-Math.min(dt, smoothingMs === 60 ? dt : 50) / smoothingMs);
		this.filtered += (target - this.filtered) * blend;
		this.filteredPitch += (pitchTarget - this.filteredPitch) * blend;
		this.filteredRoll += (rollTarget - this.filteredRoll) * blend;
		if (Math.abs(this.filtered) < 0.08 && target === 0) this.filtered = 0;
		if (Math.abs(this.filteredPitch) < 0.08 && pitchTarget === 0) this.filteredPitch = 0;
		if (Math.abs(this.filteredRoll) < 0.08 && rollTarget === 0) this.filteredRoll = 0;
		// Hysteresis, not rounding: noise at a quantization boundary must not wake rendering.
		if (Math.abs(this.filtered - this.value) >= 0.12 || this.filtered === 0) this.value = this.filtered;
		if (Math.abs(this.filteredPitch - this.pitch) >= 0.12 || this.filteredPitch === 0) this.pitch = this.filteredPitch;
		if (Math.abs(this.filteredRoll - this.roll) >= 0.12 || this.filteredRoll === 0) this.roll = this.filteredRoll;
		return this.value;
	}
}
