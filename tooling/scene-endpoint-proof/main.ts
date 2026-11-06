import * as THREE from 'three/webgpu';
import { acesFilmicToneMapping, float, mix, sRGBTransferOETF, texture, uniform, vec4 } from 'three/tsl';
import { StageRenderPipeline, type StageRenderPorts } from '@spatial-elements/core/stage/StageRenderPipeline';
import { SpatialElementRefinement } from '@spatial-elements/core/stage/SpatialElementRefinement';
import { DEFAULT_INTERACTION_THEME } from '@spatial-elements/core/stage/stageConstants';
import { STAGE_TONE_MAPPING_EXPOSURE } from '@spatial-elements/core/stage/LiquidGlassPanel';
import { compareLinearPixels, interiorPairs } from './pixelComparison';

const width = 192, height = 160; // RGBA16F row length is a multiple of WebGPU's 256-byte alignment.
const singlePremultiplicationControl = new URLSearchParams(location.search).get('coverPremultiplication') === 'single';
const runtimeCache = new URLSearchParams(location.search).get('cache') === 'runtime';
export const cases = ['opaque', 'transparent', 'rough-transmission', 'nested-transmission'] as const;
type MaterialCase = typeof cases[number];
const output = document.querySelector<HTMLPreElement>('#result')!;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;

function patternTexture() {
	const c = document.createElement('canvas'); c.width = c.height = 64;
	const ctx = c.getContext('2d')!;
	for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
		ctx.fillStyle = ['#eb5819', '#1745ba', '#c5e2aa', '#54206e'][(x + 3 * y) % 4];
		ctx.fillRect(x * 8, y * 8, 8, 8);
	}
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function environment(high: boolean) {
	const colors = high ? ['#7189c2', '#f4c377', '#c3d1ea', '#473d68', '#c07654', '#327a86'] : ['#d9af74', '#597cab', '#f1e6c5', '#324864', '#76aaab', '#ad6363'];
	const faces = colors.map(color => {
		const c = document.createElement('canvas'); c.width = c.height = 16;
		const ctx = c.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 16, 16); return c;
	});
	const t = new THREE.CubeTexture(faces); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

function model(kind: MaterialCase, high: boolean, pattern: THREE.Texture) {
	const group = new THREE.Group();
	const segments = high ? 48 : 18;
	const material = kind === 'opaque'
		? new THREE.MeshStandardMaterial({ color: high ? '#268ba7' : '#3b75a0', roughness: 0.38, metalness: 0.2 })
		: kind === 'transparent'
			? new THREE.MeshPhysicalMaterial({ color: high ? '#779edb' : '#da906d', transparent: true, opacity: high ? 0.47 : 0.38, depthWrite: false, roughness: 0.27, side: THREE.DoubleSide })
			: new THREE.MeshPhysicalMaterial({ color: '#edf3ff', transmission: 0.94, roughness: high ? 0.38 : 0.31, thickness: 1.1, ior: 1.43, attenuationColor: '#70a8b9', attenuationDistance: 1.2, metalness: 0 });
	const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.88, segments, segments / 2), material);
	sphere.position.set(high ? 0.065 : -0.055, 0.05, 0.1); group.add(sphere);
	if (kind === 'transparent' || kind === 'nested-transmission') {
		const innerMaterial = kind === 'transparent'
			? new THREE.MeshStandardMaterial({ color: '#f2cb48', transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide })
			: new THREE.MeshPhysicalMaterial({ transmission: 0.91, roughness: 0.53, thickness: 0.65, ior: 1.62, attenuationColor: '#e6aa71', attenuationDistance: 0.8, side: THREE.DoubleSide });
		const inner = new THREE.Mesh(new THREE.SphereGeometry(0.51, segments, segments / 2), innerMaterial);
		inner.position.set(-0.19, -0.12, 0.15); group.add(inner);
		const overlap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.45, 0.35), material.clone());
		overlap.position.set(0.64, 0.12, -0.13); overlap.rotation.z = 0.22; group.add(overlap);
	}
	// The model pass has genuine opaque geometry behind the transmissive objects as well as the staged background.
	const back = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshBasicMaterial({ map: pattern, color: new THREE.Color(1.3, 1.1, 0.9) }));
	back.position.set(-0.5, 0.1, -0.95); group.add(back);
	return group;
}

function colorTarget() {
	const target = new THREE.RenderTarget(width, height, { type: THREE.HalfFloatType, samples: 0, depthBuffer: false, stencilBuffer: false });
	target.texture.colorSpace = THREE.NoColorSpace; target.texture.generateMipmaps = false;
	return target;
}

function quad(fragmentNode: THREE.NodeMaterial['fragmentNode'], overlay = false) {
	const material = new THREE.NodeMaterial(); material.fragmentNode = fragmentNode;
	material.depthTest = material.depthWrite = false; material.blending = overlay ? THREE.NormalBlending : THREE.NoBlending; material.toneMapped = false;
	material.transparent = material.premultipliedAlpha = overlay;
	return new THREE.QuadMesh(material);
}

async function pixels(renderer: THREE.WebGPURenderer, target: THREE.RenderTarget) {
	const raw = await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height);
	if (!(raw instanceof Uint16Array) || raw.length !== width * height * 4) throw new Error('Expected tightly packed RGBA16F readback');
	return Array.from(raw, value => THREE.DataUtils.fromHalfFloat(value));
}

function destroyScene(scene: THREE.Scene) {
	const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
	scene.traverse(node => { if (node instanceof THREE.Mesh) { geometries.add(node.geometry); for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m); } });
	for (const geometry of geometries) geometry.dispose();
	for (const material of materials) material.dispose();
}

async function runCase(renderer: THREE.WebGPURenderer, kind: MaterialCase) {
	const pattern = patternTexture(), lowEnvironment = environment(false), highEnvironment = environment(true);
	const scene = new THREE.Scene(), backgroundScene = new THREE.Scene(), tintScene = new THREE.Scene();
	const low = model(kind, false, pattern), high = model(kind, true, pattern);
	low.visible = true; high.visible = false; scene.add(low, high);
	scene.environment = lowEnvironment; scene.environmentIntensity = 0.7;
	scene.add(new THREE.HemisphereLight(0xe8efff, 0x3e3024, 1.2));
	const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 3, 4); scene.add(key);
	const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 7), new THREE.MeshBasicMaterial({ map: pattern, color: new THREE.Color(1.8, 1.2, 1.4) }));
	back.position.z = -2; backgroundScene.add(back);
	const tint = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: '#7d8ca8', transparent: true, opacity: 0.13, depthTest: false, depthWrite: false }));
	tintScene.add(tint);
	const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 20); camera.position.z = 4.4;
	const tintCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2); tintCamera.position.z = 1;
	let backgroundReveal = 0.37;
	const destination = new THREE.RenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true, stencilBuffer: false });
	destination.texture.colorSpace = THREE.NoColorSpace; destination.texture.generateMipmaps = false;
	const refinement = new SpatialElementRefinement(true);
	const extra = runtimeCache ? [] : [colorTarget(), colorTarget()]; // Runtime mode allocates only the real API's two targets.
	const describeTargets = (targets: THREE.RenderTarget[]) => targets.map(t => ({ type: t.texture.type, halfFloat: t.texture.type === THREE.HalfFloatType, width: t.width, height: t.height, samples: t.samples, depthBuffer: t.depthBuffer, stencilBuffer: t.stencilBuffer }));
	let additionalTargets = describeTargets(extra);
	const pipeline = new StageRenderPipeline({
		renderer, container: document.body, backgroundCanvas: canvas, backgroundCanvasTarget: renderer.getCanvasTarget(),
		scene, backgroundScene, tintScene, camera, tintCamera, pageBackground: '#f0e8dc',
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		frame: () => ({ outgoingBackground: false, catalogDockTarget: false, catalogHandoff: false, catalogMotionComplete: false,
			stageViewportVisible: true, detailMediaActive: true, modelHover: false, modelInteractionActive: false,
			catalog: false, pageModelReady: true, backgroundReveal })
	} as StageRenderPorts);
	if (singlePremultiplicationControl) {
		// ISOLATED COUNTERFACTUAL: the real fragmentNode already premultiplies the cover.
		// Preserve the existing premultiplied blend factors but suppress NodeMaterial's second multiply.
		// Deliberately accesses the proof-owned pipeline's implementation; no production instance is changed.
		const cover = (pipeline as unknown as { backgroundCoverMaterial: THREE.NodeMaterial }).backgroundCoverMaterial;
		cover.setupPremultipliedAlpha = (_builder, outputNode) => outputNode;
	}
	const drawModel = (useHigh: boolean) => {
		const oldLow = low.visible, oldHigh = high.visible, oldEnvironment = scene.environment;
		low.visible = !useHigh; high.visible = useHigh; scene.environment = useHigh ? highEnvironment : lowEnvironment;
		try { pipeline.renderStageContents(); }
		finally { low.visible = oldLow; high.visible = oldHigh; scene.environment = oldEnvironment; }
	};
	let copy: THREE.QuadMesh | undefined, candidate: THREE.QuadMesh | undefined, display: THREE.QuadMesh | undefined;
	try {
		renderer.setRenderTarget(destination);
		renderer.clear();
		// Allocate the EXISTING refinement targets once. This disposable proof has no production controller/clock.
		refinement.render(renderer, drawModel, false, 0.41);
		const [lowTarget, highTarget] = refinement.getRenderTargets();
		if (!lowTarget || !highTarget) throw new Error('Refinement targets missing');
		const sourceTexture = texture(lowTarget.texture);
		const p = uniform(0), q = uniform(0);
		if (!runtimeCache) {
			copy = quad(sourceTexture);
			candidate = quad(mix(mix(texture(extra[0].texture), texture(lowTarget.texture), p), mix(texture(extra[1].texture), texture(highTarget.texture), p), q), true);
		}
		// Same final ACES/exposure/sRGB operations as StageDisplay/CanvasTarget, reported separately.
		display = quad(vec4(sRGBTransferOETF(acesFilmicToneMapping(texture(destination.texture).rgb, float(STAGE_TONE_MAPPING_EXPOSURE))) as THREE.Node<'vec3'>, 1));
		const displayPixels = async () => {
			// Endpoint 0 has already been consumed; reuse it instead of allocating another readback target.
			const scratch = runtimeCache ? lowTarget : extra[0];
			renderer.setRenderTarget(scratch); display!.render(renderer);
			const result = await pixels(renderer, scratch); renderer.setRenderTarget(destination); return result;
		};
		const endpointReports: ReturnType<typeof compareLinearPixels>[] = [];
		let capturesPreservedState = true;
		const captureEndpoints = async () => {
			const saved = { p: backgroundReveal, frames: refinement.frames, q: refinement.presentedProgress, complete: refinement.complete,
				low: low.visible, high: high.visible, environment: scene.environment, target: renderer.getRenderTarget(),
				projection: camera.projectionMatrix.toArray(), world: camera.matrixWorld.toArray() };
			let ticket: ReturnType<SpatialElementRefinement['prepareSceneEndpoints']>;
			try {
				if (runtimeCache) {
					ticket = refinement.prepareSceneEndpoints(renderer, (high, p) => { backgroundReveal = p; drawModel(high); }, { isValid: () => true, dispose: () => {} });
					additionalTargets = describeTargets(refinement.getRenderTargets().slice(2));
				} else {
				// Keep the same High-before-Low ordering as the actual refinement renderer.
				for (const reveal of [0, 1]) for (const useHigh of [true, false]) {
					backgroundReveal = reveal;
					const target = useHigh ? highTarget : lowTarget;
					renderer.setRenderTarget(target); drawModel(useHigh);
					if (reveal === 0) { sourceTexture.value = target.texture; renderer.setRenderTarget(extra[useHigh ? 1 : 0]); copy!.render(renderer); }
				}
				}
			} finally { backgroundReveal = saved.p; renderer.setRenderTarget(saved.target); }
			if (runtimeCache) {
				await (renderer.backend as unknown as { device: GPUDevice }).device.queue.onSubmittedWorkDone();
				if (!ticket?.commit()) throw new Error('Runtime endpoint ticket did not commit');
			}
			capturesPreservedState &&= saved.frames === refinement.frames && saved.q === refinement.presentedProgress && saved.complete === refinement.complete &&
				saved.low === low.visible && saved.high === high.visible && saved.environment === scene.environment && saved.p === backgroundReveal &&
				saved.projection.every((n, i) => n === camera.projectionMatrix.elements[i]) && saved.world.every((n, i) => n === camera.matrixWorld.elements[i]);
		};
		const samples = [];
		const seedDestination = (color: THREE.ColorRepresentation) => {
			renderer.setRenderTarget(destination); renderer.setClearColor(color, 1); renderer.clear();
			renderer.setClearColor(0xffffff, 1); // Production Stage clear state for the separate scene passes.
		};
		for (const seed of ['#ffffff', '#153044']) for (const pair of [...[{ backgroundReveal: 0, refinementProgress: 0 }, { backgroundReveal: 1, refinementProgress: 1 }], ...interiorPairs]) {
			seedDestination(seed);
			const seedBefore = await pixels(renderer, destination);
			await captureEndpoints(); p.value = pair.backgroundReveal; q.value = pair.refinementProgress;
			const seedPreservation = compareLinearPixels(await pixels(renderer, destination), seedBefore);
			// Do not reseed the candidate: an unintended preparation overlay must remain observable.
			if (runtimeCache) refinement.render(renderer, () => { throw new Error('Expected an actual cache hit, not a live candidate render'); }, false, pair.refinementProgress, { backgroundReveal: pair.backgroundReveal });
			else candidate!.render(renderer);
			const proposed = await pixels(renderer, destination);
			if (runtimeCache) refinement.invalidateSceneEndpoints(); // Display scratch/reference now borrow existing Low, with no stale cache lease.
			const proposedDisplay = await displayPixels();
			backgroundReveal = pair.backgroundReveal;
			seedDestination(seed);
			refinement.render(renderer, drawModel, false, pair.refinementProgress);
			const reference = await pixels(renderer, destination);
			// A repeated real render detects unstable scenes; it cannot be mistaken for a cache mismatch.
			seedDestination(seed);
			refinement.render(renderer, drawModel, false, pair.refinementProgress);
			const repeated = await pixels(renderer, destination);
			const referenceDisplay = await displayPixels();
			const comparison = compareLinearPixels(proposed, reference), repeat = compareLinearPixels(repeated, reference);
			const displayComparison = compareLinearPixels(proposedDisplay, referenceDisplay);
			const alphaRange = (buffer: number[]) => {
				let min = Infinity, max = -Infinity;
				for (let i = 3; i < buffer.length; i += 4) { min = Math.min(min, buffer[i]); max = Math.max(max, buffer[i]); }
				return { min, max };
			};
			if (pair.backgroundReveal === 0 || pair.backgroundReveal === 1) endpointReports.push(comparison);
			samples.push({ ...pair, destinationSeed: seed, seedPreservation, comparison, repeatedReference: repeat,
				finalCompositeAlphaRange: { candidate: alphaRange(proposed), reference: alphaRange(reference) },
				displayDifference: { maxEncodedError: displayComparison.maxError, maxEightBitLevels: 255 * displayComparison.maxError, rmseEncoded: displayComparison.rmse, maxErrorIndex: displayComparison.maxErrorIndex } });
		}
		return { kind, samples, capturesPreservedState, endpointControlsPass: endpointReports.every(r => r.equivalent),
			additionalTargets, additionalResolvedBytes: additionalTargets.length * width * height * 8,
			runtimeCacheStats: runtimeCache ? refinement.getSceneEndpointStats() : null,
			fixtureExtraTargetCount: extra.length,
			eligibleForStaticStandardMaterialProof: capturesPreservedState && samples.every(s => s.comparison.equivalent && s.repeatedReference.equivalent) };
	} finally {
		renderer.setRenderTarget(null);
		for (const item of [copy, candidate, display]) if (item) (item.material as THREE.Material).dispose();
		refinement.dispose(); for (const target of extra) target.dispose(); destination.dispose(); pipeline.dispose();
		destroyScene(scene); destroyScene(backgroundScene); destroyScene(tintScene);
		pattern.dispose(); lowEnvironment.dispose(); highEnvironment.dispose();
	}
}

let running: Promise<unknown> | undefined;
async function run() {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: false });
	try {
		await renderer.init();
		if (!(renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend) throw new Error('This proof requires native WebGPU; fallback is not evidence');
		renderer.setSize(width, height, false); renderer.setPixelRatio(1); renderer.autoClear = false;
		renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = STAGE_TONE_MAPPING_EXPOSURE;
		renderer.setClearColor(0xffffff, 1); renderer.setScissorTest(false);
		const results = [];
		for (const kind of cases) { output.textContent = `Running ${kind}…`; results.push(await runCase(renderer, kind)); }
		const report = { protocol: runtimeCache ? 'scene-endpoint-half-float-v3-runtime-cache' : 'scene-endpoint-half-float-v2-overlay', diagnosticOnly: true, productionCacheEnabled: false,
			candidate: runtimeCache ? 'actual-SpatialElementRefinement-prepareSceneEndpoints-render' : 'independent-bilinear-fixture',
			control: singlePremultiplicationControl ? 'fixture-only-single-background-cover-premultiplication' : 'unmodified-production-renderer',
			backend: 'webgpu', threeRevision: THREE.REVISION, width, height, maxAdditionalResolvedBytesAtProductionCap: 2 * 512 * 1024 * 8,
			refinementMode: 'Production NormalBlending/premultiplied overlay; candidate and reference use identical white and dark opaque destination seeds',
			tolerance: 'max(2^-13, four binary16 ULPs of the larger channel magnitude), all RGBA channels',
			order: 'scene High/Low render; linear refinement mix; display ACES/sRGB excluded from captures', results };
		output.textContent = JSON.stringify(report, null, 2); return report;
	} finally { renderer.dispose(); }
}

const api = { run: () => running ??= run().catch(error => { output.textContent = String(error?.stack ?? error); throw error; }) };
Object.assign(window, { __sceneEndpointProof: api });
document.querySelector<HTMLButtonElement>('#run')!.onclick = () => { void api.run(); };
