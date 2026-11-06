import * as THREE from 'three/webgpu';
import { uv, vec4 } from 'three/tsl';
import { StageRenderPipeline, type StageRenderPorts } from '@spatial-elements/core/stage/StageRenderPipeline';
import { LiquidGlassPanel, STAGE_TONE_MAPPING_EXPOSURE } from '@spatial-elements/core/stage/LiquidGlassPanel';
import { DEFAULT_INTERACTION_THEME } from '@spatial-elements/core/stage/stageConstants';
import type { StagePanelRuntime } from '@spatial-elements/core/stage/StagePanelRuntime';
import type { StageMinimapState } from '@spatial-elements/core/stage/minimap/MinimapState';
import { unpackHalfFloatRgbaRows } from '../background-layer-output/readback';

const difference = (a: ArrayLike<number>, b: ArrayLike<number>) => {
	if (a.length !== b.length) throw new Error('Readback sizes differ');
	let max = 0; for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i])); return max;
};

export type ScrollWarmupCheckpoint = 'source' | 'source-idle' | 'after-warm' | 'retained' |
	'candidate-scroll' | 'candidate-full' | 'reference-scroll' | 'reference-full';

/** Actual runtime API; screenshot checkpoints and depth witnesses are fixture-only. */
export async function runDeferredScrollWarmupProof(
	host: HTMLElement,
	checkpoint: (name: ScrollWarmupCheckpoint, dpr: number) => Promise<void>
) {
	const renderer = new THREE.WebGPURenderer({ antialias: true });
	const canvas = document.createElement('canvas'), output = new THREE.CanvasTarget(canvas);
	canvas.dataset.scrollWarmupCanvas = '';
	const camera = new THREE.PerspectiveCamera(45, 4 / 3, 1, 1000); camera.position.z = 200;
	const miniCamera = camera.clone();
	const panelScene = new THREE.Scene(), runtimes: StagePanelRuntime[] = [], views = new Map<number, StageMinimapState>();
	const options = [
		{ width: 72, height: 55, backdropBlur: 4, position: { x: -25, y: 10 }, tintOpacity: 0.2 },
		{ width: 45, height: 38, backdropBlur: 0, position: { x: 28, y: -14 }, tintOpacity: 0.35 }
	];
	const sourceMaterial = new THREE.NodeMaterial();
	sourceMaterial.fragmentNode = vec4(uv().x.mul(3.5).add(0.02), uv().y.mul(1.6).add(0.03), uv().x.mul(uv().y).add(0.13), 1);
	sourceMaterial.depthTest = sourceMaterial.depthWrite = sourceMaterial.toneMapped = false;
	const source = new THREE.QuadMesh(sourceMaterial);
	let sceneDraws = 0;
	const ports = { renderer, container: host, backgroundCanvasTarget: output, panelScene, camera, panelCamera: camera,
		interactionTheme: () => DEFAULT_INTERACTION_THEME, fallbackPanelOptions: () => options,
		panelRuntimes: () => runtimes, minimaps: () => views,
		frame: () => ({ outgoingBackground: false }),
		renderStage: () => { sceneDraws++; renderer.setClearColor(0xffffff, 1); renderer.clear(); source.render(renderer); }
	} as unknown as StageRenderPorts;
	const pipeline = new StageRenderPipeline(ports), glass: LiquidGlassPanel[] = [];
	const seedCamera = new THREE.OrthographicCamera(-100, 100, 75, -75, 1, 1000); seedCamera.position.z = 200;
	const seedGeometry = new THREE.PlaneGeometry(90, 150), witnessGeometry = new THREE.PlaneGeometry(200, 150);
	const seedMaterial = new THREE.MeshBasicMaterial({ color: 0xe02080, depthTest: true, depthWrite: true });
	const witnessMaterial = new THREE.MeshBasicMaterial({ color: 0x16dab0, depthTest: true, depthWrite: true });
	const seed = new THREE.Mesh(seedGeometry, seedMaterial); seed.position.set(-50, 0, 100);
	const witness = new THREE.Mesh(witnessGeometry, witnessMaterial);
	const seedScene = new THREE.Scene(), witnessScene = new THREE.Scene(); seedScene.add(seed); witnessScene.add(witness);
	const readback = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
	let framebuffer = new THREE.FramebufferTexture(1, 1); framebuffer.type = THREE.HalfFloatType;
	const gpuErrors: string[] = [], pendingErrors: Promise<void>[] = [];
	const creates: { method: string; phase: string }[] = [];
	let phase = 'initialize', device: GPUDevice | undefined;
	const restoreMethods: (() => void)[] = [];
	const rows: { dpr: number; used: boolean; sourceDraws: number; colorError: number;
		depthWitnessError: number; depthWitnessControl: number; scrollError: number;
		fullError: number; firstScrollCreates: { method: string; phase: string }[];
		stateRestored: boolean; resizeRejected: boolean }[] = [];
	const onGpuError = (event: GPUUncapturedErrorEvent) => gpuErrors.push(event.error.message);
	const validate = <T>(name: string, draw: () => T) => {
		phase = name; device!.pushErrorScope('validation');
		try { return draw(); }
		finally { pendingErrors.push(device!.popErrorScope().then(error => { if (error) gpuErrors.push(`${name}: ${error.message}`); })); }
	};
	const state = () => ({ target: renderer.getRenderTarget(), canvas: renderer.getCanvasTarget(),
		viewport: renderer.getViewport(new THREE.Vector4()).toArray(), scissor: renderer.getScissor(new THREE.Vector4()).toArray(),
		scissorTest: renderer.getScissorTest(), auto: renderer.autoClear, colorAuto: renderer.autoClearColor,
		depthAuto: renderer.autoClearDepth, stencilAuto: renderer.autoClearStencil,
		color: renderer.getClearColor(new THREE.Color()).toArray(), alpha: renderer.getClearAlpha(),
		depth: renderer.getClearDepth(), stencil: renderer.getClearStencil(), active: pipeline.activeRenderTargets });
	const sameState = (a: ReturnType<typeof state>, b: ReturnType<typeof state>) => Object.keys(a).every(key => {
		const k = key as keyof typeof a;
		return Array.isArray(a[k]) ? JSON.stringify(a[k]) === JSON.stringify(b[k]) : a[k] === b[k];
	});
	const capture = async () => {
		phase = 'readback';
		const target = renderer.getRenderTarget();
		try {
			renderer.setRenderTarget(null); renderer.copyFramebufferToTexture(framebuffer);
			renderer.initRenderTarget(readback); renderer.copyTextureToTexture(framebuffer, readback.texture);
			const raw = await renderer.readRenderTargetPixelsAsync(readback, 0, 0, readback.width, readback.height);
			if (!(raw instanceof Uint16Array)) throw new Error('Expected RGBA HalfFloat/Uint16Array');
			const unpacked = unpackHalfFloatRgbaRows(raw, readback.width, readback.height);
			return Array.from(unpacked.pixels, value => THREE.DataUtils.fromHalfFloat(value));
		} finally { renderer.setRenderTarget(target); }
	};
	const fenceAndPaint = async () => {
		await device!.queue.onSubmittedWorkDone();
		await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	};
	const render = (scroll: boolean) => {
		pipeline.setScrollRenderQuality(scroll);
		renderer.setCanvasTarget(output); renderer.setRenderTarget(pipeline.activeRenderTargets!.sceneCapture);
		ports.renderStage(); pipeline.renderPanelBlurCaptures(pipeline.activeRenderTargets!, true);
		pipeline.renderStageDisplay(); pipeline.renderBackgroundPanels();
	};
	const seedOutput = () => {
		renderer.setCanvasTarget(output); renderer.setRenderTarget(null); renderer.setScissorTest(false);
		pipeline.renderStageDisplay(); renderer.render(seedScene, seedCamera);
	};
	try {
		await renderer.init();
		const backend = renderer.backend as unknown as { isWebGPUBackend: boolean; device: GPUDevice };
		if (!backend.isWebGPUBackend) throw new Error('Requires real WebGPU');
		device = backend.device; device.addEventListener('uncapturederror', onGpuError);
		for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createTexture', 'createBuffer'] as const) {
			const original = device[method];
			Object.defineProperty(device, method, { configurable: true, value: function (...args: unknown[]) {
				creates.push({ method, phase }); return (original as (...values: unknown[]) => unknown).apply(device, args);
			} });
			restoreMethods.push(() => { Object.defineProperty(device!, method, { configurable: true, value: original }); });
		}
		host.append(canvas); renderer.autoClear = false;
		renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = STAGE_TONE_MAPPING_EXPOSURE;
		for (const camera of [seedCamera, ports.camera, miniCamera]) { camera.coordinateSystem = renderer.coordinateSystem; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); }
		pipeline.createSceneCapture();
		for (const [index, value] of options.entries()) {
			const panel = new LiquidGlassPanel(pipeline.getPanelBlurTexture(value), value); glass.push(panel);
			panel.group.rotation.y = index ? -0.1 : 0.16; panelScene.add(panel.group);
			runtimes.push({ group: panel.group, glass: panel, options: panel.options, surface: 'glass' } as StagePanelRuntime);
		}
		// Frosted DOM panels have no GPU glass group; keep that actual runtime branch in the inventory.
		runtimes.push({ group: new THREE.Group(), options: glass[0].options, surface: 'frosted' } as StagePanelRuntime);
		views.set(1, { panelIndex: 1, viewportVisible: true, screenCamera: miniCamera,
			stageCaptureTexture: { value: pipeline.activeRenderTargets!.sceneCapture.texture },
			stageBlurTexture: { value: pipeline.getPanelBlurTexture(options[1]) } } as StageMinimapState);
		for (const dpr of [1, 1.5]) {
			phase = 'resize'; renderer.setCanvasTarget(output); renderer.setPixelRatio(dpr); renderer.setSize(160, 120, false);
			for (const scroll of [false, true]) {
				pipeline.setScrollRenderQuality(scroll);
				const set = pipeline.activeRenderTargets!, width = Math.round(160 * dpr * set.scale), height = Math.round(120 * dpr * set.scale);
				set.sceneCapture.setSize(width, height);
				for (const blur of set.panelBlurCaptures.values()) {
					const scale = blur.effect ? blur.resolutionScale / (dpr * set.scale) : 1;
					if (blur.effect) { blur.effect.resolutionScale = scale; blur.effect.setSize(width, height); }
					blur.target.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
				}
			}
			pipeline.setScrollRenderQuality(false);
			readback.setSize(canvas.width, canvas.height); framebuffer.dispose();
			framebuffer = new THREE.FramebufferTexture(canvas.width, canvas.height); framebuffer.type = THREE.HalfFloatType;
			miniCamera.copy(camera); miniCamera.setViewOffset(192, 144, 16, 8, 160, 120); miniCamera.updateMatrixWorld(true);
			// Same completed Full contexts as reveal; Scroll remains cold on the first iteration.
			validate('full-warm', () => { for (const alpha of [0.5, 1]) { glass.forEach(panel => panel.setVisibilityAlpha(alpha)); render(false); } });
			const token = pipeline.captureDeferredScrollWarmup(() => true);
			if (!token) throw new Error('Controlled fixture unexpectedly ineligible');
			await device.queue.onSubmittedWorkDone();
			validate('color-depth-seed', seedOutput);
			await checkpoint('source', dpr);
			// Control the presentation measurement itself without any intervening draw.
			await fenceAndPaint();
			await checkpoint('source-idle', dpr);
			const before = await capture(), beforeState = state(), beforeDraws = sceneDraws;
			const used = validate('candidate-warm', () => pipeline.warmInactiveScrollTargetSet(token));
			const sourceDrawCount = sceneDraws - beforeDraws, stateRestored = sameState(beforeState, state());
			await checkpoint('after-warm', dpr);
			const after = await capture();
			// No Canvas redraw/reseed: the harness reads the presented DOM pixels,
			// not an expired WebGPU drawing buffer through drawImage(canvas).
			await fenceAndPaint();
			await checkpoint('retained', dpr);
			// No reseed after candidate warm. The first real scroll draw must already have its resources.
			const firstCreate = creates.length;
			validate('first-scroll', () => render(true));
			const firstScrollCreates = creates.slice(firstCreate);
			await checkpoint('candidate-scroll', dpr); const candidateScroll = await capture();
			validate('candidate-full', () => render(false));
			await checkpoint('candidate-full', dpr); const candidateFull = await capture();
			validate('reference-warm', () => pipeline.warmRenderTargetSets());
			validate('reference-scroll', () => render(true));
			await checkpoint('reference-scroll', dpr); const referenceScroll = await capture();
			validate('reference-full', () => render(false));
			await checkpoint('reference-full', dpr); const referenceFull = await capture();
			// Independent depth witness: candidate warm must not erase the near left-side seed.
			validate('depth-seed', seedOutput);
			const depthToken = pipeline.captureDeferredScrollWarmup(() => true)!;
			validate('depth-warm', () => pipeline.warmInactiveScrollTargetSet(depthToken));
			validate('depth-witness', () => renderer.render(witnessScene, seedCamera)); const depthCandidate = await capture();
			validate('depth-control-seed', seedOutput);
			validate('depth-control-witness', () => renderer.render(witnessScene, seedCamera)); const depthControl = await capture();
			validate('depth-negative-control', () => { renderer.clearDepth(); renderer.render(witnessScene, seedCamera); });
			const erasedDepth = await capture();
			const stale = pipeline.captureDeferredScrollWarmup(() => true)!;
			pipeline.resizeRenderTargets();
			const resizeRejected = !pipeline.warmInactiveScrollTargetSet(stale);
			rows.push({ dpr, used, sourceDraws: sourceDrawCount, stateRestored, resizeRejected, firstScrollCreates,
				colorError: difference(before, after),
				depthWitnessError: difference(depthCandidate, depthControl), depthWitnessControl: difference(depthControl, erasedDepth),
				scrollError: difference(candidateScroll, referenceScroll), fullError: difference(candidateFull, referenceFull) });
		}
		await device.queue.onSubmittedWorkDone(); await Promise.all(pendingErrors);
		return { protocol: 'offscreen-scroll-warmup-v3-dom-checkpoints', rows, gpuErrors, creates,
			readback: 'RGBA/HalfFloat/Uint16Array', diagnosticOnly: true };
	} finally {
		for (const restore of restoreMethods) restore(); device?.removeEventListener('uncapturederror', onGpuError);
		glass.forEach(panel => panel.dispose()); pipeline.dispose(); sourceMaterial.dispose();
		seedGeometry.dispose(); witnessGeometry.dispose(); seedMaterial.dispose(); witnessMaterial.dispose();
		readback.dispose(); framebuffer.dispose(); output.dispose(); renderer.dispose(); canvas.remove();
	}
}
