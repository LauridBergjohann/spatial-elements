import { tick } from 'svelte';
import type { BeforeNavigate } from '@sveltejs/kit';
import type { StageExperience } from '@spatial-elements/core/stage/StageExperience';
import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
import type { CatalogEndpointRegistry } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
import { resolveCatalogIntent } from '@spatial-elements/core/catalog/catalogRecipes';
import { captureCardElement, captureElementPlane } from '@spatial-elements/core/catalog/cardProjection';
import { captureCarouselElement } from '@spatial-elements/core/catalog/carouselPanelProjection';
import { readCatalogViewContext } from '@spatial-elements/core/catalog/catalogViewLink';
import { StagedCatalogTransition, type StagedDomActor } from '@spatial-elements/core/catalog/StagedCatalogTransition';
import { createSourceDomMotion } from '@spatial-elements/core/catalog/SourceDomMotion';
import { releaseSourceDomClipping } from '@spatial-elements/core/catalog/SourceDomClipping';
import type { EarlyNavigationCancelReason } from '@spatial-elements/core/catalog/EarlyNavigationCoordinator';
import { resolveDetailLayout, type ResponsiveLayoutInput } from '@spatial-elements/core/spatial-element/responsiveLayout';
import type { SpatialSummaryHostController } from '../spatial-element/spatialSummaryHost.svelte.js';
import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
import { getStageVisualScrollPosition } from '@spatial-elements/core/stage/scrollFrame';

/** Source ownership stays in the persistent shell; Kit only replaces its placement. */
export function startStagedCatalogNavigation(options: {
	root: HTMLElement;
	navigation: BeforeNavigate;
	endpoints: CatalogEndpointRegistry;
	host: SpatialSummaryHostController;
	experience: StageExperience;
	metrics: ResponsiveLayoutInput;
	items: readonly SpatialListItem[];
	onFinish(): void;
}) {
	const { root, navigation, endpoints, host, experience } = options;
	const entered = performance.now();
	const decline = (reason: string) => { root.dataset.catalogStagedDecision = reason; };
	if (!navigation.from || !navigation.to) return;
	const intent = resolveCatalogIntent(navigation.from.url, navigation.to.url, navigation.type);
	const declaredDock = Boolean(navigation.to.url.hash && navigation.to.url.hash !== '#overview' &&
		readCatalogViewContext(navigation.to.url).targetPresentation === 'dock');
	if (intent?.direction !== 'list-to-detail' || intent.history ||
		(navigation.to.url.hash && navigation.to.url.hash !== '#overview' && !declaredDock)) return;
	const diagnostics = navigation.from.url.searchParams.has('stage-test');
	if (diagnostics) delete root.dataset.catalogStagedError;
	const slot = endpoints.getContentSlot(intent.identity);
	if (slot !== 'catalog.card' && slot !== 'carousel.front') { decline('source-slot'); return; }
	const container = endpoints.resolve({ ...intent.identity, slot, role: 'container' });
	const surface = endpoints.resolve({ ...intent.identity, slot, role: 'summary-surface' });
	if (!container || !surface) { decline('source-endpoints'); return; }
	const retained = host.retainByElement(surface);
	if (!retained) { decline('source-island'); return; }
	const layout = resolveDetailLayout(options.metrics);
	const geometryKind = declaredDock && layout.composition === 'flow' ? 'dock' : 'hero';
	const occurrence = container.dataset.catalogOccurrence;
	const item = options.items.find(item => item.id === intent.identity.spatialElementId && (!occurrence || item.occurrence === occurrence));
	const capture = slot === 'catalog.card' ? captureCardElement : captureCarouselElement;
	const actors: StagedDomActor[] = [];
	if (declaredDock) {
		const destination = layout.dock?.surface ?? layout.pane?.header;
		const paint = slot === 'catalog.card' ? surface : retained.record.root.querySelector<HTMLElement>('.spatial-summary-surface');
		const title = endpoints.resolve({ ...intent.identity, slot, occurrence, role: 'title' });
		const eyebrow = endpoints.resolve({ ...intent.identity, slot, occurrence, role: 'eyebrow' });
		const paintProjection = paint && capture(paint), titleProjection = title && capture(title);
		const eyebrowProjection = eyebrow && capture(eyebrow);
		if (!destination || !paint || !paintProjection || !title || !titleProjection) {
			decline('dock-source-presentation'); retained.restore() || retained.release(); return;
		}
		actors.push({ element: paint, projection: paintProjection,
			target: { left: destination.x, top: destination.y, width: destination.width, height: destination.height } });
		const textLeft = layout.dock?.titleLeft ?? destination.x + 16;
		const availableWidth = Math.max(1, destination.x + destination.width - 64 - textLeft);
		const gap = eyebrowProjection ? 4 : 0;
		const height = titleProjection.height + (eyebrowProjection?.height ?? 0) + gap;
		const scale = Math.min(1, Math.max(1, destination.height - 16) / height,
			availableWidth / Math.max(titleProjection.width, eyebrowProjection?.width ?? 0));
		let top = destination.y + (destination.height - height * scale) / 2;
		if (eyebrow && eyebrowProjection) {
			actors.push({ element: eyebrow, projection: eyebrowProjection,
				target: { left: textLeft, top, width: eyebrowProjection.width * scale } });
			top += (eyebrowProjection.height + gap) * scale;
		}
		actors.push({ element: title, projection: titleProjection,
			target: { left: textLeft, top, width: titleProjection.width * scale } });
	} else {
		const actor = slot === 'catalog.card' ? container : retained.record.root;
		const projection = capture(actor);
		if (!projection) { decline('source-projection'); retained.restore() || retained.release(); return; }
		actors.push({ element: actor, projection,
			target: { left: layout.summary.x, top: layout.summary.anchor.y, width: layout.summary.width } });
	}
	const captured = performance.now();
	const destination = navigation.to.url.href;
	// Include Kit's own post-click scheduling in the acknowledgement measurement.
	const started = navigation.type === 'link' ? navigation.event.timeStamp : performance.now();
	let prepared = 0, firstMotion = 0, firstSubmitted = 0, heldAt = 0, committedAt = 0, revealedAt = 0;
	let holdingHost: HTMLElement | undefined;
	const holdingMotions: ReturnType<typeof createSourceDomMotion>[] = [];
	let adopted = false, committed = false, cleaned = false;
	let restoreClipping: (() => void) | undefined;
	const savedShells: HTMLElement[] = [];
	const exiting: HTMLElement[] = [];
	// Fade disjoint sibling branches without flattening the live source's ancestors.
	const paths = new Set<HTMLElement>();
	for (const { element } of actors) for (let branch: HTMLElement | null = element; branch && branch !== root; branch = branch.parentElement) {
		paths.add(branch);
		if (branch.tagName === 'MAIN') break;
	}
	for (const branch of paths) {
		for (const sibling of branch.parentElement?.children ?? []) {
			if (sibling instanceof HTMLElement && !paths.has(sibling) && !sibling.matches(
				'[data-catalog-shell], [data-catalog-shell-continuous], canvas, [data-spatial-viewport-metrics]'
			) && !sibling.querySelector('[data-catalog-shell]')) exiting.push(sibling);
		}
	}
	// The flow-layout Mini-Dock replaces the main menu. Real 3XL keeps its fixed
	// menu even when the declared section destination uses the pane header.
	if (geometryKind === 'dock') exiting.push(...root.querySelectorAll<HTMLElement>('[data-catalog-shell]'));
	const presentation = (exit: number, reveal = 0) => {
		experience.setCatalogTransitionPresentation({ active: true, enterOpacity: reveal,
			exitOpacity: exit, sharedOpacity: committed ? reveal : 1,
			backgroundOpacity: reveal, geometryOpacity: reveal });
	};
	const clear = (cancelled: boolean) => {
		if (cleaned) return;
		cleaned = true;
		for (const motion of holdingMotions.splice(0)) motion?.restore();
		restoreClipping?.(); restoreClipping = undefined;
		if (cancelled && !adopted) retained.restore() || retained.release();
		else retained.release();
		holdingHost?.remove(); holdingHost = undefined;
		for (const name of ['catalog-transition', 'catalog-direction', 'catalog-recipe', 'catalog-enter-hidden', 'catalog-shared-hidden', 'catalog-staged-phase']) root.removeAttribute(`data-${name}`);
		for (const name of ['enter', 'shared', 'exit']) root.style.removeProperty(`--catalog-${name}-opacity`);
		for (const shell of savedShells) shell.removeAttribute('data-catalog-shell-continuous');
		experience.finishCatalogGeometry();
		experience.setCatalogTransitionPresentation({ active: false, enterOpacity: 1, exitOpacity: 1, sharedOpacity: 1 });
		experience.flushCatalogFrame();
		options.onFinish();
	};
	const transition = new StagedCatalogTransition({
		actors, exiting,
		reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
		hooks: {
			begin() {
				if (!experience.beginStagedDetailMotion({ ...intent.identity, slot, occurrence, role: 'geometry' }, layout.mediaFit,
					declaredDock ? { kind: 'dock', layout: options.metrics, minimap: item?.minimap } : undefined)) { decline('geometry-not-ready'); return false; }
				retained.freeze();
				if (declaredDock) {
					retained.record.root.inert = true;
					restoreClipping = releaseSourceDomClipping(actors.map(actor => actor.element), retained.record.root);
					if (!restoreClipping) { decline('source-clipping'); return false; }
				}
				decline('accepted');
				root.dataset.catalogStagedPhase = 'moving';
				prepared = performance.now();
				return true;
			},
			frame({ progress, exit, quads }) {
				if (progress > 0 && !firstMotion) firstMotion = performance.now();
				experience.setStagedDetailProgress(progress);
				const panel = quads[0];
				if (!experience.setStagedDetailPanel(container, panel.quad, panel.width, panel.height)) throw new Error('Source panel is not prepared');
				presentation(exit);
				if (progress > 0) experience.flushCatalogFrame();
				if (progress > 0 && !firstSubmitted) firstSubmitted = performance.now();
			},
			hold({ releaseDomStyles }) {
				root.dataset.catalogStagedPhase = 'holding';
				if (!experience.holdStagedDetail(intent.identity.spatialElementId, geometryKind)) return false;
				releaseDomStyles();
				holdingHost = document.createElement('div');
				holdingHost.dataset.catalogStagedHold = '';
				holdingHost.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;overflow:visible;';
				document.body.append(holdingHost);
				retained.hold(holdingHost);
				for (const actor of actors) {
					const heldProjection = captureElementPlane(actor.element, retained.record.root);
					if (!heldProjection) return false;
					const motion = createSourceDomMotion(actor.element, heldProjection, actor.target);
					if (!motion?.update(1)) return false;
					holdingMotions.push(motion);
				}
				root.dataset.catalogTransition = 'holding';
				root.dataset.catalogDirection = 'forward';
				root.dataset.catalogRecipe = `${slot === 'catalog.card' ? 'list' : 'carousel'}-to-${geometryKind}`;
				root.dataset.catalogEnterHidden = '';
				root.dataset.catalogSharedHidden = '';
				root.dataset.catalogStagedPhase = 'held';
				root.style.setProperty('--catalog-enter-opacity', '0');
				root.style.setProperty('--catalog-shared-opacity', '0');
				for (const shell of geometryKind === 'dock' ? [] : root.querySelectorAll<HTMLElement>('[data-catalog-shell]')) {
					if (!shell.hasAttribute('data-catalog-shell-continuous') && shell.getBoundingClientRect().top >= 0) {
						shell.setAttribute('data-catalog-shell-continuous', ''); savedShells.push(shell);
					}
				}
				heldAt = performance.now();
				return true;
			},
			reveal(progress) {
				root.dataset.catalogStagedPhase = 'revealing';
				root.removeAttribute('data-catalog-enter-hidden'); root.removeAttribute('data-catalog-shared-hidden');
				root.style.setProperty('--catalog-enter-opacity', String(progress));
				root.style.setProperty('--catalog-shared-opacity', String(progress));
				if (!adopted) retained.record.root.style.opacity = String(1 - progress);
				experience.setStagedPanelOpacity(1 - progress);
				presentation(0, progress);
				experience.flushCatalogFrame();
			},
			finish() { revealedAt = performance.now(); clear(false); },
			cancel(reason) { if (root.dataset.catalogStagedDecision === 'accepted') decline(`cancelled:${reason}`); clear(true); },
			error(error, phase) {
				if (!diagnostics) return;
				const message = error instanceof Error ? error.message : String(error);
				// Persist the original exception before cleanup alters the endpoint inventory.
				root.dataset.catalogStagedError = JSON.stringify({ phase, message });
				const detail = root.querySelector<HTMLElement>('[data-spatial-element-root]');
				const header = root.querySelector<HTMLElement>('[data-spatial-element-sticky-header]');
				root.dataset.catalogStagedError = JSON.stringify({ phase, message,
					name: error instanceof Error ? error.name : typeof error,
					geometryKind, declaredDock, identity: intent.identity, committed, adopted,
					composition: endpoints.getComposition(intent.identity), scroll: getStageVisualScrollPosition(),
					dockActive: detail?.hasAttribute('data-spatial-element-dock-active'),
					dockProgress: header?.getAttribute('data-spatial-element-dock-progress'),
					endpoints: endpoints.getSnapshot().entries.filter(entry => entry.brandId === intent.identity.brandId &&
						entry.spatialElementId === intent.identity.spatialElementId && entry.slot.startsWith('detail.'))
				});
			}
		}
	});
	const handle = transition.start();
	if (!handle) return;
	return {
		handle, destination,
		get phase() { return transition.phase; },
		get timings() { return { started, entered, captured, prepared, firstMotion, firstSubmitted, held: heldAt, committed: committedAt, revealed: revealedAt }; },
		commit() { committed = true; committedAt = performance.now(); presentation(0); },
		cancel(reason: EarlyNavigationCancelReason = 'cancelled') { transition.cancel(reason); },
		async reveal(rebind: () => void) {
			const adoptSummary = async (signal: AbortSignal) => {
				if (signal.aborted || cleaned) return;
				const destinationSurface = endpoints.resolve({ ...intent.identity, slot: 'detail.summary', role: 'summary-surface' });
				const destinationSlot = destinationSurface?.querySelector<HTMLElement>('[data-spatial-summary-slot]');
				if (retained.record.kind === 'summary' && !destinationSlot) throw new Error('Summary destination did not bind');
				if (retained.record.kind === 'summary' && destinationSlot) {
					for (const motion of holdingMotions.splice(0)) motion?.restore();
					restoreClipping?.(); restoreClipping = undefined;
					adopted = retained.adopt(destinationSlot);
					if (!adopted) throw new Error('Summary ownership transfer failed');
					retained.unfreeze();
					await tick();
					if (signal.aborted) return;
					destinationSlot.dispatchEvent(new Event('spatial-summary-measure'));
					await tick();
					if (signal.aborted) return;
					rebind();
					window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
					experience.flushCatalogFrame();
				}
			};
			await transition.reveal([], async signal => {
				if (geometryKind === 'dock' && endpoints.getComposition(intent.identity) !== 'dock') throw new Error('Declared dock endpoint is not fully docked');
				if (!experience.prepareGeometryDestination({ spatialElementId: intent.identity.spatialElementId, kind: geometryKind })) throw new Error('Detail endpoint did not bind');
				experience.beginCatalogMotion();
				experience.setCatalogGeometryProgress(1);
				if (!declaredDock) await adoptSummary(signal);
			}, declaredDock ? async signal => {
				if (signal.aborted || cleaned) return;
				root.dataset.catalogStagedPhase = 'committing';
				await adoptSummary(signal);
			} : undefined);
		}
	};
}
