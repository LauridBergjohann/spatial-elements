import * as THREE from 'three/webgpu';
import { screenUV, texture, uv, vec4 } from 'three/tsl';
import { StageRenderPipeline, type StageRenderPorts } from '@spatial-elements/core/stage/StageRenderPipeline';
import { LiquidGlassPanel, STAGE_TONE_MAPPING_EXPOSURE } from '@spatial-elements/core/stage/LiquidGlassPanel';
import { DEFAULT_INTERACTION_THEME } from '@spatial-elements/core/stage/stageConstants';
import type { StagePanelRuntime } from '@spatial-elements/core/stage/StagePanelRuntime';
import type { StageMinimapState } from '@spatial-elements/core/stage/minimap/MinimapState';

const difference = (a: ArrayLike<number>, b: ArrayLike<number>) => {
	if (a.length !== b.length) throw new Error('Mismatched pixel dimensions');
	let max = 0; for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i])); return max;
};

/** Experimental fixture only. No production output, target or readiness path uses this owner. */
export async function runBackgroundLayerProof(hosts: [HTMLElement, HTMLElement]) {
	const renderer = new THREE.WebGPURenderer({ antialias: true });
	const canvases = hosts.map(host => { const canvas = document.createElement('canvas'); host.prepend(canvas); return canvas; });
	const outputs = canvases.map(canvas => new THREE.CanvasTarget(canvas));
	const snapshot = document.createElement('canvas'), context = snapshot.getContext('2d', { willReadFrequently: true })!;
	const camera = new THREE.PerspectiveCamera(45, 4 / 3, 1, 1000); camera.position.z = 200;
	const minimapCamera = camera.clone();
	const panelScene = new THREE.Scene();
	const runtimes: StagePanelRuntime[] = [], minimaps = new Map<number, StageMinimapState>();
	const panelOptions = [
		{ width: 72, height: 55, radius: 12, backdropBlur: 4, position: { x: -22, y: 10 }, tint: 0x94bad5, tintOpacity: 0.2 },
		{ width: 54, height: 48, radius: 8, backdropBlur: 0, position: { x: 12, y: -4 }, tint: 0xf2d4b4, tintOpacity: 0.35 }
	];
	const ports = { renderer, backgroundCanvasTarget: outputs[0], panelScene, camera, panelCamera: camera,
		interactionTheme: () => DEFAULT_INTERACTION_THEME, fallbackPanelOptions: () => panelOptions,
		panelRuntimes: () => runtimes, minimaps: () => minimaps,
		frame: () => ({ stageViewportVisible: true, modelHover: false }), spatialCapture: () => undefined
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
		referenceSubmits: number; candidateSubmits: number; panelDifference: number; flagsRestored: boolean }[] = [];
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
	const draw = (candidate: boolean, fail = false) => {
		const before = state();
		try {
			ports.backgroundCanvasTarget = outputs[candidate ? 1 : 0];
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
			// The public RenderPipeline applies the same RenderOutputNode as Three's Canvas path.
			// NoToneMapping/workingColorSpace is scoped internally; no nested output framebuffer is requested.
			renderer.setRenderTarget(null);
			finalOutput.render();
		} finally { restore(before); }
	};
	const linearPixels = async (candidate: boolean) => {
		const before = state();
		try {
			renderer.setCanvasTarget(outputs[candidate ? 1 : 0]);
			renderer.setRenderTarget(candidate && eligible() ? layer : null);
			// Public API copies the current linear framebuffer, including Three's Canvas intermediate.
			// Copy to an owned readback attachment without another shader, filtering or color transform.
			renderer.copyFramebufferToTexture(framebuffer);
			renderer.initRenderTarget(readback); renderer.copyTextureToTexture(framebuffer, readback.texture);
			const raw = await renderer.readRenderTargetPixelsAsync(readback, 0, 0, readback.width, readback.height);
			if (!(raw instanceof Uint16Array)) throw new Error(`Expected HalfFloat readback, got ${raw.constructor.name}`);
			return Array.from(raw, value => THREE.DataUtils.fromHalfFloat(value));
		} finally { restore(before); }
	};
	const canvasPixels = (index: number) => {
		const canvas = canvases[index]; snapshot.width = canvas.width; snapshot.height = canvas.height;
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
				let minAlpha = Infinity, maxAlpha = -Infinity, hdrMax = -Infinity;
				for (let i = 0; i < candidate.linear.length; i += 4) {
					minAlpha = Math.min(minAlpha, candidate.linear[i + 3]); maxAlpha = Math.max(maxAlpha, candidate.linear[i + 3]);
					hdrMax = Math.max(hdrMax, candidate.linear[i], candidate.linear[i + 1], candidate.linear[i + 2]);
				}
				rows.push({ mode, alpha, eligible: eligible(), width, height, dpr,
					maxLinearError: difference(reference.linear, candidate.linear), maxCanvasError: difference(reference.pixels, candidate.pixels),
					minAlpha, maxAlpha, hdrMax, referenceSubmits: reference.count, candidateSubmits: candidate.count,
					flagsRestored: reference.restored && candidate.restored, panelDifference: baseline ? difference(baseline, candidate.pixels) : 0 });
				baseline ??= candidate.pixels;
			}
		}
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
		const result = { protocol: 'background-layer-output-v1', rows, errors, failureStateRestored, recoveryCanvasError,
			linearReadback: 'public copyFramebufferToTexture -> copyTextureToTexture -> RGBA/HalfFloat readRenderTargetPixelsAsync',
			memory: { width: layer.width, height: layer.height, samples: layer.samples, resolvedColorBytes: pixels * 8,
				multisampledColorBytes: pixels * 8 * 4, multisampledDepth32Bytes: pixels * 4 * 4,
				excludes: 'Optional depth resolve, original Three Canvas intermediates, source/blur/readback targets and driver overhead. This proof intentionally retains both paths.' },
			limitations: ['Opaque Background only; no Foreground/Rear or transparent-layer claim.', 'Partial viewport/scissor/nonstandard clear depth use the unchanged Canvas fallback.',
				'Frosted is actual DOM, not a GPU material; tested separately with the real Panel component.', 'Submission counts are not frame-time measurements.'] };
		return { result, dispose };
	} catch (error) { dispose(); throw error; }
}
