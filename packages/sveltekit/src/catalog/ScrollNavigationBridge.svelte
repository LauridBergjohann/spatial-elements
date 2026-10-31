<script lang="ts">
	import { readCatalogLinkContext, readCatalogViewContext } from '@spatial-elements/core/catalog/catalogViewLink';
	import {
		EarlyNavigationCoordinator,
		type EarlyNavigationCancelReason,
		type EarlyNavigationHandle
	} from '@spatial-elements/core/catalog/EarlyNavigationCoordinator';
	import {
		afterNavigate,
		beforeNavigate,
		disableScrollHandling,
		goto,
		onNavigate,
		preloadData,
		pushState,
		replaceState
	} from '$app/navigation';
	import { navigating, page } from '$app/state';
	import type { BeforeNavigate, OnNavigate } from '@sveltejs/kit';
	import { getContext, onDestroy, onMount, tick } from 'svelte';
	import { CATALOG_ENDPOINTS, type CatalogEndpointRegistry } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import {
		CATALOG_SECTIONS,
		type CatalogSections,
		type CatalogSectionSnapshot
	} from '@spatial-elements/core/catalog/CatalogSections';
	import type {
		ScrollRestoreTarget,
		VirtualScrollController
	} from '@spatial-elements/core/stage/VirtualScrollController';
	import { subscribeStageScrollFrame, syncStageScrollToNative } from '@spatial-elements/core/stage/scrollFrame';
	import { resolveCatalogIntent } from '@spatial-elements/core/catalog/catalogRecipes';

	interface EntryState {
		id: string;
		focus?: string;
	}

	interface Props {
		controller?: VirtualScrollController;
		onStart?: () => void;
		/** Starts only a source-only transition whose destination is already known. */
		onEarlyStart?: (navigation: BeforeNavigate) => EarlyNavigationHandle | undefined;
		onCapture?: (navigation: OnNavigate) => void | Promise<void>;
		onInterrupt?: () => void;
		onSupersede?: (destination: URL) => void;
		onRestored?: (navigation: OnNavigate) => void | Promise<void>;
		handlesNavigation?: (navigation: OnNavigate) => boolean;
	}

	let { controller, onStart, onEarlyStart, onCapture, onInterrupt, onSupersede, onRestored, handlesNavigation }: Props =
		$props();
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const disconnectSections = sections?.connect({
		read: () => (page.state as { catalogSections?: CatalogSectionSnapshot }).catalogSections,
		write: (snapshot: CatalogSectionSnapshot) => {
			// Selection modifies only the current Kit entry; URL, scroll and unrelated state survive.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			replaceState(window.location.href, { ...page.state, catalogSections: snapshot });
		}
	});
	onDestroy(() => disconnectSections?.());
	const PREPARATION_LIMIT_MS = 500;
	let generation = 0;
	let pendingNavigation = false;
	let focusRevision = 0;
	let earlyReplayComplete: Promise<void> | undefined;
	// Kit invokes beforeNavigate after the click dispatch has finished. The DOM
	// event's composedPath is empty by then, so remember its original anchor now.
	const earlyAnchors = new WeakMap<Event, HTMLAnchorElement>();
	const earlyNavigation = new EarlyNavigationCoordinator({
		preload: async (destination, signal) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			let abort: (() => void) | undefined;
			try {
				return await Promise.race([
					preloadData(destination),
					new Promise<never>((_resolve, reject) => {
						abort = () => reject(new Error('Early navigation interrupted'));
						if (signal.aborted) abort();
						else signal.addEventListener('abort', abort, { once: true });
						timer = setTimeout(() => reject(new Error('Early navigation preload deadline')), 15_000);
					})
				]);
			} finally {
				if (timer !== undefined) clearTimeout(timer);
				if (abort) signal.removeEventListener('abort', abort);
			}
		},
		// The absolute destination already includes Kit's configured base path.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		navigate: async (destination) => {
			const url = new URL(destination);
			if (url.origin !== location.origin && (url.protocol === 'https:' || url.protocol === 'http:')) {
				location.assign(url.href);
				return;
			}
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(destination);
		}
	});
	// This imperative history cache must not subscribe effects to per-frame position writes.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const entryPositions = new Map<string, { x: number; y: number }>();
	let active:
		| {
				controller: VirtualScrollController;
				token: object;
				complete?: Promise<void>;
				releasePreparation?: () => void;
		  }
		| undefined;
	let initial = $state<{ target: ScrollRestoreTarget; url: string }>();

	function entryState(): EntryState | undefined {
		return (page.state as { catalogScroll?: EntryState }).catalogScroll;
	}

	function newEntry(): EntryState {
		return { id: crypto.randomUUID() };
	}

	function ensureEntry() {
		// An empty relative URL drops the current fragment when resolved by Kit.
		// Preserve the browser's full URL while adding metadata to this history entry.
		if (!entryState()) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			replaceState(window.location.href, { ...page.state, catalogScroll: newEntry() });
		}
	}

	function rememberPosition() {
		const id = entryState()?.id;
		if (!id || !controller?.active) return;
		entryPositions.set(id, controller.readPositions().native);
		if (entryPositions.size > 100) entryPositions.delete(entryPositions.keys().next().value!);
	}

	function stopActive(destination?: URL, reason: EarlyNavigationCancelReason = 'superseded') {
		generation += 1;
		earlyNavigation.cancel(reason);
		earlyReplayComplete = undefined;
		if (active) {
			active.controller.endNavigation(active.token);
			active.releasePreparation?.();
		}
		active = undefined;
		pendingNavigation = false;
		if (destination && onSupersede) {
			try {
				onSupersede(destination);
			} catch {
				interruptVisuals();
			}
		} else interruptVisuals();
	}

	function supportsEarlyStart(navigation: BeforeNavigate): boolean {
		if (!onEarlyStart || navigation.type !== 'link' || navigation.willUnload ||
			!navigation.from || !navigation.to?.route.id ||
			navigation.to.url.origin !== navigation.from.url.origin ||
			navigation.to.url.pathname === navigation.from.url.pathname) return false;
		// Kit's BeforeNavigate does not expose the resolved link options. Keep
		// explicitly authored focus/scroll/history policies on the ordinary path.
		const anchor = earlyAnchors.get(navigation.event);
		// An author can declare a complete Dock endpoint. Arbitrary hashes still
		// need destination DOM, including short pages where native scrolling clamps.
		if (navigation.to.url.hash && navigation.to.url.hash !== '#overview' &&
			readCatalogLinkContext(anchor, navigation.to.url).targetPresentation !== 'dock') return false;
		return anchor instanceof HTMLAnchorElement && !anchor.closest(
			'[data-sveltekit-keepfocus], [data-sveltekit-noscroll], [data-sveltekit-replacestate], [data-sveltekit-reload]'
		);
	}

	function interruptVisuals() {
		try {
			onInterrupt?.();
		} catch {
			// Visual cleanup must not prevent ordinary navigation.
		}
	}

	function focusDestination(navigation: OnNavigate) {
		const visible = (element?: HTMLElement | null) => {
			if (!element || element.closest('[inert], [aria-hidden="true"]')) return false;
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return (
				rect.width > 0 &&
				rect.height > 0 &&
				rect.bottom > 0 &&
				rect.top < innerHeight &&
				style.visibility !== 'hidden'
			);
		};
		const intent =
			navigation.from && navigation.to
				? resolveCatalogIntent(navigation.from.url, navigation.to.url, navigation.type)
				: undefined;
		const card =
			intent?.direction === 'detail-to-list'
				? endpoints?.resolve({
						...intent.identity,
						slot: endpoints.getContentSlot(intent.identity) ?? 'catalog.card',
						role: 'container'
					})
				: undefined;
		const key = navigation.type === 'popstate' ? entryState()?.focus : undefined;
		const focused = key
			? (document.querySelector<HTMLElement>(`[data-catalog-focus-key="${CSS.escape(key)}"]`) ??
				document.getElementById(key))
			: undefined;
		const heading = Array.from(document.querySelectorAll<HTMLElement>('h1')).find(
			(element) => !element.closest('[inert], [aria-hidden="true"]')
		);
		let section: HTMLElement | null = null;
		if (navigation.type !== 'popstate' && navigation.to?.url.hash) {
			try {
				section = document.getElementById(decodeURIComponent(navigation.to.url.hash.slice(1)));
			} catch {
				/* Malformed fragments use the normal heading fallback. */
			}
		}
		const target =
			focused ??
			(navigation.type !== 'popstate' && visible(card) ? card : undefined) ??
			(visible(section)
				? (section?.querySelector<HTMLElement>('h1, h2, h3') ?? section)
				: undefined) ??
			heading ??
			document.querySelector<HTMLElement>('main');
		if (!target) return;
		const originalTabIndex = target.getAttribute('tabindex');
		const restoreTabIndex = () => target.removeAttribute('tabindex');
		if (originalTabIndex === null) {
			target.setAttribute('tabindex', '-1');
			// Removing tabindex while focused makes Chrome move focus back to body.
			target.addEventListener('blur', restoreTabIndex, { once: true });
		}
		// Restoring focus is not a fresh request to speculate on the spatialElement just left.
		target.setAttribute('data-catalog-restoring-focus', '');
		try {
			target.focus({ preventScroll: true });
		} finally {
			target.removeAttribute('data-catalog-restoring-focus');
		}
		if (originalTabIndex === null && document.activeElement !== target) {
			target.removeEventListener('blur', restoreTabIndex);
			restoreTabIndex();
		}
	}

	beforeNavigate((navigation) => {
		// The single permitted replay continues the existing visual ownership.
		// It must not run stopActive, onSupersede, or the generic feedback again.
		if (navigation.to && earlyNavigation.acceptReplay(navigation.to.url.href)) {
			earlyReplayComplete = navigation.complete;
			return;
		}
		if (!pendingNavigation) rememberPosition();
		stopActive(navigation.to?.url, navigation.type === 'popstate' ? 'history' : navigation.willUnload ? 'leave' : 'superseded');
		pendingNavigation = true;
		if (supportsEarlyStart(navigation)) {
			let handle: EarlyNavigationHandle | undefined;
			try { handle = onEarlyStart?.(navigation); }
			catch { interruptVisuals(); }
			if (handle) {
				navigation.cancel();
				// Rejecting the original navigation is intentional. Its completion
				// must never cancel the independently owned source movement.
				void navigation.complete.catch(() => {});
				const epoch = generation;
				void earlyNavigation.start(navigation.to!.url.href, handle).finally(() => {
					if (epoch === generation && !active) pendingNavigation = false;
				});
				return;
			}
		}
		if (controller?.active && !navigation.willUnload && navigation.to && navigation.from &&
			navigation.from.url.pathname !== navigation.to.url.pathname &&
			navigation.from.url.pathname.split('/')[1] === navigation.to.url.pathname.split('/')[1]) onStart?.();
		const epoch = generation;
		void navigation.complete
			.catch(() => {})
			.finally(() => {
				if (epoch === generation && !active) {
					pendingNavigation = false;
					interruptVisuals();
				}
			});
	});
	onDestroy(() => stopActive(undefined, 'destroyed'));
	onMount(() => {
		const rememberAnchor = (event: MouseEvent) => {
			const anchor = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
			if (anchor instanceof HTMLAnchorElement) earlyAnchors.set(event, anchor);
		};
		const interrupt = () => { if (earlyNavigation.pending) stopActive(undefined, 'interaction'); };
		const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') interrupt(); };
		const resize = () => { if (earlyNavigation.pending) stopActive(undefined, 'resize'); };
		window.addEventListener('keydown', keydown);
		window.addEventListener('wheel', interrupt, { passive: true });
		window.addEventListener('touchmove', interrupt, { passive: true });
		window.addEventListener('resize', resize);
		document.addEventListener('click', rememberAnchor, true);
		return () => {
			window.removeEventListener('keydown', keydown);
			window.removeEventListener('wheel', interrupt);
			window.removeEventListener('touchmove', interrupt);
			window.removeEventListener('resize', resize);
			document.removeEventListener('click', rememberAnchor, true);
		};
	});

	$effect(() => {
		const complete = navigating.complete;
		if (complete && earlyReplayComplete && complete !== earlyReplayComplete && earlyNavigation.pending) {
			stopActive(navigating.to?.url);
			pendingNavigation = true;
		}
		// Kit skips beforeNavigate while another navigation is already in progress.
		// The public completion identity still changes when that operation is superseded.
		if (!complete || !active?.complete || complete === active.complete) return;
		stopActive(navigating.to?.url);
		pendingNavigation = true;
		if (controller?.active && navigating.to && navigating.from &&
			navigating.from.url.pathname !== navigating.to.url.pathname &&
			navigating.from.url.pathname.split('/')[1] === navigating.to.url.pathname.split('/')[1]) onStart?.();
		const epoch = generation;
		void complete
			.catch(() => {})
			.finally(() => {
				if (epoch === generation && !active) pendingNavigation = false;
			});
	});

	onNavigate(async (navigation) => {
		const destination = navigation.to;
		if (!destination) return;
		const owner = controller;
		const handled = handlesNavigation
			? handlesNavigation(navigation)
			: navigation.from?.url.pathname.split('/')[1] === destination.url.pathname.split('/')[1];
		if (!owner?.active || !handled) return;
		const viewContext =
			navigation.type === 'popstate' ? {} : readCatalogViewContext(destination.url);
		const target: ScrollRestoreTarget =
			navigation.type === 'popstate' && destination.scroll
				? { ...destination.scroll }
				: { hash: destination.url.hash };
		const token = {};
		const epoch = ++generation;
		owner.beginNavigation(token);
		let releasePreparation!: () => void;
		const interrupted = new Promise<boolean>((resolve) => {
			releasePreparation = () => resolve(false);
		});
		active = { controller: owner, token, complete: navigation.complete, releasePreparation };
		let preparationTimer: ReturnType<typeof setTimeout> | undefined;
		try {
			const preparation = onCapture?.(navigation);
			if (preparation) {
				const prepared = await Promise.race([
					Promise.resolve(preparation).then(() => true),
					interrupted,
					new Promise<boolean>((resolve) => {
						preparationTimer = setTimeout(() => resolve(false), PREPARATION_LIMIT_MS);
					})
				]);
				if (!prepared) {
					if (epoch !== generation) return;
					interruptVisuals();
				}
			}
		} catch {
			if (epoch !== generation) return;
			interruptVisuals();
		} finally {
			if (preparationTimer !== undefined) clearTimeout(preparationTimer);
			if (active?.token === token) active.releasePreparation = undefined;
		}
		if (epoch !== generation || !owner.active) return;
		// The finite preparation above holds the outgoing DOM. A visual failure still
		// restores the committed page; a superseded preparation never suppresses its successor.
		disableScrollHandling();

		// Do not return this promise: SvelteKit must commit before it can complete.
		void navigation.complete
			.then(async () => {
				await tick();
				// Kit queues fragment focus/history work after committing the page. Its
				// scroll correction must finish before our sole destination restoration.
				// A microtask/tick alone runs before that queued task (Kit 2.69.2).
				if (destination.url.hash) await new Promise<void>((resolve) => setTimeout(resolve, 0));
				if (epoch !== generation || !owner.active) return;
				sections?.restore();
				let requestedSection = viewContext.targetSection;
				if (destination.url.hash) {
					try {
						requestedSection = decodeURIComponent(destination.url.hash.slice(1));
					} catch {
						requestedSection = undefined;
					}
				}
				if (navigation.type !== 'popstate' && requestedSection && viewContext.spatialElementId)
					sections?.selectForView(requestedSection, viewContext.spatialElementId);
				await tick();
				if (epoch !== generation || !owner.active) return;
				owner.measureExtentNow();
				// An interrupted popstate may corrupt Kit's intermediate scroll snapshot.
				// Our bounded cache belongs to public page.state entry IDs, never URLs.
				const saved =
					navigation.type === 'popstate' ? entryPositions.get(entryState()?.id ?? '') : undefined;
				const restored = owner.restoreTarget(saved ?? target, token);
				if (!restored) syncStageScrollToNative();
				ensureEntry();
				const revision = focusRevision;
				endpoints?.restoreFocus(entryState()?.focus);
				const origin = sections?.getOrigin();
				endpoints?.restoreOrigin(origin);
				await onRestored?.(navigation);
				if (restored && epoch === generation && owner.active && revision === focusRevision) {
					focusDestination(navigation);
				}
			})
			.catch(() => {
				// Canceled navigations have no destination to restore.
			})
			.finally(() => {
				owner.endNavigation(token);
				if (active?.token === token) active = undefined;
				if (epoch === generation) {
					pendingNavigation = false;
					rememberPosition();
				}
			});
	});

	afterNavigate((navigation) => {
		if (navigation.type !== 'enter' || !navigation.to) return;
		const entry = performance.getEntriesByType('navigation')[0] as
			PerformanceNavigationTiming | undefined;
		const restoreHistory = entry?.type === 'reload' || entry?.type === 'back_forward';
		initial = {
			target:
				restoreHistory && navigation.to.scroll
					? { ...navigation.to.scroll }
					: { hash: navigation.to.url.hash },
			url: navigation.to.url.href
		};
	});

	$effect(() => {
		const owner = controller;
		if (!owner?.active) return;
		const previousWriter = owner.writeHash;
		owner.writeHash = (url, replace) => {
			// The controller supplies the absolute current URL with only its fragment changed.
			// It already includes the application base path; route resolution would apply it again.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			if (replace) replaceState(url, { ...page.state, catalogScroll: entryState() ?? newEntry() });
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			else pushState(url, { ...page.state, catalogScroll: newEntry() });
		};
		const saveFocus = (event: FocusEvent) => {
			focusRevision += 1;
			if (active || pendingNavigation || !(event.target instanceof HTMLElement)) return;
			const focus = event.target.dataset.catalogFocusKey || event.target.id;
			if (!focus) return;
			// Preserve the current fragment and already resolved application base path.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			replaceState(window.location.href, {
				...page.state,
				catalogScroll: { ...(entryState() ?? newEntry()), focus }
			});
		};
		const stopFrames = subscribeStageScrollFrame(() => {
			if (!active && !pendingNavigation) rememberPosition();
		});
		document.addEventListener('focusin', saveFocus);
		return () => {
			stopFrames();
			owner.writeHash = previousWriter;
			document.removeEventListener('focusin', saveFocus);
		};
	});

	$effect(() => {
		const owner = controller;
		const start = initial;
		if (!owner?.active || !start) return;
		initial = undefined;
		const token = {};
		const epoch = generation;
		owner.beginNavigation(token);
		active = { controller: owner, token };
		void tick()
			.then(() => {
				if (epoch !== generation || !owner.active || location.href !== start.url) return;
				owner.measureExtentNow();
				owner.restoreTarget(start.target, token);
				ensureEntry();
			})
			.finally(() => {
				owner.endNavigation(token);
				if (active?.token === token) active = undefined;
				if (epoch === generation) rememberPosition();
			});
	});
</script>
