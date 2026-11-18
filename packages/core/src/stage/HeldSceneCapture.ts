import type { Object3D, PerspectiveCamera, Scene, Texture } from 'three';

/** Numeric snapshot of the inputs used while keeping an offscreen stage capture. */
export class HeldSceneCapture {
	private configuration = -1;
	private width = 0;
	private height = 0;
	private environment: Texture | null = null;
	private reveal = -1;
	private readonly projection = new Float64Array(16);
	private readonly cameraWorld = new Float64Array(16);
	private readonly children: { object: Object3D; world: Float64Array }[] = [];

	matches(scene: Scene, camera: PerspectiveCamera, configuration: number, width: number, height: number, reveal: number) {
		if (this.configuration !== configuration || this.width !== width || this.height !== height ||
			this.environment !== scene.environment || this.reveal !== reveal ||
			this.children.length !== scene.children.length ||
			!sameMatrix(this.projection, camera.projectionMatrix.elements) ||
			!sameMatrix(this.cameraWorld, camera.matrixWorld.elements)) return false;
		for (let index = 0; index < this.children.length; index++) {
			const child = this.children[index], object = scene.children[index];
			if (child.object !== object || !sameMatrix(child.world, object.matrixWorld.elements)) return false;
		}
		return true;
	}

	capture(scene: Scene, camera: PerspectiveCamera, configuration: number, width: number, height: number, reveal: number) {
		this.configuration = configuration;
		this.width = width;
		this.height = height;
		this.environment = scene.environment;
		this.reveal = reveal;
		this.projection.set(camera.projectionMatrix.elements);
		this.cameraWorld.set(camera.matrixWorld.elements);
		for (let index = 0; index < scene.children.length; index++) {
			const object = scene.children[index];
			const child = this.children[index] ??= { object, world: new Float64Array(16) };
			child.object = object;
			child.world.set(object.matrixWorld.elements);
		}
		this.children.length = scene.children.length;
	}
}

function sameMatrix(snapshot: Float64Array, elements: readonly number[]) {
	for (let index = 0; index < 16; index++) if (snapshot[index] !== elements[index]) return false;
	return true;
}
