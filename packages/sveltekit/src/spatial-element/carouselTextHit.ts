/** Test rendered text fragments, not the full width of their block container. */
export function carouselTextHit(target: EventTarget | null, x: number, y: number): HTMLElement | undefined {
	if (!(target instanceof HTMLElement) || !target.closest('.summary') ||
		target.closest('a, button, input, textarea, select, [contenteditable]')) return;
	const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.textContent?.trim()) continue;
		range.selectNodeContents(node);
		for (const rect of range.getClientRects()) {
			if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return target;
		}
	}
}
