/** Returns true when a pointer event belongs to interactive stage UI instead of the model. */
export function isStageUiTarget(target: EventTarget | null) {
	if (!(target instanceof Element)) return false;
	return Boolean(
		target.closest(
			'[data-stage-panel-content], [data-stage-panel-css-surface], [data-stage-panel-fallback], button, a, input, textarea, select, summary'
		)
	);
}

/** Converts a DOM rectangle center into the stage's centered, y-up coordinate system. */
export function getStagePositionFromRect(rect: Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>) {
	return {
		x: rect.left + rect.width * 0.5 - window.innerWidth * 0.5,
		y: window.innerHeight * 0.5 - (rect.top + rect.height * 0.5)
	};
}

/** Returns whether a rectangle intersects the viewport plus an optional preload margin. */
export function isViewportRectVisible(
	rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
	viewportWidth: number,
	viewportHeight: number,
	margin = 0
) {
	const safeMargin = Math.max(Number.isFinite(margin) ? margin : 0, 0);
	return (
		rect.right >= -safeMargin &&
		rect.left <= viewportWidth + safeMargin &&
		rect.bottom >= -safeMargin &&
		rect.top <= viewportHeight + safeMargin
	);
}
