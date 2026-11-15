import { STAGE_PANEL_LAYOUT_EVENT, STAGE_PANEL_VISUAL_EVENT } from '../stage/panelContext.js';
import { STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '../stage/scrollFrame.js';

const FIELD = '[data-spatial-element-header-field]';
const ACTION = '[data-spatial-element-dock-action]';

/** Matches projected summary fields to their fixed-header copies, including the 3XL pane. */
export class SpatialElementHeaderFields {
	private readonly summary: HTMLElement | null;
	private readonly headers: HTMLElement[];
	private readonly summaryFrame: HTMLElement | null;
	private readonly originalInert = new Map<HTMLElement, boolean>();
	private stopScroll?: () => void;
	private observer?: ResizeObserver;
	private frame = 0;

	constructor(private readonly root: HTMLElement) {
		// Retain nodes before the stage reparents projected content and the scroll header.
		this.summary = root.querySelector('[data-spatial-element-hero-panel-content]');
		this.summaryFrame = root.querySelector('[data-spatial-summary-aside]');
		this.headers = Array.from(root.querySelectorAll('[data-spatial-element-handoff-header]'));
	}

	start() {
		this.stopScroll = subscribeStageScrollFrame(this.update, STAGE_SCROLL_PRIORITY.stage + 1);
		window.addEventListener(STAGE_PANEL_LAYOUT_EVENT, this.schedule);
		window.addEventListener(STAGE_PANEL_VISUAL_EVENT, this.schedule);
		this.observer = new ResizeObserver(this.schedule);
		if (this.summary) this.observer.observe(this.summary);
		for (const header of this.headers) this.observer.observe(header);
		this.update();
	}

	destroy() {
		this.stopScroll?.();
		this.observer?.disconnect();
		window.removeEventListener(STAGE_PANEL_LAYOUT_EVENT, this.schedule);
		window.removeEventListener(STAGE_PANEL_VISUAL_EVENT, this.schedule);
		cancelAnimationFrame(this.frame);
		for (const [element, inert] of this.originalInert) {
			element.inert = inert;
			element.removeAttribute('data-header-field-visible');
		}
	}

	private readonly schedule = () => {
		if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
	};

	private readonly update = () => {
		if (!this.summary?.isConnected) return;
		const sources = new Map<string, HTMLElement>();
		for (const field of this.summary.querySelectorAll<HTMLElement>(FIELD))
			sources.set(field.dataset.spatialElementHeaderField!, field);
		const action = this.summary.querySelector<HTMLElement>('[data-catalog-rich-shared="primary-action"]');
		if (action) sources.set('primary-action', action);
		// Read the actual projected boxes, after the stage has positioned its DOM.
		// Cached document offsets drift with sticky panels, transfers and responsive reflow.
		const bounds = new Map([...sources].map(([key, element]) => [key, element.getBoundingClientRect()]));
		// Offscreen projected content is culled (display:none). Its live layout
		// placeholder still tells us whether the entire panel has passed the header.
		const summaryRect = this.summaryFrame?.getBoundingClientRect();
		const covered = new Set<HTMLElement>();
		const updates: { target: HTMLElement; visible: boolean }[] = [];
		for (const header of this.headers) {
			const pane = header.hasAttribute('data-spatial-detail-pane-header');
			const active = pane ? this.root.hasAttribute('data-spatial-detail-pane')
				: header.getAttribute('aria-hidden') === 'false';
			const headerRect = header.getBoundingClientRect();
			for (const target of header.querySelectorAll<HTMLElement>(`${FIELD}, ${ACTION}`)) {
				const key = target.hasAttribute('data-spatial-element-dock-action') ? 'primary-action'
					: target.dataset.spatialElementHeaderField!;
				const source = sources.get(key);
				const rect = bounds.get(key);
				const sourceRect = rect?.height ? rect : summaryRect;
				const visible = active && headerRect.height > 0 && Boolean(source && sourceRect && sourceRect.height > 0 && (key === 'primary-action' && rect?.height
					? sourceRect.top + sourceRect.height / 2 < headerRect.bottom
					: sourceRect.bottom <= headerRect.bottom));
				updates.push({ target, visible });
				if (active && source && sourceRect && sourceRect.bottom <= headerRect.bottom) covered.add(source);
			}
		}
		for (const { target, visible } of updates) {
			this.setInert(target, !visible);
			if (target.hasAttribute('data-header-field-visible') !== visible)
				target.toggleAttribute('data-header-field-visible', visible);
		}
		for (const source of sources.values()) this.setInert(source, covered.has(source));
	};

	private setInert(element: HTMLElement, hidden: boolean) {
		if (!this.originalInert.has(element)) this.originalInert.set(element, element.inert);
		const inert = hidden || this.originalInert.get(element)!;
		if (element.inert !== inert) element.inert = inert;
	}
}
