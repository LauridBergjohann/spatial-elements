import { STAGE_PANEL_LAYOUT_EVENT, STAGE_PANEL_VISUAL_EVENT } from '../stage/panelContext.js';
import {
	STAGE_SCROLL_PRIORITY,
	getStageVisualScrollPosition,
	subscribeStageScrollFrame,
	type StageScrollFrame
} from '../stage/scrollFrame.js';
import {
	getCompactMinimapDockDestination,
	getDockedMinimapCopyReserve,
	getDockedMinimapInteractionRect,
	getDockedMinimapModelScale,
	getMinimapDockDestination,
	getSpatialElementDockBreakpoint,
	getSpatialElementDockPresentationProgress,
	getSpatialElementDockTarget,
	getSpatialElementSectionScrollOffset,
	getSpatialElementTabsDockBreakpoint,
	getSpatialElementTabsDockDestination,
	getSpatialElementTabsDockProgress,
	getSpatialElementTabsDockTarget,
	type SpatialElementDockRect
} from './spatialElementDock.js';

const COMPACT_BREAKPOINT = 1100;
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
	clipPath: string;
	webkitClipPath: string;
	documentTop: number;
	height: number;
	appliedClipPath?: string;
}

/**
 * Pins the existing minimap without transforming it and reveals a separate HTML header.
 * The normal element summary remains in document flow and simply leaves with the hero.
 */
export class SpatialElementDockController {
	private minimapAnchor?: HTMLElement;
	private minimapFrame?: HTMLElement;
	private stickyHeader?: HTMLElement;
	private stickyMinimapAction?: HTMLElement;
	private stickyHeaderOriginalParent?: HTMLElement;
	private stickyHeaderOriginalNextSibling?: ChildNode | null;
	private tabsAnchor?: HTMLElement;
	private tabsFrame?: HTMLElement;
	private sourceTabsList?: HTMLElement;
	private stickyTabs?: HTMLElement;
	private dockedTabsList?: HTMLElement;
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
	private tabsDock?: SpatialElementDockRect;
	private dockedMinimapModelScale = 1;
	private dockedMinimapModelTop = 0;
	private stickyHeaderBottom = 0;
	private breakpoint = 0;
	private presentationEndScrollY = 0;
	private tabsBreakpoint = Number.POSITIVE_INFINITY;
	private tabsPanelRadius = 12;
	private tabsDockProgress = -1;
	private resizeObserver?: ResizeObserver;
	private animationFrame = 0;
	private focusTransferFrame = 0;
	private focusTransferTimer = 0;
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
	private lastFocusedTabId?: string;
	private lastTabFocusTime = 0;
	private readonly layoutRoot?: HTMLElement;

	constructor(private readonly root: HTMLElement) {
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
		this.tabsAnchor = this.root.querySelector<HTMLElement>(TABS_ANCHOR) ?? undefined;
		this.tabsFrame = this.tabsAnchor?.querySelector<HTMLElement>(PANEL_FRAME) ?? undefined;
		this.sourceTabsList = this.tabsFrame?.querySelector<HTMLElement>(TABS_LIST) ?? undefined;
		this.stickyTabs = this.stickyHeader?.querySelector<HTMLElement>(STICKY_TABS) ?? undefined;
		this.dockedTabsList = this.stickyTabs?.querySelector<HTMLElement>(TABS_LIST) ?? undefined;
		this.departingContent = Array.from(
			this.root.querySelectorAll<HTMLElement>(DEPARTING_CONTENT)
		).map((element) => ({
			element,
			clipPath: element.style.clipPath,
			webkitClipPath: element.style.getPropertyValue('-webkit-clip-path'),
			documentTop: 0,
			height: 0
		}));

		if (!this.minimapFrame || !this.minimapAnchor || !this.stickyHeader) return;

		this.mountStickyHeaderOverlay();
		this.mountStickyTabsOverlay();
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
		this.sourceTabsList?.addEventListener('focusin', this.handleTabFocusIn);
		this.dockedTabsList?.addEventListener('focusin', this.handleTabFocusIn);
		this.measure();
		this.stopScrollFrames = subscribeStageScrollFrame(this.scrollFrame, STAGE_SCROLL_PRIORITY.dock);
		window.addEventListener('resize', this.handleResize, { passive: true });

		if ('ResizeObserver' in window) {
			this.resizeObserver = new ResizeObserver(this.handleResize);
			this.resizeObserver.observe(this.minimapAnchor);
			this.resizeObserver.observe(this.stickyHeader);
			if (this.tabsAnchor) this.resizeObserver.observe(this.tabsAnchor);
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
		this.resizeObserver?.disconnect();
		if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
		if (this.focusTransferFrame) cancelAnimationFrame(this.focusTransferFrame);
		if (this.focusTransferTimer) clearTimeout(this.focusTransferTimer);
		this.sourceTabsList?.removeEventListener('focusin', this.handleTabFocusIn);
		this.dockedTabsList?.removeEventListener('focusin', this.handleTabFocusIn);
		this.restoreMinimap();
		this.restoreMinimapDockProgress();
		this.restoreMinimapModelScale();
		this.restoreMinimapModelTop();
		this.restoreHeaderPresentation();
		this.setHeaderActive(false);
		this.setTabsActive(false);
		this.restoreStickyTabs();
		this.restoreStickyHeader();
		this.restoreDepartingContentClipping();
		this.root.removeAttribute('data-spatial-element-dock-active');
		this.root.removeAttribute('data-spatial-element-tabs-dock-active');
		this.root.style.removeProperty('--spatial-element-section-scroll-offset');
		(this.layoutRoot ?? this.root).style.removeProperty('--spatial-element-content-inline-inset');
	}

	private readonly scrollFrame = (frame: StageScrollFrame) => {
		this.scrollY = frame.scrollY;
		this.update();
	};

	private readonly schedule = () => {
		if (!this.started || this.animationFrame) return;
		this.animationFrame = requestAnimationFrame(() => {
			this.animationFrame = 0;
			this.update();
		});
	};

	private readonly handleResize = () => {
		this.scrollY = getStageVisualScrollPosition().scrollY;
		this.measure();
		this.schedule();
	};

	private readonly handleTabFocusIn = (event: FocusEvent) => {
		if (!(event.target instanceof HTMLElement)) return;
		const tabId = event.target.closest<HTMLElement>('[data-spatial-element-tab-id]')?.dataset.spatialElementTabId;
		if (!tabId) return;
		this.lastFocusedTabId = tabId;
		this.lastTabFocusTime = performance.now();
	};

	private measure() {
		if (!this.minimapFrame || !this.stickyHeader) return;

		const decorationOpacity = this.decorationOpacity;
		this.restoreMinimap();
		this.setMinimapSurfaceOpacity(decorationOpacity);
		const minimapRect = toRect(this.minimapFrame.getBoundingClientRect());
		const headerRect = toRect(this.stickyHeader.getBoundingClientRect());
		this.minimapDock =
			window.innerWidth <= COMPACT_BREAKPOINT
				? getCompactMinimapDockDestination(minimapRect, headerRect, window.innerWidth)
				: getMinimapDockDestination(minimapRect);
		this.dockedMinimapModelScale = getDockedMinimapModelScale(
			this.minimapDock,
			headerRect,
			this.getConfiguredDockedModelScale()
		);
		this.dockedMinimapModelTop = headerRect.top;
		if (this.stickyMinimapAction) {
			applyViewportFixedRect(
				this.stickyMinimapAction,
				getDockedMinimapInteractionRect(this.minimapDock, headerRect, this.dockedMinimapModelScale)
			);
		}
		this.stickyHeaderBottom = headerRect.top + headerRect.height;
		this.measureDepartingContent();
		this.breakpoint = getSpatialElementDockBreakpoint(
			minimapRect.top + this.scrollY,
			this.minimapDock.top
		);
		this.presentationEndScrollY = Math.max(minimapRect.top + this.scrollY + minimapRect.height, 0);
		const reserve = getDockedMinimapCopyReserve(
			this.minimapDock,
			headerRect,
			this.dockedMinimapModelScale,
			window.innerWidth <= COMPACT_BREAKPOINT ? 12 : 16
		);
		this.stickyHeader.style.setProperty('--spatial-element-sticky-minimap-reserve', `${reserve}px`);
		(this.layoutRoot ?? this.root).style.setProperty(
			'--spatial-element-content-inline-inset',
			`${Math.max(headerRect.left + reserve, 0)}px`
		);

		if (this.tabsFrame && this.stickyTabs) {
			const tabsRect = toRect(this.tabsFrame.getBoundingClientRect());
			const panelRadius = Number.parseFloat(
				getComputedStyle(this.tabsFrame).getPropertyValue('--stage-panel-radius')
			);
			if (Number.isFinite(panelRadius)) this.tabsPanelRadius = Math.max(panelRadius, 0);
			this.tabsDockProgress = -1;
			this.tabsDock = getSpatialElementTabsDockDestination(tabsRect, headerRect, window.innerWidth);
			this.tabsBreakpoint = getSpatialElementTabsDockBreakpoint(
				tabsRect.top + this.scrollY,
				this.tabsDock.top
			);
			applyViewportFixedRect(this.stickyTabs, this.tabsDock);
			this.stickyTabs.style.setProperty(
				'--spatial-element-tabs-dock-bottom-radius',
				`${this.tabsPanelRadius}px`
			);
			this.root.style.setProperty(
				'--spatial-element-section-scroll-offset',
				`${getSpatialElementSectionScrollOffset(this.tabsDock)}px`
			);
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
		} else if (changed || this.minimapDockApplied) {
			const decorationOpacity = this.decorationOpacity;
			this.restoreMinimap();
			this.setMinimapSurfaceOpacity(decorationOpacity);
		}

		if (changed) {
			this.setHeaderActive(docked);
			this.root.toggleAttribute('data-spatial-element-dock-active', docked);
		}
		this.setMinimapModelTop(docked ? this.dockedMinimapModelTop : undefined);
		if (docked) this.updateDepartingContentClipping();
		else if (changed) this.restoreDepartingContentClipping();
		if (changed || dockLayoutChanged) {
			window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
		}
	}

	private applyTabsState(docked: boolean) {
		if (!this.stickyTabs || !this.sourceTabsList || !this.dockedTabsList) return;
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

	private setTabsActive(active: boolean) {
		if (!this.stickyTabs || !this.sourceTabsList || !this.dockedTabsList) return;

		const outgoingList = active ? this.sourceTabsList : this.dockedTabsList;
		const incomingList = active ? this.dockedTabsList : this.sourceTabsList;
		this.syncTabScrollPosition(outgoingList, incomingList);
		const focusedTabId =
			document.activeElement instanceof HTMLElement && outgoingList.contains(document.activeElement)
				? document.activeElement.closest<HTMLElement>('[data-spatial-element-tab-id]')?.dataset.spatialElementTabId
				: performance.now() - this.lastTabFocusTime <= 500
					? this.lastFocusedTabId
					: undefined;

		this.tabsDocked = active;
		this.sourceTabsList.inert = active;
		this.sourceTabsList.setAttribute('aria-hidden', String(active));
		this.sourceTabsList.toggleAttribute('data-spatial-element-tab-list-hidden', active);
		this.stickyTabs.inert = !active;
		this.stickyTabs.setAttribute('aria-hidden', String(!active));
		this.stickyTabs.toggleAttribute('data-active', active);
		this.setSourceTabsSurfaceVisible(!active);

		if (!focusedTabId) return;
		if (this.focusTransferFrame) cancelAnimationFrame(this.focusTransferFrame);
		if (this.focusTransferTimer) clearTimeout(this.focusTransferTimer);
		const focusMatchingTab = (retry = true) => {
			if (!this.started || this.tabsDocked !== active) return;
			const matchingTab = Array.from(
				incomingList.querySelectorAll<HTMLElement>('[data-spatial-element-tab-id]')
			).find((element) => element.dataset.spatialElementTabId === focusedTabId);
			matchingTab?.focus({ preventScroll: true });
			if (retry && matchingTab && document.activeElement !== matchingTab) {
				this.focusTransferTimer = window.setTimeout(() => focusMatchingTab(false), 160);
			}
		};
		this.focusTransferFrame = requestAnimationFrame(() => {
			this.focusTransferFrame = 0;
			focusMatchingTab();
		});
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

	private syncTabScrollPosition(outgoingList: HTMLElement, incomingList: HTMLElement) {
		const outgoingLinks = outgoingList.querySelector<HTMLElement>(TABS_LINKS);
		const incomingLinks = incomingList.querySelector<HTMLElement>(TABS_LINKS);
		if (!outgoingLinks || !incomingLinks) return;

		const outgoingRange = Math.max(outgoingLinks.scrollWidth - outgoingLinks.clientWidth, 0);
		const incomingRange = Math.max(incomingLinks.scrollWidth - incomingLinks.clientWidth, 0);
		incomingLinks.scrollLeft =
			outgoingRange > 0
				? (outgoingLinks.scrollLeft / outgoingRange) * incomingRange
				: outgoingLinks.scrollLeft;
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
		}
	}

	private updateDepartingContentClipping() {
		for (const state of this.departingContent) {
			const viewportTop = state.documentTop - this.scrollY;
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
	// A transformed virtual document is the containing block for fixed descendants.
	// Counter the document transform so the dock remains viewport-aligned.
	frame.style.top = `calc(var(--virtual-scroll-y, 0px) + ${rect.top}px)`;
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
