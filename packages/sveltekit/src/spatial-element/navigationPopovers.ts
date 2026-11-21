/** Keep navigation in its semantic DOM while painting open panels above the 3D layers. */
export function enhanceNavigationPopovers(rack: HTMLElement) {
	const originals = new Map<HTMLElement, string | null>();
	const selector = '.ps-submenu:not([hidden]), details[open] > .settings-panel, details[open] > .mobile-panel, [data-spatial-navigation-popup]';

	function restore(panel: HTMLElement) {
		if (!originals.has(panel)) return;
		if (panel.matches(':popover-open')) panel.hidePopover();
		panel.removeAttribute('popover');
		const style = originals.get(panel);
		if (style === null) panel.removeAttribute('style');
		else panel.setAttribute('style', style!);
		originals.delete(panel);
	}

	function sync() {
		const panels = new Set(rack.querySelectorAll<HTMLElement>(selector));
		for (const panel of originals.keys()) if (!panels.has(panel)) restore(panel);
		for (const panel of panels) {
			if (originals.has(panel) || !('showPopover' in panel)) continue;
			// Desktop search fields stay in the header; only their mobile overlay is promoted.
			const style = getComputedStyle(panel);
			if (style.position !== 'absolute' || !panel.getClientRects().length) continue;
			if (panel.parentElement?.closest(':popover-open')) continue;
			const rect = panel.getBoundingClientRect();
			const width = Math.min(rect.width, innerWidth - 24);
			const padding = style.padding;
			originals.set(panel, panel.getAttribute('style'));
			panel.popover = 'manual';
			Object.assign(panel.style, {
				position: 'fixed', inset: 'auto', margin: '0', transform: 'none',
				left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + 'px',
				top: rect.top + 'px', width: width + 'px', padding, boxSizing: 'border-box',
				maxHeight: Math.max(0, innerHeight - rect.top - 12) + 'px', overflowY: 'auto'
			});
			panel.showPopover();
		}
	}
	const observer = new MutationObserver(sync);
	observer.observe(rack, { subtree: true, childList: true, attributes: true,
		attributeFilter: ['hidden', 'open', 'data-spatial-navigation-popup'] });
	sync();
	return () => { observer.disconnect(); for (const panel of originals.keys()) restore(panel); };
}
