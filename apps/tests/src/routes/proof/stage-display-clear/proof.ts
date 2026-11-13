import * as THREE from 'three/webgpu';
import { uv, vec4 } from 'three/tsl';
import {
	StageRenderPipeline,
	type StageRenderPorts
} from '@spatial-elements/core/stage/StageRenderPipeline';
import { DEFAULT_INTERACTION_THEME } from '@spatial-elements/core/stage/stageConstants';

/** Actual StageDisplay/Canvas output comparison; GPU readback is not a timing benchmark. */
export async function runStageDisplayClearProof(container: HTMLElement) {
	const renderer = new THREE.WebGPURenderer({ antialias: true });
	const canvases = [document.createElement('canvas'), document.createElement('canvas')];
	const outputs = canvases.map((canvas) => new THREE.CanvasTarget(canvas));
	const snapshot = document.createElement('canvas');
	const context = snapshot.getContext('2d', { willReadFrequently: true })!;
	const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 20);
	camera.position.z = 4;
	const panelCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	panelCamera.position.z = 5;
	const geometry = new THREE.PlaneGeometry(1.2, 1.2);
	const panelMaterial = new THREE.MeshBasicMaterial({
		color: 0x25d37e,
		transparent: true,
		opacity: 0.7
	});
	const panel = new THREE.Mesh(geometry, panelMaterial);
	const seedMaterial = new THREE.MeshBasicMaterial({ color: 0xff0099 });
	const seed = new THREE.Mesh(geometry, seedMaterial);
	seed.position.z = 4;
	const panelScene = new THREE.Scene();
	panelScene.add(panel);
	const seedScene = new THREE.Scene();
	seedScene.add(seed);
	const modelGeometry = new THREE.BoxGeometry(0.6, 0.9, 0.5);
	const model = new THREE.Mesh(modelGeometry, seedMaterial);
	model.rotation.y = 0.4;
	model.updateMatrixWorld(true);
	let hover = false;
	const ports = {
		renderer,
		backgroundCanvasTarget: outputs[0],
		camera,
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		fallbackPanelOptions: () => [],
		panelRuntimes: () => [],
		isInteractionMesh: () => true,
		frame: () => ({ stageViewportVisible: true, modelHover: hover }),
		spatialCapture: () => undefined
	} as unknown as StageRenderPorts;
	const pipeline = new StageRenderPipeline(ports);
	const sourceMaterial = new THREE.NodeMaterial();
	sourceMaterial.fragmentNode = vec4(
		uv().x.mul(3.5).add(0.01),
		uv().y.mul(1.7),
		uv().x.mul(uv().y).add(0.12),
		1
	);
	sourceMaterial.depthTest = sourceMaterial.depthWrite = sourceMaterial.toneMapped = false;
	const source = new THREE.QuadMesh(sourceMaterial);
	const rows: {
		mode: string;
		halo: boolean;
		panel: boolean;
		maxLinearError: number;
		maxCanvasError: number;
		referenceSubmits: number;
		candidateSubmits: number;
		flagsRestored: boolean;
		pixelRange: number;
		panelDifference: number;
	}[] = [];
	let submits = 0;
	let restoreSubmit: (() => void) | undefined;
	let proofDevice: GPUDevice | undefined;
	let validationScope = false;
	const gpuErrors: string[] = [];
	const validationReports: Promise<void>[] = [];
	const onGpuError = (event: GPUUncapturedErrorEvent) => {
		gpuErrors.push(event.error.message);
	};
	const validate = <T>(phase: string, action: () => T): T => {
		proofDevice!.pushErrorScope('validation');
		try {
			return action();
		} finally {
			validationReports.push(
				proofDevice!.popErrorScope().then((error) => {
					if (error) gpuErrors.push(`[${phase}] ${error.message}`);
				})
			);
		}
	};
	const difference = (a: ArrayLike<number>, b: ArrayLike<number>) => {
		let max = 0;
		for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
		return max;
	};
	try {
		await renderer.init();
		const backend = renderer.backend as unknown as { isWebGPUBackend: boolean; device: GPUDevice };
		if (!backend.isWebGPUBackend) throw new Error('This proof requires the real WebGPU backend');
		proofDevice = backend.device;
		proofDevice.addEventListener('uncapturederror', onGpuError);
		proofDevice.pushErrorScope('validation');
		validationScope = true;
		const queue = backend.device.queue;
		const submit = queue.submit;
		queue.submit = function (commands) {
			submits++;
			return submit.call(this, commands);
		};
		restoreSubmit = () => {
			queue.submit = submit;
		};
		container.append(...canvases);
		renderer.autoClear = false;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.2;
		camera.coordinateSystem = panelCamera.coordinateSystem = renderer.coordinateSystem;
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld(true);
		panelCamera.updateProjectionMatrix();
		panelCamera.updateMatrixWorld(true);
		pipeline.createSceneCapture();
		pipeline.createModelOutline(model);
		for (const mode of [
			'first',
			'repeat',
			'resize-dpr',
			'partial-viewport',
			'scissor',
			'clear-depth'
		]) {
			const width = mode === 'first' || mode === 'repeat' ? 96 : 114;
			const height = mode === 'first' || mode === 'repeat' ? 64 : 80;
			const ratio = mode === 'first' || mode === 'repeat' ? 1 : 1.5;
			for (const output of outputs) {
				// Match StageRenderPipeline.resizeCanvasTarget: the selected target owns
				// Renderer's resize listener, which invalidates its backend descriptor.
				// Resizing an inactive CanvasTarget directly leaves that descriptor stale.
				renderer.setCanvasTarget(output);
				renderer.setPixelRatio(ratio);
				renderer.setSize(width, height, false);
				output.setScissorTest(mode === 'scissor');
				output.setScissor(3, 5, width - 12, height - 14);
				if (mode === 'partial-viewport') output.setViewport(4, 6, width - 10, height - 16);
			}
			pipeline.activeRenderTargets!.sceneCapture.setSize(width, height);
			pipeline.resizeOutline(width, height);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			for (const halo of [false, true]) {
				hover = halo;
				// A nonuniform HDR capture exercises both linear copying and the real output transform.
				renderer.setRenderTarget(pipeline.activeRenderTargets!.sceneCapture);
				renderer.setClearColor(0, 1);
				renderer.clear();
				source.render(renderer);
				pipeline.renderModelOutline(pipeline.activeRenderTargets!.sceneCapture);
				let withoutPanel: Uint8ClampedArray | undefined;
				for (const withPanel of [false, true]) {
					const capture = async (candidate: boolean) => {
						const phase = `${mode}/halo-${halo}/panel-${withPanel}/${candidate ? 'candidate' : 'control'}`;
						const output = outputs[candidate ? 1 : 0];
						ports.backgroundCanvasTarget = output;
						renderer.setRenderTarget(null);
						renderer.setCanvasTarget(output);
						renderer.autoClear = false;
						renderer.autoClearColor = false;
						renderer.autoClearDepth = false;
						renderer.autoClearStencil = true;
						if (!(mode === 'first' && !halo && !withPanel)) {
							renderer.setClearDepth(1);
							renderer.setClearColor(0xff0099, 1);
							validate(`${phase}/poison-clear`, () => renderer.clear());
							// Poison previous depth: a later, farther panel must survive the display clear.
							validate(`${phase}/poison-draw`, () => renderer.render(seedScene, panelCamera));
						}
						renderer.setClearDepth(mode === 'clear-depth' ? 0.8 : 1);
						const before = submits;
						validate(`${phase}/display`, () => {
							if (candidate) pipeline.renderStageDisplay();
							else {
								// Exact previous production path, including its Canvas output-color transform.
								renderer.setRenderTarget(null);
								renderer.setCanvasTarget(output);
								renderer.setClearColor(0xffffff, 1);
								renderer.clear();
								pipeline.stageDisplayQuad!.render(renderer);
							}
						});
						const drawSubmits = submits - before;
						const restored =
							!renderer.autoClear &&
							!renderer.autoClearColor &&
							!renderer.autoClearDepth &&
							renderer.autoClearStencil;
						if (withPanel)
							validate(`${phase}/panel`, () => renderer.render(panelScene, panelCamera));
						// Copy the actual ACES/sRGB canvas before yielding to another browser frame.
						const canvas = canvases[candidate ? 1 : 0];
						snapshot.width = canvas.width;
						snapshot.height = canvas.height;
						context.drawImage(canvas, 0, 0);
						const canvasPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
						// Proof-only access to Three's linear intermediate; production uses public APIs only.
						const linearTarget = (
							renderer as unknown as { _getFrameBufferTarget(): THREE.RenderTarget }
						)._getFrameBufferTarget();
						const raw = await renderer.readRenderTargetPixelsAsync(
							linearTarget,
							0,
							0,
							linearTarget.width,
							linearTarget.height
						);
						if (
							linearTarget.texture.type !== THREE.HalfFloatType ||
							linearTarget.texture.format !== THREE.RGBAFormat ||
							!(raw instanceof Uint16Array)
						)
							throw new Error(
								`Expected RGBA HalfFloat/Uint16Array readback, received ${linearTarget.texture.type}/${linearTarget.texture.format}/${raw.constructor.name}`
							);
						const linear = Array.from(raw, (value) => THREE.DataUtils.fromHalfFloat(value));
						return { linear, canvasPixels, drawSubmits, restored };
					};
					const reference = await capture(false),
						candidate = await capture(true);
					let min = 255,
						max = 0;
					for (let index = 0; index < candidate.canvasPixels.length; index += 4) {
						min = Math.min(min, candidate.canvasPixels[index]);
						max = Math.max(max, candidate.canvasPixels[index]);
					}
					rows.push({
						mode,
						halo,
						panel: withPanel,
						maxLinearError: difference(reference.linear, candidate.linear),
						maxCanvasError: difference(reference.canvasPixels, candidate.canvasPixels),
						referenceSubmits: reference.drawSubmits,
						candidateSubmits: candidate.drawSubmits,
						flagsRestored: candidate.restored,
						pixelRange: max - min,
						panelDifference: withoutPanel ? difference(withoutPanel, candidate.canvasPixels) : 0
					});
					withoutPanel ??= candidate.canvasPixels;
				}
			}
		}
		await proofDevice.queue.onSubmittedWorkDone();
		await Promise.all(validationReports);
		const validationError = await proofDevice.popErrorScope();
		validationScope = false;
		if (validationError) gpuErrors.push(validationError.message);
		return { rows, gpuErrors, linearReadback: 'RGBA/HalfFloat/Uint16Array' };
	} finally {
		if (validationScope) await proofDevice?.popErrorScope();
		proofDevice?.removeEventListener('uncapturederror', onGpuError);
		restoreSubmit?.();
		pipeline.dispose();
		sourceMaterial.dispose();
		geometry.dispose();
		modelGeometry.dispose();
		panelMaterial.dispose();
		seedMaterial.dispose();
		outputs.forEach((output) => output.dispose());
		renderer.dispose();
		canvases.forEach((canvas) => canvas.remove());
	}
}
