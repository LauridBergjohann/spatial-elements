import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { SpatialElementRefinement } from './SpatialElementRefinement.js';

function fixture() {
	const destination = new THREE.RenderTarget(1920, 1080, { type: THREE.HalfFloatType, samples: 4 });
	let current: THREE.RenderTarget | null = destination;
	let scissorTest = false;
	const renderer = { autoClear: false, getRenderTarget: () => current, setRenderTarget: (target: THREE.RenderTarget | null) => { current = target; },
		getScissorTest: () => scissorTest, setScissorTest: (value: boolean) => { scissorTest = value; }, clear: vi.fn(), render: vi.fn() } as unknown as THREE.WebGPURenderer;
	const refinement = new SpatialElementRefinement(true);
	const guard = { isValid: vi.fn(() => true), dispose: vi.fn() };
	return { destination, renderer, refinement, guard };
}

test('four captures keep q/frames/completion unchanged and add only two capped resolved color targets', () => {
	const f = fixture();
	f.refinement.render(f.renderer, () => {}, false, 0.31);
	const before = { frames: f.refinement.frames, progress: f.refinement.presentedProgress, complete: f.refinement.complete };
	const draws: [boolean, number][] = [];
	const ticket = f.refinement.prepareSceneEndpoints(f.renderer, (high, p) => draws.push([high, p]), f.guard)!;
	expect(draws).toEqual([[true, 0], [false, 0], [true, 1], [false, 1]]);
	expect({ frames: f.refinement.frames, progress: f.refinement.presentedProgress, complete: f.refinement.complete }).toEqual(before);
	expect(f.renderer.getRenderTarget()).toBe(f.destination);
	const extra = f.refinement.getRenderTargets().slice(2);
	expect(extra).toHaveLength(2);
	for (const target of extra) {
		expect(target.width * target.height).toBeLessThanOrEqual(512 * 1024);
		expect([target.samples, target.depthBuffer, target.stencilBuffer, target.texture.type]).toEqual([0, false, false, THREE.HalfFloatType]);
	}
	expect(ticket.commit()).toBe(true);
	const live = vi.fn();
	f.refinement.render(f.renderer, live, false, 0.63, { backgroundReveal: 0.17 });
	expect(live).not.toHaveBeenCalled();
	expect(f.refinement.presentedProgress).toBe(0.63);
	expect(f.refinement.getSceneEndpointStats()).toMatchObject({ preparations: 1, ready: 1, hits: 1, active: true });
	f.refinement.dispose(); expect(f.guard.dispose).toHaveBeenCalledTimes(1);
});

test('a hidden normal RAF may read pending endpoints without writing them or advancing q', () => {
	const f = fixture(); f.refinement.render(f.renderer, () => {}, false, 0.24);
	const ticket = f.refinement.prepareSceneEndpoints(f.renderer, () => {}, f.guard)!;
	const frames = f.refinement.frames, live = vi.fn();
	f.refinement.render(f.renderer, live, false, undefined, { backgroundReveal: 0.4, advanceClock: false });
	expect(live).not.toHaveBeenCalled();
	expect(f.refinement.frames).toBe(frames); expect(f.refinement.presentedProgress).toBe(0.24);
	expect(f.refinement.getSceneEndpointStats()).toMatchObject({ pendingReads: 1, pending: true, ready: 0 });
	expect(ticket.commit()).toBe(true);
	f.refinement.dispose();
});

test('a real Low/High overwrite during the fence rejects the ticket even with the same scene generation', () => {
	const f = fixture(); const ticket = f.refinement.prepareSceneEndpoints(f.renderer, () => {}, f.guard)!;
	const live = vi.fn();
	f.refinement.render(f.renderer, live, false, 0.2); // Ordinary render owner, not the hidden-preparation read contract.
	expect(live).toHaveBeenCalledTimes(2);
	expect(ticket.commit()).toBe(false);
	expect(f.refinement.getSceneEndpointStats()).toMatchObject({ ready: 0, hits: 0, staleTickets: 1, active: false });
	expect(f.guard.dispose).toHaveBeenCalledTimes(1);
	expect(f.refinement.getRenderTargets()).toHaveLength(2);
	f.refinement.dispose();
});

test.each(['resize', 'resize-before-raf', 'guard', 'cancel', 'dispose', 'restart'] as const)('%s invalidates pending ownership and cannot be resurrected after its fence', (reason) => {
	const f = fixture(); const ticket = f.refinement.prepareSceneEndpoints(f.renderer, () => {}, f.guard)!;
	const extraDisposed = f.refinement.getRenderTargets().slice(2).map(target => vi.spyOn(target, 'dispose'));
	if (reason === 'resize') { f.destination.setSize(800, 600); f.refinement.render(f.renderer, () => {}, false, 0.1, { backgroundReveal: 0.3, advanceClock: false }); }
	if (reason === 'resize-before-raf') f.destination.setSize(800, 600);
	if (reason === 'guard') f.guard.isValid.mockReturnValue(false);
	if (reason === 'cancel') ticket.cancel();
	if (reason === 'dispose') f.refinement.dispose();
	if (reason === 'restart') f.refinement.restart();
	expect(ticket.commit()).toBe(false);
	extraDisposed.forEach(disposed => expect(disposed).toHaveBeenCalledTimes(1));
	expect(f.guard.dispose).toHaveBeenCalledTimes(1);
	f.refinement.dispose();
});

test('capture errors restore the output owner and release added resources/guard without ticking the clock', () => {
	const f = fixture(); f.refinement.render(f.renderer, () => {}, false, 0.19);
	const frames = f.refinement.frames;
	expect(() => f.refinement.prepareSceneEndpoints(f.renderer, (_high, p) => { if (p === 1) throw new Error('capture failed'); }, f.guard)).toThrow('capture failed');
	expect(f.renderer.getRenderTarget()).toBe(f.destination);
	expect(f.refinement.frames).toBe(frames); expect(f.refinement.presentedProgress).toBe(0.19);
	expect(f.refinement.getRenderTargets()).toHaveLength(2);
	expect(f.guard.dispose).toHaveBeenCalledTimes(1);
	f.refinement.dispose();
});

test('a stale cancel cannot destroy the replacement ticket and its bounded targets', () => {
	const f = fixture(); const old = f.refinement.prepareSceneEndpoints(f.renderer, () => {}, f.guard)!;
	const nextGuard = { isValid: () => true, dispose: vi.fn() };
	const next = f.refinement.prepareSceneEndpoints(f.renderer, () => {}, nextGuard)!;
	old.cancel(); expect(old.commit()).toBe(false); expect(next.commit()).toBe(true);
	expect(f.refinement.getRenderTargets()).toHaveLength(4);
	expect(f.guard.dispose).toHaveBeenCalledTimes(1); expect(nextGuard.dispose).not.toHaveBeenCalled();
	f.refinement.dispose(); expect(nextGuard.dispose).toHaveBeenCalledTimes(1);
});

test('composite warm-up cannot write or clear the real presentation seed and restores borrowed state on failure', () => {
	const f = fixture(); f.destination.scissor.set(3, 7, 80, 60); f.renderer.autoClear = true;
	vi.mocked(f.renderer.render).mockImplementation(() => {
		if (f.renderer.getRenderTarget() === f.destination) {
			expect(f.destination.scissor.toArray()).toEqual([0, 0, 0, 0]);
			expect(f.renderer.getScissorTest()).toBe(true); expect(f.renderer.autoClear).toBe(false);
			throw new Error('warm failed');
		}
	});
	expect(() => f.refinement.prepareSceneEndpoints(f.renderer, () => {}, f.guard)).toThrow('warm failed');
	expect(f.destination.scissor.toArray()).toEqual([3, 7, 80, 60]);
	expect(f.renderer.getScissorTest()).toBe(false); expect(f.renderer.autoClear).toBe(true);
	expect(f.renderer.clear).not.toHaveBeenCalled();
	expect(f.guard.dispose).toHaveBeenCalledTimes(1); f.refinement.dispose();
});
