import { resolveDetailLayout, type ResponsiveLayoutInput } from './responsiveLayout.js';
import { STAGE_PANEL_LAYOUT_EVENT } from '../stage/panelContext.js';
import { getStageVisualScrollPosition, STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame, syncStageScrollToNative } from '../stage/scrollFrame.js';
import { getPanelFocusBlur, getPanelFocusOffset, getPanelFocusOpacity, getPanelFocusPerspectiveOffset, getPerspectiveDistance } from '../stage/stageMath.js';
import { PANEL_CAMERA_FOV, PANEL_FOCUS_PERSPECTIVE_MAX_SCALE } from '../stage/stageConstants.js';

/** The native pane uses the same focus curve and camera-facing motion as panels. */
export function resolvePaneFocusPresentation(rect: { x: number; y: number; width: number; height: number },
	viewport: { width: number; height: number }, focus: number) {
	const position = { x: rect.x + rect.width / 2 - viewport.width / 2,
		y: viewport.height / 2 - rect.y - rect.height / 2 };
	const options = { width: rect.width, height: rect.height, position };
	const offset = getPanelFocusOffset(options, focus, viewport.width, viewport.height);
	const distance = getPerspectiveDistance(viewport.height, PANEL_CAMERA_FOV);
	const perspective = getPanelFocusPerspectiveOffset({ x: position.x + offset.x, y: position.y + offset.y }, offset.z, distance);
	return { x: offset.x + perspective.x, y: -offset.y - perspective.y,
		scale: Math.min(PANEL_FOCUS_PERSPECTIVE_MAX_SCALE, Math.max(1, distance / Math.max(distance - offset.z, 1))),
		opacity: getPanelFocusOpacity(focus), blur: getPanelFocusBlur(focus, options),
		pivotY: rect.y + rect.height / 2 };
}

/** One document coordinate system; clipping changes paint and hit testing only. */
export function resolvePaneScrollClip(bodyTop: number, bodyHeight: number, viewportTop: number, viewportBottom: number, scrollY: number) {
	return {
		top: Math.max(0, scrollY + viewportTop - bodyTop),
		bottom: Math.max(0, bodyTop + bodyHeight - scrollY - viewportBottom)
	};
}

/** Keeps fixed 3XL regions and the ordinary document body on the Stage scroll clock. */
export class SpatialElementPaneController {
	private body?: HTMLElement;
	private stage?: HTMLElement;
	private regions: HTMLElement[] = [];
	private hiddenRegions: HTMLElement[] = [];
	private observer?: ResizeObserver;
	private stageObserver?: MutationObserver;
	private stopScroll?: () => void;
	private frame = 0;
	private layout?: ReturnType<typeof resolveDetailLayout>;
	private metricKey = '';
	private bodyTop = 0;
	private bodyHeight = 0;
	private scrollY = 0;
	private hidden = false;
	private focus = 0;
	private focusPose = { x: 0, y: 0, scale: 1, opacity: 1, blur: 0, pivotY: 0 };
	private savedScroll?: { x: number; y: number };
	private actionBottom = Infinity;
	private sectionPositions: { element: HTMLElement; top: number }[] = [];
	private restoreAnchor?: { element: HTMLElement; offset: number };
	private resizeAnchor?: { element: HTMLElement; offset: number };
	private readingTop = 0;
	private started = false;

	constructor(private readonly root: HTMLElement,
		private readonly readMetrics: () => ResponsiveLayoutInput | undefined,
		private readonly onMode: (split: boolean) => void) {}

	start() {
		if (this.started) return;
		this.started = true;
		this.stage = this.root.closest<HTMLElement>('.stage') ?? undefined;
		this.body = this.root.querySelector<HTMLElement>('[data-spatial-detail-pane-body]') ?? undefined;
		this.regions = Array.from(this.root.querySelectorAll<HTMLElement>('[data-spatial-detail-fixed]'));
		this.hiddenRegions = Array.from(this.root.querySelectorAll<HTMLElement>('[data-spatial-detail-pane-body], [data-spatial-detail-pane-header], [data-spatial-detail-pane-submenu-shell]'));
		this.scrollY = getStageVisualScrollPosition().scrollY;
		this.observer = new ResizeObserver(this.schedule);
		if (this.body) this.observer.observe(this.body);
		this.stageObserver = new MutationObserver(this.schedule);
		if (this.stage) this.stageObserver.observe(this.stage, { attributes: true, attributeFilter: ['class'] });
		window.addEventListener(STAGE_PANEL_LAYOUT_EVENT, this.schedule);
		window.addEventListener('resize', this.handleResize, { passive: true });
		this.root.addEventListener('focusin', this.handleFocus);
		this.stopScroll = subscribeStageScrollFrame(frame => {
			this.scrollY = frame.scrollY;
			this.paint();
		}, STAGE_SCROLL_PRIORITY.virtualDocument + 2);
		this.update();
	}

	setHidden(hidden: boolean) {
		if (this.hidden === hidden) return;
		this.hidden = hidden;
		if (hidden && this.layout?.composition === 'split') this.savedScroll = { x: window.scrollX, y: window.scrollY };
		this.root.toggleAttribute('data-spatial-detail-pane-hidden', hidden);
		for (const region of this.hiddenRegions) region.inert = hidden && this.layout?.composition === 'split';
		if (!hidden && this.savedScroll) {
			window.scrollTo({ left: this.savedScroll.x, top: this.savedScroll.y, behavior: 'instant' });
			syncStageScrollToNative();
			this.savedScroll = undefined;
		}
	}

	setFocus(focus: number, fullscreen = false) {
		this.focus = fullscreen ? 1 : Math.max(0, Math.min(1, Number.isFinite(focus) ? focus : 0));
		this.paintFocus();
	}

	destroy() {
		this.started = false;
		this.stopScroll?.();
		this.observer?.disconnect();
		this.stageObserver?.disconnect();
		cancelAnimationFrame(this.frame);
		window.removeEventListener(STAGE_PANEL_LAYOUT_EVENT, this.schedule);
		window.removeEventListener('resize', this.handleResize);
		this.root.removeEventListener('focusin', this.handleFocus);
		for (const region of this.regions) region.removeAttribute('data-stage-fixed-region');
	}

	private readonly schedule = () => {
		if (!this.started || this.frame) return;
		this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
	};

	private readAnchor() {
		const anchor = this.sectionPositions.filter(item => item.top <= this.scrollY + this.readingTop + 1).at(-1);
		return anchor ? { element: anchor.element, offset: this.scrollY + this.readingTop - anchor.top } : undefined;
	}

	private readonly handleResize = () => {
		// CSS reflows before the shared viewport probe's next frame. Preserve the
		// last stable document anchor now, before any observer can cache new boxes
		// against old metrics. Keep it across consecutive breakpoint crossings.
		this.resizeAnchor ??= this.restoreAnchor ?? this.readAnchor();
		this.schedule();
	};

	private update() {
		const metrics = this.readMetrics();
		if (!metrics || !this.body) return;
		if (!this.stage?.classList.contains('stage-virtual-scroll-active')) this.scrollY = window.scrollY;
		const key = JSON.stringify(metrics);
		const metricsChanged = key !== this.metricKey;
		if (key !== this.metricKey) {
			const previous = this.layout;
			const next = resolveDetailLayout(metrics);
			if (previous && previous.composition !== next.composition && this.scrollY > 1) {
				this.restoreAnchor = this.resizeAnchor ?? this.restoreAnchor ?? this.readAnchor();
			}
			if (!this.restoreAnchor) this.resizeAnchor = undefined;
			this.metricKey = key;
			this.layout = next;
			const split = next.composition === 'split';
			this.root.toggleAttribute('data-spatial-detail-pane', split);
			this.root.toggleAttribute('data-spatial-detail-flow', next.shortHeightFallback);
			for (const region of this.regions) region.toggleAttribute('data-stage-fixed-region', split);
			for (const region of this.hiddenRegions) region.inert = split && this.hidden;
			this.onMode(split);
			// The framework flushes the native summary ownership before its new box is measured.
			this.schedule();
		}
		const rect = this.body.getBoundingClientRect();
		// A breakpoint can remove the paint transform before this resize callback.
		if (this.layout?.composition !== 'split') this.focusPose = { x: 0, y: 0, scale: 1, opacity: 1, blur: 0, pivotY: 0 };
		const bodyHeightChanged = Math.abs(this.bodyHeight - rect.height / this.focusPose.scale) > 0.5;
		this.bodyTop = this.neutralY(rect.top) + this.scrollY;
		this.bodyHeight = rect.height / this.focusPose.scale;
		this.sectionPositions = Array.from(this.body.querySelectorAll<HTMLElement>('[data-spatial-element-tab-target]'))
			.map(element => ({ element, top: this.neutralY(element.getBoundingClientRect().top) + this.scrollY }));
		const action = this.body.querySelector<HTMLElement>('[data-catalog-rich-shared="primary-action"]');
		this.actionBottom = action ? this.neutralY(action.getBoundingClientRect().bottom) + this.scrollY : Infinity;
		this.readingTop = this.layout?.pane?.body.y ?? (Number.parseFloat(getComputedStyle(this.root).getPropertyValue('--spatial-element-section-scroll-offset')) || 0);
		const summaryReady = this.layout?.composition !== 'split' || Boolean(this.body.querySelector('[data-spatial-summary-root]'));
		if (!metricsChanged && !bodyHeightChanged && summaryReady && this.restoreAnchor && this.restoreAnchor.element.isConnected) {
			const anchor = this.restoreAnchor;
			this.restoreAnchor = undefined;
			this.resizeAnchor = undefined;
			const y = Math.max(0, this.neutralY(anchor.element.getBoundingClientRect().top) + this.scrollY + anchor.offset - this.readingTop);
			window.scrollTo({ top: y, behavior: 'instant' });
			syncStageScrollToNative();
			this.scrollY = getStageVisualScrollPosition().scrollY;
		}
		if (this.restoreAnchor) this.schedule();
		this.paint();
	}

	private paint() {
		this.paintFocus();
		const pane = this.layout?.pane;
		if (!pane || !this.body) {
			this.root.removeAttribute('data-spatial-detail-pane-clipped');
			this.body?.style.removeProperty('clip-path');
			this.root.style.removeProperty('--spatial-pane-fixed-compensation');
			return;
		}
		const enhanced = this.stage?.classList.contains('stage-virtual-scroll-active');
		this.root.style.setProperty('--spatial-pane-fixed-compensation', `${enhanced ? this.scrollY : 0}px`);
		const clip = resolvePaneScrollClip(this.bodyTop, this.bodyHeight, pane.body.y, pane.body.y + pane.body.height, this.scrollY);
		this.body.style.clipPath = `inset(${clip.top}px 0 ${clip.bottom}px 0 round 0 0 var(--spatial-element-panel-radius) var(--spatial-element-panel-radius))`;
		this.root.toggleAttribute('data-spatial-detail-pane-clipped', true);
		this.root.toggleAttribute('data-spatial-detail-pane-action', this.actionBottom - this.scrollY <= pane.body.y);
	}

	/** Measurements remain in document coordinates while the pane moves in paint. */
	private neutralY(y: number) {
		const { scale, pivotY, y: offset } = this.focusPose;
		return pivotY + (y - pivotY - offset) / scale;
	}

	private paintFocus() {
		const pane = this.layout?.pane;
		const metrics = this.readMetrics();
		this.focusPose = pane && metrics ? resolvePaneFocusPresentation(pane.surface, metrics, this.focus)
			: { x: 0, y: 0, scale: 1, opacity: 1, blur: 0, pivotY: 0 };
		const pose = this.focusPose;
		this.root.toggleAttribute('data-spatial-detail-pane-zooming', Boolean(pane && this.focus > 0.001));
		this.setHidden(Boolean(pane && pose.opacity < 0.12));
		const values = { '--spatial-pane-focus-x': `${pose.x}px`, '--spatial-pane-focus-y': `${pose.y}px`,
			'--spatial-pane-focus-scale': String(pose.scale), '--spatial-pane-focus-opacity': String(pose.opacity),
			'--spatial-pane-focus-blur': `${pose.blur}px` };
		for (const [name, value] of Object.entries(values)) {
			if (this.root.style.getPropertyValue(name) !== value) this.root.style.setProperty(name, value);
		}
		if (!pane || !this.body) return;
		this.body.style.setProperty('--spatial-pane-focus-origin-y', `${pose.pivotY - this.bodyTop + this.scrollY}px`);
		for (const region of this.regions) {
			const top = region.hasAttribute('data-spatial-detail-pane-submenu-shell') ? pane.surface.y + pane.surface.height
				: region.hasAttribute('data-spatial-detail-pane-header') || region.hasAttribute('data-spatial-detail-pane-surface') ? pane.surface.y : undefined;
			if (top !== undefined) region.style.setProperty('--spatial-pane-focus-origin-y', `${pose.pivotY - top}px`);
		}
	}

	private readonly handleFocus = (event: FocusEvent) => {
		// VirtualScrollController owns the enhanced path; native DOM uses identical bounds.
		if (!this.layout?.pane || this.hidden || this.stage?.classList.contains('stage-virtual-scroll-active')) return;
		const target = event.target;
		if (!(target instanceof HTMLElement) || !this.body?.contains(target)) return;
		const rect = target.getBoundingClientRect();
		const viewport = this.layout.pane.body;
		if (rect.top >= viewport.y && rect.bottom <= viewport.y + viewport.height) return;
		window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - viewport.y - Math.max(0, (viewport.height - rect.height) / 2)), behavior: 'instant' });
	};
}
