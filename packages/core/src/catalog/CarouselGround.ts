import * as THREE from 'three/webgpu';
import { CatalogDepthBlur } from './CatalogDepthBlur.js';
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
}

/** Actual mesh silhouettes on one floor; no tinted receiver or generic shadow decals. */
export class CarouselGround {
	private readonly scene = new THREE.Scene();
	private readonly blur = new CatalogDepthBlur();
	private readonly shadows = new Map<object, Shadow>();
	private readonly seen = new Set<object>();
	getRenderTargets() { return this.blur.getRenderTargets(); }
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
	draw(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera, opacity = 1) {
		for (const entry of this.shadows.values()) {
			entry.material.opacity = entry.opacity * opacity;
			if (entry.material.opacity <= 0.001) continue;
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
			if (!Number.isFinite(left)) continue;
			entry.group.visible = true;
			try {
				this.blur.render(renderer, camera, { left, top, width: right - left, height: bottom - top },
					2.5, projection => renderer.render(this.scene, projection));
			} finally { entry.group.visible = false; }
		}
	}
	getStats() { return { silhouettes: this.shadows.size }; }
	private release(entry: Shadow) {
		entry.group.removeFromParent();
		entry.material.dispose();
		// Geometry belongs to the asset manager and is shared, never disposed here.
	}
	dispose() {
		this.seen.clear(); this.endFrame(); this.blur.dispose();
	}
}
