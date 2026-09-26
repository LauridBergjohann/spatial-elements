import {
	geometryEndpoint,
	type CatalogGeometryEndpoint,
	type CatalogGeometryDestination
} from './catalogGeometryRequest.js';
import {
	resolveCatalogJourney,
	planCatalogParticipants,
	type CatalogParticipantEndpoint,
	type CatalogParticipantPair,
	type CatalogViewContext
} from './catalogJourney.js';
import { readCatalogViewContext } from './catalogViewLink.js';
import { captureCarouselElement } from './carouselPanelProjection.js';
import type { CatalogTransitionPresentation } from './catalogPresentation.js';
import { PresentationLease } from './PresentationLease.js';
import { rebasePresentation } from './rebasePresentation.js';
import { getProjectiveCssMatrix3d, type CssProjectionQuad } from '../stage/cssProjection.js';
import type { CatalogSurfaceCapture } from './catalogSurfaceCapture.js';
import {
	catalogSharedKey,
	type CatalogIdentity,
	type CatalogSharedRole,
	type CatalogEndpointRegistry
} from './CatalogEndpointRegistry.js';
import { resolveCatalogIntent, selectCatalogRecipe, type CatalogRecipe } from './catalogRecipes.js';
export { catalogSharedKey } from './CatalogEndpointRegistry.js';
export type { CatalogSharedRole } from './CatalogEndpointRegistry.js';
import {
	MOTION_DURATION as DURATION,
	transitionTiming,
	type TransitionMode
} from './transitionTiming.js';

export type CatalogTransitionIdentity = CatalogIdentity;

function isReturnRecipe(recipe: CatalogRecipe) {
	return recipe.source.startsWith('detail.');
}
function isRichRole(role: CatalogSharedRole) {
	return role === 'features' || role === 'primary-action';
}

/** Full summaries retain authored row/icon layout; temporary controls never become interactive. */
function copyRichContent(target: HTMLElement, source: HTMLElement) {
	const copy = source.cloneNode(true) as HTMLElement;
	const originals = [source, ...source.querySelectorAll<HTMLElement | SVGElement>('*')];
	const copies = [copy, ...copy.querySelectorAll<HTMLElement | SVGElement>('*')];
	for (let index = 0; index < originals.length; index++) {
		const style = getComputedStyle(originals[index]);
		for (const property of style)
			copies[index].style.setProperty(property, style.getPropertyValue(property));
		copies[index].style.visibility = 'visible';
		copies[index].removeAttribute('id');
		for (const attribute of [...copies[index].attributes])
			if (attribute.name.startsWith('data-')) copies[index].removeAttribute(attribute.name);
	}
	Object.assign(copy.style, {
		position: 'relative',
		left: '0',
		top: '0',
		width: '100%',
		height: '100%',
		margin: '0',
		transform: 'none',
		pointerEvents: 'none'
	});
	copy.inert = true;
	copy.setAttribute('aria-hidden', 'true');
	target.append(copy);
}

/** Only the forward list-to-hero edge is part of the first vertical slice. */
export function resolveCatalogTransition(
	from: URL,
	to: URL,
	type: string
): CatalogTransitionIdentity | undefined {
	if (
		type === 'popstate' ||
		to.hash ||
		!from.pathname.replace(/\/$/, '').endsWith('/categories/list')
	)
		return;
	return selectCatalogRecipe(resolveCatalogIntent(from, to, type), 'list', 'hero')?.identity;
}

/** A stale animation completion cannot settle a newer navigation. */
export class CatalogTransitionSequence {
	private generation = 0;
	private current?: { token: number; phase: 'captured' | 'animating' };

	get active() {
		return this.current !== undefined;
	}

	get phase() {
		return this.current?.phase ?? 'idle';
	}

	begin() {
		const token = ++this.generation;
		this.current = { token, phase: 'captured' };
		return token;
	}

	start(token: number) {
		if (!this.current || this.current.token !== token || this.current.phase !== 'captured') {
			return false;
		}
		this.current.phase = 'animating';
		return true;
	}

	isCurrent(token: number) {
		return this.current?.token === token;
	}

	finish(token: number) {
		if (!this.isCurrent(token)) return false;
		this.current = undefined;
		return true;
	}

	cancel() {
		this.generation += 1;
		this.current = undefined;
	}
}

interface CatalogTransitionHooks {
	captureContentGeometry?(
		endpoint: CatalogParticipantEndpoint,
		secondary: CatalogParticipantEndpoint[]
	): boolean;
	prepareContentParticipants?(
		pairs: CatalogParticipantPair[]
	): CatalogParticipantPair[] | undefined;
	adoptContentParticipants?(pairs: CatalogParticipantPair[]): void;
	promoteContentParticipant?(source: CatalogParticipantEndpoint): boolean;
	backgroundPrepared?(): boolean;
	captureElement?(
		element: HTMLElement
	): { width: number; height: number; corners: CssProjectionQuad } | undefined;
	adoptGeometry?(destination: CatalogGeometryDestination): boolean;
	geometryPoint?(): { x: number; y: number } | null;
	beginMotion?(): TransitionMode;
	captureGeometry(source: CatalogGeometryEndpoint): boolean;
	prepareDestination?(destination: CatalogGeometryDestination): boolean;
	setGeometryProgress(progress: number): void;
	flushFrame(): void;
	finishGeometry(): void;
	resolveSurface(element: HTMLElement): HTMLElement;
	captureSurface?(element: HTMLElement): CatalogSurfaceCapture;
	setPresentation(presentation: CatalogTransitionPresentation): void;
}

interface TransitionActor {
	semantic?: string;
	layoutWidth?: number;
	layoutHeight?: number;
	corners?: CssProjectionQuad;
	sourceOnly?: boolean;
	baseOpacity?: number;
	rebased?: boolean;
	role: CatalogSharedRole;
	element: HTMLDivElement;
	from: DOMRect;
	fontSize: number;
	to?: DOMRect;
	fontScale?: number;
	destinationCopy?: HTMLDivElement;
}

interface TransitionCapture {
	view?: {
		source: CatalogParticipantEndpoint;
		sources: CatalogParticipantEndpoint[];
		pairs?: CatalogParticipantPair[];
		alternates?: Map<string, TransitionActor[]>;
		context: CatalogViewContext;
	};
	panelContent?: { element: HTMLElement; rect: DOMRect; panel: DOMRect; incoming: boolean }[];
	backgroundPrepared?: boolean;
	retarget?: boolean;
	captureShell?: boolean;
	suspendedPose?: { surface: DOMRect; geometry: { x: number; y: number } | null };
	lease?: PresentationLease<TransitionCapture>;
	owner?: ReturnType<PresentationLease<TransitionCapture>['claim']>;
	paused?: boolean;
	elapsed: number;
	mode?: TransitionMode;
	token: number;
	identity: CatalogTransitionIdentity;
	recipe: CatalogRecipe;
	host: HTMLDivElement;
	actors: TransitionActor[];
	exiting: HTMLElement[];
	restore: (() => void)[];
	frame: number;
	timeout: ReturnType<typeof setTimeout>;
	resolve?: () => void;
	observer?: MutationObserver;
	layoutObserver?: ResizeObserver;
	inert: Map<HTMLElement, boolean>;
	content?: HTMLElement;
	focus?: HTMLElement;
}

function hasSize(rect: DOMRect) {
	return rect.width > 0 && rect.height > 0;
}

function intersectsViewport(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	return (
		hasSize(rect) &&
		rect.right > 0 &&
		rect.bottom > 0 &&
		rect.left < innerWidth &&
		rect.top < innerHeight
	);
}

/** A partial endpoint needs an explicit clip representation; otherwise use semantic navigation. */
function fullyPresented(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	if (
		!hasSize(rect) ||
		rect.left < 0 ||
		rect.top < 0 ||
		rect.right > innerWidth ||
		rect.bottom > innerHeight
	)
		return false;
	for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
		const style = getComputedStyle(ancestor);
		const clip = ancestor.getBoundingClientRect();
		if (
			/(hidden|clip|scroll|auto)/.test(style.overflowX) &&
			(rect.left < clip.left - 1 || rect.right > clip.right + 1)
		)
			return false;
		if (
			/(hidden|clip|scroll|auto)/.test(style.overflowY) &&
			(rect.top < clip.top - 1 || rect.bottom > clip.bottom + 1)
		)
			return false;
	}
	return true;
}

function visiblyPresented(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	if (!hasSize(rect) || rect.bottom <= 0 || rect.top >= innerHeight) return false;
	for (let node: HTMLElement | null = element; node; node = node.parentElement) {
		const style = getComputedStyle(node);
		if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.01)
			return false;
	}
	return true;
}

function copyTypography(element: HTMLElement, style: CSSStyleDeclaration) {
	for (const property of [
		'font-family',
		'font-size',
		'font-weight',
		'font-style',
		'line-height',
		'letter-spacing',
		'text-transform',
		'text-align',
		'white-space',
		'overflow',
		'text-overflow',
		'color',
		'text-shadow'
	])
		element.style.setProperty(property, style.getPropertyValue(property));
}

function preserveStyle(element: HTMLElement, property: string, restore: (() => void)[]) {
	const value = element.style.getPropertyValue(property);
	const priority = element.style.getPropertyPriority(property);
	const reset = () => {
		if (value) element.style.setProperty(property, value, priority);
		else element.style.removeProperty(property);
	};
	restore.push(reset);
	return reset;
}

/** Owns decorative DOM only. Semantic pages and element geometry keep their respective owners. */
export class CatalogTransition {
	private readonly sequence = new CatalogTransitionSequence();
	private captureState?: TransitionCapture;
	private readonly interrupt = () => this.cancel();
	private readonly keydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') this.cancel();
	};

	constructor(
		private readonly root: HTMLElement,
		private readonly endpoints: CatalogEndpointRegistry,
		private readonly hooks: CatalogTransitionHooks
	) {}

	get active() {
		return this.sequence.active;
	}

	/** Pause at the last submitted DOM/GPU frame while a compatible navigation resolves. */
	supersede(destination: URL) {
		const capture = this.captureState;
		const path = destination.pathname.replace(/\/$/, '');
		const compatible =
			capture &&
			destination.origin === location.origin &&
			(Boolean(
				resolveCatalogIntent(
					new URL(
						`/${encodeURIComponent(capture.identity.brandId)}/elements/${encodeURIComponent(capture.identity.spatialElementId)}`,
						location.href
					),
					destination,
					'link'
				)
			) ||
				path ===
					`/${encodeURIComponent(capture.identity.brandId)}/elements/${encodeURIComponent(capture.identity.spatialElementId)}`);
		if (!capture || !compatible) {
			this.cancel();
			return;
		}
		cancelAnimationFrame(capture.frame);
		// The old destination can unmount while the successor binds asynchronously.
		// Its observer must not cancel the new owner when those old bounds disappear.
		capture.layoutObserver?.disconnect();
		capture.layoutObserver = undefined;
		capture.suspendedPose = {
			surface: capture.actors[0]?.element.getBoundingClientRect() ?? new DOMRect(),
			geometry: this.hooks.geometryPoint?.() ?? null
		};
		capture.paused = true;
		capture.resolve?.();
		capture.resolve = undefined;
		const reverse = /\/categories\/(?:list|carousel|mixed)$/.test(path);
		if (
			capture.view ||
			capture.retarget ||
			reverse !== isReturnRecipe(capture.recipe) ||
			destination.hash
		) {
			if (
				!this.hooks.adoptGeometry?.({
					spatialElementId: capture.identity.spatialElementId,
					kind: reverse ? 'content' : destination.hash ? 'dock' : 'hero'
				})
			) {
				this.cancel();
				return;
			}
			capture.retarget = true;
			const panelRect = capture.actors
				.find((actor) => actor.role === 'summary-surface')
				?.element.getBoundingClientRect();
			if (panelRect)
				for (const copy of capture.panelContent ?? []) {
					const rect = copy.element.getBoundingClientRect();
					const wrapper = rebasePresentation([copy.element], rect, 'summary-surface');
					delete wrapper.dataset.catalogActorRole;
					wrapper.dataset.catalogPanelContent = '';
					capture.host.appendChild(wrapper);
					const index = capture.exiting.indexOf(copy.element);
					if (index >= 0) capture.exiting[index] = wrapper;
					else capture.exiting.push(wrapper);
					copy.element = wrapper;
					copy.rect = rect;
					copy.panel = panelRect;
					copy.incoming = false;
				}
			const extra: TransitionActor[] = [];
			const opacity = Number(this.root.style.getPropertyValue('--catalog-shared-opacity')) || 0;
			for (const actor of capture.actors) {
				const rect = actor.element.getBoundingClientRect();
				if (!actor.sourceOnly && opacity > 0) {
					const real = this.endpoints.resolve({
						...capture.identity,
						slot: capture.recipe.targetShared,
						role: actor.role
					});
					if (real) {
						const bounds = (
							actor.role === 'summary-surface' ? this.hooks.resolveSurface(real) : real
						).getBoundingClientRect();
						const copy = document.createElement('div');
						copy.style.cssText = actor.element.style.cssText;
						Object.assign(copy.style, {
							left: `${bounds.left}px`,
							top: `${bounds.top}px`,
							width: `${bounds.width}px`,
							height: `${bounds.height}px`,
							transform: 'none',
							clipPath: 'none',
							opacity: String(opacity)
						});
						if (actor.role !== 'summary-surface') {
							copy.textContent = real.textContent;
							copyTypography(copy, getComputedStyle(real));
						}
						capture.host.appendChild(copy);
						extra.push({
							role: actor.role,
							element: copy,
							from: bounds,
							fontSize: Number.parseFloat(getComputedStyle(real).fontSize),
							sourceOnly: true,
							baseOpacity: opacity
						});
						if (actor.role !== 'summary-surface') {
							preserveStyle(real, 'visibility', capture.restore);
							real.style.setProperty('visibility', 'hidden', 'important');
						}
					}
				}
				const layers = [actor.element, ...(actor.destinationCopy ? [actor.destinationCopy] : [])];
				const wrapper = rebasePresentation(layers, rect, actor.role);
				capture.host.appendChild(wrapper);
				actor.fontSize *= rect.width / actor.from.width;
				actor.element = wrapper;
				actor.corners = undefined;
				actor.from = rect;
				actor.to = undefined;
				actor.destinationCopy = undefined;
				actor.rebased = true;
				actor.baseOpacity = 1;
			}
			capture.actors.push(...extra);
			// Retain visible secondary content before hiding its shared parent or awaiting route data.
			const previousRecipe = capture.recipe;
			capture.recipe = {
				...previousRecipe,
				source: this.root.querySelector('[data-catalog-list]') ? 'catalog.card' : 'detail.summary'
			};
			this.captureExitingContent(capture);
			capture.recipe = previousRecipe;
			const surface = this.endpoints.resolve({
				...capture.identity,
				slot: previousRecipe.targetShared,
				role: 'summary-surface'
			});
			if (surface) {
				preserveStyle(surface, 'visibility', capture.restore);
				surface.style.setProperty('visibility', 'hidden', 'important');
			}
			for (const copy of capture.exiting)
				copy.dataset.catalogBaseOpacity = copy.style.opacity || '1';
		}
	}

	getOwnership() {
		const capture = this.captureState;
		return capture
			? {
					revision: capture.lease?.revision,
					elapsed: capture.elapsed,
					identity: capture.identity,
					source: capture.recipe.source,
					target: capture.recipe.targetShared,
					suspendedPose: capture.suspendedPose
						? {
								surface: capture.suspendedPose.surface.toJSON(),
								geometry: capture.suspendedPose.geometry
							}
						: null
				}
			: null;
	}

	private matchesDestination(capture: TransitionCapture, destination: URL) {
		return (
			destination.origin === location.origin &&
			!destination.hash &&
			destination.pathname.replace(/\/$/, '') ===
				`/${encodeURIComponent(capture.identity.brandId)}/elements/${encodeURIComponent(capture.identity.spatialElementId)}`
		);
	}

	private createActor(
		identity: CatalogIdentity,
		source: HTMLElement,
		role: CatalogSharedRole,
		reverse: boolean
	): TransitionActor {
		const paint =
			role === 'summary-surface' && reverse ? this.hooks.captureSurface?.(source) : undefined;
		const projection =
			captureCarouselElement(source) ??
			(role !== 'summary-surface' && reverse ? this.hooks.captureElement?.(source) : undefined);
		const bounds =
			paint?.bounds ?? (role === 'summary-surface' ? this.hooks.resolveSurface(source) : source);
		const from = bounds.getBoundingClientRect();
		const style = getComputedStyle(
			role === 'summary-surface' && reverse ? bounds : source,
			role === 'summary-surface' && source.closest('[data-carousel-spatial-element]') ? '::before' : null
		);
		const element = document.createElement('div');
		element.dataset.catalogSharedKey = catalogSharedKey(identity, role);
		element.dataset.catalogActorRole = role;
		Object.assign(element.style, {
			position: 'fixed',
			left: `${from.left}px`,
			top: `${from.top}px`,
			width: `${from.width}px`,
			height: `${from.height}px`,
			margin: '0',
			boxSizing: 'border-box',
			pointerEvents: 'none',
			transformOrigin: 'top left',
			zIndex: role === 'summary-surface' ? '20' : '22',
			willChange: 'transform, opacity'
		});
		if (role === 'summary-surface') {
			Object.assign(element.style, {
				background: paint?.background ?? style.backgroundColor,
				border: paint?.border ?? style.border,
				borderRadius: paint?.borderRadius ?? style.borderRadius,
				boxShadow: paint?.boxShadow ?? style.boxShadow
			});
		} else {
			if (isRichRole(role)) copyRichContent(element, source);
			else element.textContent = source.textContent;
			copyTypography(element, style);
			Object.assign(element.style, {
				fontFamily: style.fontFamily,
				fontSize: style.fontSize,
				fontWeight: style.fontWeight,
				fontStyle: style.fontStyle,
				lineHeight: style.lineHeight,
				letterSpacing: style.letterSpacing,
				textTransform: style.textTransform,
				textAlign: style.textAlign,
				color: style.color
			});
		}
		const actor: TransitionActor = {
			semantic: source.dataset.catalogSemantic,
			role,
			element,
			from,
			fontSize: Number.parseFloat(style.fontSize),
			corners: projection?.corners ?? paint?.corners,
			layoutWidth: projection?.width,
			layoutHeight: projection?.height
		};
		const corners = projection?.corners ?? paint?.corners;
		if (corners) {
			const local = corners.map((point) => ({
				x: point.x - from.left,
				y: point.y - from.top
			})) as unknown as CssProjectionQuad;
			const width = projection?.width ?? from.width;
			const height = projection?.height ?? from.height;
			element.style.width = `${width}px`;
			element.style.height = `${height}px`;
			element.style.transform = getProjectiveCssMatrix3d(local, width, height) ?? '';
		}
		return actor;
	}

	private contentEndpoints(brandId: string, requireSubmitted = true): CatalogParticipantEndpoint[] {
		return this.endpoints
			.getContentEndpoints()
			.filter((entry) => entry.address.brandId === brandId)
			.map(({ address, element }) => {
				let sectionId: string | undefined;
				try {
					sectionId = JSON.parse(address.occurrence ?? '[]')[0];
				} catch {
					/* Legacy occurrence. */
				}
				return {
					...address,
					role: 'geometry',
					sectionId,
					order: Number(element.dataset.catalogOrder ?? 0),
					eligible:
						address.slot === 'catalog.card' ? fullyPresented(element) : intersectsViewport(element),
					prepared: !requireSubmitted || element.hasAttribute('data-catalog-model-ready'),
					selected: address.slot === 'carousel.front',
					focused: element.contains(document.activeElement)
				};
			});
	}
	capture(fromURL: URL, toURL: URL, type: string) {
		const retained = this.captureState;

		if (retained?.paused && retained.retarget) {
			const journey = resolveCatalogJourney(fromURL, toURL, type);
			if (journey?.kind === 'content-view') {
				const context = type === 'popstate' ? {} : readCatalogViewContext(toURL);
				const previousPairs = retained.view?.pairs ?? [];
				const candidates = previousPairs.length
					? previousPairs.map((pair) => pair.target)
					: this.contentEndpoints(journey.brandId, false);
				const source = candidates.find(
					(p) =>
						p.spatialElementId === retained.identity.spatialElementId && p.slot === retained.recipe.targetShared
				);
				if (source && (!context.spatialElementId || context.spatialElementId === retained.identity.spatialElementId)) {
					this.hooks.adoptContentParticipants?.(previousPairs);
					retained.view = {
						source,
						sources: candidates.filter((p) => p.sectionId === source.sectionId),
						context: {
							...context,
							spatialElementId: retained.identity.spatialElementId,
							targetSection: journey.section ?? context.targetSection
						}
					};
					retained.recipe = {
						...retained.recipe,
						source: source.slot,
						id: source.slot === 'catalog.card' ? 'list-to-carousel' : 'carousel-to-list'
					};
					retained.owner = retained.lease!.claim();
					retained.token = this.sequence.begin();
					retained.elapsed = 0;
					retained.mode = undefined;
					retained.backgroundPrepared = undefined;
					retained.paused = false;
					retained.retarget = false;
					this.captureExitingContent(retained);
					this.root.dataset.catalogDirection = 'return';
					this.root.dataset.catalogRecipe = retained.recipe.id;
					this.root.dataset.catalogOwnershipRevision = String(retained.lease!.revision);
					this.setPresentation({ active: true, exitOpacity: 1, enterOpacity: 0, sharedOpacity: 0 });
					return false;
				}
			}
			const intent = resolveCatalogIntent(fromURL, toURL, type);
			const reverse = intent?.direction === 'detail-to-list';
			const content =
				retained.recipe.source.startsWith('carousel.') ||
				retained.recipe.targetShared.startsWith('carousel.')
					? 'carousel'
					: 'list';
			const recipe = selectCatalogRecipe(
				intent,
				reverse ? (retained.recipe.targetShared === 'detail.dock' ? 'dock' : 'hero') : content,
				reverse ? content : 'hero'
			);
			if (recipe) {
				retained.view = undefined;
				this.hooks.adoptContentParticipants?.([]);
				retained.owner = retained.lease!.claim();
				retained.token = this.sequence.begin();
				retained.recipe = recipe;
				retained.elapsed = 0;
				retained.mode = undefined;
				retained.backgroundPrepared = undefined;
				retained.paused = false;
				retained.retarget = false;
				this.captureExitingContent(retained);
				this.root.dataset.catalogDirection = reverse ? 'return' : 'forward';
				this.root.dataset.catalogRecipe = recipe.id;
				this.root.dataset.catalogOwnershipRevision = String(retained.lease!.revision);
				this.setPresentation({ active: true, exitOpacity: 1, enterOpacity: 0, sharedOpacity: 0 });
				return false;
			}
		}
		if (
			retained?.paused &&
			retained.mode &&
			type !== 'popstate' &&
			this.matchesDestination(retained, toURL)
		) {
			retained.token = this.sequence.begin();
			retained.owner = retained.lease!.claim();
			this.root.dataset.catalogOwnershipRevision = String(retained.lease!.revision);
			return true;
		}
		this.cancel();
		const journey = resolveCatalogJourney(fromURL, toURL, type);
		const context = type === 'popstate' ? {} : readCatalogViewContext(toURL);
		const inventory =
			journey?.kind === 'content-view' ? this.contentEndpoints(journey.brandId) : [];
		const sourcePairs = planCatalogParticipants(
			inventory,
			inventory,
			{
				spatialElementId: context.spatialElementId,
				sourceSection: context.sourceSection,
				sourceOccurrence: context.sourceOccurrence
			},
			5
		);
		const primary = sourcePairs[0];
		const view =
			journey?.kind === 'content-view' && primary
				? {
						source: primary.source,
						sources: sourcePairs.map((pair) => pair.source),
						context: { ...context, targetSection: journey.section ?? context.targetSection }
					}
				: undefined;
		if (journey?.kind === 'content-view' && !view) return;
		if (view)
			this.endpoints.prefer(
				view.source.brandId,
				view.source.spatialElementId,
				view.source.occurrence!,
				view.source.slot as 'catalog.card' | 'carousel.front' | 'carousel.neighbour'
			);
		const intent = view
			? {
					identity: primary!.identity,
					direction: 'list-to-detail' as const,
					history: type === 'popstate',
					target: 'hero' as const
				}
			: resolveCatalogIntent(fromURL, toURL, type);
		const reverse = intent?.direction === 'detail-to-list';
		const contentSlot = intent
			? reverse
				? this.endpoints.getPreferredContentSlot(intent.identity)
				: this.endpoints.getContentSlot(intent.identity)
			: undefined;
		const composition =
			reverse && intent
				? this.endpoints.getComposition(intent.identity)
				: contentSlot?.startsWith('carousel.')
					? 'carousel'
					: contentSlot === 'catalog.card'
						? 'list'
						: 'unavailable';
		const recipe: CatalogRecipe | undefined = view
			? {
					id: view.source.slot === 'catalog.card' ? 'list-to-carousel' : 'carousel-to-list',
					identity: primary!.identity,
					source: view.source.slot,
					targetGeometry: view.source.slot === 'catalog.card' ? 'carousel.front' : 'catalog.card',
					targetShared: view.source.slot === 'catalog.card' ? 'carousel.front' : 'catalog.card',
					roles: ['summary-surface', 'eyebrow', 'title']
				}
			: selectCatalogRecipe(
					intent,
					composition,
					reverse ? (contentSlot?.startsWith('carousel.') ? 'carousel' : 'list') : 'hero'
				);
		if (recipe && !reverse && contentSlot === 'carousel.neighbour') {
			recipe.source = contentSlot;
			recipe.roles = [];
		}
		if (!recipe || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const identity = recipe.identity;
		const dock = recipe.source === 'detail.dock';
		const source = { ...identity, slot: recipe.source };
		const card = this.endpoints.resolve({
			...source,
			role: reverse ? 'summary-surface' : 'container'
		});
		if (
			!card ||
			!this.endpoints.resolve({
				...source,
				slot: reverse && !dock ? 'detail.hero' : source.slot,
				role: 'geometry'
			})
		)
			return;
		if (reverse)
			recipe.roles = recipe.roles.filter((role) => {
				const element = this.endpoints.resolve({ ...source, role });
				// During docking the hero remains the geometry source. Do not resurrect
				// already clipped summary pieces just to retain their semantic roles.
				return (
					element &&
					visiblyPresented(element) &&
					(composition !== 'intermediate' || fullyPresented(element))
				);
			});
		recipe.roles = recipe.roles.filter(
			(role) => !isRichRole(role) || this.endpoints.resolve({ ...source, role })
		);
		const sources = recipe.roles.map((role) => this.endpoints.resolve({ ...source, role }));
		if (sources.some((element) => !element || !hasSize(element.getBoundingClientRect()))) return;
		if (!reverse && !(composition === 'carousel' ? visiblyPresented(card) : fullyPresented(card)))
			return;
		if (reverse && sources.some((element) => element && !fullyPresented(element))) return;

		try {
			const endpoint = geometryEndpoint({
				...source,
				slot: reverse && !dock ? 'detail.hero' : source.slot
			});
			if (
				view
					? !this.hooks.captureContentGeometry?.(view.source, view.sources.slice(1))
					: !this.hooks.captureGeometry(endpoint)
			)
				return;
			const token = this.sequence.begin();
			const host = document.createElement('div');
			host.dataset.catalogTransitionActors = '';
			host.setAttribute('aria-hidden', 'true');
			host.inert = true;
			// The host must not form a stacking context: surface < GPU overlay < text.
			host.style.pointerEvents = 'none';
			const capture: TransitionCapture = {
				view,
				captureShell: !reverse && (intent?.history || intent?.target === 'section'),
				elapsed: 0,
				token,
				identity,
				recipe,
				host,
				actors: [],
				exiting: [],
				restore: [],
				frame: 0,
				inert: new Map(),
				timeout: setTimeout(() => {
					if (this.captureState === capture) this.cancel();
				}, 5000)
			};
			this.captureState = capture;
			capture.lease = new PresentationLease(capture, () => this.cleanup());
			capture.owner = capture.lease.claim();
			for (let index = 0; index < recipe.roles.length; index++) {
				const actor = this.createActor(identity, sources[index]!, recipe.roles[index], reverse);
				capture.actors.push(actor);
				host.appendChild(actor.element);
			}
			if (capture.view && !capture.view.context.spatialElementId) {
				capture.view.alternates = new Map();
				for (const endpoint of capture.view.sources.slice(1)) {
					const actors: TransitionActor[] = [];
					for (const role of ['summary-surface', 'eyebrow', 'title'] as const) {
						const element = this.endpoints.resolve({ ...endpoint, role });
						if (element && visiblyPresented(element))
							actors.push(this.createActor(endpoint, element, role, false));
					}
					capture.view.alternates.set(endpoint.occurrence!, actors);
				}
				this.endpoints.prefer(
					identity.brandId,
					identity.spatialElementId,
					capture.view.source.occurrence!,
					capture.view.source.slot as 'catalog.card' | 'carousel.front' | 'carousel.neighbour'
				);
			}

			document.body.appendChild(host);
			if (reverse) {
				for (const source of sources) {
					if (source === card) continue;
					preserveStyle(source!, 'visibility', capture.restore);
					source!.style.setProperty('visibility', 'hidden', 'important');
				}
				this.captureExitingContent(capture);
			}
			preserveStyle(card, 'visibility', capture.restore);
			card.style.setProperty('visibility', 'hidden', 'important');
			if (!reverse) this.captureExitingContent(capture);
			this.root.dataset.catalogDirection = reverse || view ? 'return' : 'forward';
			this.setPresentation({ active: true, exitOpacity: 1, enterOpacity: 0, sharedOpacity: 0 });
			this.root.dataset.catalogTransition = 'captured';
			this.root.dataset.catalogRecipe = recipe.id;
			this.root.dataset.catalogOwnershipRevision = String(capture.lease.revision);
			this.lockParticipants(capture);
			capture.observer = new MutationObserver(() => this.lockParticipants(capture));
			capture.observer.observe(this.root, { childList: true, subtree: true });
			window.addEventListener('resize', this.interrupt, { passive: true });
			window.addEventListener('wheel', this.interrupt, { passive: true, capture: true });
			window.addEventListener('touchmove', this.interrupt, { passive: true, capture: true });
			window.addEventListener('keydown', this.keydown);
		} catch {
			this.cancel();
		}
	}

	/** Keep only decorative outgoing DOM; Kit can mount and measure the real destination now. */
	private captureExitingContent(capture: TransitionCapture) {
		const selector = isReturnRecipe(capture.recipe)
			? '[data-catalog-transition-dom="enter"], [data-catalog-transition-group="enter"], [data-catalog-secondary]'
			: `[data-catalog-transition-dom="exit"]${capture.captureShell ? ', [data-catalog-shell]' : ''}`;
		for (const source of this.root.querySelectorAll<HTMLElement>(selector)) {
			if (source.parentElement?.closest(selector)) continue;
			if (
				capture.actors.some(
					(actor) =>
						actor.role ===
						source.closest<HTMLElement>('[data-catalog-rich-shared]')?.dataset.catalogRichShared
				)
			)
				continue;
			const rect = source.getBoundingClientRect();
			if (!hasSize(rect) || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
			if (!visiblyPresented(source)) continue;
			const copy = source.cloneNode(true) as HTMLElement;
			const style = getComputedStyle(source);
			const originals = [source, ...source.querySelectorAll<HTMLElement | SVGElement>('*')];
			const copies = [copy, ...copy.querySelectorAll<HTMLElement | SVGElement>('*')];
			for (let index = 0; index < originals.length; index++) {
				const computed = getComputedStyle(originals[index]);
				for (const property of computed)
					copies[index].style.setProperty(property, computed.getPropertyValue(property));
			}
			for (const element of [copy, ...copy.querySelectorAll('*')]) {
				element.removeAttribute('id');
				for (const attribute of [...element.attributes]) {
					if (
						attribute.name.startsWith('data-') &&
						attribute.name !== 'data-catalog-model-ready' &&
						attribute.name !== 'data-catalog-poster' &&
						![
							'data-stage-panel-content',
							'data-stage-panel-css-surface',
							'data-stage-panel-render-mode',
							'data-stage-panel-surface'
						].includes(attribute.name)
					)
						element.removeAttribute(attribute.name);
				}
			}
			for (let index = 0; index < originals.length; index++) {
				const original = originals[index];
				if (original.matches('[data-catalog-card], [data-carousel-spatial-element]'))
					(copies[index] as HTMLElement).dataset.catalogExitOccurrence = (
						original as HTMLElement
					).dataset.catalogOccurrence;
			}
			copy.dataset.catalogExitCopy = '';
			copy.dataset.catalogBaseOpacity = style.opacity;
			if (source.hasAttribute('data-catalog-shell')) copy.dataset.catalogShellCopy = '';
			copy.setAttribute('aria-hidden', 'true');
			copy.inert = true;
			Object.assign(copy.style, {
				position: 'fixed',
				left: `${rect.left}px`,
				top: `${rect.top}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				margin: '0',
				transform: 'none',
				zIndex: source.hasAttribute('data-catalog-secondary') ? '22' : '2',
				pointerEvents: 'none',
				transition: 'none',
				animation: 'none',
				willChange: 'opacity'
			});
			const projection = this.hooks.captureElement?.(source);
			if (projection) {
				const corners = projection.corners.map((point) => ({
					x: point.x - rect.left,
					y: point.y - rect.top
				})) as unknown as CssProjectionQuad;
				Object.assign(copy.style, {
					width: `${projection.width}px`,
					height: `${projection.height}px`,
					transformOrigin: 'top left',
					transform:
						getProjectiveCssMatrix3d(corners, projection.width, projection.height) ?? 'none'
				});
			}
			this.root.appendChild(copy);
			capture.exiting.push(copy);
			const panel = capture.actors.find((actor) => actor.role === 'summary-surface');
			if (panel && source.closest('[data-spatial-element-hero-panel-content]')) {
				(capture.panelContent ??= []).push({
					element: copy,
					rect,
					panel: panel.from,
					incoming: false
				});
			}
			preserveStyle(source, 'visibility', capture.restore);
			source.style.setProperty('visibility', 'hidden', 'important');
		}
	}

	private lockParticipants(capture: TransitionCapture) {
		if (!this.sequence.isCurrent(capture.token)) return;
		for (const element of this.root.querySelectorAll<HTMLElement>(
			'[data-catalog-transition-dom], [data-catalog-transition-group]'
		)) {
			if (capture.inert.has(element)) continue;
			capture.inert.set(element, element.inert);
			element.inert = true;
		}
	}

	private setPresentation(presentation: CatalogTransitionPresentation) {
		for (const channel of ['enter', 'exit', 'shared'] as const) {
			const value = presentation[`${channel}Opacity`];
			if (presentation.active) {
				this.root.style.setProperty(`--catalog-${channel}-opacity`, String(value));
			} else this.root.style.removeProperty(`--catalog-${channel}-opacity`);
			this.root.toggleAttribute(
				`data-catalog-${channel}-hidden`,
				presentation.active && value === 0
			);
		}
		for (const copy of this.captureState?.exiting ?? []) {
			copy.style.opacity = String(
				copy.hasAttribute('data-catalog-shell-copy') &&
					this.captureState?.recipe.targetGeometry !== 'detail.dock'
					? 1
					: presentation.exitOpacity * Number(copy.dataset.catalogBaseOpacity ?? 1)
			);
		}
		this.hooks.setPresentation(presentation);
	}

	/** Call only after destination registration and scroll restoration have completed. */
	async play(): Promise<void> {
		const capture = this.captureState;
		if (!capture || !this.sequence.start(capture.token)) return;
		try {
			const reverse = Boolean(capture.view) || isReturnRecipe(capture.recipe);
			if (capture.view) {
				const pairs = planCatalogParticipants(
					capture.view.sources,
					this.contentEndpoints(capture.identity.brandId, false),
					capture.view.context,
					5
				);
				capture.view.pairs = pairs;
				const pair = pairs[0];
				if (
					!pair ||
					pair.source.slot === pair.target.slot ||
					(pair.source.slot.startsWith('carousel.') && pair.target.slot.startsWith('carousel.'))
				) {
					this.cancel();
					return;
				}
				if (pair.identity.spatialElementId !== capture.identity.spatialElementId) {
					const actors = capture.view.alternates?.get(pair.source.occurrence!);
					if (!actors || !this.hooks.promoteContentParticipant?.(pair.source)) {
						this.cancel();
						return;
					}
					for (const actor of capture.actors) capture.exiting.push(actor.element);
					capture.actors = actors;
					for (const actor of actors) capture.host.appendChild(actor.element);
					for (const element of capture.host.querySelectorAll<HTMLElement>(
						'[data-catalog-exit-occurrence]'
					))
						if (element.dataset.catalogExitOccurrence === pair.source.occurrence)
							element.style.opacity = '0';
					capture.identity = pair.identity;
					capture.recipe.identity = pair.identity;
					capture.recipe.source = pair.source.slot;
					capture.recipe.roles = actors.map((actor) => actor.role);
					capture.view.source = pair.source;
				}
				this.endpoints.prefer(
					pair.target.brandId,
					pair.target.spatialElementId,
					pair.target.occurrence!,
					pair.target.slot as 'catalog.card' | 'carousel.front' | 'carousel.neighbour'
				);
				capture.recipe.targetGeometry = capture.recipe.targetShared = pair.target.slot;
				if (pair.target.slot === 'carousel.neighbour') {
					for (const actor of capture.actors) capture.exiting.push(actor.element);
					capture.actors = [];
					capture.recipe.roles = [];
				}
			} else if (reverse) {
				const slot = this.endpoints.getContentSlot(capture.identity);
				if (!slot) {
					this.cancel();
					return;
				}
				capture.recipe = {
					...capture.recipe,
					id: slot.startsWith('carousel.')
						? capture.recipe.source === 'detail.dock'
							? 'dock-to-carousel'
							: 'hero-to-carousel'
						: capture.recipe.source === 'detail.dock'
							? 'dock-to-list'
							: 'hero-to-list',
					targetGeometry: slot,
					targetShared: slot
				};
				if (slot === 'carousel.neighbour') {
					for (const actor of capture.actors) {
						capture.exiting.push(actor.element);
						actor.destinationCopy?.remove();
					}
					capture.actors = [];
					capture.recipe.roles = [];
				}
				this.root.dataset.catalogRecipe = capture.recipe.id;
			} else {
				const composition = this.endpoints.getComposition(capture.identity);
				if (composition !== 'hero' && composition !== 'intermediate' && composition !== 'dock') {
					this.cancel();
					return;
				}
				capture.recipe = {
					...capture.recipe,
					id:
						composition === 'dock'
							? capture.recipe.source.startsWith('carousel.')
								? 'carousel-to-dock'
								: 'list-to-dock'
							: capture.recipe.source.startsWith('carousel.')
								? 'carousel-to-hero'
								: 'list-to-hero',
					targetGeometry: composition === 'dock' ? 'detail.dock' : 'detail.hero',
					targetShared: composition === 'dock' ? 'detail.dock' : 'detail.summary'
				};
				this.root.dataset.catalogRecipe = capture.recipe.id;
			}
			const page = this.root.querySelector<HTMLElement>('[data-spatial-element-root]');
			if (
				(!reverse && page?.dataset.spatialElementId !== capture.identity.spatialElementId) ||
				!this.endpoints.resolve({
					...capture.identity,
					slot: capture.recipe.targetGeometry,
					role: 'geometry'
				})
			) {
				this.cancel();
				return;
			}
			if (
				this.hooks.prepareDestination?.({
					spatialElementId: capture.identity.spatialElementId,
					kind: reverse ? 'content' : capture.recipe.targetGeometry === 'detail.dock' ? 'dock' : 'hero'
				}) === false
			) {
				this.cancel();
				return;
			}
			if (capture.view) {
				const prepared = this.hooks.prepareContentParticipants?.(capture.view.pairs ?? []) ?? [];
				for (const pair of prepared) {
					const geometry = this.endpoints.resolve({ ...pair.target, role: 'geometry' });
					if (!geometry) continue;
					preserveStyle(geometry, 'visibility', capture.restore);
					geometry.style.setProperty('visibility', 'hidden', 'important');
				}
				// Remove prepared target pixels before yielding to the first moving frame.
				this.hooks.flushFrame();
			}
			if (reverse) {
				const card = this.endpoints.resolve({
					...capture.identity,
					slot: capture.recipe.targetShared,
					role: 'container'
				});
				if (
					!card ||
					!(capture.recipe.targetShared.startsWith('carousel.')
						? intersectsViewport(card)
						: fullyPresented(card))
				) {
					this.cancel();
					return;
				}
				if (capture.actors.length) {
					preserveStyle(card, 'visibility', capture.restore);
					card.style.setProperty('visibility', 'hidden', 'important');
				}
			}
			const measuredTargets = new Map<HTMLElement, DOMRect>();
			const sharedTargets = new Set<HTMLElement>();
			for (const actor of capture.actors) {
				let target = this.endpoints.resolve({
					...capture.identity,
					slot: capture.recipe.targetShared,
					role: actor.role
				});
				const missingRich = !target && isRichRole(actor.role);
				if (missingRich) {
					target = this.endpoints.resolve({
						...capture.identity,
						slot: capture.recipe.targetShared,
						role: 'summary-surface'
					});
					actor.sourceOnly = true;
				}
				if (!target) {
					this.cancel();
					return;
				}
				const bounds =
					actor.role === 'summary-surface' ? this.hooks.resolveSurface(target) : target;
				sharedTargets.add(target);
				const targetRect = bounds.getBoundingClientRect();
				if (
					capture.paused &&
					actor.to &&
					['x', 'y', 'width', 'height'].some(
						(key) =>
							Math.abs(
								(targetRect[key as keyof DOMRect] as number) -
									(actor.to![key as keyof DOMRect] as number)
							) > 0.5
					)
				) {
					this.cancel();
					return;
				}
				actor.to = targetRect;
				if (missingRich) {
					const panel = capture.actors.find((item) => item.role === 'summary-surface')!;
					const sx = targetRect.width / panel.from.width,
						sy = targetRect.height / panel.from.height;
					actor.to = new DOMRect(
						targetRect.left + (actor.from.left - panel.from.left) * sx,
						targetRect.top + (actor.from.top - panel.from.top) * sy,
						actor.from.width * sx,
						actor.from.height * sy
					);
				}
				if (isRichRole(actor.role))
					actor.element.dataset.catalogContentMatch =
						actor.semantic && actor.semantic === target.dataset.catalogSemantic
							? 'shared'
							: 'replaced';
				measuredTargets.set(bounds, targetRect);
				if (!hasSize(actor.to)) {
					this.cancel();
					return;
				}
				actor.fontScale =
					Number.parseFloat(getComputedStyle(target).fontSize) / actor.fontSize || 1;
				if (!actor.sourceOnly && !actor.destinationCopy) {
					// Keep both text layouts fixed. Crossfade their typography instead of stretching
					// the source line width beyond the destination panel or recomputing layout every frame.
					const copy = document.createElement('div');
					copy.style.cssText = actor.element.style.cssText;
					if (actor.role !== 'summary-surface') {
						if (isRichRole(actor.role)) copyRichContent(copy, target);
						else copy.textContent = target.textContent;
						copyTypography(copy, getComputedStyle(target));
					} else {
						const paint = this.hooks.captureSurface?.(target);
						const style = getComputedStyle(
							target,
							target.closest('[data-carousel-spatial-element]') ? '::before' : null
						);
						Object.assign(copy.style, {
							background: paint?.background ?? style.backgroundColor,
							border: paint?.border ?? style.border,
							borderRadius: paint?.borderRadius ?? style.borderRadius,
							boxShadow: paint?.boxShadow ?? style.boxShadow
						});
					}
					copy.style.width = `${actor.to.width}px`;
					copy.style.height = `${actor.to.height}px`;
					copy.style.opacity = '0';
					copy.style.overflow = 'hidden';
					copy.dataset.catalogActorRole = actor.role;
					copy.dataset.catalogActorVariant = 'destination';
					capture.host.appendChild(copy);
					actor.destinationCopy = copy;
				}
				if (actor.role === 'summary-surface') {
					capture.content = target;
					if (!capture.panelContent?.some((entry) => entry.incoming)) {
						for (const source of target.querySelectorAll<HTMLElement>('[data-catalog-secondary]')) {
							if (
								capture.actors.some(
									(actor) =>
										actor.role ===
										source.closest<HTMLElement>('[data-catalog-rich-shared]')?.dataset
											.catalogRichShared
								)
							)
								continue;
							const rect = source.getBoundingClientRect();
							const copy = source.cloneNode(true) as HTMLElement;
							const originals = [source, ...source.querySelectorAll<HTMLElement | SVGElement>('*')];
							const copies = [copy, ...copy.querySelectorAll<HTMLElement | SVGElement>('*')];
							for (let index = 0; index < originals.length; index++) {
								const style = getComputedStyle(originals[index]);
								for (const property of style)
									copies[index].style.setProperty(property, style.getPropertyValue(property));
								// The live destination is deliberately masked during binding.
								copies[index].style.visibility = 'visible';
							}
							for (const element of [copy, ...copy.querySelectorAll('*')]) {
								element.removeAttribute('id');
								for (const attribute of [...element.attributes])
									if (attribute.name.startsWith('data-')) element.removeAttribute(attribute.name);
							}
							copy.inert = true;
							copy.setAttribute('aria-hidden', 'true');
							copy.dataset.catalogPanelContent = '';
							Object.assign(copy.style, {
								position: 'fixed',
								left: '0',
								top: '0',
								width: `${rect.width}px`,
								height: `${rect.height}px`,
								margin: '0',
								transformOrigin: 'top left',
								opacity: '0',
								visibility: 'visible',
								zIndex: '22',
								pointerEvents: 'none',
								transition: 'none',
								animation: 'none'
							});
							capture.host.appendChild(copy);
							(capture.panelContent ??= []).push({
								element: copy,
								rect,
								panel: targetRect,
								incoming: true
							});
						}
					}
				}
			}
			for (const target of sharedTargets) {
				preserveStyle(target, 'visibility', capture.restore);
				target.style.setProperty('visibility', 'hidden', 'important');
			}
			const content = capture.content;
			capture.layoutObserver?.disconnect();
			capture.layoutObserver = new ResizeObserver(() => {
				if (this.captureState !== capture || capture.paused) return;
				for (const [element, rect] of measuredTargets) {
					const current = element.getBoundingClientRect();
					if (
						Math.abs(current.width - rect.width) > 1 ||
						Math.abs(current.height - rect.height) > 1
					) {
						this.cancel();
						return;
					}
				}
			});
			for (const element of measuredTargets.keys()) capture.layoutObserver.observe(element);
			if (
				document.activeElement instanceof HTMLElement &&
				content?.contains(document.activeElement)
			) {
				capture.focus = document.activeElement;
			}
			this.lockParticipants(capture);
			this.root.dataset.catalogTransition = 'animating';
			if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
				this.hooks.setGeometryProgress(1);
				this.settle(capture.token);
				return;
			}
			await new Promise<void>((resolve) => {
				const mode =
					capture.mode ?? (reverse ? 'synchronous' : this.hooks.beginMotion?.()) ?? 'asynchronous';
				capture.mode = mode;
				capture.backgroundPrepared ??= !reverse && Boolean(this.hooks.backgroundPrepared?.());
				capture.paused = false;
				const owner = capture.owner!;
				capture.resolve = resolve;
				let previous = performance.now();
				let elapsed = capture.elapsed;
				const frame = (now: number) => {
					if (!owner.isCurrent() || capture.paused) return;
					try {
						// A shader compilation or slow frame must not skip the entire content reveal.
						// The existing wall-clock timeout still bounds prolonged or hidden-page work.
						const nextElapsed = elapsed + Math.min(Math.max(now - previous, 0), 50);
						// Submit one complete destination-pose frame before background/High work.
						elapsed = elapsed < DURATION ? Math.min(nextElapsed, DURATION) : nextElapsed;
						capture.elapsed = elapsed;
						previous = now;
						const timing = transitionTiming(elapsed, mode, capture.backgroundPrepared);
						const progress = timing.motion;
						const enter = timing.enter;
						// Moving actors exclusively own shared surfaces/type until the final pose.
						for (const actor of capture.actors) {
							const target = actor.to!;
							const scaleX =
								actor.role === 'summary-surface'
									? target.width / actor.from.width
									: actor.fontScale!;
							const scaleY =
								actor.role === 'summary-surface'
									? target.height / actor.from.height
									: actor.fontScale!;
							const x = (target.left - actor.from.left) * progress;
							const y = (target.top - actor.from.top) * progress;
							const currentScaleX = 1 + (scaleX - 1) * progress;
							actor.element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${currentScaleX}, ${1 + (scaleY - 1) * progress})`;
							let projectedCorners: CssProjectionQuad | undefined;
							if (actor.corners) {
								const ends = [
									{ x: target.left, y: target.top },
									{ x: target.right, y: target.top },
									{ x: target.right, y: target.bottom },
									{ x: target.left, y: target.bottom }
								];
								const corners = actor.corners.map((point, index) => ({
									x: point.x + (ends[index].x - point.x) * progress - actor.from.left,
									y: point.y + (ends[index].y - point.y) * progress - actor.from.top
								})) as unknown as CssProjectionQuad;
								projectedCorners = corners;
								actor.element.style.transform =
									getProjectiveCssMatrix3d(
										corners,
										actor.layoutWidth ?? actor.from.width,
										actor.layoutHeight ?? actor.from.height
									) ?? actor.element.style.transform;
							}
							if (actor.destinationCopy) {
								const typography =
									actor.role === 'summary-surface'
										? transitionTiming(elapsed, 'synchronous').enter
										: Math.min(1, Math.max(0, (progress - 0.25) / 0.55));
								const destinationScale =
									1 / actor.fontScale! + (1 - 1 / actor.fontScale!) * progress;
								const availableWidth =
									actor.from.width + (target.width - actor.from.width) * progress;
								const clippedWidth = Math.max(0, actor.from.width - availableWidth / currentScaleX);
								actor.element.style.clipPath = actor.corners
									? 'none'
									: `inset(0 ${clippedWidth}px 0 0)`;
								actor.element.style.opacity = String(1 - typography);
								actor.destinationCopy.style.transform =
									actor.role === 'summary-surface'
										? `translate3d(${x}px, ${y}px, 0) scale(${(actor.from.width + (target.width - actor.from.width) * progress) / target.width}, ${(actor.from.height + (target.height - actor.from.height) * progress) / target.height})`
										: `translate3d(${x}px, ${y}px, 0) scale(${destinationScale})`;
								actor.destinationCopy.style.opacity = String(typography);
								if (projectedCorners && actor.role === 'summary-surface') {
									actor.destinationCopy.style.transform =
										getProjectiveCssMatrix3d(projectedCorners, target.width, target.height) ??
										actor.destinationCopy.style.transform;
								}
							} else
								actor.element.style.opacity = String(
									(actor.baseOpacity ?? 1) * (actor.sourceOnly ? 1 - progress : 1)
								);
						}
						const panel = capture.actors.find((actor) => actor.role === 'summary-surface');
						if (panel?.to)
							for (const copy of capture.panelContent ?? []) {
								const width = panel.from.width + (panel.to.width - panel.from.width) * progress;
								const height = panel.from.height + (panel.to.height - panel.from.height) * progress;
								const sx = width / copy.panel.width,
									sy = height / copy.panel.height;
								const x =
									panel.from.left +
									(panel.to.left - panel.from.left) * progress +
									(copy.rect.left - copy.panel.left) * sx;
								const y =
									panel.from.top +
									(panel.to.top - panel.from.top) * progress +
									(copy.rect.top - copy.panel.top) * sy;
								copy.element.style.left = '0';
								copy.element.style.top = '0';
								copy.element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sx}, ${sy})`;
								if (copy.incoming) copy.element.style.opacity = String(enter);
							}
						this.setPresentation({
							active: true,
							exitOpacity: timing.exit,
							enterOpacity: enter,
							sharedOpacity: 0,
							backgroundOpacity: timing.background,
							geometryOpacity: timing.geometry
						});
						this.hooks.setGeometryProgress(progress);
						this.hooks.flushFrame();
						if (timing.complete || matchMedia('(prefers-reduced-motion: reduce)').matches)
							this.settle(capture.token);
						else capture.frame = requestAnimationFrame(frame);
					} catch {
						this.cancel();
					}
				};
				capture.frame = requestAnimationFrame(frame);
			});
		} catch {
			this.cancel();
		}
	}

	cancel() {
		this.sequence.cancel();
		this.captureState?.owner?.release();
	}

	dispose() {
		this.cancel();
	}

	private settle(token: number) {
		if (this.sequence.finish(token)) this.captureState?.owner?.release();
	}

	private cleanup() {
		const capture = this.captureState;
		this.captureState = undefined;
		delete this.root.dataset.catalogTransition;
		delete this.root.dataset.catalogRecipe;
		delete this.root.dataset.catalogOwnershipRevision;
		delete this.root.dataset.catalogDirection;
		window.removeEventListener('resize', this.interrupt);
		window.removeEventListener('wheel', this.interrupt, true);
		window.removeEventListener('touchmove', this.interrupt, true);
		window.removeEventListener('keydown', this.keydown);
		if (!capture) return;
		capture.observer?.disconnect();
		capture.layoutObserver?.disconnect();
		cancelAnimationFrame(capture.frame);
		clearTimeout(capture.timeout);
		capture.host.remove();
		for (const copy of capture.exiting) copy.remove();
		for (const restore of capture.restore.reverse()) restore();
		for (const [element, inert] of capture.inert) {
			// Docking can change during route scroll restoration after this lock was acquired.
			// Preserve the controller's current semantic state instead of reviving a stale lock snapshot.
			const dock = element.matches('[data-spatial-element-sticky-header], [data-spatial-element-sticky-tabs]');
			element.inert = dock ? element.getAttribute('aria-hidden') === 'true' : inert;
		}
		if (
			capture.focus?.isConnected &&
			(document.activeElement === document.body ||
				capture.content?.contains(document.activeElement))
		)
			capture.focus.focus({ preventScroll: true });
		try {
			try {
				this.setPresentation({ active: false, enterOpacity: 1, exitOpacity: 1, sharedOpacity: 1 });
			} finally {
				this.hooks.finishGeometry();
				this.hooks.flushFrame();
			}
		} catch {
			// A renderer failure cannot prevent DOM restoration or completion of navigation.
		} finally {
			capture.resolve?.();
		}
	}
}
