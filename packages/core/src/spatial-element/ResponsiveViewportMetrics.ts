import type { ResponsiveLayoutInput } from './responsiveLayout.js';
import { STAGE_PANEL_LAYOUT_EVENT } from '../stage/panelContext.js';

/** One browser-resolved source for svh, safe areas and reserved scrollbar width. */
export class ResponsiveViewportMetrics {
	private probe?: HTMLDivElement;
	private observer?: ResizeObserver;
	private frame = 0;
	private snapshot?: ResponsiveLayoutInput;
	private visibleHeight = 0;
	constructor(private readonly container: HTMLElement) {}
	start() {
		if (this.probe) return;
		const probe = document.createElement('div');
		probe.setAttribute('aria-hidden', 'true');
		probe.dataset.spatialViewportMetrics = '';
		probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100svh;box-sizing:border-box;visibility:hidden;pointer-events:none;contain:strict;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
		this.container.appendChild(probe);
		this.probe = probe;
		this.measure();
		this.observer = new ResizeObserver(this.schedule);
		this.observer.observe(probe);
		this.observer.observe(document.documentElement);
		window.addEventListener('resize', this.schedule, { passive: true });
		window.addEventListener('orientationchange', this.schedule, { passive: true });
	}
	/** Cached reads never force layout during animation. */
	read(mode: 'stable' | 'visible' = 'stable'): ResponsiveLayoutInput | undefined {
		if (!this.snapshot) return;
		return mode === 'stable' ? this.snapshot : { ...this.snapshot, height: this.visibleHeight };
	}
	destroy() {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.observer?.disconnect();
		this.observer = undefined;
		window.removeEventListener('resize', this.schedule);
		window.removeEventListener('orientationchange', this.schedule);
		this.probe?.remove();
		this.probe = undefined;
		this.snapshot = undefined;
	}
	private readonly schedule = () => {
		if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.measure(); });
	};
	private measure() {
		if (!this.probe) return;
		const style = getComputedStyle(this.probe);
		const px = (value: string) => Number.parseFloat(value) || 0;
		const previous = JSON.stringify(this.snapshot);
		const previousVisibleHeight = this.visibleHeight;
		this.visibleHeight = window.innerHeight;
		this.snapshot = {
			width: window.innerWidth,
			height: this.probe.getBoundingClientRect().height,
			scrollbarWidth: Math.max(0, window.innerWidth - document.documentElement.getBoundingClientRect().width),
			safeArea: { top: px(style.paddingTop), right: px(style.paddingRight), bottom: px(style.paddingBottom), left: px(style.paddingLeft) }
		};
		if (previous !== JSON.stringify(this.snapshot) || previousVisibleHeight !== this.visibleHeight)
			window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
	}
}
