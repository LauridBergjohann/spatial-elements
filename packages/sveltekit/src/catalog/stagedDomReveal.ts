export const STAGED_REVEAL_OPACITY = '--catalog-reveal-opacity';

const CANDIDATES = '[data-catalog-transition-dom="enter"], [data-stage-panel-content], [data-stage-panel-css-surface]';
const OBSERVED_ATTRIBUTES = ['data-catalog-transition-dom', 'data-catalog-transition-group',
	'data-stage-panel-content', 'data-stage-panel-css-surface', 'data-catalog-shell-continuous'];

/** The existing paint formula owns the fade; panel frame wrappers never do. */
export function isStagedRevealPaintOwner(element: HTMLElement): boolean {
	if (element.closest('[data-catalog-shell-continuous]')) return false;
	if (element.getAttribute('data-catalog-transition-dom') === 'enter') return true;
	if (!element.hasAttribute('data-stage-panel-content') && !element.hasAttribute('data-stage-panel-css-surface')) return false;
	// Nested panels can inherit the original transition factor without carrying
	// a group marker of their own. Keep that existing multiplicative behavior.
	const group = element.closest('[data-catalog-transition-group]')?.getAttribute('data-catalog-transition-group');
	return group === 'enter' || group === 'shared';
}

/** One staged reveal owns only a non-inherited property on real paint targets. */
export function createStagedDomReveal(root: HTMLElement) {
	const receivers = new Map<HTMLElement, { value: string; priority: string; written?: string }>();
	let disposed = false, opacity = '0';
	const restoreProperty = (element: HTMLElement, original: { value: string; priority: string }) => {
		if (original.value) element.style.setProperty(STAGED_REVEAL_OPACITY, original.value, original.priority);
		else element.style.removeProperty(STAGED_REVEAL_OPACITY);
	};
	const write = (element: HTMLElement, original: { written?: string }) => {
		if (original.written === opacity) return;
		element.style.setProperty(STAGED_REVEAL_OPACITY, opacity);
		original.written = opacity;
	};
	const refresh = () => {
		if (disposed) return;
		const current = new Set(Array.from(root.querySelectorAll<HTMLElement>(CANDIDATES)).filter(isStagedRevealPaintOwner));
		for (const [element, original] of receivers) if (!current.has(element)) {
			restoreProperty(element, original);
			receivers.delete(element);
		}
		for (const element of current) {
			let original = receivers.get(element);
			if (!original) {
				original = { value: element.style.getPropertyValue(STAGED_REVEAL_OPACITY),
					priority: element.style.getPropertyPriority(STAGED_REVEAL_OPACITY) };
				receivers.set(element, original);
			}
			write(element, original);
		}
	};
	// Child and marker changes are reconciled before the next paint. No style
	// observation, computed-style reads or layout measurements occur per frame.
	const observer = new MutationObserver(refresh);
	observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: OBSERVED_ATTRIBUTES });
	refresh();
	return {
		setProgress(progress: number) {
			if (disposed) return;
			opacity = String(Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0);
			for (const [element, original] of receivers) write(element, original);
		},
		restore() {
			if (disposed) return;
			disposed = true;
			observer.disconnect();
			for (const [element, original] of receivers) restoreProperty(element, original);
			receivers.clear();
		}
	};
}
