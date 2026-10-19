/** Native tooltips only for clipped text; measurements never run on pointer movement. */
export function truncatedTitle(node: HTMLElement, text: string) {
	const target = node.closest<HTMLElement>('[data-catalog-card]') ?? node;
	let frame = 0;
	const measure = () => {
		frame = 0;
		if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)
			target.title = node.textContent?.trim() || text;
		else target.removeAttribute('title');
	};
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(measure);
	};
	const observer = new ResizeObserver(schedule);
	observer.observe(node);
	document.fonts?.addEventListener('loadingdone', schedule);
	schedule();
	return {
		update(value: string) { text = value; schedule(); },
		destroy() {
			cancelAnimationFrame(frame);
			observer.disconnect();
			document.fonts?.removeEventListener('loadingdone', schedule);
		}
	};
}
