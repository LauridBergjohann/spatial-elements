export { withSharedPanelShadow } from '@spatial-elements/core/stage/panelShadowStyle';

/** Theme edits and responsive styles update GPU materials without per-frame CSS reads. */
export function observePanelShadowStyles(stage: HTMLElement, update: () => void) {
	const observer = new MutationObserver(update);
	for (let ancestor = stage.parentElement; ancestor; ancestor = ancestor.parentElement) {
		observer.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class', 'data-ps-theme', 'data-color-scheme'] });
	}
	observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'media', 'disabled'] });
	window.addEventListener('resize', update, { passive: true });
	return () => { observer.disconnect(); window.removeEventListener('resize', update); };
}
