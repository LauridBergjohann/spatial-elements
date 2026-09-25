import * as THREE from 'three/webgpu';
import { texture, uniform } from 'three/tsl';

/** Fade the resolved image, never the individual opaque surfaces of a product. */
export class CatalogGeometryFade {
	getRenderTargets() {
		return this.capture ? [this.capture] : [];
	}
	private capture?: THREE.RenderTarget;
	private material?: THREE.NodeMaterial;
	private quad?: THREE.QuadMesh;
	private readonly alpha = uniform(1);

	render(renderer: THREE.WebGPURenderer, opacity: number, draw: () => void) {
		if (opacity >= 1) {
			draw();
			return;
		}
		if (opacity <= 0) return;
		const destination = renderer.getRenderTarget();
		const size = destination ?? renderer.getDrawingBufferSize(new THREE.Vector2());
		if (!this.capture) {
			this.capture = new THREE.RenderTarget(size.width, size.height, {
				type: THREE.HalfFloatType,
				samples: 4
			});
			this.material = new THREE.NodeMaterial();
			this.material.fragmentNode = texture(this.capture.texture).mul(this.alpha);
			this.material.transparent = true;
			this.material.premultipliedAlpha = true;
			this.material.depthTest = false;
			this.material.depthWrite = false;
			this.material.toneMapped = false;
			this.quad = new THREE.QuadMesh(this.material);
		}
		this.capture.setSize(size.width, size.height);
		const color = renderer.getClearColor(new THREE.Color());
		const clearAlpha = renderer.getClearAlpha();
		const scissor = renderer.getScissor(new THREE.Vector4());
		const scissorTest = renderer.getScissorTest();
		try {
			renderer.setRenderTarget(this.capture);
			renderer.setScissorTest(false);
			renderer.setClearColor(0x000000, 0);
			renderer.clear();
			draw();
			renderer.setRenderTarget(destination);
			renderer.setScissor(scissor);
			renderer.setScissorTest(scissorTest);
			this.alpha.value = opacity;
			this.quad!.render(renderer);
		} finally {
			renderer.setRenderTarget(destination);
			renderer.setClearColor(color, clearAlpha);
			renderer.setScissor(scissor);
			renderer.setScissorTest(scissorTest);
		}
	}
	dispose() {
		this.capture?.dispose();
		this.material?.dispose();
		this.capture = undefined;
		this.material = undefined;
		this.quad = undefined;
	}
}
