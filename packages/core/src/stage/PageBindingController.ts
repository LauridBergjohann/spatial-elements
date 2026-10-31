import type { StagePanelTarget, StageViewportTarget } from './stageTypes.js';
import { getStickyPanelTop } from './stageDom.js';
import { resolveMenuOffset } from '../spatial-element/responsiveLayout.js';

export interface CachedStageRect {
	fixed: boolean;
	height: number;
	left: number;
	top: number;
	width: number;
	sticky?: { inset: number; boundaryBottom: number };
	/** Persistent shell panels share the DOM rack's bounded scroll rule. */
	shell?: { fixed: boolean };
}

/** Page-local registrations only. Never owns element leases or a renderer. */
export class PageBindingController {
	private epoch = 0;
	private targets: StagePanelTarget[] = [];
	private viewportHost?: StageViewportTarget;
	private observer?: ResizeObserver;
	private readonly rectangles = new Map<HTMLElement, CachedStageRect>();
	private viewportRectangle?: CachedStageRect;

	get token() {
		return this.epoch;
	}
	get panels() {
		return this.targets;
	}
	get viewport() {
		return this.viewportHost;
	}
	get viewportRect() {
		return this.viewportRectangle;
	}
	set viewportRect(rect: CachedStageRect | undefined) {
		this.viewportRectangle = rect;
	}
	isCurrent(token: number) {
		return token === this.epoch;
	}

	attach(panels: StagePanelTarget[] = [], viewport?: StageViewportTarget) {
		this.targets = [...panels];
		this.viewportHost = viewport;
	}

	/** Invalidate callbacks before consumers tear down local presentation objects. */
	invalidate() {
		this.epoch++;
		this.observer?.disconnect();
		this.observer = undefined;
		for (const target of this.targets) delete target.frame.dataset.stagePanelBound;
	}

	release() {
		this.targets = [];
		this.viewportHost = undefined;
		this.clearMeasurements();
	}

	clearMeasurements() {
		this.rectangles.clear();
		this.viewportRectangle = undefined;
	}

	observe(onResize: ResizeObserverCallback) {
		this.observer?.disconnect();
		if ((!this.targets.length && !this.viewportHost) || typeof ResizeObserver === 'undefined')
			return;
		const token = this.token;
		this.observer = new ResizeObserver((entries, observer) => {
			if (this.isCurrent(token)) onResize(entries, observer);
		});
		for (const target of this.targets) {
			this.observer.observe(target.frame);
			if (target.frame.parentElement) this.observer.observe(target.frame.parentElement);
		}
		if (this.viewportHost) this.observer.observe(this.viewportHost.element);
	}

	getPanelRect(element: HTMLElement) {
		return this.rectangles.get(element);
	}
	setPanelRect(element: HTMLElement, rect: CachedStageRect) {
		this.rectangles.set(element, rect);
	}

	measure(element: HTMLElement, scrollX: number, scrollY: number): CachedStageRect {
		const rect = element.getBoundingClientRect();
		const popover = element.closest?.<HTMLElement>('[popover]');
		// A projected child can be relatively positioned inside a region which the
		// document owner keeps fixed. Cache its visible rectangle once; subtracting
		// the document scroll again would move the GPU surface away from that DOM.
		const fixedRegion = element.closest?.<HTMLElement>('[data-stage-fixed-region]');
		const style = window.getComputedStyle(element);
		const fixed = Boolean(fixedRegion) || style.position === 'fixed' ||
			Boolean(popover && window.getComputedStyle(popover).position === 'fixed');
		const shell = !fixed ? element.closest?.<HTMLElement>('[data-stage-scroll-shell]') : undefined;
		const compensation = shell ? Number(shell.dataset.stageScrollCompensation) || 0 : 0;
		const sticky = style.position === 'sticky' && element.parentElement && style.top !== 'auto'
			? { inset: Number.parseFloat(style.top) || 0, boundaryBottom: element.parentElement.getBoundingClientRect().bottom + scrollY }
			: undefined;
		return {
			fixed,
			left: rect.left + (fixed ? 0 : scrollX),
			top: rect.top + (fixed ? 0 : scrollY) - compensation,
			width: rect.width,
			height: rect.height,
			...(sticky ? { sticky } : {}),
			...(shell ? { shell: { fixed: shell.hasAttribute('data-stage-scroll-shell-fixed') } } : {})
		};
	}

	resolve(rect: CachedStageRect, scrollX: number, scrollY: number) {
		const left = rect.left - (rect.fixed ? 0 : scrollX);
		const top = rect.shell ? rect.top + resolveMenuOffset(scrollY, rect.shell.fixed) : rect.sticky
			? getStickyPanelTop(rect.top, rect.height, rect.sticky.boundaryBottom, rect.sticky.inset, scrollY)
			: rect.top - (rect.fixed ? 0 : scrollY);
		return {
			left,
			top,
			right: left + rect.width,
			bottom: top + rect.height,
			width: rect.width,
			height: rect.height
		};
	}
}
