const PROPERTIES = ['overflow-x', 'overflow-y', 'clip-path', 'width', 'height', 'box-sizing',
	'padding-left', 'padding-right', 'padding-bottom'] as const;

/**
 * Let separately moving descendants leave their source clipping boxes. Preserve
 * each affected ancestor's local border box and scrollbar space so this does not
 * change source text wrapping. No actor is reparented or copied. Restore before
 * adopting the source component into its new layout.
 */
export function releaseSourceDomClipping(actors: readonly HTMLElement[], root: HTMLElement) {
	const ancestors = new Set<HTMLElement>();
	for (const actor of actors) {
		if (!root.contains(actor)) continue;
		for (let node = actor.parentElement; node && root.contains(node); node = node.parentElement) {
			ancestors.add(node);
			if (node === root) break;
		}
	}
	// Read all source boxes before changing overflow on any ancestor.
	const entries = [...ancestors].flatMap(element => {
		const style = getComputedStyle(element);
		if ([style.overflowX, style.overflowY].every(value => !value || value === 'visible') &&
			(!style.clipPath || style.clipPath === 'none')) return [];
		const px = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
		const horizontalBorder = px('border-left-width') + px('border-right-width');
		const verticalBorder = px('border-top-width') + px('border-bottom-width');
		const width = px('width') + (style.boxSizing === 'border-box' ? 0 : horizontalBorder + px('padding-left') + px('padding-right'));
		const height = px('height') + (style.boxSizing === 'border-box' ? 0 : verticalBorder + px('padding-top') + px('padding-bottom'));
		const verticalGutter = Math.max(0, element.offsetWidth - element.clientWidth - horizontalBorder);
		const horizontalGutter = Math.max(0, element.offsetHeight - element.clientHeight - verticalBorder);
		const gutterSide = style.direction === 'rtl' ? 'padding-left' : 'padding-right';
		return [{ element, width, height, gutterSide, gutterPadding: px(gutterSide), bottomPadding: px('padding-bottom'),
			verticalGutter: verticalGutter >= 1 ? verticalGutter : 0, horizontalGutter: horizontalGutter >= 1 ? horizontalGutter : 0,
			saved: PROPERTIES.map(property => ({ property, value: element.style.getPropertyValue(property),
				priority: element.style.getPropertyPriority(property) })) }];
	});
	// Removing a scroll container resets its offset and can reveal previously
	// clipped sibling content. Those sources need the ordinary transition rather
	// than a guessed scroll compensation or a flash of hidden snippet content.
	if (entries.some(({ element }) => element.scrollLeft !== 0 || element.scrollTop !== 0 ||
		element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)) return undefined;
	for (const entry of entries) {
		const write = (property: string, value: string) => entry.element.style.setProperty(property, value, 'important');
		write('box-sizing', 'border-box');
		if (entry.width > 0) write('width', `${entry.width}px`);
		if (entry.height > 0) write('height', `${entry.height}px`);
		if (entry.verticalGutter) write(entry.gutterSide, `${entry.gutterPadding + entry.verticalGutter}px`);
		if (entry.horizontalGutter) write('padding-bottom', `${entry.bottomPadding + entry.horizontalGutter}px`);
		write('overflow-x', 'visible'); write('overflow-y', 'visible'); write('clip-path', 'none');
	}
	let restored = false;
	return () => {
		if (restored) return;
		restored = true;
		for (const { element, saved } of entries) for (const { property, value, priority } of saved) {
			if (value) element.style.setProperty(property, value, priority);
			else element.style.removeProperty(property);
		}
	};
}
