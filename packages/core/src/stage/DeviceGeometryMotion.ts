import { Euler, MathUtils, Object3D, Quaternion, Vector3 } from 'three/webgpu';

/** Add screen-relative motion without changing the authored model or camera pose. */
export class DeviceGeometryMotion {
	readonly rotation = new Quaternion();
	private readonly angles = new Vector3();
	private readonly euler = new Euler(0, 0, 0, 'ZXY');
	private readonly world = new Quaternion();
	private readonly inverseCamera = new Quaternion();
	private readonly base = new WeakMap<Object3D, { rotation: Quaternion; position: Vector3 }>();
	update(yaw: number, pitch: number, roll: number, delta: number) {
		const targets = [-pitch, -yaw, -roll];
		let animating = false;
		for (let index = 0; index < 3; index++) {
			let next = MathUtils.damp(this.angles.getComponent(index), targets[index], 40, delta);
			if (Math.abs(next - targets[index]) < 0.01) next = targets[index];
			this.angles.setComponent(index, next);
			animating ||= next !== targets[index];
		}
		this.rotation.setFromEuler(this.euler.set(MathUtils.degToRad(this.angles.x), MathUtils.degToRad(this.angles.y), MathUtils.degToRad(this.angles.z), 'ZXY'));
		return animating;
	}
	apply(model: Object3D, camera: Object3D, center: Vector3) {
		let base = this.base.get(model);
		if (!base) {
			base = { rotation: model.quaternion.clone(), position: model.position.clone() };
			this.base.set(model, base);
		}
		camera.getWorldQuaternion(this.world);
		this.inverseCamera.copy(this.world).invert();
		this.world.multiply(this.rotation).multiply(this.inverseCamera);
		model.quaternion.copy(base.rotation).premultiply(this.world);
		model.position.copy(base.position).sub(center).applyQuaternion(this.world).add(center);
		model.updateMatrixWorld(true);
	}
}
