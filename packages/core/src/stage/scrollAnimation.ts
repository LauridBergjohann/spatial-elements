export const STAGE_ANCHOR_SCROLL_DURATION_MS = 480;
// With x control points at 1/3 and 2/3, this is the exact CSS form of ease-out cubic.
export const STAGE_ANCHOR_SCROLL_EASING = 'cubic-bezier(0.333333, 1, 0.666667, 1)';
export const STAGE_ANCHOR_NAVIGATION_EVENT = 'stage-anchor-navigation';
export const STAGE_ANCHOR_NAVIGATION_END_EVENT = 'stage-anchor-navigation-end';

export interface StageAnchorNavigationDetail {
	targetId: string;
}

/** Ease-out cubic used by the scroll timeline; the tab indicator shares its duration and curve. */
export function easeStageAnchorScroll(progress: number) {
	const clampedProgress = Math.min(Math.max(Number.isFinite(progress) ? progress : 0, 0), 1);
	return 1 - Math.pow(1 - clampedProgress, 3);
}
