import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	STAGE_SCROLL_PRIORITY,
	markStageScrollInput,
	subscribeStageScrollFrame,
	syncStageScrollToNative,
	type StageScrollFrame
} from './scrollFrame.js';

interface ScrollFrameHarness {
	listeners: Map<string, (event?: unknown) => void>;
	requestedFrames: FrameRequestCallback[];
	windowStub: {
		addEventListener: ReturnType<typeof vi.fn>;
		removeEventListener: ReturnType<typeof vi.fn>;
		innerHeight: number;
		matchMedia: ReturnType<typeof vi.fn>;
		scrollX: number;
		scrollY: number;
	};
	runFrame(time: number): void;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('stage scroll frames', () => {
	it('rebases a pending damped frame immediately in consumer order without a velocity impulse', () => {
		const harness = createHarness(0, 0);
		const calls: string[] = [];
		const stops = [
			subscribeStageScrollFrame(() => calls.push('stage'), STAGE_SCROLL_PRIORITY.stage),
			subscribeStageScrollFrame((frame) => {
				calls.push('document');
				if (frame.inputSource === 'navigation') {
					expect(frame).toMatchObject({
						scrollY: 120,
						previousScrollY: 120,
						deltaY: 0,
						directionY: 0,
						settled: true
					});
				}
			}, STAGE_SCROLL_PRIORITY.virtualDocument),
			subscribeStageScrollFrame(() => calls.push('dock'), STAGE_SCROLL_PRIORITY.dock)
		];
		markStageScrollInput('wheel');
		harness.windowStub.scrollY = 120;
		harness.listeners.get('scroll')?.();
		harness.runFrame(16);
		calls.length = 0;
		expect(syncStageScrollToNative()).toEqual({ scrollX: 0, scrollY: 120 });
		expect(calls).toEqual(['document', 'dock', 'stage']);
		expect(cancelAnimationFrame).toHaveBeenCalled();
		for (const stop of stops) stop();
	});

	it('publishes restoration even if the native position has not changed', () => {
		createHarness(0, 240);
		const frames: StageScrollFrame[] = [];
		const stop = subscribeStageScrollFrame((frame) => frames.push(frame));
		syncStageScrollToNative();
		syncStageScrollToNative();
		expect(frames).toHaveLength(2);
		expect(frames[1]).toMatchObject({ scrollY: 240, deltaY: 0, settled: true });
		stop();
	});

	it('shares one animation frame and commits DOM docking before rendering the stage', () => {
		const harness = createHarness(12, 240);
		const calls: string[] = [];
		const stopStage = subscribeStageScrollFrame(
			(frame) => calls.push(`stage:${frame.scrollX}:${frame.scrollY}`),
			STAGE_SCROLL_PRIORITY.stage
		);
		const stopDock = subscribeStageScrollFrame(
			() => calls.push('dock'),
			STAGE_SCROLL_PRIORITY.dock
		);

		expect(harness.listeners.has('scroll')).toBe(true);
		harness.listeners.get('scroll')?.();
		harness.listeners.get('scroll')?.();
		expect(harness.requestedFrames).toHaveLength(1);

		harness.runFrame(123);
		expect(calls).toEqual(['dock', 'stage:12:240']);

		stopDock();
		expect(harness.windowStub.removeEventListener).not.toHaveBeenCalled();
		stopStage();
		expect(harness.windowStub.removeEventListener).toHaveBeenCalledWith(
			'scroll',
			expect.any(Function)
		);
	});

	it('publishes one immutable direct-scroll snapshot with frame deltas', () => {
		const harness = createHarness(4, 80);
		let received: StageScrollFrame | undefined;
		const stop = subscribeStageScrollFrame((frame) => {
			received = frame;
		});
		harness.windowStub.scrollX = 10;
		harness.windowStub.scrollY = 44;
		harness.listeners.get('scroll')?.();
		harness.runFrame(456);

		expect(received).toMatchObject({
			time: 456,
			scrollX: 10,
			scrollY: 44,
			targetScrollX: 10,
			targetScrollY: 44,
			previousScrollX: 4,
			previousScrollY: 80,
			deltaX: 6,
			deltaY: -36,
			directionY: -1,
			inputSource: 'direct',
			settled: true
		});
		expect(Object.isFrozen(received)).toBe(true);
		stop();
	});

	it('damps a discrete wheel target and keeps publishing until it settles', () => {
		const harness = createHarness(0, 0);
		const frames: StageScrollFrame[] = [];
		const stop = subscribeStageScrollFrame((frame) => frames.push(frame));

		harness.listeners.get('wheel')?.({ deltaMode: 0, deltaX: 0, deltaY: 120 });
		harness.windowStub.scrollY = 120;
		harness.listeners.get('scroll')?.();
		harness.runFrame(16);

		expect(frames[0].inputSource).toBe('wheel');
		expect(frames[0].targetScrollY).toBe(120);
		expect(frames[0].scrollY).toBeGreaterThan(0);
		expect(frames[0].scrollY).toBeLessThan(120);
		expect(frames[0].settled).toBe(false);

		for (let index = 1; harness.requestedFrames.length && index < 60; index += 1) {
			harness.runFrame(16 + index * 16.67);
		}

		expect(frames.at(-1)?.scrollY).toBe(120);
		expect(frames.at(-1)?.settled).toBe(true);
		expect(harness.requestedFrames).toHaveLength(0);
		stop();
	});

	it('keeps precision-wheel and reduced-motion input exact', () => {
		const precisionHarness = createHarness(0, 0);
		let precisionFrame: StageScrollFrame | undefined;
		const stopPrecision = subscribeStageScrollFrame((frame) => {
			precisionFrame = frame;
		});
		precisionHarness.listeners.get('wheel')?.({ deltaMode: 0, deltaX: 0, deltaY: 12 });
		precisionHarness.windowStub.scrollY = 60;
		precisionHarness.listeners.get('scroll')?.();
		precisionHarness.runFrame(16);
		expect(precisionFrame).toMatchObject({
			scrollY: 60,
			inputSource: 'precision-wheel',
			settled: true
		});
		stopPrecision();

		const reducedHarness = createHarness(0, 0, true);
		let reducedFrame: StageScrollFrame | undefined;
		const stopReduced = subscribeStageScrollFrame((frame) => {
			reducedFrame = frame;
		});
		markStageScrollInput('wheel');
		reducedHarness.windowStub.scrollY = 120;
		reducedHarness.listeners.get('scroll')?.();
		reducedHarness.runFrame(16);
		expect(reducedFrame).toMatchObject({ scrollY: 120, settled: true });
		stopReduced();
	});
});

function createHarness(
	scrollX: number,
	scrollY: number,
	reducedMotion = false
): ScrollFrameHarness {
	const listeners = new Map<string, (event?: unknown) => void>();
	const requestedFrames: FrameRequestCallback[] = [];
	const windowStub = {
		addEventListener: vi.fn((type: string, listener: (event?: unknown) => void) => {
			listeners.set(type, listener);
		}),
		removeEventListener: vi.fn((type: string) => listeners.delete(type)),
		innerHeight: 900,
		matchMedia: vi.fn(() => ({ matches: reducedMotion })),
		scrollX,
		scrollY
	};
	vi.stubGlobal('window', windowStub);
	vi.stubGlobal(
		'requestAnimationFrame',
		vi.fn((callback: FrameRequestCallback) => {
			requestedFrames.push(callback);
			return requestedFrames.length;
		})
	);
	vi.stubGlobal('cancelAnimationFrame', vi.fn());

	return {
		listeners,
		requestedFrames,
		windowStub,
		runFrame(time: number) {
			const callback = requestedFrames.shift();
			if (!callback) throw new Error('No animation frame is pending');
			callback(time);
		}
	};
}
