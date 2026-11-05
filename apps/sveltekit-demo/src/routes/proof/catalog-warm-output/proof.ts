import * as THREE from 'three/webgpu';
import { screenUV, texture, uv, vec4 } from 'three/tsl';
import { CatalogSpatialElementLayer } from '@spatial-elements/core/catalog/CatalogSpatialElementLayer';
import { CatalogWarmOutputContext } from '@spatial-elements/core/catalog/CatalogWarmOutputContext';
import { CatalogGeometryFade } from '@spatial-elements/core/catalog/CatalogGeometryFade';
import { BackgroundLayerOutput } from '@spatial-elements/core/stage/BackgroundLayerOutput';
import { SpatialElementAssetManager } from '@spatial-elements/core/catalog/assets/SpatialElementAssetManager';
import { EnvironmentCache } from '@spatial-elements/core/catalog/EnvironmentCache';
import { PreparationGate } from '@spatial-elements/core/catalog/PreparationGate';
import { carouselPose } from '@spatial-elements/core/catalog/catalogPose';
import { captureCarouselElement } from '@spatial-elements/core/catalog/carouselPanelProjection';
import { STAGE_TONE_MAPPING_EXPOSURE } from '@spatial-elements/core/stage/LiquidGlassPanel';
import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
import { overview } from '$lib/catalog';
import type { BackgroundCheckpoint } from '../background-layer-output/checkpoints';

export interface WarmGpuCall { method: string; phase: string; label: string }
export type CatalogWarmMode = 'scratch' | 'legacy' | 'borrowed';
export interface CatalogWarmRow {
	kind: string; actors: number; initialReady: boolean; readyBeforeFence: boolean; readyAfterFence: boolean;
	legacyReadyAfterScratch: boolean; stateRestoredSynchronously: boolean; scratchStateRestored: boolean;
	backgroundImplicitBefore: boolean; backgroundImplicitAfter: boolean;
	firstFocusCreates: WarmGpuCall[]; firstMovingCreates: WarmGpuCall[];
	afterHighFocusCreates: WarmGpuCall[]; afterHighMovingCreates: WarmGpuCall[];
	focusObserved: boolean[]; captureAccepted: boolean[]; scratchDistinct: boolean; warmCreates: number;
	sharedOwnerTarget: boolean | null; scratchPublicationRejected: boolean | null;
	staleFenceRejected: boolean; resizeRejected: boolean; resizedBackStillRejected: boolean;
	stats: ReturnType<CatalogSpatialElementLayer['getStats']>;
}
export interface CatalogWarmEvidence { protocol: string; warmMode: CatalogWarmMode; phase: string; rows: CatalogWarmRow[]; calls: WarmGpuCall[]; gpuErrors: string[] }
export interface FadeReuseFrame { phase: string; draws: number; submits: number; creates: WarmGpuCall[] }
export interface FadeReuseProof { mode: 'control' | 'candidate'; frames: FadeReuseFrame[] }

/** Real catalog owners and GLB loader, isolated from Stage orchestration; no production caller opts in. */
export async function runCatalogWarmOutputProof(host: HTMLElement,
	checkpoint: (point: Omit<BackgroundCheckpoint, 'id'>) => Promise<void>, observe?: (evidence: CatalogWarmEvidence) => void) {
	const requestedMode = new URLSearchParams(location.search).get('warm-mode');
	const warmMode: CatalogWarmMode = requestedMode === 'legacy' || requestedMode === 'borrowed' ? requestedMode : 'scratch';
	const requestedReuse = new URLSearchParams(location.search).get('fade-reuse');
	const fadeReuse: FadeReuseProof | undefined = requestedReuse === 'control' || requestedReuse === 'candidate'
		? { mode: requestedReuse, frames: [] } : undefined;
	const renderer = new THREE.WebGPURenderer({ antialias: true });
	const assets = new SpatialElementAssetManager(), environments = new EnvironmentCache(renderer, new PreparationGate());
	const canvases = ['background', 'rear', 'front'].map((name, index) => {
		const canvas = document.createElement('canvas'); canvas.dataset.catalogWarmCanvas = name;
		canvas.style.cssText = index === 0
			? 'position:fixed;left:8px;top:8px;width:240px;height:160px;z-index:100;pointer-events:none;'
			: `position:fixed;left:0;top:0;z-index:${index};pointer-events:none;`;
		host.append(canvas); return canvas;
	});
	const outputs = canvases.map(canvas => new THREE.CanvasTarget(canvas));
	const background = new THREE.RenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
	background.texture.colorSpace = THREE.LinearSRGBColorSpace;
	const seedMaterial = new THREE.NodeMaterial();
	seedMaterial.fragmentNode = vec4(uv().x.mul(2.5).add(0.05), uv().y.mul(1.8).add(0.1), uv().x.mul(uv().y).add(0.2), 1);
	seedMaterial.depthTest = seedMaterial.depthWrite = seedMaterial.toneMapped = false;
	const seed = new THREE.QuadMesh(seedMaterial), publish = new THREE.RenderPipeline(renderer, texture(background.texture, screenUV));
	const displayMaterial = new THREE.NodeMaterial();
	displayMaterial.fragmentNode = texture(background.texture, screenUV);
	displayMaterial.depthTest = displayMaterial.depthWrite = displayMaterial.toneMapped = false;
	const display = new THREE.QuadMesh(displayMaterial);
	let outputOwner: BackgroundLayerOutput | undefined;
	const calls: WarmGpuCall[] = [], gpuErrors: string[] = [], rows: CatalogWarmRow[] = [];
	let phase = 'initialize', device: GPUDevice | undefined, layer: CatalogSpatialElementLayer | undefined;
	let context: CatalogWarmOutputContext | undefined, semantic: HTMLElement | undefined;
	let intervention: THREE.RenderTarget | undefined;
	const restoreMethods: (() => void)[] = [];
	let fadeDraws = 0, submissions = 0, validationScope = false;
	const originalFadeRender = CatalogGeometryFade.prototype.render;
	if (fadeReuse) {
		// Proof-only control: execute the same production owner without its optional
		// retained-source key. Both modes keep identical rendering and input poses.
		CatalogGeometryFade.prototype.render = function (...args: Parameters<CatalogGeometryFade['render']>) {
			const [renderer, opacity, draw, warmOutput, frozenSource] = args;
			return originalFadeRender.call(this, renderer, opacity, () => {
				if (opacity > 0 && opacity < 1) fadeDraws++;
				draw();
			}, warmOutput, fadeReuse.mode === 'candidate' ? frozenSource : undefined);
		};
		restoreMethods.push(() => { CatalogGeometryFade.prototype.render = originalFadeRender; });
	}
	const onGpuError = (event: GPUUncapturedErrorEvent) => gpuErrors.push(event.error.message);
	const paint = async () => { await device!.queue.onSubmittedWorkDone(); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
	const presented = async (name: string) => {
		await paint();
		observe?.({ protocol: 'catalog-warm-output-v1', warmMode, phase, rows, calls, gpuErrors });
		await checkpoint({ phase: name, width: 240, height: 160, dpr: 1 });
	};
	const select = (index: number) => {
		renderer.setCanvasTarget(outputs[index]); renderer.setRenderTarget(null);
		renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
	};
	const publishSource = () => {
		select(0);
		if (outputOwner) {
			if (!outputOwner.resize() || !outputOwner.compose(display, () => {})) throw new Error('Background owner could not rebuild its source');
		} else publish.render();
	};
	const createWarmContext = (current: () => boolean) => {
		if (!outputOwner) return CatalogWarmOutputContext.create(renderer, current);
		const handle = outputOwner.captureScratch();
		return handle && CatalogWarmOutputContext.createBorrowed(renderer, handle, current);
	};
	const state = () => ({ canvas: renderer.getCanvasTarget(), target: renderer.getRenderTarget(), output: renderer.getOutputRenderTarget(),
		viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()), test: renderer.getScissorTest(),
		color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), depth: renderer.getClearDepth(), stencil: renderer.getClearStencil(),
		auto: renderer.autoClear, colorClear: renderer.autoClearColor, depthClear: renderer.autoClearDepth, stencilClear: renderer.autoClearStencil,
		tone: renderer.toneMapping, exposure: renderer.toneMappingExposure, outputSpace: renderer.outputColorSpace });
	const equal = (a: ReturnType<typeof state>, b: ReturnType<typeof state>) => Object.keys(a).every(key => {
		const x = a[key as keyof typeof a], y = b[key as keyof typeof b];
		return x instanceof THREE.Vector4 ? x.equals(y as THREE.Vector4) : x instanceof THREE.Color ? x.equals(y as THREE.Color) : x === y;
	});
	const sourceDom = (kind: string) => {
		const root = document.createElement('section'); root.dataset.catalogList = ''; root.dataset.brandId = 'warm-proof';
		root.style.cssText = 'position:fixed;left:0;top:190px;width:960px;height:400px;z-index:3;pointer-events:none;';
		const carousel = kind !== 'list', ids = carousel || fadeReuse ? ['column', 'ring'] : ['column'];
		const items: SpatialListItem[] = [];
		let focus: HTMLElement | undefined, selectedCard: HTMLElement | undefined, selectedSummary: HTMLElement | undefined;
		for (const [index, id] of ids.entries()) {
			const card = document.createElement('div'); card.style.cssText = carousel
				? 'position:absolute;inset:0;pointer-events:none;' : `position:absolute;left:${fadeReuse ? 180 + index * 280 : 350}px;top:0;width:240px;height:260px;`;
			if (carousel) {
				card.dataset.carouselSpatialElement = ''; card.dataset.carouselSurface = kind;
				card.dataset.carouselTheme = JSON.stringify({ backdropBlur: 5, tintOpacity: 0.2, radius: 12 });
			} else card.dataset.catalogCard = '';
			if (!index) { card.dataset.catalogSelected = ''; selectedCard = card; }
			const slot = document.createElement('div'); slot.dataset.catalogGeometry = ''; slot.dataset.spatialElementId = id;
			slot.style.cssText = carousel ? 'position:absolute;inset:0;' : 'width:240px;height:180px;'; card.append(slot);
			if (carousel) {
				const hit = document.createElement('button'); hit.className = 'spatial-element-target'; hit.textContent = '';
				hit.setAttribute('aria-label', `Focus ${id}`); hit.style.cssText = 'position:absolute;transform:translate(-50%,-50%);background:transparent;border:0;pointer-events:auto;';
				card.append(hit); if (!index) focus = hit;
				const summary = document.createElement('div'); summary.className = 'summary';
				summary.style.cssText = 'position:absolute;left:580px;top:50px;width:180px;height:130px;transform-origin:0 0;';
				if (kind === 'frosted') summary.style.cssText += 'background:rgba(255,255,255,.2);backdrop-filter:blur(5px);border-radius:12px;';
				card.append(summary);
				if (!index) selectedSummary = summary;
			} else { card.tabIndex = 0; if (!index) focus = card; }
			root.append(card);
			const item = overview.find(item => item.id === id)!;
			items.push({ ...item, ...(carousel ? { pose: { kind: 'carousel' as const, read: () => carouselPose(index, 0, ids.length, {},
				{ width: 960, height: 400, left: 0, viewportWidth: innerWidth }) } } : {}) });
		}
		host.append(root); return { root, items, focus: focus!, selectedCard: selectedCard!, selectedSummary };
	};
	try {
		await renderer.init();
		const backend = renderer.backend as unknown as { isWebGPUBackend: boolean; device: GPUDevice };
		if (!backend.isWebGPUBackend) throw new Error('Catalog output proof requires real WebGPU');
		device = backend.device; device.addEventListener('uncapturederror', onGpuError);
		if (fadeReuse) {
			device.pushErrorScope('validation'); validationScope = true;
			const queue = device.queue, submit = queue.submit;
			queue.submit = function (commands) { submissions++; return submit.call(this, commands); };
			restoreMethods.push(() => { queue.submit = submit; });
		}
		for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createTexture', 'createBuffer'] as const) {
			const port = device as unknown as Record<string, (...args: unknown[]) => unknown>, original = port[method];
			port[method] = function (...args) {
				calls.push({ method, phase, label: String((args[0] as { label?: unknown })?.label ?? '') });
				return original.apply(this, args);
			};
			restoreMethods.push(() => { port[method] = original; });
		}
		renderer.autoClear = false; renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = STAGE_TONE_MAPPING_EXPOSURE;
		for (let index = 0; index < outputs.length; index++) {
			select(index); renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight, false);
		}
		const implicit = (renderer as unknown as { _frameBufferTargets?: Map<object, unknown> })._frameBufferTargets;
		if (!(implicit instanceof Map)) throw new Error('Three r186 implicit-buffer diagnostic unavailable');
		const backgroundHasImplicit = () => Map.prototype.has.call(implicit, outputs[0]);
		select(0); renderer.setRenderTarget(background); renderer.setClearColor(0, 1); renderer.clear(); seed.render(renderer);
		renderer.setRenderTarget(null);
		if (warmMode === 'borrowed') {
			outputOwner = BackgroundLayerOutput.create(renderer, outputs[0]);
			if (!outputOwner) throw new Error('Borrowed Background owner profile declined');
		}
		publishSource();
		const envLease = environments.acquire('/assets/demo/studio.hdr');
		const environment = await envLease.ready;
		try {
			for (const kind of ['list', 'frosted', 'glass']) {
				phase = `${kind}/setup`;
				const dom = sourceDom(kind); semantic = dom.root;
				layer = new CatalogSpatialElementLayer(assets, () => {});
				await layer.setSpatialElements('warm-proof', dom.items); await paint();
				let clock = performance.now();
				const update = () => layer!.update(renderer, environment.target.texture, clock += 1000 / 60);
				const draw = () => {
					select(1); renderer.setClearColor(0, 0); renderer.clear(); layer!.renderRear(renderer);
					select(2); renderer.setClearColor(0, 0); renderer.clear(); layer!.draw(renderer, 'front'); select(0);
				};
				intervention = fadeReuse ? new THREE.RenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }) : undefined;
				const warmIntervention = () => {
					if (!intervention) return;
					try { renderer.setRenderTarget(intervention); renderer.setClearColor(0, 0); renderer.clear(); layer!.renderForPreparation(renderer); }
					finally { select(0); }
				};
				update(); draw(); await paint(); update(); draw(); await paint();
				// Allocate the artificial intervening warm destination before measured
				// motion. It later overwrites the real shared fade scratch, not a mock.
				if (intervention) { warmIntervention(); await paint(); }
				context = createWarmContext(() => true);
				if (!context) throw new Error(`Scratch output profile unexpectedly declined: ${kind}`);
				// The separate legacy control exercises the unchanged Canvas warm caller.
				// Its Background allocation/retention is recorded, not certified as an offscreen path.
				const warmContext = warmMode !== 'legacy' ? context : undefined;
				const initialReady = layer.isStagedDetailReady('column', undefined, renderer, warmContext);
				await presented(`${kind}/source`); await presented(`${kind}/source-idle`);
				const before = state(), targetViewport = context.target.viewport.clone(), targetScissor = context.target.scissor.clone(), targetTest = context.target.scissorTest;
				const implicitBefore = backgroundHasImplicit(), warmStart = calls.length;
				phase = `${kind}/warm`;
				const warming = layer.prepareStagedNavigation(renderer, warmContext);
				const restored = equal(before, state());
				const targetRestored = context.target.viewport.equals(targetViewport) && context.target.scissor.equals(targetScissor) && context.target.scissorTest === targetTest;
				const readyBeforeFence = layer.isStagedDetailReady('column', undefined, renderer, warmContext);
				await warming;
				const warmCreates = calls.length - warmStart;
				const readyAfterFence = layer.isStagedDetailReady('column', undefined, renderer, warmContext);
				const legacyReadyAfterScratch = layer.isStagedDetailReady('column', undefined, renderer);
				const scratchPublicationRejected = outputOwner ? !outputOwner.publish() : null;
				await presented(`${kind}/after-warm`);
				const focusObserved: boolean[] = [], captureAccepted: boolean[] = [];
				const exercise = async (prefix: string) => {
					phase = prefix + '/focus'; const focusStart = calls.length;
					dom.focus.focus({ preventScroll: true }); update(); draw(); await device!.queue.onSubmittedWorkDone();
					focusObserved.push(dom.focus.matches(':focus-visible') && (kind === 'list' || layer!.getStats().actors.some(actor => actor.spatialElementId === 'column' && actor.hover > 0)));
					const focusCreates = calls.slice(focusStart);
					await presented(`${prefix}/focus`);
					const target = layer!.getStagedDetailTarget('column', undefined, { x: 100, y: 180, width: 420, height: 400 }, { width: innerWidth, height: innerHeight });
					if (!target) throw new Error('Existing actor has no canonical handoff target');
					const panel = dom.selectedSummary && captureCarouselElement(dom.selectedSummary);
					if (kind === 'glass' && !panel) throw new Error('Real selected glass has no captured plane');
					phase = prefix + '/moving'; const movingStart = calls.length;
					const firstDraws = fadeDraws, firstSubmits = submissions;
					captureAccepted.push(layer!.capture('column'));
					layer!.freezeStagedSource(); layer!.setExitOpacity(0.5, true);
					if (panel && !layer!.setStagedPanel(dom.selectedCard, panel.corners, panel.width, panel.height)) throw new Error('Existing glass ownership was not retained');
					layer!.setHandoffTarget({ ...target, progress: 0.25 }); update(); draw(); await device!.queue.onSubmittedWorkDone();
					const movingCreates = calls.slice(movingStart);
					fadeReuse?.frames.push({ phase, draws: fadeDraws - firstDraws, submits: submissions - firstSubmits, creates: movingCreates });
					await presented(`${prefix}/moving`);
					if (fadeReuse) {
						for (const [index, name] of ['moving-reuse', 'moving-after-warm', 'moving-reuse-again'].entries()) {
							if (index === 1) { phase = `${prefix}/intervening-warm`; warmIntervention(); await paint(); }
							phase = `${prefix}/${name}`;
							const beforeDraws = fadeDraws, beforeSubmits = submissions, beforeCalls = calls.length;
							const progress = 0.45 + index * 0.2;
							layer!.setExitOpacity(0.4 - index * 0.12, true);
							if (panel && dom.selectedSummary) {
								dom.selectedSummary.style.transform = `translate(${(index + 1) * 28}px,${-(index + 1) * 18}px)`;
								const moved = captureCarouselElement(dom.selectedSummary);
								if (!moved || !layer!.setStagedPanel(dom.selectedCard, moved.corners, moved.width, moved.height)) throw new Error('Retained panel did not move');
							}
							layer!.setHandoffTarget({ ...target, progress }); update(); draw(); await device!.queue.onSubmittedWorkDone();
							fadeReuse.frames.push({ phase, draws: fadeDraws - beforeDraws, submits: submissions - beforeSubmits, creates: calls.slice(beforeCalls) });
							await presented(phase);
						}
					}
					phase = prefix + '/restore'; layer!.finishHandoff(); layer!.finishStagedPanel(); layer!.setExitOpacity(1, false); dom.focus.blur();
					if (dom.selectedSummary) dom.selectedSummary.style.transform = '';
					for (let i = 0; i < 80 && update(); i++) { /* deterministic source settling, outside measured draws */ }
					draw(); await paint();
					return { focusCreates, movingCreates };
				};
				const first = await exercise(`${kind}/first`);
				phase = `${kind}/high-intervention`;
				const highResource = dom.items[0].geometry!.high;
				const lease = assets.acquire(typeof highResource === 'string' ? { url: highResource, format: 'glb', revision: 'url-versioned' } : highResource);
				const high = await lease.createInstance();
				const highScene = new THREE.Scene(); highScene.environment = environment.target.texture; highScene.add(high.scene);
				const highCamera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100); highCamera.position.z = 5;
				highCamera.coordinateSystem = renderer.coordinateSystem; highCamera.updateProjectionMatrix(); highCamera.updateMatrixWorld();
				const highTarget = new THREE.RenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
				try {
					renderer.setRenderTarget(highTarget); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(highScene, highCamera);
					// The real High preparation path also borrows the existing Low fade owner.
					// This matters more than drawing an unrelated High clone for owner-cache eviction.
					layer.renderForPreparation(renderer);
					await device.queue.onSubmittedWorkDone();
				}
				finally { select(0); high.dispose(); lease.release(); highTarget.dispose(); }
				await presented(`${kind}/after-high`);
				const afterHigh = await exercise(`${kind}/after-high`);
				const stats = layer.getStats(renderer, warmContext);
				// The actual asynchronous fence must reject a generation invalidated before its completion.
				context.dispose(); let current = true;
				context = createWarmContext(() => current);
				if (!context) throw new Error('Replacement context declined');
				phase = `${kind}/stale-fence`; const stale = layer.prepareStagedNavigation(renderer, context); current = false; await stale;
				const staleFenceRejected = !layer.isStagedDetailReady('column', undefined, renderer, context);
				context.dispose(); context = createWarmContext(() => true);
				if (!context) throw new Error('Resize guard context declined');
				// Invalidate the physical output profile without replacing the independent preview CSS extent.
				outputs[0].setSize(innerWidth + 1, innerHeight, false);
				const resizeRejected = !context.isCurrent(renderer);
				outputs[0].setSize(innerWidth, innerHeight, false);
				const resizedBackStillRejected = !context.isCurrent(renderer);
				rows.push({ kind, actors: stats.actors.length, initialReady, readyBeforeFence, readyAfterFence, legacyReadyAfterScratch,
					stateRestoredSynchronously: restored, scratchStateRestored: targetRestored,
					backgroundImplicitBefore: implicitBefore, backgroundImplicitAfter: backgroundHasImplicit(),
					firstFocusCreates: first.focusCreates, firstMovingCreates: first.movingCreates,
					afterHighFocusCreates: afterHigh.focusCreates, afterHighMovingCreates: afterHigh.movingCreates,
					focusObserved, captureAccepted, scratchDistinct: context.target !== background, warmCreates,
					sharedOwnerTarget: outputOwner ? outputOwner.getRenderTargets().length === 1 && context.target === outputOwner.getRenderTargets()[0] : null,
					scratchPublicationRejected,
					staleFenceRejected, resizeRejected, resizedBackStillRejected, stats });
				intervention?.dispose(); intervention = undefined;
				context.dispose(); context = undefined; layer.dispose(); layer = undefined; semantic.remove(); semantic = undefined;
				// Resize invalidated the published backing texture: restore the legitimate source for the next case.
				publishSource();
			}
		} finally { envLease.release(); }
		await device.queue.onSubmittedWorkDone();
		if (validationScope) { validationScope = false; const error = await device.popErrorScope(); if (error) gpuErrors.push(error.message); }
		return { protocol: 'catalog-warm-output-v1', warmMode, rows, calls, gpuErrors, fadeReuse,
			limits: ['960x640, DPR1 only', 'High intervention includes a real GLB/environment draw and existing layer.renderForPreparation Low-fade owner in an independent 4x HalfFloat target, not the full Stage refinement owner graph.',
				'No forced renderer exception, repeated resize/reprepare pixel matrix, transmission-material or arbitrary custom callback coverage yet.',
				'Counts establish first-use compatibility only; this is not a frame-time benchmark.'] };
	} catch (error) {
		const failure = error instanceof Error ? error : new Error(String(error));
		Object.assign(failure, { evidence: { protocol: 'catalog-warm-output-v1', warmMode, phase, rows, calls, gpuErrors } });
		throw failure;
	} finally {
		if (validationScope) { validationScope = false; await device?.popErrorScope(); }
		intervention?.dispose(); context?.dispose(); layer?.dispose(); semantic?.remove();
		restoreMethods.reverse().forEach(restore => restore()); device?.removeEventListener('uncapturederror', onGpuError);
		environments.dispose(); assets.dispose(); outputOwner?.dispose(); publish.dispose(); displayMaterial.dispose(); seedMaterial.dispose(); background.dispose();
		outputs.forEach(output => output.dispose()); canvases.forEach(canvas => canvas.remove()); void renderer.dispose();
	}
}
