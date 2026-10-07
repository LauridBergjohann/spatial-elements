/** Patch authored declarations without erasing the renderer's position, transform or visibility. */
export function authoredStyle(node: HTMLElement, value: string) {
	let previous = new Set<string>();
	function update(next: string) {
		const parsed = document.createElement('div').style;
		parsed.cssText = next;
		const properties = new Set(Array.from(parsed));
		for (const name of previous) if (!properties.has(name)) node.style.removeProperty(name);
		for (const name of properties)
			node.style.setProperty(name, parsed.getPropertyValue(name), parsed.getPropertyPriority(name));
		previous = properties;
	}
	update(value);
	return { update };
}
