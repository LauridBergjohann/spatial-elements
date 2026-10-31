import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StagedCatalogTransition, type StagedCatalogTransitionHooks } from './StagedCatalogTransition.js';
import { MOTION_DURATION, ASYNC_REVEAL_DURATION } from './transitionTiming.js';
import { createSourceDomMotion } from './SourceDomMotion.js';

vi.mock('./SourceDomMotion.js', () => ({ createSourceDomMotion: vi.fn() }));
let now: number, next: number, frames: Map<number, FrameRequestCallback>;
beforeEach(() => {
	now = 0; next = 0; frames = new Map();
	vi.stubGlobal('performance', { now: () => now });
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; });
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('getComputedStyle', () => ({ opacity: '0.8' }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
async function frame(time: number) {
	now = time;
	const [id, callback] = frames.entries().next().value!;
	frames.delete(id); callback(time); await flush();
}
function element() {
	const styles = new Map<string, { value: string; priority: string }>();
	return { inert: false, contains: () => false, style: {
		getPropertyValue: (key: string) => styles.get(key)?.value ?? '',
		getPropertyPriority: (key: string) => styles.get(key)?.priority ?? '',
		setProperty: (key: string, value: string, priority = '') => styles.set(key, { value, priority }),
		removeProperty: (key: string) => styles.delete(key)
	} } as unknown as HTMLElement;
}
function fixture(reducedMotion = false) {
	const actor = element(), exiting = element(), incoming = element();
	const quad = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] as const;
	const motion = { update: vi.fn(() => quad), hide: vi.fn(), restore: vi.fn() };
	vi.mocked(createSourceDomMotion).mockReturnValue(motion);
	const hooks: StagedCatalogTransitionHooks = { begin: vi.fn(() => true), frame: vi.fn(), hold: vi.fn(() => true),
		reveal: vi.fn(), finish: vi.fn(), cancel: vi.fn() };
	const transition = new StagedCatalogTransition({ actors: [{ element: actor, projection: { width: 100, height: 100, corners: quad },
		target: { left: 200, top: 20, width: 300 } }], exiting: [exiting], reducedMotion, hooks });
	return { transition, hooks, actor, exiting, incoming, motion };
}

test('source motion starts synchronously; hold waits for a frame after the final moving frame', async () => {
	const f = fixture(), handle = f.transition.start()!;
	expect(f.hooks.begin).toHaveBeenCalledTimes(1);
	expect(f.hooks.frame).toHaveBeenLastCalledWith(expect.objectContaining({ progress: 0, exit: 1 }));
	expect(f.actor.inert).toBe(true);
	let finished = false; void handle.finished.then(() => { finished = true; });
	await frame(MOTION_DURATION);
	expect(f.hooks.frame).toHaveBeenLastCalledWith(expect.objectContaining({ progress: 1, exit: 0 }));
	expect(f.hooks.hold).not.toHaveBeenCalled(); expect(finished).toBe(false);
	await frame(MOTION_DURATION + 16);
	expect(f.hooks.hold).toHaveBeenCalledTimes(1); expect(await handle.finished).toBe(true);
	expect(f.transition.phase).toBe('held'); expect(frames.size).toBe(0);
	expect(f.hooks.finish).not.toHaveBeenCalled();
});

test('the first submission includes actual begin and DOM preparation time without another RAF', () => {
	const f = fixture();
	vi.mocked(f.hooks.begin).mockImplementation(() => { now += 9; return true; });
	vi.mocked(createSourceDomMotion).mockImplementation(() => { now += 4; return f.motion; });
	vi.stubGlobal('getComputedStyle', () => { now += 2; return { opacity: '0.8' }; });
	f.transition.start();
	expect(now).toBe(15);
	expect(f.hooks.frame).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
		progress: 1 - (1 - 15 / MOTION_DURATION) ** 2,
		exit: (1 - 15 / 140) ** 2
	}));
	expect(f.motion.update).toHaveBeenCalledTimes(1);
	expect(createSourceDomMotion).toHaveBeenCalledTimes(1);
	expect(frames.size).toBe(1);
	expect(f.hooks.hold).not.toHaveBeenCalled();
});

test.each([100, 800])('a %i ms preparation contributes at most one frame and shifts the remaining clock', async preparation => {
	const f = fixture();
	vi.mocked(f.hooks.begin).mockImplementation(() => { now = preparation; return true; });
	const handle = f.transition.start()!;
	const initial = 1000 / 60;
	const progress = () => vi.mocked(f.hooks.frame).mock.lastCall![0].progress;
	expect(progress()).toBeCloseTo(1 - (1 - initial / MOTION_DURATION) ** 2, 12);
	expect(f.transition.phase).toBe('moving');
	await frame(preparation + 20);
	expect(progress()).toBeCloseTo(1 - (1 - (initial + 20) / MOTION_DURATION) ** 2, 12);
	const endpoint = Math.ceil(preparation + MOTION_DURATION - initial);
	await frame(endpoint - 1);
	expect(progress()).toBeLessThan(1);
	expect(f.hooks.hold).not.toHaveBeenCalled();
	await frame(endpoint);
	expect(progress()).toBe(1);
	expect(f.hooks.hold).not.toHaveBeenCalled();
	await frame(endpoint + 16);
	expect(await handle.finished).toBe(true);
});

test('an earlier RAF timestamp cannot reverse the synchronous first movement', async () => {
	const f = fixture();
	vi.mocked(f.hooks.begin).mockImplementation(() => { now = 15; return true; });
	f.transition.start();
	await frame(12);
	await frame(20);
	await frame(30);
	const progress = vi.mocked(f.hooks.frame).mock.calls.map(([value]) => value.progress);
	expect(progress).toEqual([15, 15, 20, 30].map(elapsed => 1 - (1 - elapsed / MOTION_DURATION) ** 2));
	expect(frames.size).toBe(1);
});

test('binding and content reflow occur only in reveal; source and incoming styles are restored after completion', async () => {
	const f = fixture(); f.exiting.style.setProperty('opacity', '.4', 'important');
	const handle = f.transition.start()!; await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16); await handle.finished;
	const prepare = vi.fn(); const revealing = f.transition.reveal([f.incoming], prepare); await flush();
	expect(prepare).toHaveBeenCalledTimes(1); expect(f.incoming.style.getPropertyValue('opacity')).toBe('0');
	await frame(MOTION_DURATION + 16 + ASYNC_REVEAL_DURATION); await revealing;
	expect(f.transition.phase).toBe('complete'); expect(f.hooks.finish).toHaveBeenCalledTimes(1);
	expect(f.motion.restore).toHaveBeenCalledTimes(1); expect(f.actor.inert).toBe(false);
	expect(f.exiting.style.getPropertyValue('opacity')).toBe('.4');
	expect(f.exiting.style.getPropertyPriority('opacity')).toBe('important');
	expect(f.incoming.style.getPropertyValue('opacity')).toBe('');
	f.transition.cancel(); expect(f.hooks.cancel).not.toHaveBeenCalled();
});

test.each(['moving', 'holding', 'held', 'revealing'] as const)('cancel during %s restores every owner once', async phase => {
	const f = fixture(), handle = f.transition.start()!;
	if (phase !== 'moving') await frame(MOTION_DURATION);
	if (phase === 'held' || phase === 'revealing') await frame(MOTION_DURATION + 16);
	const revealing = phase === 'revealing' ? f.transition.reveal([f.incoming]) : undefined; await flush();
	f.transition.cancel('interaction'); f.transition.cancel('interaction');
	expect(await handle.finished).toBe(phase === 'held' || phase === 'revealing'); await revealing;
	expect(f.hooks.cancel).toHaveBeenCalledExactlyOnceWith('interaction');
	expect(f.motion.restore).toHaveBeenCalledTimes(1); expect(f.actor.inert).toBe(false); expect(frames.size).toBe(0);
	expect(f.hooks.finish).not.toHaveBeenCalled();
});

test('a stalled asynchronous hold or reveal prepare cannot retain ownership after cancellation', async () => {
	for (const where of ['hold', 'reveal']) {
		const f = fixture();
		if (where === 'hold') vi.mocked(f.hooks.hold).mockReturnValue(new Promise(() => {}));
		const handle = f.transition.start()!; await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16);
		const revealing = where === 'reveal' ? f.transition.reveal([], () => new Promise(() => {})) : undefined;
		f.transition.cancel(); await handle.finished; await revealing;
		expect(f.transition.phase).toBe('cancelled');
	}
});

test('the hold hook can release old-parent CSS before moving the retained node, without later clobbering new placement', async () => {
	const f = fixture(); vi.mocked(f.hooks.hold).mockImplementation(({ releaseDomStyles }) => { releaseDomStyles(); return true; });
	const handle = f.transition.start()!; await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16); await handle.finished;
	expect(f.motion.restore).toHaveBeenCalledTimes(1);
	f.transition.cancel(); expect(f.motion.restore).toHaveBeenCalledTimes(1);
});

test('Reduced Motion uses no duration wait but retains the final-frame-before-hold ordering', async () => {
	const f = fixture(true), handle = f.transition.start()!;
	expect(f.hooks.frame).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ progress: 1, exit: 0 }));
	expect(f.transition.phase).toBe('holding');
	expect(f.hooks.hold).not.toHaveBeenCalled();
	await frame(16);
	expect(f.hooks.hold).not.toHaveBeenCalled();
	expect(f.hooks.frame).toHaveBeenCalledTimes(1);
	await frame(32); expect(await handle.finished).toBe(true);
	expect(f.hooks.frame).toHaveBeenCalledTimes(1);
	const reveal = f.transition.reveal(); await flush(); await frame(48); await reveal;
	expect(f.transition.phase).toBe('complete');
});

test.each([false, true])('Reduced Motion cancellation after paint barrier=%s cannot start ownership preparation', async afterBarrier => {
	const f = fixture(true), handle = f.transition.start()!;
	if (afterBarrier) await frame(16);
	f.transition.cancel('superseded');
	expect(await handle.finished).toBe(false);
	expect(f.hooks.frame).toHaveBeenCalledTimes(1);
	expect(f.hooks.hold).not.toHaveBeenCalled();
	expect(f.motion.restore).toHaveBeenCalledTimes(1);
	expect(f.actor.inert).toBe(false);
	expect(frames.size).toBe(0);
});

test('a failed begin rolls back and declines before navigation interception', () => {
	const f = fixture(); vi.mocked(f.hooks.begin).mockReturnValue(false);
	expect(f.transition.start()).toBeUndefined(); expect(f.hooks.cancel).toHaveBeenCalledExactlyOnceWith('error');
	expect(frames.size).toBe(0);
});

test('a failed hold rejects the navigation handle so the adapter can fall back to ordinary routing', async () => {
	const f = fixture(); vi.mocked(f.hooks.hold).mockReturnValue(false);
	const handle = f.transition.start()!; const failure = expect(handle.finished).rejects.toThrow('retain');
	await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16); await failure;
	expect(f.hooks.cancel).toHaveBeenCalledExactlyOnceWith('error'); expect(f.actor.inert).toBe(false);
});

test('a synchronous first-frame failure rolls back without leaking a rejected promise', async () => {
	const f = fixture(); vi.mocked(f.hooks.frame).mockImplementation(() => { throw Error('frame'); });
	expect(f.transition.start()).toBeUndefined(); await flush();
	expect(f.hooks.cancel).toHaveBeenCalledExactlyOnceWith('error'); expect(f.motion.restore).toHaveBeenCalledTimes(1);
});

test('final content commit waits until replacement is fully revealed and retains ownership until its async work finishes', async () => {
	const f = fixture(), handle = f.transition.start()!;
	await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16); await handle.finished;
	let release!: () => void;
	const pending = new Promise<void>(resolve => { release = resolve; });
	const commit = vi.fn(() => pending);
	const revealing = f.transition.reveal([f.incoming], undefined, commit); await flush();
	expect(commit).not.toHaveBeenCalled();
	await frame(MOTION_DURATION + 16 + ASYNC_REVEAL_DURATION);
	expect(f.hooks.reveal).toHaveBeenLastCalledWith(1);
	expect(commit).toHaveBeenCalledTimes(1);
	expect(f.transition.phase).toBe('committing');
	expect(f.incoming.style.getPropertyValue('opacity')).toBe('0.8');
	expect(f.actor.inert).toBe(true); expect(f.motion.restore).not.toHaveBeenCalled();
	expect(f.hooks.finish).not.toHaveBeenCalled(); expect(frames.size).toBe(0);
	release(); await revealing;
	expect(f.transition.phase).toBe('complete'); expect(f.hooks.finish).toHaveBeenCalledTimes(1);
	expect(f.motion.restore).toHaveBeenCalledTimes(1); expect(f.actor.inert).toBe(false);
});

test('cancellation aborts a stalled final commit and late completion cannot finish or clean up twice', async () => {
	const f = fixture(), handle = f.transition.start()!;
	await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16); await handle.finished;
	let release!: () => void, signal!: AbortSignal;
	const pending = new Promise<void>(resolve => { release = resolve; });
	const revealing = f.transition.reveal([], undefined, current => { signal = current; return pending; }); await flush();
	await frame(MOTION_DURATION + 16 + ASYNC_REVEAL_DURATION);
	expect(f.transition.phase).toBe('committing');
	f.transition.cancel('superseded'); await revealing;
	expect(signal.aborted).toBe(true); expect(f.transition.phase).toBe('cancelled');
	expect(f.motion.restore).toHaveBeenCalledTimes(1); expect(f.hooks.cancel).toHaveBeenCalledExactlyOnceWith('superseded');
	release(); await flush();
	expect(f.hooks.finish).not.toHaveBeenCalled(); expect(f.motion.restore).toHaveBeenCalledTimes(1);
});

test('a rejected final content commit releases the retained source through the ordinary error cleanup', async () => {
	const f = fixture(), handle = f.transition.start()!;
	await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16); await handle.finished;
	const revealing = f.transition.reveal([], undefined, () => { throw new Error('adoption'); }); await flush();
	await frame(MOTION_DURATION + 16 + ASYNC_REVEAL_DURATION); await revealing;
	expect(f.transition.phase).toBe('cancelled'); expect(f.hooks.cancel).toHaveBeenCalledExactlyOnceWith('error');
	expect(f.hooks.finish).not.toHaveBeenCalled(); expect(f.actor.inert).toBe(false);
});

test('error diagnostics receive the original binding exception before cleanup and cannot prevent cancellation', async () => {
	const f = fixture(), handle = f.transition.start()!;
	await frame(MOTION_DURATION); await frame(MOTION_DURATION + 16); await handle.finished;
	const error = new Error('Declared dock endpoint is not fully docked');
	f.hooks.error = vi.fn((received, phase) => {
		expect(received).toBe(error); expect(phase).toBe('revealing');
		expect(f.hooks.cancel).not.toHaveBeenCalled();
		throw new Error('diagnostic observer failed');
	});
	await f.transition.reveal([], () => { throw error; });
	expect(f.hooks.error).toHaveBeenCalledTimes(1);
	expect(f.hooks.cancel).toHaveBeenCalledExactlyOnceWith('error');
	expect(f.motion.restore).toHaveBeenCalledTimes(1);
	expect(f.transition.phase).toBe('cancelled');
});
