import * as THREE from 'three/webgpu';
import { dampAndSnap } from './damping.js';

const MAX_ANGLE = THREE.MathUtils.degToRad(2.5);
/** A finite introductory orbit, never a second animation loop or an idle animation. */
export class ModelPointerPreview {
	private readonly basePosition = new THREE.Vector3();
	private readonly baseTarget = new THREE.Vector3();
	private readonly projectionCamera = new THREE.PerspectiveCamera();
	private readonly point = new THREE.Vector3();
	private readonly offset = new THREE.Vector3();
	private readonly spherical = new THREE.Spherical();
	private ready = false;
	private x = 0;
	private y = 0;
	private targetX = 0;
	private targetY = 0;
	capture(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
		this.basePosition.copy(camera.position);
		this.baseTarget.copy(target);
		this.x = this.y = this.targetX = this.targetY = 0;
		this.ready = true;
	}
	/** Leave the visible pose intact when the user takes over. */
	forget() { this.ready = false; this.x = this.y = this.targetX = this.targetY = 0; }
	clear() { this.targetX = this.targetY = 0; }
	pointAt(x: number, y: number, camera: THREE.PerspectiveCamera, bounds: THREE.Box3, width: number, height: number) {
		if (!this.ready || bounds.isEmpty()) return;
		// Project the unmodified pose so the response cannot chase its own moving silhouette.
		this.projectionCamera.copy(camera);
		this.projectionCamera.position.copy(this.basePosition);
		this.projectionCamera.lookAt(this.baseTarget);
		this.projectionCamera.updateMatrixWorld(true);
		let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
		for (let corner = 0; corner < 8; corner++) {
			this.point.set(corner & 1 ? bounds.max.x : bounds.min.x, corner & 2 ? bounds.max.y : bounds.min.y, corner & 4 ? bounds.max.z : bounds.min.z).project(this.projectionCamera);
			const px = (this.point.x + 1) * width / 2, py = (1 - this.point.y) * height / 2;
			left = Math.min(left, px); right = Math.max(right, px);
			top = Math.min(top, py); bottom = Math.max(bottom, py);
		}
		const halfWidth = Math.max(24, (right - left) / 2), halfHeight = Math.max(24, (bottom - top) / 2);
		const dx = x - (left + right) / 2, dy = y - (top + bottom) / 2;
		const distance = Math.hypot(Math.max(0, Math.abs(dx) - halfWidth), Math.max(0, Math.abs(dy) - halfHeight));
		const influence = Math.max(0, 1 - distance / 100);
		this.targetX = MAX_ANGLE * THREE.MathUtils.clamp(dx / halfWidth, -1, 1) * influence;
		this.targetY = MAX_ANGLE * THREE.MathUtils.clamp(dy / halfHeight, -1, 1) * influence;
	}
	advance(camera: THREE.PerspectiveCamera, delta: number, reducedMotion = false) {
		if (!this.ready) return false;
		if (reducedMotion) this.clear();
		const x = reducedMotion ? 0 : dampAndSnap(this.x, this.targetX, 12, delta, 0.00002);
		const y = reducedMotion ? 0 : dampAndSnap(this.y, this.targetY, 12, delta, 0.00002);
		if (x === this.x && y === this.y) return false;
		this.x = x; this.y = y;
		this.spherical.setFromVector3(this.offset.copy(this.basePosition).sub(this.baseTarget));
		this.spherical.theta += x;
		this.spherical.phi += y;
		this.spherical.makeSafe();
		camera.position.copy(this.baseTarget).add(this.offset.setFromSpherical(this.spherical));
		camera.lookAt(this.baseTarget);
		camera.updateMatrixWorld(true);
		return true;
	}
}
