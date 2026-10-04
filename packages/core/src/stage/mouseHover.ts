const hovered = new Set<HTMLElement>();
let subscribers = 0;

function clearHover(event?: PointerEvent) {
	if (event?.pointerType === 'mouse') return;
	for (const node of hovered) node.removeAttribute('data-mouse-hover');
	hovered.clear();
}

const clearOnBlur = () => clearHover();

/**
 * Gates CSS hover effects by the actual pointer, including on touch laptops.
 * Capability media queries alone still allow sticky touch :hover on hybrid devices.
 * The returned lifecycle also works as a Svelte action.
 */
export function mouseHover(node: HTMLElement) {
	const enter = (event: PointerEvent) => {
		if (event.pointerType !== 'mouse') {
			clearHover();
			return;
		}
		if (hovered.has(node)) return;
		hovered.add(node);
		node.setAttribute('data-mouse-hover', '');
	};
	const leave = () => {
		hovered.delete(node);
		node.removeAttribute('data-mouse-hover');
	};

	if (subscribers++ === 0) {
		window.addEventListener('pointerdown', clearHover, { capture: true, passive: true });
		window.addEventListener('pointermove', clearHover, { capture: true, passive: true });
		window.addEventListener('blur', clearOnBlur);
	}
	node.addEventListener('pointerenter', enter, { passive: true });
	node.addEventListener('pointermove', enter, { passive: true });
	node.addEventListener('pointerleave', leave, { passive: true });
	node.addEventListener('pointercancel', leave, { passive: true });

	return {
		destroy() {
			leave();
			node.removeEventListener('pointerenter', enter);
			node.removeEventListener('pointermove', enter);
			node.removeEventListener('pointerleave', leave);
			node.removeEventListener('pointercancel', leave);
			if (--subscribers === 0) {
				window.removeEventListener('pointerdown', clearHover, true);
				window.removeEventListener('pointermove', clearHover, true);
				window.removeEventListener('blur', clearOnBlur);
			}
		}
	};
}
