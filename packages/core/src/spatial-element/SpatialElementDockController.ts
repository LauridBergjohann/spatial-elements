import { STAGE_PANEL_LAYOUT_EVENT, STAGE_PANEL_VISUAL_EVENT } from '../stage/panelContext.js';
import { getStickyPanelTop } from '../stage/stageDom.js';
import type { ResponsiveLayoutInput } from './responsiveLayout.js';
import {
	STAGE_SCROLL_PRIORITY,
	getStageVisualScrollPosition,
	subscribeStageScrollFrame,
	type StageScrollFrame
} from '../stage/scrollFrame.js';
import {
	getDockedMinimapInteractionRect,
	getDockedMinimapModelScale,
	getSpatialElementDockBreakpoint,
	getSpatialElementDockPresentationProgress,
	getSpatialElementDockTarget,
	getSpatialElementTabsDockBreakpoint,
	getSpatialElementTabsDockProgress,
	getSpatialElementTabsDockTarget,
	resolveSpatialElementDockLayout,
	type SpatialElementDockRect
} from './spatialElementDock.js';

const TABS_DOCK_MORPH_DISTANCE = 24;
const MINIMAP_ANCHOR = '[data-spatial-element-dock-minimap-anchor]';
const PANEL_FRAME = '[data-stage-panel-fallback]';
const STICKY_HEADER = '[data-spatial-element-sticky-header]';
const STICKY_MINIMAP_ACTION = '[data-spatial-element-sticky-minimap-action]';
const TABS_ANCHOR = '[data-spatial-element-tabs-panel-anchor]';
const TABS_LIST = '[data-spatial-element-tab-list]';
const TABS_LINKS = '[data-spatial-element-tab-links]';
const STICKY_TABS = '[data-spatial-element-sticky-tabs]';
const SPATIAL_ELEMENT_LAYOUT_ROOT = '.stage';
const DEPARTING_CONTENT =
	'[data-spatial-element-hero-panel-content], [data-spatial-element-departing-media-content]';

interface ContentPresentation {
	element: HTMLElement;
	frame?: HTMLElement;
	sticky?: { documentTop: number; height: number; boundaryBottom: number; inset: number; contentInset: number };
	clipPath: string;
	webkitClipPath: string;
	documentTop: number;
	height: number;
	action?: { element: HTMLElement; bottom: number; inert: boolean };
	appliedClipPath?: string;
}

/**
 * Pins the existing minimap without transforming it and reveals a separate HTML header.
 * The element summary stays bounded by its hero while the header takes over on scroll.
 */
export class SpatialElementDockController {
	private minimapAnchor?: HTMLElement;
	private minimapFrame?: HTMLElement;
	private stickyHeader?: HTMLElement;
	private stickyMinimapAction?: HTMLElement;
	private stickyAction?: HTMLElement;
	private stickyHeaderOriginalParent?: HTMLElement;
	private stickyHeaderOriginalNextSibling?: ChildNode | null;
	private stickyHeaderOriginalStyle: string | null = null;
	private tabsAnchor?: HTMLElement;
	private tabsFrame?: HTMLElement;
	private sourceTabsList?: HTMLElement;
	private stickyTabs?: HTMLElement;
	private paneTabs?: HTMLElement;
	private tabsInPane = false;
	private tabsListOriginalParent?: HTMLElement;
	private tabsListOriginalNextSibling?: ChildNode | null;
	private stickyTabsOriginalParent?: HTMLElement;
	private stickyTabsOriginalNextSibling?: ChildNode | null;
	private stickyTabsOriginalStyle: string | null = null;
	private tabsOriginalSurfaceOpacity = '';
	private departingContent: ContentPresentation[] = [];
	private minimapOriginalStyle: string | null = null;
	private minimapOriginalDockProgress: string | null = null;
	private minimapOriginalModelScale: string | null = null;
	private minimapOriginalModelTop: string | null = null;
	private minimapDock?: SpatialElementDockRect;
	private minimapViewportTop = 0;
	private tabsDock?: SpatialElementDockRect;
	private dockedMinimapModelScale = 1;
	private stickyHeaderBottom = 0;
	private breakpoint = 0;
	private presentationEndScrollY = 0;
	private tabsBreakpoint = Number.POSITIVE_INFINITY;
	private tabsPanelRadius = 12;
	private tabsDockProgress = -1;
	private resizeObserver?: ResizeObserver;
	private animationFrame = 0;
	private layoutDirty = false;
	private stopScrollFrames?: () => void;
	private decorationOpacity = 1;
	private minimapDockProgress = 0;
	private minimapModelScale = 1;
	private scrollY = 0;
	private minimapDockApplied = false;
	private started = false;
	private docked = false;
	private presentationProgress = 0;
	private presentationRevision = 0;
	private tabsDocked = false;
	private readonly layoutRoot?: HTMLElement;

	constructor(private readonly root: HTMLElement, private readonly readLayoutMetrics?: () => ResponsiveLayoutInput | undefined) {
		this.layoutRoot = root.closest<HTMLElement>(SPATIAL_ELEMENT_LAYOUT_ROOT) ?? undefined;
	}

	/** Production presentation state, published after this controller's ordered scroll update. */
	getPresentation() {
		return {
			composition:
				!this.started || !this.stickyHeader?.isConnected
					? ('unavailable' as const)
					: this.docked && this.presentationProgress === 1
						? ('dock' as const)
						: !this.docked && this.presentationProgress === 0
							? ('hero' as const)
							: ('intermediate' as const),
			progress: this.presentationProgress,
			revision: this.presentationRevision
		};
	}

	start() {
		if (this.started) return;

		this.minimapAnchor = this.root.querySelector<HTMLElement>(MINIMAP_ANCHOR) ?? undefined;
		this.minimapFrame = this.minimapAnchor?.querySelector<HTMLElement>(PANEL_FRAME) ?? undefined;
		this.stickyHeader = this.root.querySelector<HTMLElement>(STICKY_HEADER) ?? undefined;
		this.stickyMinimapAction =
			this.stickyHeader?.querySelector<HTMLElement>(STICKY_MINIMAP_ACTION) ?? undefined;
		this.stickyAction = this.stickyHeader?.querySelector<HTMLElement>('[data-spatial-element-dock-action]') ?? undefined;
		this.tabsAnchor = this.root.querySelector<HTMLElement>(TABS_ANCHOR) ?? undefined;
		this.tabsFrame = this.tabsAnchor?.querySelector<HTMLElement>(PANEL_FRAME) ?? undefined;
		this.sourceTabsList = this.tabsFrame?.querySelector<HTMLElement>(TABS_LIST) ?? undefined;
		this.stickyTabs = this.stickyHeader?.querySelector<HTMLElement>(STICKY_TABS) ?? undefined;
		this.paneTabs = this.root.querySelector<HTMLElement>('[data-spatial-detail-pane-submenu]') ?? undefined;
		this.tabsListOriginalParent = this.sourceTabsList?.parentElement ?? undefined;
		this.tabsListOriginalNextSibling = this.sourceTabsList?.nextSibling;
		this.departingContent = Array.from(
			this.root.querySelectorAll<HTMLElement>(DEPARTING_CONTENT)
		).map((element) => ({
			element,
			frame: element.closest<HTMLElement>(PANEL_FRAME) ?? undefined,
			clipPath: element.style.clipPath,
			webkitClipPath: element.style.getPropertyValue('-webkit-clip-path'),
			documentTop: 0,
			height: 0
		}));

		if (!this.minimapFrame || !this.minimapAnchor || !this.stickyHeader) return;

		this.mountStickyHeaderOverlay();
		this.mountStickyTabsOverlay();
		this.stickyHeaderOriginalStyle = this.stickyHeader.getAttribute('style');
		this.minimapOriginalStyle = this.minimapFrame.getAttribute('style');
		this.minimapOriginalDockProgress = this.minimapFrame.getAttribute(
			'data-stage-minimap-dock-progress'
		);
		this.minimapOriginalModelScale = this.minimapFrame.getAttribute(
			'data-stage-minimap-model-scale'
		);
		this.minimapOriginalModelTop = this.minimapFrame.getAttribute('data-stage-minimap-model-top');
		this.stickyTabsOriginalStyle = this.stickyTabs?.getAttribute('style') ?? null;
		this.tabsOriginalSurfaceOpacity =
			this.tabsFrame?.style.getPropertyValue('--stage-panel-surface-opacity') ?? '';
		this.decorationOpacity = this.getMinimapSurfaceOpacity();
		this.minimapDockProgress = this.getMinimapDockProgress();
		this.minimapModelScale = this.getMinimapModelScale();
		this.scrollY = getStageVisualScrollPosition().scrollY;
		this.started = true;
		this.measure();
		this.stopScrollFrames = subscribeStageScrollFrame(this.scrollFrame, STAGE_SCROLL_PRIORITY.dock);
		window.addEventListener('resize', this.handleResize, { passive: true });
		window.addEventListener(STAGE_PANEL_LAYOUT_EVENT, this.handlePanelLayout);

		if ('ResizeObserver' in window) {
			this.resizeObserver = new ResizeObserver(this.handleResize);
			this.resizeObserver.observe(this.minimapAnchor);
			this.resizeObserver.observe(this.stickyHeader);
			if (this.tabsAnchor) this.resizeObserver.observe(this.tabsAnchor);
			for (const { frame } of this.departingContent) {
				if (frame) this.resizeObserver.observe(frame);
				if (frame?.parentElement) this.resizeObserver.observe(frame.parentElement);
			}
		}

		this.setTabsActive(false);
		this.update();
	}

	destroy() {
		if (!this.started) return;
		this.started = false;
		this.stopScrollFrames?.();
		this.stopScrollFrames = undefined;
		window.removeEventListener('resize', this.handleResize);
		window.removeEventListener(STAGE_PANEL_LAYOUT_EVENT, this.handlePanelLayout);
		this.resizeObserver?.disconnect();
		if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
		this.restoreMinimap();
		this.restoreMinimapDockProgress();
		this.restoreMinimapModelScale();
		this.restoreMinimapModelTop();
		this.restoreHeaderPresentation();
		this.setHeaderActive(false);
		this.setPaneTabsActive(false);
		this.setTabsActive(false);
		this.restoreStickyTabs();
		this.restoreStickyHeader();
		this.restoreDepartingContentClipping();
		for (const { action } of this.departingContent) {
			if (action) action.element.inert = action.inert;
		}
		this.root.removeAttribute('data-spatial-element-dock-active');
		this.root.removeAttribute('data-spatial-element-tabs-dock-active');
		this.root.style.removeProperty('--spatial-element-section-scroll-offset');
		this.root.style.removeProperty('--spatial-element-summary-sticky-top');
	}

	private readonly scrollFrame = (frame: StageScrollFrame) => {
		this.scrollY = frame.scrollY;
		this.update();
	};

	private readonly schedule = () => {
		if (!this.started || this.animationFrame) return;
		this.animationFrame = requestAnimationFrame(() => {
			this.animationFrame = 0;
			if (this.layoutDirty) {
				this.layoutDirty = false;
				this.measure();
			}
			this.update();
		});
	};

	private readonly handleResize = () => {
		this.scrollY = getStageVisualScrollPosition().scrollY;
		this.measure();
		this.schedule();
	};

	private readonly handlePanelLayout = (event: Event) => {
		// Also ignore another route's dock during a transition. Otherwise two
		// temporarily mounted controllers could keep remeasuring each other.
		if ((event as CustomEvent<{ source?: string }>).detail?.source === 'spatial-element-dock') return;
		this.layoutDirty = true;
		this.schedule();
	};

	private measure() {
		if (!this.minimapFrame || !this.stickyHeader) return;

		const decorationOpacity = this.decorationOpacity;
		this.restoreMinimap();
		this.setMinimapSurfaceOpacity(decorationOpacity);
		const minimapRect = toRect(this.minimapFrame.getBoundingClientRect());
		const tabsWidth = this.sourceTabsList?.querySelector<HTMLElement>(TABS_LINKS)?.scrollWidth ?? 0;
		const geometry = resolveSpatialElementDockLayout(this.readLayoutMetrics?.() ?? {
			width: window.innerWidth, height: window.innerHeight,
			scrollbarWidth: Math.max(0, window.innerWidth - (document.documentElement?.clientWidth ?? window.innerWidth))
		}, tabsWidth);
		// The fixed 3XL pane owns its header and submenu separately (step 10).
		if (!geometry) {
			this.applyState(false);
			this.setMinimapModelTop(undefined);
			if (!this.tabsInPane) this.setTabsActive(false);
			this.setPaneTabsActive(true);
			this.applyMinimapPresentation(0);
			this.applyHeaderPresentation(0);
			this.updateActionPresentation(false);
			this.presentationProgress = 0;
			this.minimapDock = undefined;
			this.tabsDock = undefined;
			this.tabsBreakpoint = Number.POSITIVE_INFINITY;
			this.root.style.removeProperty('--spatial-element-section-scroll-offset');
			return;
		}
		this.setPaneTabsActive(false);
		const tabsRect = this.tabsFrame ? toRect(this.tabsFrame.getBoundingClientRect()) : undefined;
		const headerRect = geometry.header;
		applyViewportFixedRect(this.stickyHeader, headerRect);
		this.minimapDock = geometry.minimap;
		this.minimapViewportTop = geometry.header.top;
		this.dockedMinimapModelScale = getDockedMinimapModelScale(
			this.minimapDock,
			headerRect,
			this.getConfiguredDockedModelScale() ?? 1
		);
		if (this.stickyMinimapAction) {
			applyViewportFixedRect(
				this.stickyMinimapAction,
				getDockedMinimapInteractionRect(this.minimapDock, headerRect, this.dockedMinimapModelScale)
			);
		}
		this.stickyHeaderBottom = headerRect.top + headerRect.height;
		this.root.style.setProperty('--spatial-element-summary-sticky-top', `${this.stickyHeaderBottom + 10}px`);
		this.measureDepartingContent();
		this.breakpoint = getSpatialElementDockBreakpoint(
			minimapRect.top + this.scrollY,
			this.minimapDock.top
		);
		this.presentationEndScrollY = Math.max(minimapRect.top + this.scrollY + minimapRect.height, 0);
		this.stickyHeader.style.setProperty('--spatial-element-sticky-minimap-reserve', `${geometry.titleReserve}px`);
		this.root.style.setProperty('--spatial-element-section-scroll-offset', `${geometry.sectionOffset}px`);

		if (this.tabsFrame && this.stickyTabs && tabsRect && geometry.submenu) {
			const panelRadius = Number.parseFloat(
				getComputedStyle(this.tabsFrame).getPropertyValue('--stage-panel-radius')
			);
			if (Number.isFinite(panelRadius)) this.tabsPanelRadius = Math.max(panelRadius, 0);
			this.tabsDockProgress = -1;
			this.tabsDock = geometry.submenu;
			this.tabsBreakpoint = getSpatialElementTabsDockBreakpoint(
				tabsRect.top + this.scrollY,
				this.tabsDock.top
			);
			applyViewportFixedRect(this.stickyTabs, this.tabsDock);
			this.stickyTabs.style.setProperty(
				'--spatial-element-tabs-dock-bottom-radius',
				`${this.tabsPanelRadius}px`
			);
		} else {
			this.setTabsActive(false);
			this.tabsDock = undefined;
			this.tabsBreakpoint = Number.POSITIVE_INFINITY;
		}
	}

	private update() {
		if (!this.minimapFrame || !this.minimapDock) return;

		const presentationProgress = getSpatialElementDockPresentationProgress(
			this.scrollY,
			this.presentationEndScrollY
		);
		const docked = getSpatialElementDockTarget(this.scrollY, this.breakpoint, this.docked);
		const tabsDocked = getSpatialElementTabsDockTarget(
			this.scrollY,
			this.tabsBreakpoint,
			docked,
			this.tabsDocked
		);
		this.applyMinimapPresentation(presentationProgress);
		this.applyHeaderPresentation(presentationProgress);
		this.applyState(docked);
		this.applyTabsPresentation(tabsDocked);
		this.applyTabsState(tabsDocked);
		this.updateActionPresentation(docked);
		this.presentationProgress = presentationProgress;
		this.presentationRevision++;
	}

	private applyState(docked: boolean) {
		if (!this.minimapFrame || !this.minimapDock) return;
		const changed = docked !== this.docked;
		const dockLayoutChanged = docked && !this.minimapDockApplied;
		this.docked = docked;

		if (docked) {
			if (!this.minimapDockApplied) {
				applyFixedRect(this.minimapFrame, this.minimapDock);
				this.minimapDockApplied = true;
			}
			// The virtual document is a transformed containing block. Counter only
			// this dock's scroll offset instead of invalidating inherited styles
			// across the complete page with a per-frame CSS custom property.
			const compensation = this.layoutRoot?.classList.contains('stage-virtual-scroll-active') ? this.scrollY : 0;
			this.minimapFrame.style.top = `${compensation + this.minimapDock.top}px`;
		} else if (changed || this.minimapDockApplied) {
			const decorationOpacity = this.decorationOpacity;
			this.restoreMinimap();
			this.setMinimapSurfaceOpacity(decorationOpacity);
		}

		if (changed) {
			this.setHeaderActive(docked);
			this.root.toggleAttribute('data-spatial-element-dock-active', docked);
		}
		// The fit square can extend above the viewport for large layouts. The live
		// model follows this top edge through the same continuous dock morph,
		// including its hover and sensor pose, instead of being clipped by it.
		this.setMinimapModelTop(this.minimapViewportTop);
		if (docked) this.updateDepartingContentClipping();
		else if (changed) this.restoreDepartingContentClipping();
		if (changed || dockLayoutChanged) {
			window.dispatchEvent(new CustomEvent(STAGE_PANEL_LAYOUT_EVENT, { detail: { source: 'spatial-element-dock' } }));
		}
	}

	private applyTabsState(docked: boolean) {
		if (!this.stickyTabs || !this.sourceTabsList) return;
		if (docked === this.tabsDocked) return;

		this.setTabsActive(docked);
		this.root.toggleAttribute('data-spatial-element-tabs-dock-active', docked);
	}

	private applyTabsPresentation(docked: boolean) {
		if (!this.stickyTabs || !this.tabsDock) return;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const progress = docked
			? reducedMotion
				? 1
				: getSpatialElementTabsDockProgress(this.scrollY, this.tabsBreakpoint, TABS_DOCK_MORPH_DISTANCE)
			: 0;
		const top = this.tabsDock.top + (docked ? Math.max(this.tabsBreakpoint - this.scrollY, 0) : 0);
		this.stickyTabs.style.top = `${top}px`;

		if (Math.abs(progress - this.tabsDockProgress) < 0.0005) return;
		this.tabsDockProgress = progress;
		this.stickyTabs.style.setProperty(
			'--spatial-element-tabs-dock-top-radius',
			`${(this.tabsPanelRadius * (1 - progress)).toFixed(3)}px`
		);
		this.stickyTabs.setAttribute('data-spatial-element-tabs-dock-progress', progress.toFixed(3));
	}

	private applyMinimapPresentation(progress: number) {
		const clampedProgress = Math.min(Math.max(progress, 0), 1);
		this.setMinimapSurfaceOpacity(1 - clampedProgress);
		this.setMinimapModelScale(1 + (this.dockedMinimapModelScale - 1) * clampedProgress);
		this.setMinimapDockProgress(clampedProgress);
	}

	private applyHeaderPresentation(progress: number) {
		if (!this.stickyHeader) return;
		const clampedProgress = Math.min(Math.max(progress, 0), 1);
		const value = formatPresentationProgress(clampedProgress);
		this.stickyHeader.style.setProperty('--spatial-element-sticky-header-progress', value);
		this.stickyHeader.setAttribute('data-spatial-element-dock-progress', value);
		this.stickyHeader.toggleAttribute('data-presented', clampedProgress > 0);
	}

	private restoreHeaderPresentation() {
		if (!this.stickyHeader) return;
		this.stickyHeader.style.removeProperty('--spatial-element-sticky-header-progress');
		this.stickyHeader.removeAttribute('data-spatial-element-dock-progress');
		this.stickyHeader.removeAttribute('data-presented');
	}

	private getMinimapSurfaceOpacity() {
		if (!this.minimapFrame) return 1;
		const value = Number.parseFloat(
			this.minimapFrame.style.getPropertyValue('--stage-panel-surface-opacity') || '1'
		);
		return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 1;
	}

	private setMinimapSurfaceOpacity(opacity: number) {
		if (!this.minimapFrame) return;
		const nextOpacity = Math.min(Math.max(opacity, 0), 1);
		const changed = Math.abs(nextOpacity - this.decorationOpacity) >= 0.0005;
		this.decorationOpacity = nextOpacity;
		this.minimapFrame.style.setProperty(
			'--stage-panel-surface-opacity',
			this.decorationOpacity.toFixed(3)
		);
		if (changed) window.dispatchEvent(new Event(STAGE_PANEL_VISUAL_EVENT));
	}

	private getMinimapModelScale() {
		if (!this.minimapFrame) return 1;
		const value = Number.parseFloat(
			this.minimapFrame.getAttribute('data-stage-minimap-model-scale') || '1'
		);
		return Number.isFinite(value) ? Math.min(Math.max(value, 0.2), 2) : 1;
	}

	private getConfiguredDockedModelScale() {
		if (!this.minimapFrame) return undefined;
		const value = Number.parseFloat(
			this.minimapFrame.getAttribute('data-stage-minimap-docked-view-scale') ?? ''
		);
		return Number.isFinite(value) ? value : undefined;
	}

	private getMinimapDockProgress() {
		if (!this.minimapFrame) return 0;
		const value = Number.parseFloat(
			this.minimapFrame.getAttribute('data-stage-minimap-dock-progress') || '0'
		);
		return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
	}

	private setMinimapDockProgress(progress: number) {
		if (!this.minimapFrame) return;
		const nextProgress = Math.min(Math.max(progress, 0), 1);
		const changed = nextProgress !== this.minimapDockProgress;
		this.minimapDockProgress = nextProgress;
		this.minimapFrame.setAttribute(
			'data-stage-minimap-dock-progress',
			formatPresentationProgress(this.minimapDockProgress)
		);
		if (changed) window.dispatchEvent(new Event(STAGE_PANEL_VISUAL_EVENT));
	}

	private restoreMinimapDockProgress() {
		if (!this.minimapFrame) return;
		if (this.minimapOriginalDockProgress === null) {
			this.minimapFrame.removeAttribute('data-stage-minimap-dock-progress');
		} else {
			this.minimapFrame.setAttribute(
				'data-stage-minimap-dock-progress',
				this.minimapOriginalDockProgress
			);
		}
		this.minimapDockProgress = this.getMinimapDockProgress();
	}

	private setMinimapModelScale(scale: number) {
		if (!this.minimapFrame) return;
		const nextScale = Math.min(Math.max(scale, 0.2), 2);
		const changed = Math.abs(nextScale - this.minimapModelScale) >= 0.0005;
		this.minimapModelScale = nextScale;
		this.minimapFrame.setAttribute(
			'data-stage-minimap-model-scale',
			this.minimapModelScale.toFixed(3)
		);
		if (changed) window.dispatchEvent(new Event(STAGE_PANEL_VISUAL_EVENT));
	}

	private restoreMinimapModelScale() {
		if (!this.minimapFrame) return;
		if (this.minimapOriginalModelScale === null) {
			this.minimapFrame.removeAttribute('data-stage-minimap-model-scale');
		} else {
			this.minimapFrame.setAttribute(
				'data-stage-minimap-model-scale',
				this.minimapOriginalModelScale
			);
		}
		this.minimapModelScale = this.getMinimapModelScale();
	}

	private setMinimapModelTop(top: number | undefined) {
		if (!this.minimapFrame) return;
		const nextValue = top === undefined ? null : top.toFixed(3);
		const changed = this.minimapFrame.getAttribute('data-stage-minimap-model-top') !== nextValue;
		if (nextValue === null) this.minimapFrame.removeAttribute('data-stage-minimap-model-top');
		else this.minimapFrame.setAttribute('data-stage-minimap-model-top', nextValue);
		if (changed) window.dispatchEvent(new Event(STAGE_PANEL_VISUAL_EVENT));
	}

	private restoreMinimapModelTop() {
		if (!this.minimapFrame) return;
		if (this.minimapOriginalModelTop === null) {
			this.minimapFrame.removeAttribute('data-stage-minimap-model-top');
		} else {
			this.minimapFrame.setAttribute('data-stage-minimap-model-top', this.minimapOriginalModelTop);
		}
	}

	private setHeaderActive(active: boolean) {
		if (!this.stickyHeader) return;
		this.stickyHeader.toggleAttribute('data-active', active);
		this.stickyHeader.inert = !active;
		this.stickyHeader.setAttribute('aria-hidden', String(!active));
	}

	private moveTabsTo(parent: HTMLElement, next: ChildNode | null = null) {
		const list = this.sourceTabsList;
		if (!list || list.parentElement === parent || list.contains(parent)) return;
		const focused = document.activeElement instanceof HTMLElement && list.contains(document.activeElement)
			? document.activeElement : undefined;
		const links = list.querySelector<HTMLElement>(TABS_LINKS);
		const scrollLeft = links?.scrollLeft ?? 0;
		// Reuse the live Svelte-owned navigation, including focus and horizontal
		// scroll. There is never a second active list or a cloned control.
		// Svelte can disconnect the original slot before this controller's cleanup.
		// Atomic moves require matching connected states; an ordinary DOM move is
		// necessary when returning a live portal to that detached owner.
		const reference = next?.parentNode === parent ? next : null;
		if (typeof parent.moveBefore === 'function' && parent.ownerDocument === list.ownerDocument &&
			parent.isConnected === list.isConnected) parent.moveBefore(list, reference);
		else parent.insertBefore(list, reference);
		if (links) links.scrollLeft = scrollLeft;
		if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
	}

	private restoreTabsList() {
		if (!this.tabsListOriginalParent) return;
		const next = this.tabsListOriginalNextSibling?.parentNode === this.tabsListOriginalParent
			? this.tabsListOriginalNextSibling : null;
		this.moveTabsTo(this.tabsListOriginalParent, next);
	}

	private setTabsActive(active: boolean) {
		if (!this.stickyTabs || !this.sourceTabsList || !this.tabsListOriginalParent) return;
		this.stickyTabs.inert = !active;
		this.stickyTabs.setAttribute('aria-hidden', String(!active));
		this.stickyTabs.toggleAttribute('data-active', active);
		this.setSourceTabsSurfaceVisible(!active);
		if (active) this.moveTabsTo(this.stickyTabs);
		else this.restoreTabsList();
		this.tabsDocked = active;
		this.sourceTabsList.dataset.spatialElementTabList = active ? 'docked' : 'panel';
	}

	private setPaneTabsActive(active: boolean) {
		if (!this.paneTabs || !this.sourceTabsList) return;
		if (active) {
			this.paneTabs.inert = false;
			this.paneTabs.setAttribute('aria-hidden', 'false');
			this.paneTabs.toggleAttribute('data-active', true);
			this.moveTabsTo(this.paneTabs);
			this.sourceTabsList.dataset.spatialElementTabList = 'docked';
			const links = this.sourceTabsList.querySelector<HTMLElement>(TABS_LINKS);
			if (links?.scrollWidth) this.paneTabs.style.setProperty('--spatial-detail-submenu-natural-width', `${links.scrollWidth}px`);
		} else if (this.tabsInPane) {
			this.root.removeAttribute('data-spatial-detail-pane-tabs');
			this.setSourceTabsSurfaceVisible(true);
			this.restoreTabsList();
			this.sourceTabsList.dataset.spatialElementTabList = 'panel';
			this.paneTabs.inert = true;
			this.paneTabs.setAttribute('aria-hidden', 'true');
			this.paneTabs.removeAttribute('data-active');
		}
		this.tabsInPane = active;
		this.root.toggleAttribute('data-spatial-detail-pane-tabs', active);
		if (active) this.setSourceTabsSurfaceVisible(false);
		else if (!this.tabsDocked) this.setSourceTabsSurfaceVisible(true);
	}

	private setSourceTabsSurfaceVisible(visible: boolean) {
		if (!this.tabsFrame) return;
		const property = '--stage-panel-surface-opacity';
		const currentValue = this.tabsFrame.style.getPropertyValue(property);
		const nextValue = visible ? this.tabsOriginalSurfaceOpacity : '0.000';
		if (currentValue === nextValue) return;

		if (nextValue) this.tabsFrame.style.setProperty(property, nextValue);
		else this.tabsFrame.style.removeProperty(property);
		window.dispatchEvent(new Event(STAGE_PANEL_VISUAL_EVENT));
	}


	private mountStickyHeaderOverlay() {
		if (!this.stickyHeader) return;
		const stage = this.root.closest<HTMLElement>('.stage');
		const parent = this.stickyHeader.parentElement;
		if (!stage || !parent || parent === stage) return;

		this.stickyHeaderOriginalParent = parent;
		this.stickyHeaderOriginalNextSibling = this.stickyHeader.nextSibling;
		stage.appendChild(this.stickyHeader);
		this.stickyHeader.setAttribute('data-stage-fixed-overlay', '');
	}

	private mountStickyTabsOverlay() {
		if (!this.stickyTabs) return;
		const stage = this.root.closest<HTMLElement>('.stage');
		const parent = this.stickyTabs.parentElement;
		if (!stage || !parent || parent === stage) return;

		this.stickyTabsOriginalParent = parent;
		this.stickyTabsOriginalNextSibling = this.stickyTabs.nextSibling;
		stage.appendChild(this.stickyTabs);
		this.stickyTabs.setAttribute('data-stage-fixed-overlay', '');
	}

	private restoreStickyHeader() {
		if (!this.stickyHeader || !this.stickyHeaderOriginalParent) return;
		const parent = this.stickyHeaderOriginalParent;
		const sibling = this.stickyHeaderOriginalNextSibling;
		this.stickyHeader.removeAttribute('data-stage-fixed-overlay');
		if (this.stickyHeaderOriginalStyle === null) this.stickyHeader.removeAttribute('style');
		else this.stickyHeader.setAttribute('style', this.stickyHeaderOriginalStyle);

		if (sibling?.parentNode === parent) parent.insertBefore(this.stickyHeader, sibling);
		else parent.appendChild(this.stickyHeader);

		this.stickyHeaderOriginalParent = undefined;
		this.stickyHeaderOriginalNextSibling = undefined;
	}

	private restoreStickyTabs() {
		if (!this.stickyTabs || !this.stickyTabsOriginalParent) return;
		const parent = this.stickyTabsOriginalParent;
		const sibling = this.stickyTabsOriginalNextSibling;
		this.stickyTabs.removeAttribute('data-stage-fixed-overlay');
		this.stickyTabs.removeAttribute('data-spatial-element-tabs-dock-progress');
		if (this.stickyTabsOriginalStyle === null) this.stickyTabs.removeAttribute('style');
		else this.stickyTabs.setAttribute('style', this.stickyTabsOriginalStyle);

		if (sibling?.parentNode === parent) parent.insertBefore(this.stickyTabs, sibling);
		else parent.appendChild(this.stickyTabs);

		this.stickyTabsOriginalParent = undefined;
		this.stickyTabsOriginalNextSibling = undefined;
	}

	private measureDepartingContent() {
		for (const state of this.departingContent) {
			const rect = state.element.getBoundingClientRect();
			state.documentTop = rect.top + this.scrollY;
			state.height = rect.height;
			const action = state.element.querySelector<HTMLElement>('[data-catalog-rich-shared="primary-action"]');
			if (action) state.action = { element: action, bottom: action.getBoundingClientRect().bottom - rect.top,
				inert: state.action?.inert ?? action.inert };
			state.sticky = undefined;
			if (state.frame?.parentElement) {
				const style = getComputedStyle(state.frame);
				if (style.position !== 'sticky') continue;
				const frameRect = state.frame.getBoundingClientRect();
				state.sticky = {
					documentTop: frameRect.top + this.scrollY,
					height: frameRect.height,
					boundaryBottom: state.frame.parentElement.getBoundingClientRect().bottom + this.scrollY,
					inset: Number.parseFloat(style.top) || 0,
					contentInset: Number.parseFloat(style.getPropertyValue('--stage-panel-content-inset')) || 0
				};
			}
		}
	}

	private contentViewportTop(state: ContentPresentation) {
		const sticky = state.sticky;
		return sticky
			? getStickyPanelTop(sticky.documentTop, sticky.height, sticky.boundaryBottom, sticky.inset, this.scrollY) + sticky.contentInset
			: state.documentTop - this.scrollY;
	}

	private updateActionPresentation(docked: boolean) {
		const summary = this.departingContent.find(state => state.action);
		const hiddenAboveDock = summary?.action
			? this.contentViewportTop(summary) + summary.action.bottom <= this.stickyHeaderBottom : true;
		const visible = docked && hiddenAboveDock;
		this.stickyHeader?.toggleAttribute('data-action-active', visible);
		if (this.stickyAction && this.stickyAction.inert === visible) this.stickyAction.inert = !visible;
		if (summary?.action) {
			const inert = summary.action.inert || visible;
			if (summary.action.element.inert !== inert) summary.action.element.inert = inert;
		}
	}

	private updateDepartingContentClipping() {
		for (const state of this.departingContent) {
			const viewportTop = this.contentViewportTop(state);
			const inset = Math.min(Math.max(this.stickyHeaderBottom - viewportTop, 0), state.height);
			const clipPath = `inset(${inset.toFixed(2)}px 0 0 0)`;
			if (state.appliedClipPath === clipPath) continue;
			state.appliedClipPath = clipPath;
			state.element.style.clipPath = clipPath;
			state.element.style.setProperty('-webkit-clip-path', clipPath);
		}
	}

	private restoreDepartingContentClipping() {
		for (const state of this.departingContent) this.restoreContentClipping(state);
	}

	private restoreContentClipping(state: ContentPresentation) {
		state.appliedClipPath = undefined;
		state.element.style.clipPath = state.clipPath;
		if (state.webkitClipPath) {
			state.element.style.setProperty('-webkit-clip-path', state.webkitClipPath);
		} else {
			state.element.style.removeProperty('-webkit-clip-path');
		}
	}

	private restoreMinimap() {
		if (!this.minimapFrame) return;
		if (this.minimapOriginalStyle === null) this.minimapFrame.removeAttribute('style');
		else this.minimapFrame.setAttribute('style', this.minimapOriginalStyle);
		this.minimapDockApplied = false;
	}
}

function formatPresentationProgress(progress: number) {
	if (progress <= 0) return '0.000';
	if (progress >= 1) return '1.000';
	return progress.toFixed(6);
}

function applyFixedRect(frame: HTMLElement, rect: SpatialElementDockRect) {
	frame.style.position = 'fixed';
	frame.style.left = `${rect.left}px`;
	frame.style.width = `${rect.width}px`;
	frame.style.height = `${rect.height}px`;
	frame.style.minHeight = `${rect.height}px`;
	frame.style.margin = '0';
	frame.style.zIndex = '22';
}

function applyViewportFixedRect(element: HTMLElement, rect: SpatialElementDockRect) {
	element.style.position = 'fixed';
	element.style.left = `${rect.left}px`;
	element.style.top = `${rect.top}px`;
	element.style.width = `${rect.width}px`;
	element.style.height = `${rect.height}px`;
	element.style.margin = '0';
}

function toRect(rect: DOMRect): SpatialElementDockRect {
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height
	};
}
