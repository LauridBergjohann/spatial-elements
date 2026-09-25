import {
	STAGE_SCROLL_PRIORITY,
	getStageVisualScrollPosition,
	markStageScrollInput,
	subscribeStageScrollFrame,
	syncStageScrollToNative,
	type StageScrollFrame
} from './scrollFrame.js';
import {
	STAGE_ANCHOR_NAVIGATION_END_EVENT,
	STAGE_ANCHOR_NAVIGATION_EVENT,
	STAGE_ANCHOR_SCROLL_DURATION_MS,
	easeStageAnchorScroll
} from './scrollAnimation.js';

const ACTIVE_CLASS = 'stage-virtual-scroll-active';
const FOCUS_VIEWPORT_MARGIN = 24;
const SCROLL_INTERRUPTION_KEYS = new Set([
	'ArrowDown',
	'ArrowUp',
	'End',
	'Home',
	'PageDown',
	'PageUp',
	' '
]);

export type ScrollRestoreTarget = { x: number; y: number } | { hash: string };

export interface ScrollPositions {
	native: { x: number; y: number };
	visual: { x: number; y: number };
}

/**
 * Keeps native scrolling as the input and scrollbar source while moving the
 * complete visible DOM from the same animation frame consumed by the stage.
 */
export class VirtualScrollController {
	private stopScrollFrames?: () => void;
	private resizeObserver?: ResizeObserver;
	private measureFrame = 0;
	private hashFrame = 0;
	private anchorScrollFrame = 0;
	private anchorNavigationTargetId?: string;
	private scrollY = 0;
	private started = false;
	private navigation?: { token: object; interrupted: boolean };
	private historyHashUrl?: string;
	/** The navigation bridge supplies SvelteKit's public history writers. */
	writeHash?: (url: URL, replace: boolean) => void;

	constructor(
		private readonly container: HTMLElement,
		private readonly content: HTMLElement,
		private readonly spacer: HTMLElement
	) {}

	get active() {
		return this.started;
	}

	readPositions(): ScrollPositions {
		const visual = getStageVisualScrollPosition();
		return {
			native: { x: window.scrollX, y: window.scrollY },
			visual: { x: visual.scrollX, y: visual.scrollY }
		};
	}

	beginNavigation(token: object) {
		this.cancelAnchorScroll();
		if (this.hashFrame) cancelAnimationFrame(this.hashFrame);
		this.hashFrame = 0;
		this.navigation = { token, interrupted: false };
	}

	measureExtentNow() {
		if (!this.started) return;
		if (this.measureFrame) cancelAnimationFrame(this.measureFrame);
		this.measureFrame = 0;
		this.measureDocumentHeight();
		return Number.parseFloat(this.spacer.style.height);
	}

	restoreTarget(target: ScrollRestoreTarget, token: object) {
		if (!this.started || this.navigation?.token !== token || this.navigation.interrupted) return;
		let position: { x: number; y: number };
		if ('hash' in target) {
			const element = this.getHashTarget(target.hash);
			position = { x: 0, y: element ? this.getElementScrollTop(element) : 0 };
		} else {
			position = target;
		}
		window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
		syncStageScrollToNative();
		return this.readPositions();
	}

	endNavigation(token: object) {
		if (this.navigation?.token === token) this.navigation = undefined;
	}

	start() {
		if (this.started) return;
		this.started = true;

		// Preserve the in-flow height before the content becomes viewport-fixed.
		this.measureDocumentHeight();
		this.container.classList.add(ACTIVE_CLASS);
		this.applyPosition(window.scrollX, window.scrollY);
		this.measureDocumentHeight();

		this.stopScrollFrames = subscribeStageScrollFrame(
			this.handleScrollFrame,
			STAGE_SCROLL_PRIORITY.virtualDocument
		);
		window.addEventListener('resize', this.handleResize, { passive: true });
		// Panel content is moved into the CSS3D renderer after enhancement. Listen
		// on the stable stage container so anchors and focus keep working there too.
		this.container.addEventListener('click', this.handleAnchorClick);
		this.container.addEventListener('focusin', this.handleFocusIn);
		window.addEventListener('hashchange', this.handleHashChange);
		window.addEventListener('popstate', this.handlePopState);
		window.addEventListener('wheel', this.handleUserInput, { passive: true });
		window.addEventListener('touchstart', this.handleUserInput, { passive: true });
		window.addEventListener('pointerdown', this.handleUserInput, { passive: true });
		window.addEventListener('keydown', this.handleScrollInterruptionKey);

		if ('ResizeObserver' in window) {
			this.resizeObserver = new ResizeObserver(this.scheduleMeasurement);
			this.resizeObserver.observe(this.content);
		}

		void document.fonts?.ready.then(() => this.scheduleMeasurement());
		if (window.location.hash) this.scheduleHashNavigation();
	}

	destroy() {
		if (!this.started) return;
		this.started = false;
		this.stopScrollFrames?.();
		this.stopScrollFrames = undefined;
		window.removeEventListener('resize', this.handleResize);
		this.container.removeEventListener('click', this.handleAnchorClick);
		this.container.removeEventListener('focusin', this.handleFocusIn);
		window.removeEventListener('hashchange', this.handleHashChange);
		window.removeEventListener('popstate', this.handlePopState);
		window.removeEventListener('wheel', this.handleUserInput);
		window.removeEventListener('touchstart', this.handleUserInput);
		window.removeEventListener('pointerdown', this.handleUserInput);
		window.removeEventListener('keydown', this.handleScrollInterruptionKey);
		this.resizeObserver?.disconnect();
		this.resizeObserver = undefined;
		if (this.measureFrame) cancelAnimationFrame(this.measureFrame);
		if (this.hashFrame) cancelAnimationFrame(this.hashFrame);
		this.historyHashUrl = undefined;
		this.navigation = undefined;
		this.cancelAnchorScroll();
		this.measureFrame = 0;
		this.hashFrame = 0;
		this.content.style.removeProperty('transform');
		this.content.style.removeProperty('--virtual-scroll-y');
		this.spacer.style.removeProperty('height');
		this.container.classList.remove(ACTIVE_CLASS);
	}

	private readonly handleScrollFrame = (frame: StageScrollFrame) => {
		this.applyPosition(frame.scrollX, frame.scrollY);
	};

	private readonly handleResize = () => {
		this.scheduleMeasurement();
	};

	private readonly handleHashChange = (event: HashChangeEvent) => {
		const restoredByHistory = event.newURL === this.historyHashUrl;
		this.historyHashUrl = undefined;
		if (!restoredByHistory) this.scheduleHashNavigation();
	};
	private readonly handlePopState = () => {
		if (!this.writeHash) return;
		// History restoration wins over a fragment, including SvelteKit shallow entries.
		if (this.hashFrame) cancelAnimationFrame(this.hashFrame);
		this.hashFrame = 0;
		this.historyHashUrl = window.location.href;
	};
	private readonly handleUserInput = () => {
		this.cancelAnchorScroll();
		if (this.navigation) this.navigation.interrupted = true;
	};
	private readonly handleScrollInterruptionKey = (event: KeyboardEvent) => {
		if (SCROLL_INTERRUPTION_KEYS.has(event.key)) this.handleUserInput();
	};

	private readonly cancelAnchorScroll = () => {
		if (this.anchorScrollFrame) cancelAnimationFrame(this.anchorScrollFrame);
		this.anchorScrollFrame = 0;
		this.completeAnchorNavigation();
	};

	private completeAnchorNavigation() {
		const targetId = this.anchorNavigationTargetId;
		if (!targetId) return;
		this.anchorNavigationTargetId = undefined;
		window.dispatchEvent(
			new CustomEvent(STAGE_ANCHOR_NAVIGATION_END_EVENT, { detail: { targetId } })
		);
	}

	private readonly scheduleMeasurement = () => {
		if (!this.started || this.measureFrame) return;
		this.measureFrame = requestAnimationFrame(() => {
			this.measureFrame = 0;
			this.measureDocumentHeight();
		});
	};

	private readonly handleAnchorClick = (event: MouseEvent) => {
		if (
			this.navigation ||
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		)
			return;
		const target =
			event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
		if (!target) return;

		const url = new URL(target.href, window.location.href);
		if (
			!url.hash ||
			url.origin !== window.location.origin ||
			url.pathname !== window.location.pathname ||
			url.search !== window.location.search
		)
			return;

		const element = this.getHashTarget(url.hash);
		if (!element) return;

		event.preventDefault();
		const animated =
			target.hasAttribute('data-product-tab-id') ||
			target.hasAttribute('data-product-section-navigation');
		const navigationHash =
			animated && element.hasAttribute('data-stage-scroll-top') ? '' : url.hash;
		if (window.location.hash !== navigationHash) {
			if (this.writeHash) {
				url.hash = navigationHash;
				this.writeHash(url, animated);
			} else if (animated) {
				url.hash = navigationHash;
				history.replaceState(history.state, '', url);
			} else {
				window.location.hash = navigationHash;
			}
		}
		this.scrollElementIntoView(element, false, animated);
	};

	private scheduleHashNavigation() {
		if (!this.started || this.hashFrame || this.navigation) return;
		this.hashFrame = requestAnimationFrame(() => {
			this.hashFrame = 0;
			const element = this.getHashTarget(window.location.hash);
			if (element) {
				this.scrollElementIntoView(element, false, element.hasAttribute('data-product-tab-target'));
			}
		});
	}

	private getHashTarget(hash: string) {
		if (!hash || hash === '#') return null;
		try {
			return this.container.querySelector<HTMLElement>(
				`#${CSS.escape(decodeURIComponent(hash.slice(1)))}`
			);
		} catch {
			return null;
		}
	}

	private readonly handleFocusIn = (event: FocusEvent) => {
		if (this.navigation || !(event.target instanceof HTMLElement)) return;
		const rect = event.target.getBoundingClientRect();
		if (
			rect.top >= FOCUS_VIEWPORT_MARGIN &&
			rect.bottom <= window.innerHeight - FOCUS_VIEWPORT_MARGIN
		)
			return;

		this.scrollElementIntoView(event.target, true);
	};

	private getElementScrollTop(element: HTMLElement, center = false) {
		const rect = element.getBoundingClientRect();
		const style = window.getComputedStyle(element);
		const scrollMarginTop = Number.parseFloat(style.scrollMarginTop) || 0;
		const documentTop = rect.top + this.scrollY;
		return Math.max(
			element.hasAttribute('data-stage-scroll-top')
				? 0
				: center
					? documentTop - (window.innerHeight - rect.height) * 0.5
					: documentTop - scrollMarginTop,
			0
		);
	}

	private scrollElementIntoView(element: HTMLElement, center = false, animated = false) {
		const targetY = this.getElementScrollTop(element, center);

		this.cancelAnchorScroll();
		if (animated) {
			this.anchorNavigationTargetId = element.id;
			window.dispatchEvent(
				new CustomEvent(STAGE_ANCHOR_NAVIGATION_EVENT, {
					detail: { targetId: element.id }
				})
			);
		}
		if (!animated || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			markStageScrollInput(animated ? 'navigation' : 'programmatic');
			window.scrollTo({ top: targetY, behavior: 'instant' });
			this.completeAnchorNavigation();
			return;
		}

		const startY = this.scrollY;
		const distance = targetY - startY;
		if (Math.abs(distance) < 0.5) {
			markStageScrollInput('navigation');
			window.scrollTo({ top: targetY, behavior: 'instant' });
			this.completeAnchorNavigation();
			return;
		}

		let startTime: number | undefined;
		const animate = (time: number) => {
			if (!this.started) return;
			startTime ??= time;
			const progress = Math.min((time - startTime) / STAGE_ANCHOR_SCROLL_DURATION_MS, 1);
			const scrollTop = startY + distance * easeStageAnchorScroll(progress);
			markStageScrollInput('navigation');
			window.scrollTo({ top: progress === 1 ? targetY : scrollTop, behavior: 'instant' });

			if (progress < 1) {
				this.anchorScrollFrame = requestAnimationFrame(animate);
			} else {
				this.anchorScrollFrame = 0;
				this.completeAnchorNavigation();
			}
		};

		this.anchorScrollFrame = requestAnimationFrame(animate);
	}

	private applyPosition(scrollX: number, scrollY: number) {
		this.scrollY = scrollY;
		this.content.style.transform = `translate3d(${-scrollX}px, ${-scrollY}px, 0)`;
		this.content.style.setProperty('--virtual-scroll-y', `${scrollY}px`);
	}

	private measureDocumentHeight() {
		const rect = this.content.getBoundingClientRect();
		const height = Math.max(this.content.scrollHeight, rect.height, window.innerHeight);
		this.spacer.style.height = `${Math.ceil(height)}px`;
	}
}
