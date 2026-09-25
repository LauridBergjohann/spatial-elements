import { Color, Vector4 } from 'three/webgpu';
import type { WebGPURenderer } from 'three/webgpu';

type RendererStatePort = Pick<
	WebGPURenderer,
	| 'getCanvasTarget'
	| 'setCanvasTarget'
	| 'getRenderTarget'
	| 'setRenderTarget'
	| 'getClearColor'
	| 'getClearAlpha'
	| 'setClearColor'
	| 'getViewport'
	| 'getScissor'
	| 'getScissorTest'
	| 'setScissorTest'
> & { setViewport(value: Vector4): void; setScissor(value: Vector4): void };

/** A pass borrows renderer state; failures must not poison the next output band. */
export function withRendererState<T>(renderer: RendererStatePort, draw: () => T): T {
	const canvas = renderer.getCanvasTarget();
	const target = renderer.getRenderTarget();
	const color = renderer.getClearColor(new Color());
	const alpha = renderer.getClearAlpha();
	const viewport = renderer.getViewport(new Vector4());
	const scissor = renderer.getScissor(new Vector4());
	const scissorTest = renderer.getScissorTest();
	try {
		return draw();
	} finally {
		renderer.setCanvasTarget(canvas);
		renderer.setRenderTarget(target);
		renderer.setClearColor(color, alpha);
		renderer.setViewport(viewport);
		renderer.setScissor(scissor);
		renderer.setScissorTest(scissorTest);
	}
}

/** Restore borrowed scene visibility even if a WebGPU pass throws. */
export function withVisibility<T>(nodes: readonly { visible: boolean }[], draw: () => T): T {
	const visible = nodes.map((node) => node.visible);
	try {
		return draw();
	} finally {
		nodes.forEach((node, index) => {
			node.visible = visible[index];
		});
	}
}
