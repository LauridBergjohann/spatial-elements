import * as THREE from 'three/webgpu';

/** A shared, horizon-free floor and soft contact patches in the carousel camera space. */
export class CarouselGround {
	private readonly scene = new THREE.Scene();
	private readonly geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	private readonly texture: THREE.DataTexture;
	private readonly patches = new Map<object, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
	private readonly seen = new Set<object>();
	constructor() {
		const size = 64, data = new Uint8Array(size * size * 4);
		for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
			const r = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
			const alpha = Math.max(0, 1 - r * r) ** 3;
			const offset = (y * size + x) * 4;
			data[offset] = data[offset + 1] = data[offset + 2] = 255;
			data[offset + 3] = Math.round(alpha * 255);
		}
		this.texture = new THREE.DataTexture(data, size, size);
		this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
		this.texture.needsUpdate = true;
	}
	beginFrame() { this.seen.clear(); }
	patch(key: object, matrix: THREE.Matrix4, width: number, depth: number, opacity: number) {
		this.seen.add(key);
		let patch = this.patches.get(key);
		if (!patch) {
			patch = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({
				map: this.texture, color: 0x475569, transparent: true,
				depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide
			}));
			patch.matrixAutoUpdate = false;
			this.patches.set(key, patch);
			this.scene.add(patch);
		}
		patch.matrix.copy(matrix).scale(new THREE.Vector3(width, 1, depth));
		patch.matrixWorldNeedsUpdate = true;
		patch.material.opacity = opacity;
		patch.userData.opacity = opacity;
		patch.visible = opacity > 0.001;
	}
	endFrame() {
		for (const [key, patch] of this.patches) if (!this.seen.has(key)) {
			patch.removeFromParent();
			patch.material.dispose();
			this.patches.delete(key);
		}
	}
	draw(renderer: THREE.WebGPURenderer, camera: THREE.Camera, opacity = 1) {
		for (const patch of this.patches.values()) patch.material.opacity = patch.userData.opacity * opacity;
		if (this.patches.size) renderer.render(this.scene, camera);
	}
	getStats() { return { patches: this.patches.size }; }
	dispose() {
		this.seen.clear();
		this.endFrame();
		this.geometry.dispose();
		this.texture.dispose();
	}
}
