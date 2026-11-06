/** Read the entire live style before writing any frozen presentation value. */
export function freezePresentationBox(root: HTMLElement) {
	const box = root.getBoundingClientRect();
	const computed = getComputedStyle(root);
	const borderBox = (axis: 'width' | 'height') => {
		const value = parseFloat(computed[axis]);
		if (!Number.isFinite(value)) return axis === 'width' ? root.offsetWidth : root.offsetHeight;
		if (computed.boxSizing === 'border-box') return value;
		const edges = axis === 'width' ? ['left', 'right'] : ['top', 'bottom'];
		return value + edges.reduce((sum, edge) => sum
			+ parseFloat(computed.getPropertyValue(`padding-${edge}`) || '0')
			+ parseFloat(computed.getPropertyValue(`border-${edge}-width`) || '0'), 0);
	};
	// Projected rectangles can be tilted; CSS needs the untransformed local box.
	const width = borderBox('width'), height = borderBox('height');
	const snapshot = { css: root.style.cssText, box, width, height, inert: root.inert };
	const properties = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color'];
	for (let index = 0; index < computed.length; index++) {
		const name = computed[index];
		if (/^--(spatial|card|catalog|carousel|summary)-/.test(name)) properties.push(name);
	}
	// CSSStyleDeclaration is live. Alternating reads and writes would repeatedly
	// invalidate/recalculate style, and could change later inherited values.
	const values = properties.map(name => [name, computed.getPropertyValue(name)] as const);
	for (const [name, value] of values) root.style.setProperty(name, value);
	Object.assign(root.style, {
		width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`,
		height: `${height}px`, minHeight: `${height}px`, maxHeight: `${height}px`, boxSizing: 'border-box'
	});
	return snapshot;
}
