import * as THREE from 'three/webgpu';
import { texture } from 'three/tsl';
import { createOutlineOpacity, createOutlineUniforms, isOutlineMesh } from '../stage/interactionOutline.js';
import { isMesh } from '../stage/stageSceneUtils.js';
import type { StageInteractionTheme } from '../stage/stageTypes.js';
import type { BlurRect } from './CatalogDepthBlur.js';

/** A shared, cropped silhouette target. Idle hover fades reuse its last mask. */
export class CatalogModelOutline {
	private readonly scene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera();
	private readonly controls = createOutlineUniforms();
	private readonly modelMatrix = new THREE.Matrix4();
	private readonly cameraMatrix = new THREE.Matrix4();
	private readonly projection = new THREE.Matrix4();
	private masks = new WeakMap<THREE.Object3D, THREE.Object3D>();
	private source?: THREE.Object3D;
	private capture?: THREE.RenderTarget;
	private maskMaterial?: THREE.MeshBasicMaterial;
	private material?: THREE.MeshBasicNodeMaterial;
	private quad?: THREE.QuadMesh;
	private captures = 0;
	private passes = 0;
	getRenderTargets() { return this.capture ? [this.capture] : []; }
	getStats() { return { captures: this.captures, passes: this.passes, targets: this.getRenderTargets().length, size: this.capture?.width ?? 0 }; }

	render(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
		model: THREE.Object3D, bounds: BlurRect, clip: BlurRect,
		opacity: number, theme: StageInteractionTheme) {
		if (opacity <= 0.001) return;
		const padding = Math.ceil(theme.outlineThickness * Math.max(1, theme.outlineGlowThickness) + 2);
		const left = Math.max(0, clip.left, Math.floor(bounds.left - padding));
		const top = Math.max(0, clip.top, Math.floor(bounds.top - padding));
		const right = Math.min(innerWidth, clip.left + clip.width, Math.ceil(bounds.left + bounds.width + padding));
		const bottom = Math.min(innerHeight, clip.top + clip.height, Math.ceil(bounds.top + bounds.height + padding));
		const width = right - left, height = bottom - top;
		if (width <= 0 || height <= 0) return;
		if (!this.capture) {
			this.capture = new THREE.RenderTarget(512, 512, { depthBuffer: true, samples: 4 });
			this.capture.texture.generateMipmaps = false;
			this.maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
			this.material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
			this.material.colorNode = this.controls.color;
			this.material.opacityNode = createOutlineOpacity(texture(this.capture.texture), this.controls);
			this.quad = new THREE.QuadMesh(this.material);
		}
		let mask = this.masks.get(model);
		if (!mask) {
			mask = model.clone(true);
			mask.traverse(child => {
				if (!isMesh(child)) return;
				child.visible &&= isOutlineMesh(child, theme);
				child.material = this.maskMaterial!;
			});
			mask.matrixAutoUpdate = false;
			this.masks.set(model, mask);
		}
		model.updateWorldMatrix(true, false);
		mask.matrix.copy(model.matrixWorld);
		mask.matrixWorldNeedsUpdate = true;
		this.camera.copy(camera);
		this.camera.setViewOffset(innerWidth, innerHeight, left, top, width, height);
		const changed = this.source !== model || !this.modelMatrix.equals(model.matrixWorld) ||
			!this.cameraMatrix.equals(camera.matrixWorld) || !this.projection.equals(this.camera.projectionMatrix);
		if (this.source !== model) {
			this.scene.clear();
			this.scene.add(mask);
			this.source = model;
		}
		this.controls.color.value.set(theme.outlineColor);
		this.controls.strength.value = theme.outlineOpacity;
		this.controls.glow.value = theme.outlineGlow;
		this.controls.opacityScale.value = opacity;
		this.controls.texel.value.set(theme.outlineThickness / width, theme.outlineThickness / height);
		this.controls.glowTexel.value.copy(this.controls.texel.value).multiplyScalar(theme.outlineGlowThickness);
		const destination = renderer.getRenderTarget();
		const viewport = destination ? destination.viewport.clone() : renderer.getViewport(new THREE.Vector4());
		const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
		const scissorTest = renderer.getScissorTest();
		try {
			renderer.setScissorTest(false);
			if (changed) {
				renderer.setRenderTarget(this.capture);
				renderer.setClearColor(0x000000, 0);
				renderer.clear();
				renderer.render(this.scene, this.camera);
				this.modelMatrix.copy(model.matrixWorld);
				this.cameraMatrix.copy(camera.matrixWorld);
				this.projection.copy(this.camera.projectionMatrix);
				this.captures++;
			}
			renderer.setRenderTarget(destination);
			const scaleX = viewport.z / innerWidth, scaleY = viewport.w / innerHeight;
			const output = new THREE.Vector4(viewport.x + left * scaleX, viewport.y + top * scaleY, width * scaleX, height * scaleY);
			if (destination) destination.viewport.copy(output);
			else renderer.setViewport(output);
			this.quad!.render(renderer);
			this.passes++;
		} finally {
			renderer.setRenderTarget(destination);
			if (destination) destination.viewport.copy(viewport);
			else renderer.setViewport(viewport);
			renderer.setClearColor(clearColor, clearAlpha);
			renderer.setScissorTest(scissorTest);
		}
	}
	release(model: THREE.Object3D) {
		this.masks.delete(model);
		if (this.source !== model) return;
		this.source = undefined;
		this.scene.clear();
	}
	dispose() {
		this.scene.clear();
		this.source = undefined;
		this.masks = new WeakMap();
		this.capture?.dispose();
		this.maskMaterial?.dispose();
		this.material?.dispose();
	}
}
