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

// Nested passes need distinct snapshots, but each renderer can reuse that small
// stack after a pass returns instead of allocating three math objects per pass.
const statePools = new WeakMap<RendererStatePort, {
	depth: number;
	frames: { color: Color; viewport: Vector4; scissor: Vector4 }[];
}>();

/** A cached uniform attachment must be complete on WebGPU and its WebGL fallback. */
export function clearFullTarget(renderer: Pick<WebGPURenderer, 'getScissorTest' | 'setScissorTest' | 'clear'>) {
	const scissorTest = renderer.getScissorTest();
	if (scissorTest) renderer.setScissorTest(false);
	try { renderer.clear(); }
	finally { if (scissorTest) renderer.setScissorTest(true); }
}

/** A pass borrows renderer state; failures must not poison the next output band. */
export function withRendererState<T>(renderer: RendererStatePort, draw: () => T): T {
	let pool = statePools.get(renderer);
	if (!pool) {
		pool = { depth: 0, frames: [] };
		statePools.set(renderer, pool);
	}
	const snapshot = pool.frames[pool.depth] ??= { color: new Color(), viewport: new Vector4(), scissor: new Vector4() };
	const canvas = renderer.getCanvasTarget();
	const target = renderer.getRenderTarget();
	const color = renderer.getClearColor(snapshot.color);
	const alpha = renderer.getClearAlpha();
	const viewport = renderer.getViewport(snapshot.viewport);
	const scissor = renderer.getScissor(snapshot.scissor);
	const scissorTest = renderer.getScissorTest();
	pool.depth++;
	try {
		return draw();
	} finally {
		try {
			renderer.setCanvasTarget(canvas);
			renderer.setRenderTarget(target);
			renderer.setClearColor(color, alpha);
			renderer.setViewport(viewport);
			renderer.setScissor(scissor);
			renderer.setScissorTest(scissorTest);
		} finally { pool.depth--; }
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
