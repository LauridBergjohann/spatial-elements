export type TransitionMode = 'synchronous' | 'asynchronous';
export const MOTION_DURATION = 400;
export const ASYNC_REVEAL_DURATION = 300;
const SYNC_REVEAL_START = 0;
export const clampProgress = (value: number) => Math.min(1, Math.max(0, value));
export const easeInOutSine = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

/** Times are relative to prepared destination binding, never pointer activation. */
export function transitionTiming(
	elapsed: number,
	mode: TransitionMode,
	backgroundPrepared = false
) {
	const revealStart = mode === 'synchronous' ? SYNC_REVEAL_START : MOTION_DURATION;
	const revealDuration =
		mode === 'synchronous' ? MOTION_DURATION - SYNC_REVEAL_START : ASYNC_REVEAL_DURATION;
	const reveal = easeInOutSine(clampProgress((elapsed - revealStart) / revealDuration));
	return {
		motion: 1 - (1 - clampProgress(elapsed / MOTION_DURATION)) ** 2,
		exit: (1 - clampProgress(elapsed / 140)) ** 2,
		enter: reveal,
		background: backgroundPrepared
			? easeInOutSine(
					clampProgress((elapsed - SYNC_REVEAL_START) / (MOTION_DURATION - SYNC_REVEAL_START))
				)
			: reveal,
		geometry: reveal,
		complete: elapsed >= revealStart + revealDuration
	};
}
