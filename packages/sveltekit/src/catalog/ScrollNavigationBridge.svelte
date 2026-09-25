<script lang="ts">
	import { readCatalogViewContext } from '@spatial-elements/core/catalog/catalogViewLink';
	import {
		afterNavigate,
		beforeNavigate,
		disableScrollHandling,
		onNavigate,
		pushState,
		replaceState
	} from '$app/navigation';
	import { navigating, page } from '$app/state';
	import type { OnNavigate } from '@sveltejs/kit';
	import { getContext, onDestroy, tick } from 'svelte';
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
		onCapture?: (navigation: OnNavigate) => void | Promise<void>;
		onInterrupt?: () => void;
		onSupersede?: (destination: URL) => void;
		onRestored?: (navigation: OnNavigate) => void | Promise<void>;
		handlesNavigation?: (navigation: OnNavigate) => boolean;
	}

	let { controller, onCapture, onInterrupt, onSupersede, onRestored, handlesNavigation }: Props =
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

	function stopActive(destination?: URL) {
		generation += 1;
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
		// Restoring focus is not a fresh request to speculate on the product just left.
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
		if (!pendingNavigation) rememberPosition();
		stopActive(navigation.to?.url);
		pendingNavigation = true;
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
	onDestroy(() => stopActive());

	$effect(() => {
		const complete = navigating.complete;
		// Kit skips beforeNavigate while another navigation is already in progress.
		// The public completion identity still changes when that operation is superseded.
		if (!complete || !active?.complete || complete === active.complete) return;
		stopActive(navigating.to?.url);
		pendingNavigation = true;
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
				if (navigation.type !== 'popstate' && requestedSection && viewContext.productId)
					sections?.selectForView(requestedSection, viewContext.productId);
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
