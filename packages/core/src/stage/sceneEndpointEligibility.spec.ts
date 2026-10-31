import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { createSceneEndpointGuard } from './sceneEndpointEligibility.js';

function fixture() {
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	const model = new THREE.Group(), lowRoot = new THREE.Group(), frame = new THREE.Group();
	const low = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
	const high = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ transmission: 0.5, roughness: 0.2 }));
	const light = new THREE.DirectionalLight();
	const map = new THREE.DataTexture(new Uint8Array([255, 128, 0, 255]), 1, 1);
	const environment = new THREE.Texture(), highEnvironment = new THREE.Texture();
	low.material.map = map;
	frame.add(low); lowRoot.add(frame); model.add(lowRoot, high); high.visible = false;
	scene.add(model, light); scene.environment = environment;
	scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
	const options = { scene, camera, model, low, high, highEnvironment };
	const make = () => createSceneEndpointGuard(options);
	return { ...options, lowRoot, frame, light, map, environment, make };
}

test('static standard scene accepts only the known representation visibility and environment switches', () => {
	const f = fixture(), guard = f.make();
	expect(guard).toBeDefined(); expect(guard!.isValid()).toBe(true);
	f.lowRoot.visible = false; f.high.visible = true; f.scene.environment = f.highEnvironment;
	expect(guard!.isValid()).toBe(true);
	f.lowRoot.visible = true; f.high.visible = false; f.scene.environment = f.environment;
	expect(guard!.isValid()).toBe(true);
	f.low.visible = false;
	expect(guard!.isValid()).toBe(false); // Authored mesh visibility is not a representation switch.
	f.low.visible = true;
	expect(guard!.isValid()).toBe(false); // A stale capture never silently becomes valid again.
	guard!.dispose();
});

const mutations: [string, (f: ReturnType<typeof fixture>) => void][] = [
	['camera local pose before matrix update', f => { f.camera.position.x += 0.1; }],
	['projection', f => { f.camera.projectionMatrix.elements[0] += 0.1; }],
	['camera view offset', f => { f.camera.setViewOffset(1000, 800, 10, 0, 1000, 800); }],
	['model local pose', f => { f.model.quaternion.x += 0.1; }],
	['asset import matrix', f => { f.frame.matrix.elements[12] += 0.1; }],
	['light intensity without material version change', f => { f.light.intensity += 0.1; }],
	['light target', f => { f.light.target.position.y += 0.1; }],
	['scene intensity', f => { f.scene.environmentIntensity += 0.1; }],
	['unknown environment', f => { f.scene.environment = new THREE.Texture(); }],
	['new scene child', f => { f.scene.add(new THREE.AmbientLight()); }],
	['replacement geometry', f => { f.low.geometry = new THREE.BoxGeometry(); }],
	['attribute upload version', f => { f.low.geometry.attributes.position.needsUpdate = true; }],
	['added attribute', f => { f.low.geometry.setAttribute('another', new THREE.Float32BufferAttribute([0], 1)); }],
	['draw range', f => { f.low.geometry.drawRange.count = 3; }],
	['geometry group', f => { f.low.geometry.groups[0].materialIndex = 3; }],
	['material scalar without needsUpdate', f => { f.high.material.roughness += 0.1; }],
	['material color without needsUpdate', f => { f.low.material.color.r = 0.1; }],
	['material version', f => { f.low.material.needsUpdate = true; }],
	['replacement material', f => { f.low.material = new THREE.MeshStandardMaterial(); }],
	['replacement texture', f => { f.low.material.map = new THREE.Texture(); }],
	['texture version', f => { f.map.needsUpdate = true; }],
	['texture source version', f => { f.map.source.needsUpdate = true; }],
	['texture source data', f => { f.map.source.data = { width: 1, height: 1 }; }],
	['texture UV transform', f => { f.map.offset.x = 0.1; }],
	['texture filter', f => { f.map.magFilter = THREE.LinearFilter; }],
	['render callback', f => { f.low.onBeforeRender = () => {}; }],
	['shader callback', f => { f.low.material.onBeforeCompile = () => {}; }],
	['animation clip', f => { f.model.animations.push(new THREE.AnimationClip()); }],
	['material disposal', f => { f.low.material.dispose(); }],
	['geometry disposal', f => { f.low.geometry.dispose(); }],
	['texture disposal', f => { f.map.dispose(); }]
];
for (const [name, mutate] of mutations) test(`invalidates ${name}`, () => {
	const f = fixture(), guard = f.make();
	expect(guard).toBeDefined(); mutate(f); expect(guard!.isValid()).toBe(false); guard!.dispose();
});

test('guard verification does not traverse, clone, stringify or update the scene', () => {
	const f = fixture(), guard = f.make()!;
	const spies = [vi.spyOn(f.scene, 'traverse'), vi.spyOn(f.model, 'traverse'),
		vi.spyOn(f.scene, 'updateMatrixWorld'), vi.spyOn(THREE.Matrix4.prototype, 'clone'),
		vi.spyOn(JSON, 'stringify')];
	try {
		for (let i = 0; i < 30; i++) expect(guard.isValid()).toBe(true);
		for (const spy of spies) expect(spy).not.toHaveBeenCalled();
	} finally { spies.forEach(spy => spy.mockRestore()); guard.dispose(); }
});

const unsupported: [string, (f: ReturnType<typeof fixture>) => void][] = [
	['custom blending', f => { f.low.material.blending = THREE.AdditiveBlending; }],
	['ShaderMaterial', f => { f.low.material = new THREE.ShaderMaterial() as unknown as THREE.MeshStandardMaterial; }],
	['NodeMaterial', f => { f.low.material = new THREE.MeshStandardNodeMaterial() as unknown as THREE.MeshStandardMaterial; }],
	['custom program key', f => { f.low.material.customProgramCacheKey = () => 'custom'; }],
	['custom render callback', f => { f.low.onBeforeRender = () => {}; }],
	['animated scene', f => { f.model.animations.push(new THREE.AnimationClip()); }],
	['morph geometry', f => { f.low.geometry.morphAttributes.position = [f.low.geometry.attributes.position]; }],
	['dynamic buffer', f => { (f.low.geometry.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage); }],
	['skinned mesh', f => { f.scene.add(new THREE.SkinnedMesh()); }],
	['instanced mesh', f => { f.scene.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2)); }],
	['video texture', f => { Object.assign(f.map, { isVideoTexture: true }); }],
	['canvas-backed plain texture', f => { f.map.source.data = { getContext: () => {} }; }],
	['render-target material map', f => { Object.assign(f.map, { isRenderTargetTexture: true }); }],
	['texture callback', f => { f.map.onUpdate = () => {}; }],
	['shadow-casting light', f => { f.light.castShadow = true; }],
	['override material', f => { f.scene.overrideMaterial = new THREE.MeshBasicMaterial(); }]
];
for (const [name, mutate] of unsupported) test(`rejects ${name} before capturing`, () => {
	const f = fixture(); mutate(f); expect(f.make()).toBeUndefined();
});

test('guard cleanup is idempotent and removes its disposal listeners without disposing resources', () => {
	const f = fixture();
	const removed = vi.spyOn(f.map, 'removeEventListener'), disposed = vi.spyOn(f.map, 'dispose');
	const guard = f.make()!;
	guard.dispose(); guard.dispose();
	expect(removed).toHaveBeenCalledTimes(1); expect(disposed).not.toHaveBeenCalled();
	expect(guard.isValid()).toBe(false);
});

test('rejected graph removes listeners already acquired before discovering the invalid child', () => {
	const f = fixture(), removed = vi.spyOn(f.map, 'removeEventListener');
	f.scene.add(new THREE.SkinnedMesh());
	expect(f.make()).toBeUndefined(); expect(removed).toHaveBeenCalledTimes(1);
});

test('additional background and tint scenes and orthographic projection are guarded', () => {
	for (const change of ['background', 'tint', 'projection'] as const) {
		const f = fixture(), background = new THREE.Scene(), tint = new THREE.Scene();
		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const target = new THREE.RenderTarget(4, 4);
		background.background = target.texture;
		const material = new THREE.MeshBasicMaterial({ color: '#abcdef', transparent: true, opacity: 0.2 });
		tint.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
		tint.updateMatrixWorld(true); camera.updateMatrixWorld(true);
		const guard = createSceneEndpointGuard({ ...f, additionalScenes: [background, tint], additionalCameras: [camera] });
		expect(guard).toBeDefined(); expect(guard!.isValid()).toBe(true);
		if (change === 'background') background.backgroundBlurriness = 0.2;
		else if (change === 'tint') material.opacity = 0.3;
		else camera.left = -2;
		expect(guard!.isValid()).toBe(false); guard!.dispose(); target.dispose();
	}
});

const invalidRadiometry: [string, (f: ReturnType<typeof fixture>) => void][] = [
	['negative diffuse RGB', f => { f.low.material.color.r = -0.01; }],
	['nonfinite emissive RGB', f => { f.low.material.emissive.g = Infinity; }],
	['NaN light RGB', f => { f.light.color.b = NaN; }],
	['negative light intensity', f => { f.light.intensity = -1; }],
	['infinite background intensity', f => { f.scene.backgroundIntensity = Infinity; }],
	['negative environment intensity', f => { f.scene.environmentIntensity = -0.5; }],
	['negative emissive intensity', f => { f.low.material.emissiveIntensity = -1; }],
	['nonfinite environment-map intensity', f => { f.high.material.envMapIntensity = Infinity; }],
	['negative light-map intensity', f => { f.low.material.lightMapIntensity = -1; }],
	['AO weight above one', f => { f.low.material.aoMapIntensity = 1.1; }],
	['opacity above one', f => { f.low.material.opacity = 1.1; }],
	['negative transmission', f => { f.high.material.transmission = -0.01; }],
	['negative metalness', f => { f.low.material.metalness = -0.1; }],
	['roughness above one', f => { f.low.material.roughness = 1.1; }],
	['clearcoat above one', f => { f.high.material.clearcoat = 1.1; }],
	['negative clearcoat roughness', f => { f.high.material.clearcoatRoughness = -0.1; }],
	['sheen above one', f => { f.high.material.sheen = 1.1; }],
	['negative sheen roughness', f => { f.high.material.sheenRoughness = -0.1; }],
	['iridescence above one', f => { f.high.material.iridescence = 1.1; }],
	['specular intensity above one', f => { f.high.material.specularIntensity = 1.1; }],
	['arbitrary float material map', f => { f.map.type = THREE.FloatType; }],
	['arbitrary half-float material map', f => { f.map.type = THREE.HalfFloatType; }],
	['signed material map', f => { f.map.type = THREE.ByteType; }],
	['unvalidated vertex colors', f => { f.low.material.vertexColors = true; }]
];
for (const [name, change] of invalidRadiometry) test(`keeps ${name} on the live path`, () => {
	const f = fixture(); change(f); expect(f.make()).toBeUndefined();
});

test('nonnegative HDR values, physical endpoints and negative poses remain eligible', () => {
	const f = fixture();
	f.low.material.color.setRGB(4, 2, 0);
	f.low.material.emissiveIntensity = 4; f.light.intensity = 8;
	f.scene.environmentIntensity = 2; f.scene.backgroundIntensity = 0;
	f.high.material.transmission = 1; f.low.material.opacity = 0;
	f.low.material.roughness = 0; f.high.material.roughness = 1;
	f.model.position.x = -100; f.model.rotation.y = -0.5; f.model.scale.x = -1;
	f.camera.position.z = -10;
	f.scene.updateMatrixWorld(true); f.camera.updateMatrixWorld(true);
	const guard = f.make(); expect(guard).toBeDefined(); expect(guard!.isValid()).toBe(true); guard!.dispose();
});

test('prepared runtime floating environment targets stay separately eligible without reading pixels', () => {
	const f = fixture(), target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType });
	f.scene.environment = target.texture;
	const guard = f.make(); expect(guard).toBeDefined(); expect(guard!.isValid()).toBe(true);
	target.texture.needsUpdate = true; expect(guard!.isValid()).toBe(false);
	guard!.dispose(); target.dispose();
});
