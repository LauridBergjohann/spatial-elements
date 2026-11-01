import * as THREE from 'three/webgpu';
import { screenUV, texture, uv, vec4 } from 'three/tsl';
import { StageRenderPipeline, type StageRenderPorts } from '@spatial-elements/core/stage/StageRenderPipeline';
import { LiquidGlassPanel, STAGE_TONE_MAPPING_EXPOSURE } from '@spatial-elements/core/stage/LiquidGlassPanel';
import { DEFAULT_INTERACTION_THEME } from '@spatial-elements/core/stage/stageConstants';
import type { StagePanelRuntime } from '@spatial-elements/core/stage/StagePanelRuntime';
import type { StageMinimapState } from '@spatial-elements/core/stage/minimap/MinimapState';
import { unpackHalfFloatRgbaRows } from './readback';
import type { BackgroundCheckpoint } from './checkpoints';

const difference = (a: ArrayLike<number>, b: ArrayLike<number>) => {
	if (a.length !== b.length) throw new Error('Mismatched pixel dimensions');
	let max = 0; for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i])); return max;
};

/** Experimental fixture only. No production output, target or readiness path uses this owner. */
export async function runBackgroundLayerProof(hosts: [HTMLElement, HTMLElement], checkpoint?: (value: Omit<BackgroundCheckpoint, 'id'>) => Promise<void>) {
	const renderer = new THREE.WebGPURenderer({ antialias: true });
	const canvases = hosts.map(host => { const canvas = document.createElement('canvas'); host.prepend(canvas); return canvas; });
	const outputs = canvases.map(canvas => new THREE.CanvasTarget(canvas));
	const snapshot = document.createElement('canvas'), context = snapshot.getContext('2d', { willReadFrequently: true })!;
	const camera = new THREE.PerspectiveCamera(45, 4 / 3, 1, 1000); camera.position.z = 200;
	const minimapCamera = camera.clone();
	const panelScene = new THREE.Scene();
	let outgoingBackground = false;
	const runtimes: StagePanelRuntime[] = [], minimaps = new Map<number, StageMinimapState>();
	const panelOptions = [
		{ width: 72, height: 55, radius: 12, backdropBlur: 4, position: { x: -22, y: 10 }, tint: 0x94bad5, tintOpacity: 0.2 },
		{ width: 54, height: 48, radius: 8, backdropBlur: 0, position: { x: 12, y: -4 }, tint: 0xf2d4b4, tintOpacity: 0.35 }
	];
	const ports = { renderer, backgroundCanvasTarget: outputs[0], panelScene, camera, panelCamera: camera,
		interactionTheme: () => DEFAULT_INTERACTION_THEME, fallbackPanelOptions: () => panelOptions,
		panelRuntimes: () => runtimes, minimaps: () => minimaps,
		frame: () => ({ stageViewportVisible: true, modelHover: false, outgoingBackground }), spatialCapture: () => undefined,
		catalogLayer: () => undefined
	} as unknown as StageRenderPorts;
	const pipeline = new StageRenderPipeline(ports);
	const layer = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true, stencilBuffer: false });
	layer.texture.colorSpace = THREE.LinearSRGBColorSpace;
	layer.texture.generateMipmaps = false;
	const finalOutput = new THREE.RenderPipeline(renderer, texture(layer.texture, screenUV));
	const sourceMaterial = new THREE.NodeMaterial();
	sourceMaterial.fragmentNode = vec4(uv().x.mul(3.5).add(0.02), uv().y.mul(1.6).add(0.03), uv().x.mul(uv().y).add(0.13), 1);
	sourceMaterial.depthTest = sourceMaterial.depthWrite = sourceMaterial.toneMapped = false;
	const source = new THREE.QuadMesh(sourceMaterial);
	const seedGeometry = new THREE.PlaneGeometry(100, 100), seedMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
	const seed = new THREE.Mesh(seedGeometry, seedMaterial); seed.position.z = 190;
	const seedScene = new THREE.Scene(); seedScene.add(seed);
	const witnessGeometry = new THREE.CircleGeometry(4, 16);
	const witnessMaterials = [0xe03040, 0x20ceaa].map(color => new THREE.MeshBasicMaterial({ color, depthTest: true, depthWrite: true }));
	const glass: LiquidGlassPanel[] = [];
	const readback = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
	let framebuffer = new THREE.FramebufferTexture(1, 1); framebuffer.type = THREE.HalfFloatType;
	const rows: { mode: string; alpha: number; eligible: boolean; width: number; height: number; dpr: number;
		maxLinearError: number; maxCanvasError: number; minAlpha: number; maxAlpha: number; hdrMax: number;
		referenceMinAlpha: number; referenceMaxAlpha: number; readbackLayout: ReturnType<typeof unpackHalfFloatRgbaRows>['layout'];
		referenceSubmits: number; candidateSubmits: number; panelDifference: number; flagsRestored: boolean }[] = [];
	const readbackControls: { layout: ReturnType<typeof unpackHalfFloatRgbaRows>['layout']; expected: number[]; maxError: number }[] = [];
	const errors: string[] = [], checks: Promise<void>[] = [];
	let device: GPUDevice | undefined, submits = 0, restoreSubmit: (() => void) | undefined;
	let width = 160, height = 120, dpr = 1, mode = 'first';
	const onGpuError = (event: GPUUncapturedErrorEvent) => errors.push(event.error.message);
	const validate = <T>(label: string, action: () => T): T => {
		device!.pushErrorScope('validation');
		try { return action(); }
		finally { checks.push(device!.popErrorScope().then(error => { if (error) errors.push(`${label}: ${error.message}`); })); }
	};
	const state = () => ({ canvas: renderer.getCanvasTarget(), target: renderer.getRenderTarget(), output: renderer.getOutputRenderTarget(),
		viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()), test: renderer.getScissorTest(),
		color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), depth: renderer.getClearDepth(), stencil: renderer.getClearStencil(),
		auto: renderer.autoClear, colorClear: renderer.autoClearColor, depthClear: renderer.autoClearDepth, stencilClear: renderer.autoClearStencil,
		tone: renderer.toneMapping, exposure: renderer.toneMappingExposure, space: renderer.outputColorSpace, xr: renderer.xr.enabled });
	const restore = (s: ReturnType<typeof state>) => {
		renderer.setCanvasTarget(s.canvas); renderer.setRenderTarget(s.target); renderer.setOutputRenderTarget(s.output);
		renderer.setViewport(s.viewport); renderer.setScissor(s.scissor); renderer.setScissorTest(s.test);
		renderer.setClearColor(s.color, s.alpha); renderer.setClearDepth(s.depth); renderer.setClearStencil(s.stencil);
		renderer.autoClear = s.auto; renderer.autoClearColor = s.colorClear; renderer.autoClearDepth = s.depthClear; renderer.autoClearStencil = s.stencilClear;
		renderer.toneMapping = s.tone; renderer.toneMappingExposure = s.exposure; renderer.outputColorSpace = s.space; renderer.xr.enabled = s.xr;
	};
	const sameState = (a: ReturnType<typeof state>, b: ReturnType<typeof state>) => Object.keys(a).every(key => {
		const k = key as keyof typeof a, left = a[k], right = b[k];
		return left instanceof THREE.Vector4 ? left.equals(right as THREE.Vector4) : left instanceof THREE.Color ? left.equals(right as THREE.Color) : left === right;
	});
	const eligible = () => ['first', 'repeat', 'resize-dpr'].includes(mode);
	const draw = (candidate: boolean, fail = false, output = outputs[candidate ? 1 : 0], publish = true, maskOutput = false) => {
		const before = state();
		try {
			ports.backgroundCanvasTarget = output;
			renderer.setCanvasTarget(ports.backgroundCanvasTarget); renderer.setRenderTarget(null);
			if (!candidate || !eligible()) {
				pipeline.renderStageDisplay(); pipeline.renderBackgroundPanels();
				return;
			}
			// Separate from sceneCapture and its blur textures: glass must never sample the attachment being written.
			renderer.setRenderTarget(layer); renderer.setScissorTest(false); renderer.setClearColor(0xffffff, 1);
			renderer.autoClear = renderer.autoClearColor = renderer.autoClearDepth = renderer.autoClearStencil = true;
			pipeline.stageDisplayQuad!.render(renderer);
			renderer.autoClear = false;
			pipeline.renderBackgroundPanels();
			if (fail) throw new Error('deliberate-after-panels');
			if (!publish) return;
			// The public RenderPipeline applies the same RenderOutputNode as Three's Canvas path.
			// NoToneMapping/workingColorSpace is scoped internally; no nested output framebuffer is requested.
			renderer.setRenderTarget(null);
			if (maskOutput) { renderer.setScissor(0, 0, 0, 0); renderer.setScissorTest(true); }
			finalOutput.render();
		} finally { restore(before); }
	};
	const linearPixels = async (candidate: boolean, inputTarget = candidate && eligible() ? layer : null, output = outputs[candidate ? 1 : 0]) => {
		const before = state();
		try {
			renderer.setCanvasTarget(output);
			renderer.setRenderTarget(inputTarget);
			// Public API copies the current linear framebuffer, including Three's Canvas intermediate.
			// Copy to an owned readback attachment without another shader, filtering or color transform.
			renderer.copyFramebufferToTexture(framebuffer);
			renderer.initRenderTarget(readback); renderer.copyTextureToTexture(framebuffer, readback.texture);
			const raw = await renderer.readRenderTargetPixelsAsync(readback, 0, 0, readback.width, readback.height);
			if (!(raw instanceof Uint16Array)) throw new Error(`Expected HalfFloat readback, got ${raw.constructor.name}`);
			const { pixels, layout } = unpackHalfFloatRgbaRows(raw, readback.width, readback.height);
			return { pixels: Array.from(pixels, value => THREE.DataUtils.fromHalfFloat(value)), layout };
		} finally { restore(before); }
	};
	const checkReadbackControl = async () => {
		const before = state(), expected = [0.25, 0.5, 2, 1];
		try {
			renderer.setRenderTarget(layer); renderer.setScissorTest(false);
			renderer.setClearColor(new THREE.Color().setRGB(expected[0], expected[1], expected[2]), expected[3]);
			validate('readback-control/clear', () => renderer.clear());
			const capture = await linearPixels(true, layer);
			let maxError = 0;
			for (let index = 0; index < capture.pixels.length; index++) maxError = Math.max(maxError, Math.abs(capture.pixels[index] - expected[index % 4]));
			readbackControls.push({ layout: capture.layout, expected, maxError });
		} finally { restore(before); }
	};
	const canvasPixels = (index: number, canvas = canvases[index]) => {
		snapshot.width = canvas.width; snapshot.height = canvas.height;
		context.drawImage(canvas, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data;
	};
	const resize = () => {
		for (let index = 0; index < outputs.length; index++) {
			renderer.setCanvasTarget(outputs[index]); renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
			canvases[index].style.width = `${width}px`; canvases[index].style.height = `${height}px`;
			hosts[index].style.width = `${width}px`; hosts[index].style.height = `${height}px`;
			outputs[index].setScissorTest(false);
		}
		const w = Math.floor(width * dpr), h = Math.floor(height * dpr);
		layer.setSize(w, h); readback.setSize(w, h);
		framebuffer.dispose(); framebuffer = new THREE.FramebufferTexture(w, h); framebuffer.type = THREE.HalfFloatType;
		const targets = pipeline.activeRenderTargets!; targets.sceneCapture.setSize(w, h);
		for (const capture of targets.panelBlurCaptures.values()) {
			if (capture.effect) { capture.effect.resolutionScale = capture.resolutionScale / dpr; capture.effect.setSize(w, h); }
			capture.target.setSize(
				capture.effect ? Math.max(1, Math.round(w * capture.resolutionScale / dpr)) : w,
				capture.effect ? Math.max(1, Math.round(h * capture.resolutionScale / dpr)) : h
			);
		}
		camera.aspect = width / height; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
		minimapCamera.copy(camera); minimapCamera.setViewOffset(width * 1.2, height * 1.2, width * 0.16, height * 0.08, width, height);
		minimapCamera.updateProjectionMatrix(); minimapCamera.updateMatrixWorld(true);
		renderer.setRenderTarget(targets.sceneCapture); renderer.setClearColor(0, 1); renderer.clear(); source.render(renderer);
		pipeline.renderPanelBlurCaptures(targets, true);
		renderer.setRenderTarget(null);
	};
	const prepareOutput = (index: number) => {
		renderer.setCanvasTarget(outputs[index]); renderer.setRenderTarget(null); renderer.setScissorTest(false);
		renderer.setViewport(0, 0, width, height); renderer.setClearColor(0xff00ff, 1); renderer.setClearDepth(1);
		renderer.autoClear = false; renderer.clear(); renderer.render(seedScene, camera);
		if (index === 1) {
			renderer.setRenderTarget(layer); renderer.clear(); renderer.render(seedScene, camera); renderer.setRenderTarget(null);
		}
		renderer.setScissor(3, 4, width - 12, height - 10); renderer.setScissorTest(mode === 'scissor');
		if (mode === 'partial-viewport') renderer.setViewport(5, 6, width - 16, height - 18);
		renderer.setClearDepth(mode === 'clear-depth' ? 0.8 : 1);
		renderer.autoClearColor = false; renderer.autoClearDepth = false; renderer.autoClearStencil = true;
	};
	const runLifecycleProof = async () => {
		const before = state(), beforePort = ports.backgroundCanvasTarget;
		// Diagnostic only: .has() neither allocates nor returns/mutates a private target.
		// Never call _getFrameBufferTarget(), whose lookup may allocate the very buffer being tested.
		// Renderer.js:463 constructs a Map (not DataMap's internal WeakMap).
		const implicitTargets = (renderer as unknown as { _frameBufferTargets?: Map<object, unknown> })._frameBufferTargets;
		if (!(implicitTargets instanceof Map) || typeof implicitTargets.has !== 'function')
			throw new Error(`Three r186 implicit-target presence diagnostic unavailable: expected Map.has, received ${Object.prototype.toString.call(implicitTargets)}`);
		const hasImplicit = (output: THREE.CanvasTarget): boolean => Map.prototype.has.call(implicitTargets, output);
		const container = document.createElement('div'); container.style.display = 'flex';
		container.dataset.backgroundLifecycleProof = ''; document.body.appendChild(container);
		const freshCanvases = [document.createElement('canvas'), document.createElement('canvas')];
		freshCanvases.forEach((canvas, index) => {
			canvas.dataset.backgroundLifecycleCanvas = index ? 'candidate' : 'reference';
			canvas.style.display = 'block'; container.appendChild(canvas);
		});
		const freshOutputs = freshCanvases.map(canvas => new THREE.CanvasTarget(canvas));
		const initialImplicit = freshOutputs.map(hasImplicit);
		const presence: { phase: string; width: number; height: number; dpr: number; reference: boolean; candidate: boolean }[] = [];
		const observe = (phase: string) => presence.push({ phase, width, height, dpr,
			reference: hasImplicit(freshOutputs[0]), candidate: hasImplicit(freshOutputs[1]) });
		const clearRows: { phase: string; width: number; height: number; dpr: number; referenceSubmits: number; candidateSubmits: number;
			maxLinearError: number; maxCanvasError: number; maxLinearZeroError: number; maxCanvasZeroError: number; flagsRestored: boolean }[] = [];
		const heldRows: { width: number; height: number; dpr: number; sourceImmediateCanvasError: number; skippedReferenceSubmits: number; skippedCandidateSubmits: number;
			warmSubmits: number; warmStateRestored: boolean; preparedLinearDifference: number;
			maskedWarmSubmits: number; maskedWarmStateRestored: boolean;
			publishedImmediateCanvasError: number; publishedLinearError: number; immediateIncomingCanvasDifference: number }[] = [];
		const paint = async () => { await device!.queue.onSubmittedWorkDone(); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
		const presented = async (phase: string) => {
			await paint();
			await checkpoint?.({ phase, width, height, dpr });
		};
		const zeroError = (values: ArrayLike<number>) => { let max = 0; for (let i = 0; i < values.length; i++) max = Math.max(max, Math.abs(values[i])); return max; };
		const clearContentOnly = (candidate: boolean, held = false) => {
			const previous = state(), previousHeld = outgoingBackground;
			try {
				ports.backgroundCanvasTarget = freshOutputs[candidate ? 1 : 0];
				renderer.setCanvasTarget(ports.backgroundCanvasTarget); renderer.setRenderTarget(null);
				renderer.setScissorTest(false); renderer.autoClear = false; outgoingBackground = held;
				if (!candidate) { pipeline.renderFrame(true, false); return; }
				if (held) return;
				renderer.setRenderTarget(layer); renderer.setClearColor(0, 0); renderer.clear();
				renderer.setRenderTarget(null); finalOutput.render();
			} finally { outgoingBackground = previousHeld; restore(previous); }
		};
		const compareClear = async (phase: string) => {
			const results = [];
			for (const candidate of [false, true]) {
				const previous = state(), start = submits;
				validate(`lifecycle/${phase}/${candidate}`, () => clearContentOnly(candidate));
				const count = submits - start, restored = sameState(previous, state());
				const pixels = canvasPixels(0, freshCanvases[candidate ? 1 : 0]);
				const linear = await linearPixels(candidate, candidate ? layer : null, freshOutputs[candidate ? 1 : 0]);
				results.push({ count, restored, pixels, linear });
			}
			const [reference, candidate] = results;
			clearRows.push({ phase, width, height, dpr, referenceSubmits: reference.count, candidateSubmits: candidate.count,
				maxLinearError: difference(reference.linear.pixels, candidate.linear.pixels), maxCanvasError: difference(reference.pixels, candidate.pixels),
				maxLinearZeroError: Math.max(zeroError(reference.linear.pixels), zeroError(candidate.linear.pixels)),
				maxCanvasZeroError: Math.max(zeroError(reference.pixels), zeroError(candidate.pixels)), flagsRestored: reference.restored && candidate.restored });
			observe(phase);
		};
		try {
			for (const next of ['first', 'resize-dpr']) {
				mode = next; width = next === 'first' ? 160 : 200; height = next === 'first' ? 120 : 144; dpr = next === 'first' ? 1 : 1.5;
				validate('lifecycle/source-and-target-resize', resize);
				for (let index = 0; index < freshOutputs.length; index++) {
					renderer.setCanvasTarget(freshOutputs[index]); renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
					freshCanvases[index].style.width = `${width}px`; freshCanvases[index].style.height = `${height}px`;
					renderer.setScissorTest(false); renderer.setClearDepth(1);
				}
				observe('before-first-output');
				// The first candidate output is the transparent content-only clear, not a poisoned Canvas seed.
				await compareClear('initial-transparent-clear');
				await presented('initial-transparent-clear');
				glass.forEach(panel => panel.setVisibilityAlpha(1));
				for (const candidate of [false, true]) validate('lifecycle/publish-source', () => draw(candidate, false, freshOutputs[candidate ? 1 : 0]));
				// Immediate Canvas-buffer data is separate from compositor screenshots after presentation.
				const sourcePixels = freshCanvases.map(canvas => canvasPixels(0, canvas));
				const sourceLinear = await linearPixels(true, layer, freshOutputs[1]);
				observe('published-source-and-readback');
				await presented('published-source');
				// Positive no-op control: another fence/paint opportunity with no GPU work.
				await presented('held-no-work');
				const skipped: number[] = [];
				for (const candidate of [false, true]) { const start = submits; validate('lifecycle/held-content-only', () => clearContentOnly(candidate, true)); skipped.push(submits - start); }
				await presented('held-content-only');
				// Simulate incoming content preparation using the real separate scene/blur sources.
				const stateBeforeSource = state();
				try {
					validate('lifecycle/incoming-source', () => {
						renderer.setRenderTarget(pipeline.activeRenderTargets!.sceneCapture); renderer.setScissorTest(false);
						renderer.setClearColor(new THREE.Color().setRGB(0.125, 1.5, 0.25), 1); renderer.clear();
						pipeline.renderPanelBlurCaptures(pipeline.activeRenderTargets!, true);
					});
				} finally { restore(stateBeforeSource); }
				const warmState = state(), warmStart = submits;
				validate('lifecycle/offscreen-warm', () => draw(true, false, freshOutputs[1], false));
				const warmSubmits = submits - warmStart, warmStateRestored = sameState(warmState, state());
				const prepared = await linearPixels(true, layer, freshOutputs[1]);
				observe('offscreen-warm-and-readback');
				await presented('offscreen-warm');
				const maskedState = state(), maskedStart = submits;
				validate('lifecycle/masked-output-warm', () => draw(true, false, freshOutputs[1], true, true));
				const maskedWarmSubmits = submits - maskedStart, maskedWarmStateRestored = sameState(maskedState, state());
				observe('masked-output-warm');
				await presented('masked-output-warm');
				for (const candidate of [false, true]) validate('lifecycle/publish-incoming', () => draw(candidate, false, freshOutputs[candidate ? 1 : 0]));
				const incomingPixels = freshCanvases.map(canvas => canvasPixels(0, canvas));
				const incomingReference = await linearPixels(false, null, freshOutputs[0]);
				const incomingCandidate = await linearPixels(true, layer, freshOutputs[1]);
				heldRows.push({ width, height, dpr, sourceImmediateCanvasError: difference(sourcePixels[0], sourcePixels[1]),
					skippedReferenceSubmits: skipped[0], skippedCandidateSubmits: skipped[1], warmSubmits, warmStateRestored,
					preparedLinearDifference: difference(sourceLinear.pixels, prepared.pixels),
					maskedWarmSubmits, maskedWarmStateRestored,
					publishedImmediateCanvasError: difference(incomingPixels[0], incomingPixels[1]),
					publishedLinearError: difference(incomingReference.pixels, incomingCandidate.pixels),
					immediateIncomingCanvasDifference: difference(sourcePixels[1], incomingPixels[1]) });
				observe('published-incoming');
				await presented('published-incoming');
				await compareClear('transparent-clear-after-content');
				await presented('transparent-clear-after-content');
			}
		} finally {
			restore(before); ports.backgroundCanvasTarget = beforePort;
			freshOutputs.forEach(output => output.dispose()); container.remove();
		}
		return { initialImplicit, presence, clearRows, heldRows, disposedImplicit: freshOutputs.map(hasImplicit), checkpointsEnabled: Boolean(checkpoint),
			retentionObservation: 'Playwright compositor screenshots at released checkpoints only; no post-presentation Canvas2D copies',
			implicitDiagnostic: 'Three r186 _frameBufferTargets Map; builtin Map.has only; no lookup allocation, get, set, delete or private target mutation' };
	};
	const dispose = () => {
		restoreSubmit?.(); device?.removeEventListener('uncapturederror', onGpuError);
		glass.forEach(panel => panel.dispose()); pipeline.dispose(); finalOutput.dispose(); sourceMaterial.dispose();
		seedGeometry.dispose(); seedMaterial.dispose(); witnessGeometry.dispose(); witnessMaterials.forEach(material => material.dispose());
		layer.dispose(); readback.dispose(); framebuffer.dispose(); outputs.forEach(output => output.dispose());
		void renderer.dispose(); canvases.forEach(canvas => canvas.remove());
	};
	try {
		await renderer.init();
		const backend = renderer.backend as unknown as { isWebGPUBackend: boolean; device: GPUDevice };
		if (!backend.isWebGPUBackend) throw new Error('Requires real WebGPU');
		device = backend.device; device.addEventListener('uncapturederror', onGpuError);
		// Observation only. The original submission is called immediately with exactly the original commands.
		const queue = device.queue, originalSubmit = queue.submit;
		queue.submit = function (commands) { submits++; return originalSubmit.call(this, commands); };
		restoreSubmit = () => { queue.submit = originalSubmit; };
		renderer.autoClear = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = STAGE_TONE_MAPPING_EXPOSURE;
		camera.coordinateSystem = minimapCamera.coordinateSystem = renderer.coordinateSystem;
		pipeline.createSceneCapture();
		for (const [index, options] of panelOptions.entries()) {
			const panel = new LiquidGlassPanel(pipeline.getPanelBlurTexture(options), options); glass.push(panel);
			panel.group.rotation.y = index ? -0.11 : 0.17;
			const witness = new THREE.Mesh(witnessGeometry, witnessMaterials[index]); witness.position.set(-20, 16, 2); panel.group.add(witness);
			panelScene.add(panel.group);
			runtimes.push({ glass: panel, group: panel.group, options: panel.options, surface: 'glass' } as StagePanelRuntime);
		}
		minimaps.set(1, { panelIndex: 1, viewportVisible: true, screenCamera: minimapCamera } as StageMinimapState);
		for (const next of ['first', 'repeat', 'resize-dpr', 'partial-viewport', 'scissor', 'clear-depth']) {
			mode = next; width = ['first', 'repeat'].includes(mode) ? 160 : 200; height = ['first', 'repeat'].includes(mode) ? 120 : 144; dpr = ['first', 'repeat'].includes(mode) ? 1 : 1.5;
			validate(`${mode}/resize-and-source`, resize);
			if (mode === 'first' || mode === 'resize-dpr') await checkReadbackControl();
			let baseline: Uint8ClampedArray | undefined;
			for (const alpha of [0, 0.25, 1]) {
				glass.forEach(panel => panel.setVisibilityAlpha(alpha));
				const captures = [];
				for (const candidate of [false, true]) {
					const index = candidate ? 1 : 0, label = `${mode}/${alpha}/${candidate ? 'candidate' : 'reference'}`;
					validate(`${label}/seed`, () => prepareOutput(index));
					// Warm the exact path, then repeat with the same poisoned seed. Count only the measured output sequence.
					validate(`${label}/warm`, () => draw(candidate)); await device.queue.onSubmittedWorkDone();
					validate(`${label}/seed-repeat`, () => prepareOutput(index));
					const beforeState = state(), before = submits;
					validate(`${label}/draw`, () => draw(candidate));
					const count = submits - before, restored = sameState(beforeState, state()), pixels = canvasPixels(index);
					const linear = await linearPixels(candidate);
					captures.push({ count, restored, pixels, linear });
				}
				const [reference, candidate] = captures;
				let minAlpha = Infinity, maxAlpha = -Infinity, hdrMax = -Infinity, referenceMinAlpha = Infinity, referenceMaxAlpha = -Infinity;
				for (let i = 0; i < candidate.linear.pixels.length; i += 4) {
					minAlpha = Math.min(minAlpha, candidate.linear.pixels[i + 3]); maxAlpha = Math.max(maxAlpha, candidate.linear.pixels[i + 3]);
					referenceMinAlpha = Math.min(referenceMinAlpha, reference.linear.pixels[i + 3]); referenceMaxAlpha = Math.max(referenceMaxAlpha, reference.linear.pixels[i + 3]);
					hdrMax = Math.max(hdrMax, candidate.linear.pixels[i], candidate.linear.pixels[i + 1], candidate.linear.pixels[i + 2]);
				}
				rows.push({ mode, alpha, eligible: eligible(), width, height, dpr,
					maxLinearError: difference(reference.linear.pixels, candidate.linear.pixels), maxCanvasError: difference(reference.pixels, candidate.pixels),
					referenceMinAlpha, referenceMaxAlpha, readbackLayout: candidate.linear.layout,
					minAlpha, maxAlpha, hdrMax, referenceSubmits: reference.count, candidateSubmits: candidate.count,
					flagsRestored: reference.restored && candidate.restored, panelDifference: baseline ? difference(baseline, candidate.pixels) : 0 });
				baseline ??= candidate.pixels;
			}
		}
		const lifecycle = await runLifecycleProof();
		mode = 'repeat'; width = 200; height = 144; dpr = 1.5; validate('final/resize', resize);
		glass.forEach(panel => panel.setVisibilityAlpha(1));
		prepareOutput(1); const failedState = state(); let injectedFailure = false;
		try { validate('deliberate-failure', () => draw(true, true)); } catch (error) { injectedFailure = String(error).includes('deliberate-after-panels'); }
		const failureStateRestored = injectedFailure && sameState(failedState, state());
		// Keep the final real canvases alive for the separate actual Panel.svelte/Frosted DOM comparison.
		for (const candidate of [false, true]) { prepareOutput(candidate ? 1 : 0); validate('recovered-final', () => draw(candidate)); }
		const recoveryCanvasError = difference(canvasPixels(0), canvasPixels(1));
		await device.queue.onSubmittedWorkDone(); await Promise.all(checks);
		const pixels = layer.width * layer.height;
		const result = { protocol: 'background-layer-output-v4', rows, readbackControls, lifecycle, errors, failureStateRestored, recoveryCanvasError,
			linearReadback: 'public copyFramebufferToTexture -> copyTextureToTexture -> RGBA/HalfFloat readRenderTargetPixelsAsync',
			memory: { width: layer.width, height: layer.height, samples: layer.samples, resolvedColorBytes: pixels * 8,
				multisampledColorBytes: pixels * 8 * 4, multisampledDepth32Bytes: pixels * 4 * 4,
				excludes: 'Optional depth resolve, original Three Canvas intermediates, source/blur/readback targets and driver overhead. This proof intentionally retains both paths.' },
			limitations: ['Filled Background and empty transparent clear only; no Foreground/Rear or arbitrary transparent-layer claim.', 'Partial viewport/scissor/nonstandard clear depth use the unchanged Canvas fallback.',
				'Frosted is actual DOM, not a GPU material; tested separately with the real Panel component.', 'Submission counts are not frame-time measurements.'] };
		return { result, dispose };
	} catch (error) { dispose(); throw error; }
}
