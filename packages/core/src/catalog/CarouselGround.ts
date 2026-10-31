import * as THREE from 'three/webgpu';
import { CatalogDepthBlur, resolveDepthBlurRect, type BlurRect } from './CatalogDepthBlur.js';
import { isMesh } from '../stage/stageSceneUtils.js';

/** Parallel light from above/right/front, projected onto the shared y=0 receiver. */
export function carouselShadowProjection() {
	return new THREE.Matrix4().set(1, -0.65, 0, 0, 0, 0, 0, 0.4, 0, -0.55, 1, 0, 0, 0, 0, 1);
}

interface Shadow {
	model: THREE.Object3D;
	group: THREE.Group;
	meshes: { source: THREE.Mesh; shadow: THREE.Mesh }[];
	material: THREE.MeshBasicMaterial;
	opacity: number;
	/** Separate persistent render-object owners pin both numerically possible winding signs. */
	warmGroup?: THREE.Group;
	cache?: { target: THREE.RenderTarget; state?: GroundState; failed?: GroundState };
}

// Resolved color only: at most 4 MiB of RGBA16F pixels, no depth/MSAA/mipmaps.
export const MAX_GROUND_CACHE_ENTRIES = 8;
const GROUND_BLUR_RADIUS = 2.5;
type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
type AttributeState = { value: Attribute; version: number };
interface GroundState {
	key: string; width: number; height: number; rect: BlurRect;
	view: THREE.Matrix4; projection: THREE.Matrix4; coordinateSystem: THREE.CoordinateSystem;
	meshes: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4; visible: boolean;
		attributes: Record<string, AttributeState>; attributeCount: number; index: AttributeState | undefined;
		start: number; count: number; groups: { start: number; count: number; materialIndex?: number }[] }[];
}
const attributeVersion = (attribute: Attribute) => 'data' in attribute ? attribute.data.version : attribute.version;
const attributeState = (value: Attribute): AttributeState => ({ value, version: attributeVersion(value) });
const sameAttribute = (value: Attribute | null | undefined, state?: AttributeState) =>
	value ? value === state?.value && attributeVersion(value) === state.version : !state;
const hasUntrackedDeformation = (mesh: THREE.Mesh) => Boolean(
	(mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh ||
	(mesh.geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry);

/** Actual mesh silhouettes on one floor; no tinted receiver or generic shadow decals. */
export class CarouselGround {
	private readonly scene = new THREE.Scene();
	private readonly blur = new CatalogDepthBlur();
	private readonly shadows = new Map<object, Shadow>();
	private readonly seen = new Set<object>();
	private cacheDraws = 0;
	private liveDraws = 0;
	private cachePreparations = 0;
	getRenderTargets() { return [...this.blur.getRenderTargets(),
		...[...this.shadows.values()].flatMap(entry => entry.cache ? [entry.cache.target] : [])]; }
	beginFrame() { this.seen.clear(); }
	shadow(key: object, model: THREE.Object3D, floor: THREE.Matrix4, opacity: number) {
		this.seen.add(key);
		let entry = this.shadows.get(key);
		if (entry && entry.model !== model) { this.release(entry); this.shadows.delete(key); entry = undefined; }
		if (!entry) {
			// Replace pixels in the scratch target: overlapping triangles form one silhouette.
			const material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true,
				blending: THREE.NoBlending, depthWrite: false, depthTest: false,
				toneMapped: false, side: THREE.DoubleSide });
			const group = new THREE.Group();
			entry = { model, group, meshes: [], material, opacity };
			model.traverseVisible(source => {
				if (!isMesh(source)) return;
				const shadow = source.clone(false);
				shadow.material = material;
				shadow.matrixAutoUpdate = false;
				shadow.frustumCulled = false;
				group.add(shadow);
				entry!.meshes.push({ source, shadow });
			});
			this.shadows.set(key, entry);
			this.scene.add(group);
		}
		entry.opacity = opacity;
		const projection = floor.clone().multiply(carouselShadowProjection()).multiply(floor.clone().invert());
		for (const { source, shadow } of entry.meshes) {
			shadow.matrix.copy(projection).multiply(source.matrixWorld);
			shadow.matrixWorldNeedsUpdate = true;
			shadow.visible = source.visible;
		}
		entry.group.visible = false;
	}
	endFrame() {
		for (const [key, entry] of this.shadows) if (!this.seen.has(key)) {
			this.release(entry);
			this.shadows.delete(key);
		}
	}
	/** The projected shadow is singular, so floating-point recomputation can flip its
	 * determinant sign. Pin both Three winding keys while idle. Mutating the live
	 * mesh twice is insufficient: Three may release its previous pipeline owner.
	 */
	prepareWindingVariants(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera) {
		if (!this.shadows.size) return;
		for (const entry of this.shadows.values()) {
			if (entry.warmGroup) continue;
			const group = new THREE.Group();
			group.visible = false;
			for (const { shadow } of entry.meshes) for (const sign of [1, -1]) {
				const owner = shadow.clone(false);
				// Same geometry/material/attribute layout, but a robust determinant sign.
				// These owners only draw in the existing offscreen DepthBlur capture.
				owner.matrix.makeScale(sign, 1, 1);
				owner.matrixWorldNeedsUpdate = true;
				owner.visible = true;
				group.add(owner);
			}
			entry.warmGroup = group;
			this.scene.add(group);
		}
		const visibility = this.scene.children.map(child => child.visible);
		try {
			this.scene.children.forEach(child => { child.visible = false; });
			for (const entry of this.shadows.values()) entry.warmGroup!.visible = true;
			this.blur.prepareCapture(renderer, camera, projection => renderer.render(this.scene, projection));
		} finally {
			this.scene.children.forEach((child, index) => { child.visible = visibility[index]; });
		}
	}
	private cacheCandidates(camera: THREE.PerspectiveCamera) {
		const result: { entry: Shadow; rect: BlurRect }[] = [];
		for (const entry of this.shadows.values()) {
			if (result.length === MAX_GROUND_CACHE_ENTRIES) break;
			if (entry.opacity <= 0.001 || entry.meshes.some(({ shadow }) =>
				hasUntrackedDeformation(shadow) || Object.values(shadow.geometry.morphAttributes).some(values => values.length))) continue;
			const bounds = this.bounds(entry, camera);
			const rect = bounds && resolveDepthBlurRect(bounds, GROUND_BLUR_RADIUS);
			if (rect) result.push({ entry, rect });
		}
		return result;
	}
	needsCachePreparation(camera: THREE.PerspectiveCamera, key = '') {
		return this.cacheCandidates(camera).some(({ entry }) =>
			!this.matches(entry, camera, key, entry.cache?.state) && !this.matches(entry, camera, key, entry.cache?.failed));
	}
	/** Idle-only. No missing/stale cache is ever filled by draw() or source freeze. */
	prepareCaches(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera, key = '') {
		const candidates = this.cacheCandidates(camera), retained = new Set(candidates.map(({ entry }) => entry));
		// Release first, so changing the visible set cannot temporarily exceed the bound.
		for (const entry of this.shadows.values()) if (entry.cache && !retained.has(entry)) {
			entry.cache.target.dispose(); entry.cache = undefined;
		}
		for (const { entry, rect } of candidates) {
			if (this.matches(entry, camera, key, entry.cache?.state) || this.matches(entry, camera, key, entry.cache?.failed)) continue;
			entry.cache ??= { target: new THREE.RenderTarget(256, 256, {
				type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, samples: 0
			}) };
			const cache = entry.cache, opacity = entry.material.opacity, visible = entry.group.visible;
			const state = this.captureState(entry, camera, rect, key);
			cache.state = undefined; cache.failed = undefined;
			try {
				entry.material.opacity = 1; entry.group.visible = true;
				this.blur.prepareResolved(renderer, camera, rect, GROUND_BLUR_RADIUS, cache.target,
					projection => renderer.render(this.scene, projection));
				cache.state = state; this.cachePreparations++;
			} catch {
				// Optional cache failure retains the existing live draw and does not loop at idle.
				cache.failed = state;
			} finally { entry.material.opacity = opacity; entry.group.visible = visible; }
		}
	}
	private captureState(entry: Shadow, camera: THREE.PerspectiveCamera, rect: BlurRect, key: string): GroundState {
		return { key, width: innerWidth, height: innerHeight, rect,
			view: camera.matrixWorld.clone(), projection: camera.projectionMatrix.clone(), coordinateSystem: camera.coordinateSystem,
			meshes: entry.meshes.map(({ shadow }) => {
				const geometry = shadow.geometry;
				return { geometry, matrix: shadow.matrix.clone(), visible: shadow.visible,
					attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, attributeState(attribute)])),
					attributeCount: Object.keys(geometry.attributes).length, index: geometry.index ? attributeState(geometry.index) : undefined,
					start: geometry.drawRange.start, count: geometry.drawRange.count, groups: geometry.groups.map(group => ({ ...group })) };
			}) };
	}
	private matches(entry: Shadow, camera: THREE.PerspectiveCamera, key: string, state?: GroundState) {
		if (!state || state.key !== key || state.width !== innerWidth || state.height !== innerHeight ||
			state.coordinateSystem !== camera.coordinateSystem || !state.view.equals(camera.matrixWorld) ||
			!state.projection.equals(camera.projectionMatrix) || state.meshes.length !== entry.meshes.length) return false;
		for (let index = 0; index < state.meshes.length; index++) {
			const { shadow } = entry.meshes[index], snapshot = state.meshes[index], geometry = shadow.geometry;
			if (snapshot.geometry !== geometry || snapshot.visible !== shadow.visible || !snapshot.matrix.equals(shadow.matrix) ||
				!sameAttribute(geometry.index, snapshot.index) || snapshot.start !== geometry.drawRange.start ||
				snapshot.count !== geometry.drawRange.count || snapshot.groups.length !== geometry.groups.length ||
				hasUntrackedDeformation(shadow)) return false;
			for (const name in geometry.morphAttributes)
				if (geometry.morphAttributes[name as keyof typeof geometry.morphAttributes]?.length) return false;
			let attributes = 0;
			for (const name in geometry.attributes) {
				attributes++;
				if (!sameAttribute(geometry.attributes[name], snapshot.attributes[name])) return false;
			}
			if (attributes !== snapshot.attributeCount) return false;
			for (let group = 0; group < snapshot.groups.length; group++) {
				const a = geometry.groups[group], b = snapshot.groups[group];
				if (a.start !== b.start || a.count !== b.count || a.materialIndex !== b.materialIndex) return false;
			}
		}
		return true;
	}
	private bounds(entry: Shadow, camera: THREE.PerspectiveCamera): BlurRect | undefined {
		let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
		const point = new THREE.Vector3();
		for (const { shadow } of entry.meshes) {
			if (!shadow.visible) continue;
			if (!shadow.geometry.boundingBox) shadow.geometry.computeBoundingBox();
			const box = shadow.geometry.boundingBox!;
			for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
				for (const z of [box.min.z, box.max.z]) {
					point.set(x, y, z).applyMatrix4(shadow.matrix).project(camera);
					const px = (point.x + 1) * innerWidth / 2, py = (1 - point.y) * innerHeight / 2;
					left = Math.min(left, px); right = Math.max(right, px);
					top = Math.min(top, py); bottom = Math.max(bottom, py);
				}
		}
		return Number.isFinite(left) ? { left, top, width: right - left, height: bottom - top } : undefined;
	}
	draw(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera, opacity = 1, useCache = false, key = '', preparing = false) {
		for (const entry of this.shadows.values()) {
			entry.material.opacity = entry.opacity * opacity;
			if (entry.material.opacity <= 0.001) continue;
			if (useCache && this.matches(entry, camera, key, entry.cache?.state) &&
				this.blur.drawResolved(renderer, entry.cache!.target.texture, entry.cache!.state!.rect, entry.material.opacity, preparing)) {
				this.cacheDraws++; continue;
			}
			const bounds = this.bounds(entry, camera);
			if (!bounds) continue;
			entry.group.visible = true;
			try {
				this.blur.render(renderer, camera, bounds, GROUND_BLUR_RADIUS,
					projection => renderer.render(this.scene, projection), undefined, preparing);
				this.liveDraws++;
			} finally { entry.group.visible = false; }
		}
	}
	getStats() { return { silhouettes: this.shadows.size, cacheDraws: this.cacheDraws, liveDraws: this.liveDraws,
		cachePreparations: this.cachePreparations, cachedSilhouettes: [...this.shadows.values()].filter(entry => entry.cache?.state).length }; }
	private release(entry: Shadow) {
		entry.group.removeFromParent();
		entry.warmGroup?.removeFromParent();
		entry.cache?.target.dispose();
		// Disposing this shared owned material also releases Three's warm render objects.
		entry.material.dispose();
		// Geometry belongs to the asset manager and is shared, never disposed here.
	}
	dispose() {
		this.seen.clear(); this.endFrame(); this.blur.dispose();
	}
}
