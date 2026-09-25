import * as THREE from 'three/webgpu';
import {
	getProductHandoffProjection,
	interpolatePose,
	normalizeProductClipMatrix
} from './CatalogProductLayer.js';
import type { ProductRefinement } from '../stage/ProductRefinement.js';

export interface ProductProjection {
	/** Visible section rectangle in CSS pixels, copied before its DOM owner unmounts. */
	viewportClip?: { left: number; top: number; width: number; height: number };
	environmentIntensity?: number;
	/** Preserve the catalog depth cue while a rear product travels between render owners. */
	fog?: THREE.Fog | THREE.FogExp2 | null;
	model: THREE.Matrix4;
	camera: THREE.Matrix4;
	clip: THREE.Matrix4;
}

export function captureProductProjection(
	model: THREE.Object3D,
	camera: THREE.PerspectiveCamera
): ProductProjection {
	model.updateWorldMatrix(true, true);
	camera.updateMatrixWorld();
	return {
		model: model.matrixWorld.clone(),
		camera: camera.matrixWorld.clone(),
		clip: normalizeProductClipMatrix(
			new THREE.Matrix4()
				.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
				.multiply(model.matrixWorld),
			new THREE.Vector3()
		)
	};
}

/** A renderer-owned product with copied projection and independently retained asset resources. */
export class SpatialGeometryCapture {
	getRenderTargets() {
		return this.disposed ? [] : (this.options.blend?.getRenderTargets() ?? []);
	}
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera();
	private target?: ProductProjection;
	private submitted?: ProductProjection;
	private disposed = false;
	private progress = 0;
	private highWeight: number;
	private initialHighWeight: number;
	private frames = 0;
	private sourceEnvironmentIntensity: number;

	constructor(
		readonly model: THREE.Object3D,
		private source: ProductProjection,
		options: {
			environment: THREE.Texture | null;
			environmentIntensity?: number;
			highEnvironment?: THREE.Texture;
			referencePoint?: THREE.Vector3;
			lights: THREE.Light[];
			high?: THREE.Object3D;
			highWeight?: number;
			blend?: ProductRefinement;
			release(): boolean | void;
		}
	) {
		this.options = options;
		this.initialHighWeight = this.highWeight = options.highWeight ?? 0;
		this.scene.environment = options.environment;
		this.sourceEnvironmentIntensity = this.scene.environmentIntensity =
			options.environmentIntensity ?? 0.5;
		for (const light of options.lights) this.scene.add(light.clone());
		this.scene.add(model);
		model.matrixAutoUpdate = false;
		model.matrix.copy(source.model);
	}
	private readonly options: {
		environment: THREE.Texture | null;
		environmentIntensity?: number;
		highEnvironment?: THREE.Texture;
		referencePoint?: THREE.Vector3;
		lights: THREE.Light[];
		high?: THREE.Object3D;
		highWeight?: number;
		blend?: ProductRefinement;
		release(): boolean | void;
	};

	setTarget(target: ProductProjection, progress: number, refinement: number) {
		this.target = target;
		this.progress = progress;
		this.highWeight = this.initialHighWeight * (1 - refinement);
	}

	/** Rebase on the exact submitted projection, without a camera or model reset. */
	freeze() {
		this.sourceEnvironmentIntensity = this.scene.environmentIntensity;
		if (this.submitted) this.source = this.submitted;
		this.target = undefined;
		this.progress = 0;
		this.initialHighWeight = this.highWeight;
	}

	render(renderer: THREE.WebGPURenderer) {
		if (this.disposed) return;
		const target = this.target ?? this.source;
		this.scene.fog = target.fog ?? this.source.fog ?? null;
		this.scene.environmentIntensity = THREE.MathUtils.lerp(
			this.sourceEnvironmentIntensity,
			target.environmentIntensity ?? this.sourceEnvironmentIntensity,
			this.progress
		);
		const model = interpolatePose(this.source.model, target.model, this.progress);
		const camera = interpolatePose(this.source.camera, target.camera, this.progress);
		this.model.matrix.copy(model);
		this.model.matrixWorldNeedsUpdate = true;
		this.camera.coordinateSystem = renderer.coordinateSystem;
		camera.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
		this.camera.updateMatrixWorld();
		getProductHandoffProjection(
			this.source.clip,
			target.clip,
			this.progress,
			model,
			camera,
			{
				sourceModel: this.source.model,
				sourceCamera: this.source.camera,
				targetModel: target.model,
				targetCamera: target.camera,
				reference: this.options.referencePoint
			},
			this.camera.projectionMatrix
		);
		this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
		const viewport = { left: 0, top: 0, width: innerWidth, height: innerHeight };
		const from = this.source.viewportClip ?? viewport,
			to = target.viewportClip ?? viewport;
		const clip = { ...from };
		for (const key of ['left', 'top', 'width', 'height'] as const)
			clip[key] += (to[key] - from[key]) * this.progress;
		const previousScissor = renderer.getScissor(new THREE.Vector4());
		const previousTest = renderer.getScissorTest();
		const left = Math.max(0, clip.left),
			top = Math.max(0, clip.top);
		renderer.setScissor(
			left,
			top,
			Math.max(0, Math.min(innerWidth, clip.left + clip.width) - left),
			Math.max(0, Math.min(innerHeight, clip.top + clip.height) - top)
		);
		renderer.setScissorTest(true);
		try {
			const children = [...this.model.children];
			const draw = (high: boolean) => {
				this.scene.environment = high
					? (this.options.highEnvironment ?? this.options.environment)
					: this.options.environment;
				for (const child of children) child.visible = (child === this.options.high) === high;
				renderer.clear();
				renderer.render(this.scene, this.camera);
			};
			renderer.clearDepth();
			if (this.options.high && this.options.blend && this.highWeight > 0 && this.highWeight < 1)
				this.options.blend.render(renderer, draw, false, this.highWeight);
			else {
				this.scene.environment =
					this.highWeight >= 1
						? (this.options.highEnvironment ?? this.options.environment)
						: this.options.environment;
				for (const child of children)
					child.visible =
						this.highWeight >= 1 ? child === this.options.high : child !== this.options.high;
				renderer.render(this.scene, this.camera);
			}
			this.submitted = captureProductProjection(this.model, this.camera);
			this.submitted.fog = this.scene.fog;
			this.submitted.viewportClip = clip;
			this.frames++;
		} finally {
			renderer.setScissor(previousScissor);
			renderer.setScissorTest(previousTest);
		}
	}

	getSnapshot() {
		return {
			frames: this.frames,
			progress: this.progress,
			highWeight: this.highWeight,
			projection: (this.submitted ?? this.source).clip.toArray(),
			disposed: this.disposed
		};
	}

	getPoint() {
		const point = this.options.referencePoint ?? new THREE.Vector3();
		const clip = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(
			(this.submitted ?? this.source).clip
		);
		return {
			x: ((clip.x / clip.w + 1) * innerWidth) / 2,
			y: ((1 - clip.y / clip.w) * innerHeight) / 2
		};
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.model.removeFromParent();
		// Returning false hands the prepared blend back to its still-live page owner.
		let retained = false;
		try {
			retained = this.options.release() === false;
		} finally {
			if (!retained) this.options.blend?.dispose();
		}
	}
}
