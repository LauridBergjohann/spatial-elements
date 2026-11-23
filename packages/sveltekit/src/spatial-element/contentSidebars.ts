import { STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
import { layoutTokens } from '@page-sections/core';

/** CSS sticky cannot follow a document translated by the shared stage. Keep the
 * shared Page Sections markup, internal scrolling and native fallback intact. */
export function attachContentSidebars(host: HTMLElement) {
	const stage = host.closest('.stage');
	const offsets = new Map<HTMLElement, number>();
	const body = host.querySelector<HTMLElement>('.ps-page-content .page-body');
	let menu = host.querySelector<HTMLElement>('.ps-content-menu-slot');
	// Published Page Sections 0.5.1 includes pageEnd in the same grid row.
	// Bound its menu to the sections too; newer markup already separates that row.
	const measureBoundary = () => {
		const current = host.querySelector<HTMLElement>('.ps-content-menu-slot');
		if (current !== menu) menu?.style.removeProperty('--spatial-content-menu-height');
		menu = current;
		if (body && menu) menu.style.setProperty('--spatial-content-menu-height', `${body.offsetHeight}px`);
	};
	const reset = (node: HTMLElement) => {
		node.style.removeProperty('translate');
		node.removeAttribute('data-spatial-sticky-sidebar');
		offsets.delete(node);
	};
	const update = () => {
		const enhanced = stage?.classList.contains('stage-virtual-scroll-active');
		const desktop = window.innerWidth >= layoutTokens.layoutMinWidths.xl;
		const selector = desktop
			? '.ps-left-sidebar > .sidebar-panel, .ps-content-menu-slot > .desktop'
			: '.ps-content-menu-slot > .mobile';
		const nodes = new Set(enhanced ? host.querySelectorAll<HTMLElement>(selector) : []);
		for (const node of offsets.keys()) if (!nodes.has(node)) reset(node);
		if (!nodes.size) return;
		const boundary = host.querySelector('.ps-page-frame')?.getBoundingClientRect().bottom ?? Infinity;
		const contentBottom = body?.getBoundingClientRect().bottom ?? boundary;
		for (const node of nodes) {
			node.setAttribute('data-spatial-sticky-sidebar', '');
			const rect = node.getBoundingClientRect();
			const top = rect.top - (offsets.get(node) ?? 0);
			const inset = desktop ? parseFloat(getComputedStyle(node).getPropertyValue('--ps-sidebar-sticky-top')) || 16 : 12;
			const isContentMenu = menu?.contains(node);
			const bottom = isContentMenu ? contentBottom - (desktop ? parseFloat(getComputedStyle(menu!).paddingBottom) || 0 : 0) : boundary;
			const offset = Math.max(0, Math.min(inset - top, bottom - top - rect.height));
			if (offsets.get(node) !== offset) node.style.translate = `0 ${offset}px`;
			offsets.set(node, offset);
			if (desktop) node.style.setProperty('--ps-sidebar-available-height', `${Math.max(0, innerHeight - Math.max(inset, top + offset) - inset)}px`);
		}
	};
	const stop = subscribeStageScrollFrame(update, STAGE_SCROLL_PRIORITY.virtualDocument + 2);
	const resize = new ResizeObserver(() => { measureBoundary(); update(); });
	resize.observe(host);
	if (body) resize.observe(body);
	const observer = new MutationObserver(() => { measureBoundary(); update(); });
	observer.observe(host, { childList: true, subtree: true });
	if (stage) observer.observe(stage, { attributes: true, attributeFilter: ['class'] });
	window.addEventListener('resize', update);
	measureBoundary(); update();
	return () => {
		stop(); resize.disconnect(); observer.disconnect();
		window.removeEventListener('resize', update);
		for (const node of offsets.keys()) reset(node);
		menu?.style.removeProperty('--spatial-content-menu-height');
	};
}
