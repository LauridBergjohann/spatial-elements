import * as THREE from 'three/webgpu';

export interface SceneEndpointGuard {
	/** Checks recorded values only: no scene traversal, matrix update or allocation. */
	isValid(): boolean;
	dispose(): void;
}

/** A narrow, static standard-material scene. Stage owns binding/size/input eligibility;
 * Refinement owns target-write epochs and must recheck them after its GPU fence.
 */
export function createSceneEndpointGuard(options: {
	scene: THREE.Scene;
	camera: THREE.Camera;
	model: THREE.Object3D;
	low: THREE.Object3D;
	high: THREE.Object3D;
	highEnvironment?: THREE.Texture;
	additionalScenes?: readonly THREE.Scene[];
	additionalCameras?: readonly THREE.Camera[];
}): SceneEndpointGuard | undefined {
	const checks: (() => boolean)[] = [], cleanup: (() => void)[] = [];
	const nodes = new Set<THREE.Object3D>(), resources = new Set<object>();
	let lowRoot = options.low;
	while (lowRoot.parent && lowRoot.parent !== options.model) lowRoot = lowRoot.parent;
	let eligible = true, invalid = false, disposed = false;
	const reject = () => { eligible = false; };
	const invalidate = () => { invalid = true; };
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		for (const release of cleanup) release();
		cleanup.length = 0;
	};
	function watch(resource: THREE.Material | THREE.Texture | THREE.BufferGeometry) {
		resource.addEventListener('dispose', invalidate);
		cleanup.push(() => resource.removeEventListener('dispose', invalidate));
	}
	function scalar(read: () => unknown) {
		const value = read();
		if (typeof value === 'number' && !Number.isFinite(value) && value !== Infinity) reject();
		checks.push(() => read() === value);
	}
	function sequence<T>(read: () => readonly T[]) {
		const values = [...read()];
		checks.push(() => {
			const current = read();
			if (current.length !== values.length) return false;
			for (let i = 0; i < values.length; i++) if (current[i] !== values[i]) return false;
			return true;
		});
	}
	function keys(object: Record<string, unknown>, ignored = new Set<string>()) {
		const names = Object.keys(object).filter(name => !ignored.has(name));
		const expected = new Set(names);
		checks.push(() => {
			let count = 0;
			for (const name in object) if (Object.hasOwn(object, name) && !ignored.has(name)) {
				if (!expected.has(name)) return false;
				count++;
			}
			return count === names.length;
		});
		return names;
	}
	function value(read: () => unknown, environmentTexture = false) {
		const original = read();
		if (original === null || typeof original !== 'object') {
			if (typeof original === 'function') reject();
			else scalar(read);
			return;
		}
		checks.push(() => read() === original);
		if (original instanceof THREE.Texture) { texture(original, environmentTexture); return; }
		if (original instanceof THREE.Color) {
			const copy = original.clone(); checks.push(() => original.equals(copy)); return;
		}
		if (original instanceof THREE.Vector2 || original instanceof THREE.Vector3 || original instanceof THREE.Vector4 ||
			original instanceof THREE.Quaternion || original instanceof THREE.Euler || original instanceof THREE.Matrix3 ||
			original instanceof THREE.Matrix4 || original instanceof THREE.Plane || original instanceof THREE.Box3 || original instanceof THREE.Sphere) {
			const copy = original.clone();
			checks.push(() => original.equals(copy as never)); return;
		}
		if (Array.isArray(original)) {
			sequence(() => original);
			for (let i = 0; i < original.length; i++) value(() => original[i]);
			return;
		}
		if (Object.getPrototypeOf(original) !== Object.prototype && Object.getPrototypeOf(original) !== null) { reject(); return; }
		const record = original as Record<string, unknown>;
		for (const name of keys(record)) value(() => record[name]);
	}
	function texture(resource: THREE.Texture, environment = false) {
		const dynamic = resource as THREE.Texture & { isVideoTexture?: boolean; isVideoFrameTexture?: boolean;
			isCanvasTexture?: boolean; isFramebufferTexture?: boolean; isDepthTexture?: boolean; isRenderTargetTexture?: boolean };
		const image = resource.source?.data;
		const changingImage = (data: unknown): boolean => Boolean(data && typeof data === 'object' &&
			('getContext' in data || 'requestVideoFrameCallback' in data ||
			('tagName' in data && /^(VIDEO|CANVAS)$/i.test(String(data.tagName)))));
		if (dynamic.isVideoTexture || dynamic.isVideoFrameTexture || dynamic.isCanvasTexture || dynamic.isFramebufferTexture ||
			dynamic.isDepthTexture || (dynamic.isRenderTargetTexture && !environment) || resource.onUpdate ||
			changingImage(image) || (Array.isArray(image) && image.some(changingImage))) { reject(); return; }
		if (resources.has(resource)) return;
		resources.add(resource); watch(resource);
		for (const name of ['version', 'mapping', 'channel', 'wrapS', 'wrapT', 'wrapR', 'magFilter', 'minFilter',
			'anisotropy', 'format', 'internalFormat', 'type', 'colorSpace', 'generateMipmaps', 'premultiplyAlpha',
			'flipY', 'unpackAlignment', 'compareFunction', 'rotation', 'matrixAutoUpdate', 'onUpdate'] as const) {
			const record = resource as unknown as Record<string, unknown>; scalar(() => record[name]);
		}
		value(() => resource.offset); value(() => resource.repeat); value(() => resource.center); value(() => resource.matrix);
		scalar(() => resource.source); scalar(() => resource.source.version); scalar(() => resource.source.data);
		if (Array.isArray(image)) sequence(() => resource.source.data as unknown[]);
		for (const data of Array.isArray(image) ? image : [image]) if (data && typeof data === 'object') {
			for (const name of ['width', 'height', 'depth', 'data']) scalar(() => data[name]);
		}
	}
	function material(resource: THREE.Material) {
		if (![THREE.MeshBasicMaterial, THREE.MeshStandardMaterial, THREE.MeshPhysicalMaterial].some(Type => resource.constructor === Type) ||
			(resource.blending !== THREE.NormalBlending && resource.blending !== THREE.NoBlending) ||
			resource.onBeforeRender !== THREE.Material.prototype.onBeforeRender ||
			resource.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
			resource.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) { reject(); return; }
		if (resources.has(resource)) return;
		resources.add(resource); watch(resource);
		scalar(() => resource.constructor);
		const record = resource as unknown as Record<string, unknown>;
		for (const name of keys(record, new Set(['_listeners', 'userData']))) value(() => record[name]);
		checks.push(() => resource.onBeforeRender === THREE.Material.prototype.onBeforeRender &&
			resource.onBeforeCompile === THREE.Material.prototype.onBeforeCompile &&
			resource.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey);
	}
	function attribute(resource: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null) {
		if (!resource) return;
		if (!(resource instanceof THREE.BufferAttribute) && !(resource instanceof THREE.InterleavedBufferAttribute)) { reject(); return; }
		const data = resource instanceof THREE.InterleavedBufferAttribute ? resource.data : resource;
		if (data.usage !== THREE.StaticDrawUsage) { reject(); return; }
		for (const name of ['version', 'array', 'count', 'usage', 'stride'] as const) {
			const record = data as unknown as Record<string, unknown>; scalar(() => record[name]);
		}
		for (const name of ['itemSize', 'normalized', 'offset', 'gpuType', 'data'] as const) {
			const record = resource as unknown as Record<string, unknown>; scalar(() => record[name]);
		}
	}
	function geometry(resource: THREE.BufferGeometry) {
		if (resources.has(resource)) return;
		resources.add(resource); watch(resource);
		if ((resource as THREE.InstancedBufferGeometry).isInstancedBufferGeometry || Object.keys(resource.morphAttributes).length) reject();
		scalar(() => resource.index); attribute(resource.index);
		scalar(() => resource.attributes);
		for (const name of keys(resource.attributes)) {
			scalar(() => resource.attributes[name]); attribute(resource.attributes[name]);
		}
		checks.push(() => { for (const _name in resource.morphAttributes) return false; return true; });
		value(() => resource.drawRange); value(() => resource.groups);
		value(() => resource.boundingBox); value(() => resource.boundingSphere);
	}
	function node(object: THREE.Object3D) {
		if (nodes.has(object)) return;
		nodes.add(object);
		const supported = [THREE.Scene, THREE.Group, THREE.Object3D, THREE.Mesh, THREE.PerspectiveCamera, THREE.OrthographicCamera,
			THREE.AmbientLight, THREE.HemisphereLight, THREE.DirectionalLight, THREE.PointLight, THREE.SpotLight, THREE.RectAreaLight];
		if (!supported.some(Type => object.constructor === Type) || object.animations.length || object.castShadow ||
			object.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || object.onAfterRender !== THREE.Object3D.prototype.onAfterRender ||
			object.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow || object.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow) { reject(); return; }
		checks.push(() => object.animations.length === 0 && object.onBeforeRender === THREE.Object3D.prototype.onBeforeRender &&
			object.onAfterRender === THREE.Object3D.prototype.onAfterRender && object.onBeforeShadow === THREE.Object3D.prototype.onBeforeShadow &&
			object.onAfterShadow === THREE.Object3D.prototype.onAfterShadow);
		scalar(() => object.constructor);
		if (object !== lowRoot && object !== options.high) scalar(() => object.visible);
		for (const name of ['parent', 'matrixAutoUpdate', 'matrixWorldAutoUpdate', 'frustumCulled', 'renderOrder', 'castShadow', 'receiveShadow'] as const)
			scalar(() => object[name]);
		scalar(() => object.layers.mask);
		value(() => object.position); value(() => object.quaternion); value(() => object.rotation); value(() => object.scale);
		value(() => object.matrix); value(() => object.matrixWorld);
		sequence(() => object.children);
		if (object instanceof THREE.Mesh) {
			if (object.morphTargetInfluences?.length) reject();
			scalar(() => object.morphTargetInfluences);
			scalar(() => object.geometry); geometry(object.geometry);
			scalar(() => object.material);
			if (Array.isArray(object.material)) { sequence(() => object.material as THREE.Material[]); object.material.forEach(material); }
			else material(object.material);
		}
		if (object instanceof THREE.Light) {
			const light = object as unknown as Record<string, unknown>;
			for (const name of ['color', 'groundColor', 'intensity', 'distance', 'decay', 'angle', 'penumbra', 'width', 'height']) value(() => light[name]);
			if ('target' in object) { scalar(() => object.target); node(object.target as THREE.Object3D); }
		}
		for (const child of object.children) node(child);
	}
	function cameraSnapshot(camera: THREE.Camera) {
		node(camera);
		if (camera.constructor !== THREE.PerspectiveCamera && camera.constructor !== THREE.OrthographicCamera) reject();
		value(() => camera.projectionMatrix); value(() => camera.projectionMatrixInverse);
		value(() => camera.matrixWorldInverse);
		const record = camera as unknown as Record<string, unknown>;
		for (const name of ['near', 'far', 'fov', 'aspect', 'zoom', 'focus', 'filmGauge', 'filmOffset', 'coordinateSystem', 'view',
			'left', 'right', 'top', 'bottom']) value(() => record[name]);
	}
	function sceneSnapshot(scene: THREE.Scene, allowHigh = false) {
		node(scene);
		if (scene.overrideMaterial !== null) reject();
		const lowEnvironment = scene.environment, highEnvironment = allowHigh ? options.highEnvironment : undefined;
		checks.push(() => scene.environment === lowEnvironment || Boolean(highEnvironment && scene.environment === highEnvironment));
		if (lowEnvironment) texture(lowEnvironment, true);
		if (highEnvironment) texture(highEnvironment, true);
		// Prepared environment targets are stable renderer-owned resources; arbitrary
		// render-target material maps remain ineligible above.
		value(() => scene.background, true);
		for (const name of ['backgroundBlurriness', 'backgroundIntensity', 'backgroundRotation',
			'environmentIntensity', 'environmentRotation', 'overrideMaterial'] as const) value(() => scene[name]);
		const fog = scene.fog;
		scalar(() => scene.fog);
		if (fog) {
			if (fog.constructor !== THREE.Fog && fog.constructor !== THREE.FogExp2) reject();
			value(() => fog.color);
			for (const name of ['near', 'far', 'density']) scalar(() => (fog as unknown as Record<string, unknown>)[name]);
		}
	}
	try {
		if (lowRoot === options.high || lowRoot.parent !== options.model || options.high.parent !== options.model || options.model.children.length !== 2 ||
			options.scene.overrideMaterial !== null) reject();
		sceneSnapshot(options.scene, true); cameraSnapshot(options.camera); node(options.model);
		if (!nodes.has(options.low) || !nodes.has(options.high)) reject();
		if (options.camera.constructor !== THREE.PerspectiveCamera) reject();
		if (options.additionalScenes) { sequence(() => options.additionalScenes!); for (const scene of options.additionalScenes) sceneSnapshot(scene); }
		if (options.additionalCameras) { sequence(() => options.additionalCameras!); for (const camera of options.additionalCameras) cameraSnapshot(camera); }
	} catch { eligible = false; }
	if (!eligible) { dispose(); return; }
	return { isValid() {
		if (disposed || invalid) return false;
		try {
			for (const check of checks) if (!check()) { invalid = true; return false; }
			return true;
		} catch { invalid = true; return false; }
	}, dispose };
}
