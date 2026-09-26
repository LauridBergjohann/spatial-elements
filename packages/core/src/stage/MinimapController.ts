import { withRendererState } from './rendererState.js';
import { getMinimapMeasurementMode } from './minimapMeasurement.js';
import * as THREE from 'three/webgpu';
import {
	abs,
	acesFilmicToneMapping,
	color,
	float,
	length,
	max as tslMax,
	min as tslMin,
	mix,
	oneMinus,
	premultiplyAlpha,
	renderOutput,
	screenUV,
	sRGBTransferEOTF,
	sRGBTransferOETF,
	smoothstep as tslSmoothstep,
	step,
	texture,
	uniform,
	uv,
	vec2
} from 'three/tsl';
import type { Mesh, Object3D } from 'three';
import {
	inverseAcesToneMapping,
	STAGE_TONE_MAPPING_EXPOSURE,
	type LiquidGlassPanelOptions
} from './LiquidGlassPanel.js';
import { MinimapBlurPipeline } from './MinimapBlurPipeline.js';
import {
	MINIMAP_DEFAULT_CONTEXT_COLOR,
	MINIMAP_DEFAULT_CONTEXT_OPACITY,
	MINIMAP_DEFAULT_EXPANDED_HEIGHT,
	MINIMAP_DEFAULT_HOVER_MODEL_SCALE,
	MINIMAP_DEFAULT_OVERLAY_BLUR,
	MINIMAP_MIN_BLUR_GUARD,
	MINIMAP_MODEL_FILL,
	MINIMAP_MODEL_RENDER_ORDER,
	MINIMAP_OVERLAY_Z,
	MINIMAP_PANEL_Z,
	MINIMAP_POINTER_MODEL_LIFT,
	MINIMAP_VIEWPORT_BORDER_THICKNESS,
	PANEL_CAMERA_FOV
} from './stageConstants.js';
import {
	getCameraOrbitQuaternion,
	getMinimapHoverScale,
	resolveMinimapModelScale,
	smoothstep
} from './stageMath.js';
import {
	addMinimapBlurLights,
	disposeMinimapModelMaterials,
	prepareMinimapModel
} from './minimap/MinimapModel.js';
import {
	createMinimapPanelGeometry,
	createMinimapViewportRingGeometry,
	getMinimapViewportCornerRadii,
	updateMinimapPanelGeometry,
	updateMinimapViewportRingGeometry
} from './minimap/MinimapGeometry.js';
import type { MinimapCornerRadii } from './minimap/MinimapGeometry.js';
import {
	getMinimapDepthRange,
	getMinimapCssBlurRadius,
	getMinimapViewportRect,
	getPanelLocalCameraFov
} from './minimap/MinimapProjection.js';
import type { ResolvedStageMinimapOptions, StageMinimapState } from './minimap/MinimapState.js';
import { getMeshBounds, getMeshBoundsPoints, isMesh } from './stageSceneUtils.js';
import type { StageCameraSettings, StageMinimapOptions, StagePanelTarget } from './stageTypes.js';

import type { StagePanelRuntime } from './StagePanelRuntime.js';
export interface MinimapPorts {
	renderer: THREE.WebGPURenderer;
	camera: THREE.PerspectiveCamera;
	panelCamera: THREE.PerspectiveCamera;
	panelScene: THREE.Scene;
	panel(index: number): StagePanelRuntime | undefined;
	target(index: number): StagePanelTarget | undefined;
	spatialElement(): {
		model?: THREE.Object3D;
		low?: THREE.Object3D;
		camera: StageCameraSettings;
		restCamera: THREE.Quaternion;
		restModel: THREE.Quaternion;
		hasControls: boolean;
		referenceTarget: THREE.Vector3;
	};
	frame(): { hovering: boolean; interacting: boolean; scrolling: boolean };
	environment(): THREE.RenderTarget | undefined;
	capture(): { scale: number; sceneCapture: THREE.RenderTarget } | undefined;
	blurTexture(options: LiquidGlassPanelOptions): THREE.Texture;
	transitionOpacity(panel?: StagePanelRuntime): number;
	pixelRatio(): number;
	includeMesh(mesh: Mesh): boolean;
}
const MINIMAP_OVERLAY_CAPTURE_EPSILON = 0.000001;
/** Owns independent Low views, docking projections and their blur resources. */
export class MinimapController {
	private readonly measurementMode = getMinimapMeasurementMode();
	readonly scene = new THREE.Scene();
	constructor(private readonly ports: MinimapPorts) {}
	get views(): ReadonlyMap<number, StageMinimapState> {
		return this.minimaps;
	}
	dispose() {
		for (const index of [...this.minimaps.keys()]) this.disposeMinimap(index);
	}
	private get renderer() {
		return this.ports.renderer;
	}
	private get camera() {
		return this.ports.camera;
	}
	private get panelCamera() {
		return this.ports.panelCamera;
	}
	private get panelScene() {
		return this.ports.panelScene;
	}
	private get minimapScene() {
		return this.scene;
	}
	private get model() {
		return this.ports.spatialElement().model;
	}
	private get lowModel() {
		return this.ports.spatialElement().low;
	}
	private get cameraSettings() {
		return this.ports.spatialElement().camera;
	}
	private get initialCameraWorldQuaternion() {
		return this.ports.spatialElement().restCamera;
	}
	private get initialModelWorldQuaternion() {
		return this.ports.spatialElement().restModel;
	}
	private get modelHover() {
		return this.ports.frame().hovering;
	}
	private get modelInteractionActive() {
		return this.ports.frame().interacting;
	}
	private get scrollActive() {
		return this.ports.frame().scrolling;
	}
	private isSpatialElementMesh(mesh: Mesh) {
		return this.ports.includeMesh(mesh);
	}
	private hideExcludedMeshes(model: Object3D) {
		model.traverse((child) => {
			if (isMesh(child) && !this.isSpatialElementMesh(child)) child.visible = false;
		});
	}
	private getZoomReferenceTarget() {
		return this.ports.spatialElement().referenceTarget;
	}
	private getPanelTransitionOpacity(panel?: StagePanelRuntime) {
		return this.ports.transitionOpacity(panel);
	}
	private getFullPixelRatio() {
		return this.ports.pixelRatio();
	}
	private getPanelBlurTexture(options: LiquidGlassPanelOptions) {
		return this.ports.blurTexture(options);
	}
	private readonly minimapModelWorldQuaternion = new THREE.Quaternion();
	private readonly minimapMainCameraWorldQuaternion = new THREE.Quaternion();
	private readonly minimapLiveQuaternion = new THREE.Quaternion();
	private readonly minimapBaseQuaternion = new THREE.Quaternion();
	private readonly minimapPanelCenter = new THREE.Vector3();
	private readonly minimapDesiredNdc = new THREE.Vector3();
	private readonly minimapDepthPoint = new THREE.Vector3();
	private readonly minimapModelCenter = new THREE.Vector3();
	private readonly minimapModelWorldScale = new THREE.Vector3();
	private readonly minimapLayerWorldScale = new THREE.Vector3();
	private readonly minimapModelBoundsPoint = new THREE.Vector3();
	private readonly minimaps = new Map<number, StageMinimapState>();
	createMinimap(index: number, options?: StageMinimapOptions) {
		this.disposeMinimap(index);
		if (!options || !this.model) return;

		const panel = this.ports.panel(index);
		if (!panel) return;

		const resolved = this.resolveMinimapOptions(options, panel);
		const modelRoot = (this.lowModel ?? this.model).clone(true);
		this.hideExcludedMeshes(modelRoot);
		const bounds = getMeshBounds(modelRoot, (mesh) => this.isSpatialElementMesh(mesh));
		const sphere = bounds.getBoundingSphere(new THREE.Sphere());
		const modelCenter = new THREE.Group();
		modelCenter.add(modelRoot);
		modelCenter.position.copy(sphere.center).multiplyScalar(-1);
		const model = new THREE.Group();
		model.add(modelCenter);
		prepareMinimapModel(model);
		const baseWidth = Math.max(panel.options.width, 1);
		const baseHeight = Math.max(panel.options.height, 1);
		const baseRadius = panel.options.radius;
		const cssBlurRadius = getMinimapCssBlurRadius(resolved.overlayBlur);
		const blurGuard = Math.max(MINIMAP_MIN_BLUR_GUARD, Math.ceil(cssBlurRadius * 3 + 16));
		const maximumPanelScale = Math.max(resolved.expandedHeight / baseHeight, 1);
		const captureExtentWidth = baseWidth * maximumPanelScale + blurGuard * 2;
		const captureExtentHeight = baseHeight * maximumPanelScale + blurGuard * 2;
		const maximumSourcePixelsPerCssPixel = Math.min(window.devicePixelRatio || 1, 2);
		const aspect = baseWidth / Math.max(baseHeight, 1);
		const modelRadius = Math.max(sphere.radius, 0.001);
		const panelDistance = Math.max(
			this.panelCamera.position.z - panel.group.position.z,
			modelRadius * 2
		);
		const minimapCamera = new THREE.PerspectiveCamera(
			getPanelLocalCameraFov(baseHeight, panelDistance),
			aspect,
			0.01,
			panelDistance + modelRadius * 8
		);
		minimapCamera.position.set(0, 0, panelDistance);
		minimapCamera.lookAt(0, 0, 0);
		const captureCamera = new THREE.PerspectiveCamera(
			getPanelLocalCameraFov(captureExtentHeight, panelDistance),
			captureExtentWidth / captureExtentHeight,
			0.01,
			panelDistance + modelRadius * 8
		);
		captureCamera.position.set(0, 0, panelDistance);
		captureCamera.lookAt(0, 0, 0);
		const screenCamera = new THREE.PerspectiveCamera(
			PANEL_CAMERA_FOV,
			Math.max(window.innerWidth, 1) / Math.max(window.innerHeight, 1),
			this.panelCamera.near,
			this.panelCamera.far
		);
		const captureLayer = new THREE.Group();
		captureLayer.add(model);

		const sourceScene = new THREE.Scene();
		sourceScene.add(captureLayer);
		sourceScene.background = null;
		const environment = this.ports.environment();
		if (environment) {
			sourceScene.environment = environment.texture;
			sourceScene.environmentIntensity = 1;
		}
		addMinimapBlurLights(sourceScene);

		const layer = new THREE.Group();
		layer.position.copy(panel.group.position);
		layer.rotation.copy(panel.group.rotation);
		layer.scale.copy(panel.group.scale);

		const contextTarget = new THREE.RenderTarget(1, 1, {
			depthBuffer: true,
			stencilBuffer: false,
			samples: 4,
			type: THREE.HalfFloatType
		});
		contextTarget.texture.minFilter = THREE.LinearFilter;
		contextTarget.texture.magFilter = THREE.LinearFilter;
		contextTarget.texture.generateMipmaps = false;
		contextTarget.texture.colorSpace = THREE.NoColorSpace;

		// Tone-map the model into display space while preserving its transparent,
		// premultiplied edges. The backdrop tint is composited after the blur so its
		// opacity remains independent from both the model and the page background.
		const displayTarget = new THREE.RenderTarget(1, 1, {
			depthBuffer: false,
			stencilBuffer: false,
			type: THREE.UnsignedByteType
		});
		displayTarget.texture.minFilter = THREE.LinearFilter;
		displayTarget.texture.magFilter = THREE.LinearFilter;
		displayTarget.texture.generateMipmaps = false;
		// The display pass writes sRGB values deliberately. Keep the texture
		// untagged so the blur runs in display space, matching CSS blur more closely.
		displayTarget.texture.colorSpace = THREE.NoColorSpace;

		// Preserve the exact glass-panel result underneath the minimap overlay.
		// Reconstructing that result from the stage backdrop made the overlay's
		// apparent opacity depend on the rotated model and could make it look more
		// transparent than the panel it covers.
		const panelTarget = new THREE.RenderTarget(1, 1, {
			depthBuffer: true,
			stencilBuffer: false,
			samples: 4,
			type: THREE.HalfFloatType
		});
		panelTarget.texture.minFilter = THREE.LinearFilter;
		panelTarget.texture.magFilter = THREE.LinearFilter;
		panelTarget.texture.generateMipmaps = false;
		panelTarget.texture.colorSpace = THREE.NoColorSpace;

		const displayOutput = renderOutput(
			texture(contextTarget.texture),
			THREE.ACESFilmicToneMapping,
			THREE.SRGBColorSpace
		);
		const displayMaterial = new THREE.NodeMaterial();
		// Keep transparent edge colors premultiplied through every reduction and
		// blur pass. They are unpremultiplied exactly once by MinimapBlurPipeline.
		displayMaterial.fragmentNode = premultiplyAlpha(displayOutput);
		displayMaterial.depthTest = false;
		displayMaterial.depthWrite = false;
		displayMaterial.blending = THREE.NoBlending;
		displayMaterial.toneMapped = false;
		displayMaterial.needsUpdate = true;
		const displayQuad = new THREE.QuadMesh(displayMaterial);

		const blurPipeline = new MinimapBlurPipeline(
			displayTarget.texture,
			cssBlurRadius,
			maximumSourcePixelsPerCssPixel
		);

		const displayRoot = (this.lowModel ?? this.model).clone(true);
		this.hideExcludedMeshes(displayRoot);
		const displayBounds = getMeshBounds(displayRoot, (mesh) => this.isSpatialElementMesh(mesh));
		const displaySphere = displayBounds.getBoundingSphere(new THREE.Sphere());
		const modelBoundsPoints = getMeshBoundsPoints(displayRoot, (mesh) => this.isSpatialElementMesh(mesh));
		modelBoundsPoints.forEach((point) => point.sub(displaySphere.center));
		const displayCenter = new THREE.Group();
		displayCenter.add(displayRoot);
		displayCenter.position.copy(displaySphere.center).multiplyScalar(-1);
		const displayModel = new THREE.Group();
		displayModel.add(displayCenter);
		const displayMaterials = prepareMinimapModel(displayModel);
		displayModel.renderOrder = MINIMAP_MODEL_RENDER_ORDER;
		const restQuaternion = this.initialCameraWorldQuaternion
			.clone()
			.invert()
			.multiply(this.initialModelWorldQuaternion);
		const hasDockedOrientation =
			Number.isFinite(options.dockedView?.azimuth) ||
			Number.isFinite(options.dockedView?.elevation);
		const dockedQuaternion = hasDockedOrientation
			? getCameraOrbitQuaternion(
					options.dockedView?.azimuth ?? this.cameraSettings.azimuth,
					options.dockedView?.elevation ?? this.cameraSettings.elevation
				)
					.invert()
					.multiply(this.initialModelWorldQuaternion)
			: undefined;

		const overlayVisibility = uniform(0);
		const overlayPanelSize = uniform(new THREE.Vector2(baseWidth, baseHeight));
		const overlayViewportCenter = uniform(new THREE.Vector2(baseWidth * 0.5, baseHeight * 0.5));
		const overlayViewportHalfSize = uniform(new THREE.Vector2(baseWidth * 0.5, baseHeight * 0.5));
		const overlayViewportRadii = uniform(
			new THREE.Vector4(baseRadius, baseRadius, baseRadius, baseRadius)
		);
		const captureUvScale = uniform(
			new THREE.Vector2(baseWidth / captureExtentWidth, baseHeight / captureExtentHeight)
		);
		const panelUv = uv();
		const pixelPosition = panelUv.mul(overlayPanelSize);
		const viewportOffset = pixelPosition.sub(overlayViewportCenter);
		const rightSide = step(0, viewportOffset.x);
		const bottomSide = step(0, viewportOffset.y);
		const topRadius = mix(overlayViewportRadii.x, overlayViewportRadii.y, rightSide);
		const bottomRadius = mix(overlayViewportRadii.w, overlayViewportRadii.z, rightSide);
		const viewportRadius = mix(topRadius, bottomRadius, bottomSide);
		const roundedOffset = abs(viewportOffset).sub(
			overlayViewportHalfSize.sub(vec2(viewportRadius, viewportRadius))
		);
		const viewportDistance = length(tslMax(roundedOffset, vec2(0, 0)))
			.add(tslMin(tslMax(roundedOffset.x, roundedOffset.y), 0))
			.sub(viewportRadius);
		const viewportMask = oneMinus(tslSmoothstep(-0.75, 0.75, viewportDistance));
		const captureUv = panelUv.sub(0.5).mul(captureUvScale).add(0.5);
		const blurredSample = texture(
			this.measurementMode === 'no-blur'
				? displayTarget.texture
				: blurPipeline.outputTarget.texture,
			captureUv
		);
		const panelSample = texture(panelTarget.texture, screenUV);
		const stageCaptureTexture = texture(this.ports.capture()!.sceneCapture.texture, screenUV);
		const stageBlurTexture = texture(
			panel.surface === 'solid'
				? this.ports.capture()!.sceneCapture.texture
				: this.getPanelBlurTexture(panel.options),
			screenUV
		);
		const stageSample = stageCaptureTexture;
		const displayOverlayColorValue = new THREE.Color(resolved.overlayColor);
		const displayContextColorValue = new THREE.Color(resolved.contextColor);
		THREE.ColorManagement.workingToColorSpace(displayOverlayColorValue, THREE.SRGBColorSpace);
		THREE.ColorManagement.workingToColorSpace(displayContextColorValue, THREE.SRGBColorSpace);
		const displayOverlayColor = color(displayOverlayColorValue);
		const displayContextColor = color(displayContextColorValue);
		const overlayOpacity = uniform(resolved.overlayOpacity);
		const contextOpacity = uniform(resolved.contextOpacity);
		const outsideViewport = oneMinus(viewportMask);
		// Glass uses its authoritative LiquidGlassPanel capture. Simple surfaces
		// reconstruct their CSS base in the foreground compositor: frosted samples
		// the matching preallocated blur target while solid samples the sharp stage.
		// This prevents the minimap overlay from replacing CSS blur with a sharp copy.
		const glassBaseLinearColor = panelSample.rgb.add(stageSample.rgb.mul(oneMinus(panelSample.a)));
		const glassBaseDisplayColor = sRGBTransferOETF(
			acesFilmicToneMapping(glassBaseLinearColor, float(STAGE_TONE_MAPPING_EXPOSURE))
		) as typeof blurredSample.rgb;
		const simpleBackdrop = panel.surface === 'frosted' ? stageBlurTexture : stageSample;
		const simpleBackdropDisplayColor = sRGBTransferOETF(
			acesFilmicToneMapping(simpleBackdrop.rgb, float(STAGE_TONE_MAPPING_EXPOSURE))
		) as typeof blurredSample.rgb;
		const displayPanelTintValue = new THREE.Color(panel.options.tint);
		THREE.ColorManagement.workingToColorSpace(displayPanelTintValue, THREE.SRGBColorSpace);
		const simplePanelDisplayColor = mix(
			simpleBackdropDisplayColor,
			color(displayPanelTintValue),
			float(panel.options.tintOpacity)
		) as typeof blurredSample.rgb;
		const panelBaseDisplayColor =
			panel.surface === 'glass' ? glassBaseDisplayColor : simplePanelDisplayColor;
		const capturedDisplayColor = blurredSample.rgb.add(
			panelBaseDisplayColor.mul(oneMinus(blurredSample.a))
		);
		const contextualDisplayColor = mix(capturedDisplayColor, displayContextColor, contextOpacity);
		const compositeDisplayColor = mix(contextualDisplayColor, displayOverlayColor, overlayOpacity);
		const overlayCompositeMaterial = new THREE.NodeMaterial();
		// Decode once for the final scene render. The intermediate targets stay in
		// display space so the Gaussian convolution behaves like a CSS backdrop blur.
		overlayCompositeMaterial.colorNode = inverseAcesToneMapping(
			sRGBTransferEOTF(compositeDisplayColor) as typeof blurredSample.rgb
		);
		overlayCompositeMaterial.opacityNode = overlayVisibility.mul(outsideViewport);
		overlayCompositeMaterial.depthTest = false;
		overlayCompositeMaterial.depthWrite = false;
		overlayCompositeMaterial.transparent = true;
		overlayCompositeMaterial.toneMapped = false;
		const overlayComposite = new THREE.Mesh(
			createMinimapPanelGeometry(baseWidth, baseHeight, baseRadius),
			overlayCompositeMaterial
		);
		overlayComposite.position.z = MINIMAP_OVERLAY_Z;
		overlayComposite.renderOrder = MINIMAP_MODEL_RENDER_ORDER + 1;
		overlayComposite.visible = false;

		const overlayRing = new THREE.Mesh(
			createMinimapViewportRingGeometry(
				baseWidth,
				baseHeight,
				0,
				0,
				baseWidth,
				baseHeight,
				{
					topLeft: baseRadius,
					topRight: baseRadius,
					bottomRight: baseRadius,
					bottomLeft: baseRadius
				},
				MINIMAP_VIEWPORT_BORDER_THICKNESS
			),
			new THREE.MeshBasicMaterial({
				color: resolved.viewportColor,
				depthTest: true,
				depthWrite: false,
				opacity: 0.96,
				transparent: true
			})
		);
		overlayRing.material.toneMapped = false;
		const ringRestMaterial = overlayRing.material;
		const ringForegroundMaterial = ringRestMaterial.clone();
		ringForegroundMaterial.depthTest = false;
		overlayRing.position.z = MINIMAP_OVERLAY_Z;
		overlayRing.renderOrder = MINIMAP_MODEL_RENDER_ORDER + 2;
		overlayRing.visible = true;

		layer.add(displayModel, overlayComposite, overlayRing);
		this.minimapScene.add(layer);
		this.minimaps.set(index, {
			panelIndex: index,
			screenCamera,
			camera: minimapCamera,
			captureCamera,
			model,
			sourceRoot: modelRoot,
			displayModel,
			spatialElementRoot: displayRoot,
			modelBoundsPoints,
			restQuaternion,
			dockedQuaternion,
			displayMaterials,
			displayOpacity: 1,
			layer,
			modelRadius,
			baseWidth,
			baseHeight,
			baseRadius,
			currentWidth: baseWidth,
			currentHeight: baseHeight,
			sourceScene,
			captureLayer,
			contextTarget,
			displayTarget,
			panelTarget,
			blurPipeline,
			displayMaterial,
			displayQuad,
			overlayComposite,
			stageCaptureTexture,
			stageBlurTexture,
			overlayVisibility,
			overlayPanelSize,
			overlayViewportCenter,
			overlayViewportHalfSize,
			overlayViewportRadii,
			captureUvScale,
			blurGuard,
			captureExtentWidth,
			captureExtentHeight,
			overlayRing,
			ringRestMaterial,
			ringForegroundMaterial,
			overlayProgress: 0,
			overlayGeometryWidth: baseWidth,
			overlayGeometryHeight: baseHeight,
			overlayGeometryDirty: false,
			overlayCaptureState: [],
			overlayCaptureDirty: true,
			overlayCaptureValid: false,
			panelCaptureState: [],
			panelCaptureDirty: true,
			panelCaptureValid: false,
			pointerReveal: 0,
			viewportVisible: true,
			options: resolved
		});
	}
	resolveMinimapOptions(options: StageMinimapOptions, panel: StagePanelRuntime) {
		return {
			expandedHeight: Math.max(
				options.expandedHeight ?? MINIMAP_DEFAULT_EXPANDED_HEIGHT,
				panel.options.height
			),
			inset: Math.max(options.inset ?? 0, 0),
			modelScale: resolveMinimapModelScale(options.modelScale),
			hoverModelScale: resolveMinimapModelScale(
				options.hoverModelScale,
				MINIMAP_DEFAULT_HOVER_MODEL_SCALE
			),
			expandedHoverModelScale: resolveMinimapModelScale(
				options.expandedHoverModelScale,
				resolveMinimapModelScale(options.hoverModelScale, MINIMAP_DEFAULT_HOVER_MODEL_SCALE)
			),
			overlayColor: options.overlayColor ?? '#123274',
			overlayOpacity: THREE.MathUtils.clamp(options.overlayOpacity ?? 0.22, 0, 1),
			overlayBlur: THREE.MathUtils.clamp(
				options.overlayBlur ?? MINIMAP_DEFAULT_OVERLAY_BLUR,
				0,
				40
			),
			contextColor: options.contextColor ?? MINIMAP_DEFAULT_CONTEXT_COLOR,
			contextOpacity: THREE.MathUtils.clamp(
				options.contextOpacity ?? MINIMAP_DEFAULT_CONTEXT_OPACITY,
				0,
				1
			),
			viewportColor: options.viewportColor ?? '#4569b1'
		} satisfies ResolvedStageMinimapOptions;
	}
	disposeMinimap(index: number) {
		const minimap = this.minimaps.get(index);
		if (!minimap) return;

		minimap.layer.removeFromParent();
		minimap.captureLayer.removeFromParent();
		minimap.model.removeFromParent();
		disposeMinimapModelMaterials(minimap.model);
		minimap.displayModel.removeFromParent();
		disposeMinimapModelMaterials(minimap.displayModel);
		minimap.contextTarget.dispose();
		minimap.displayTarget.dispose();
		minimap.panelTarget.dispose();
		minimap.blurPipeline.dispose();
		minimap.displayMaterial.dispose();
		const geometries = new Set([minimap.overlayComposite.geometry, minimap.overlayRing.geometry]);
		geometries.forEach((geometry) => geometry.dispose());
		minimap.overlayComposite.material.dispose();
		minimap.ringRestMaterial.dispose();
		minimap.ringForegroundMaterial.dispose();
		this.minimaps.delete(index);
	}
	updateMinimapState(minimap: StageMinimapState, focus: number) {
		const panel = this.ports.panel(minimap.panelIndex);
		if (!panel || !this.model) return;

		const panelWidth = Math.max(minimap.currentWidth, 8);
		const panelHeight = Math.max(minimap.currentHeight, 8);
		const contentWidth = Math.max(panelWidth - minimap.options.inset * 2, 8);
		const contentHeight = Math.max(panelHeight - minimap.options.inset * 2, 8);

		this.camera.updateMatrixWorld(true);
		this.panelCamera.updateMatrixWorld(true);
		this.updateMinimapDisplayModel(minimap, panelWidth, panelHeight, focus);
		this.syncMinimapProjection(minimap, panelWidth, panelHeight);

		const viewportRect =
			focus > 0.001 && this.ports.spatialElement().hasControls
				? getMinimapViewportRect(
						this.camera,
						minimap.camera,
						this.getZoomReferenceTarget(),
						this.model,
						minimap.sourceRoot,
						minimap.captureLayer,
						panelWidth,
						panelHeight
					)
				: null;
		const rectWidth = viewportRect?.width ?? panelWidth * 0.82;
		const rectHeight = viewportRect?.height ?? panelHeight * 0.82;
		const rectX = viewportRect?.x ?? 0;
		const rectY = viewportRect?.y ?? 0;
		this.updateMinimapViewport(
			minimap,
			panelWidth,
			panelHeight,
			contentWidth,
			contentHeight,
			rectX,
			rectY,
			rectWidth,
			rectHeight,
			focus
		);
		this.updateMinimapOverlayCaptureState(minimap);
	}
	updateMinimapOverlayCaptureState(minimap: StageMinimapState) {
		// SpatialElement pixels depend on the capture's own camera and model, not the
		// main camera's moving viewport hole or the backdrop behind the panel.
		this.recordMinimapCaptureState(minimap, false);
		this.recordMinimapCaptureState(minimap, true);
	}
	private recordMinimapCaptureState(minimap: StageMinimapState, panelCapture: boolean) {
		const snapshot = panelCapture ? minimap.panelCaptureState : minimap.overlayCaptureState;
		let offset = 0;
		let changed = snapshot.length === 0;
		const record = (value: number) => {
			const resolved = Number.isFinite(value) ? value : 0;
			if (
				snapshot[offset] === undefined ||
				Math.abs(snapshot[offset] - resolved) > MINIMAP_OVERLAY_CAPTURE_EPSILON
			) {
				changed = true;
			}
			snapshot[offset] = resolved;
			offset += 1;
		};
		const recordMatrix = (matrix: THREE.Matrix4) => {
			for (const value of matrix.elements) record(value);
		};

		recordMatrix(minimap.captureCamera.matrixWorld);
		recordMatrix(minimap.captureCamera.projectionMatrix);
		recordMatrix(minimap.captureLayer.matrixWorld);
		recordMatrix(minimap.model.matrixWorld);
		record(this.getFullPixelRatio());
		record(minimap.sourceScene.environment?.id ?? -1);
		record(minimap.sourceScene.environment?.version ?? -1);
		record(minimap.sourceScene.environmentIntensity);
		if (panelCapture) {
			recordMatrix(minimap.screenCamera.matrixWorld);
			recordMatrix(minimap.screenCamera.projectionMatrix);
			recordMatrix(this.camera.matrixWorld);
			recordMatrix(this.camera.projectionMatrix);
			if (this.model) {
				record(this.model.position.x);
				record(this.model.position.y);
				record(this.model.position.z);
				record(this.model.quaternion.x);
				record(this.model.quaternion.y);
				record(this.model.quaternion.z);
				record(this.model.quaternion.w);
				record(this.model.scale.x);
				record(this.model.scale.y);
				record(this.model.scale.z);
			}
			record(minimap.currentWidth);
			record(minimap.currentHeight);
			record(minimap.captureUvScale.value.x);
			record(minimap.captureUvScale.value.y);
			record(this.ports.capture()?.scale ?? 1);
			record(window.innerWidth);
			record(window.innerHeight);
			record(window.devicePixelRatio || 1);
			record(this.modelHover ? 1 : 0);
			record(this.modelInteractionActive ? 1 : 0);
			record(this.scrollActive ? 1 : 0);
			record(this.ports.target(minimap.panelIndex)?.getSurfaceOpacity?.() ?? 1);
		}

		if (snapshot.length !== offset) changed = true;
		snapshot.length = offset;
		if (changed) {
			if (panelCapture) minimap.panelCaptureDirty = true;
			else minimap.overlayCaptureDirty = true;
		}
	}
	updateMinimapDisplayModel(
		minimap: StageMinimapState,
		panelWidth: number,
		panelHeight: number,
		focus: number
	) {
		const contentWidth = Math.max(panelWidth - minimap.options.inset * 2, 8);
		const contentHeight = Math.max(panelHeight - minimap.options.inset * 2, 8);
		const availableDiameter = Math.min(contentWidth, contentHeight) * MINIMAP_MODEL_FILL;
		const presentationScale = THREE.MathUtils.clamp(
			this.ports.target(minimap.panelIndex)?.getMinimapModelScale?.() ?? 1,
			0.2,
			2
		);
		const baseScale =
			(availableDiameter * minimap.options.modelScale * presentationScale) /
			Math.max(minimap.modelRadius * 2, 0.001);
		const hoverModelScale = THREE.MathUtils.lerp(
			minimap.options.hoverModelScale,
			minimap.options.expandedHoverModelScale,
			THREE.MathUtils.clamp(focus, 0, 1)
		);
		const targetScale = baseScale * getMinimapHoverScale(hoverModelScale, minimap.pointerReveal);

		const modelZ = MINIMAP_PANEL_Z + MINIMAP_POINTER_MODEL_LIFT * minimap.pointerReveal;
		const modelWorldQuaternion = this.minimapModelWorldQuaternion;
		const mainCameraWorldQuaternion = this.minimapMainCameraWorldQuaternion;
		const liveQuaternion = this.minimapLiveQuaternion;
		const baseQuaternion = this.minimapBaseQuaternion;
		this.model?.getWorldQuaternion(modelWorldQuaternion);
		this.camera.getWorldQuaternion(mainCameraWorldQuaternion);
		liveQuaternion.copy(mainCameraWorldQuaternion).invert().multiply(modelWorldQuaternion);
		baseQuaternion.slerpQuaternions(
			minimap.restQuaternion,
			liveQuaternion,
			THREE.MathUtils.clamp(focus, 0, 1)
		);
		if (minimap.dockedQuaternion) {
			minimap.displayModel.quaternion.slerpQuaternions(
				baseQuaternion,
				minimap.dockedQuaternion,
				THREE.MathUtils.clamp(
					this.ports.target(minimap.panelIndex)?.getMinimapDockProgress?.() ?? 0,
					0,
					1
				)
			);
		} else {
			minimap.displayModel.quaternion.copy(baseQuaternion);
		}
		minimap.displayModel.scale.setScalar(targetScale);
		minimap.displayModel.position.set(0, 0, modelZ);
	}
	alignMinimapModelToDockTop(minimap: StageMinimapState) {
		const targetTop = this.ports.target(minimap.panelIndex)?.getMinimapModelTop?.();
		if (targetTop === undefined || !Number.isFinite(targetTop)) return;

		for (let iteration = 0; iteration < 2; iteration += 1) {
			const projected = this.getProjectedMinimapModelRect(minimap);
			if (!projected || Math.abs(projected.y - targetTop) < 0.001) return;

			const startY = minimap.displayModel.position.y;
			minimap.displayModel.position.y = startY + 1;
			const shifted = this.getProjectedMinimapModelRect(minimap);
			minimap.displayModel.position.y = startY;
			if (!shifted) return;

			const pixelsPerLocalUnit = shifted.y - projected.y;
			if (Math.abs(pixelsPerLocalUnit) < 0.000001) return;

			minimap.displayModel.position.y += THREE.MathUtils.clamp(
				(targetTop - projected.y) / pixelsPerLocalUnit,
				-window.innerHeight,
				window.innerHeight
			);
		}

		minimap.displayModel.updateWorldMatrix(true, true);
	}
	getProjectedMinimapModelRect(minimap: StageMinimapState) {
		minimap.layer.updateWorldMatrix(true, false);
		minimap.displayModel.updateWorldMatrix(true, true);
		minimap.screenCamera.updateMatrixWorld(true);
		const viewportWidth = Math.max(window.innerWidth, 1);
		const viewportHeight = Math.max(window.innerHeight, 1);
		let left = Number.POSITIVE_INFINITY;
		let top = Number.POSITIVE_INFINITY;
		let right = Number.NEGATIVE_INFINITY;
		let bottom = Number.NEGATIVE_INFINITY;

		for (const boundsPoint of minimap.modelBoundsPoints) {
			const projectedPoint = this.minimapModelBoundsPoint
				.copy(boundsPoint)
				.applyMatrix4(minimap.displayModel.matrixWorld)
				.project(minimap.screenCamera);
			const x = (projectedPoint.x + 1) * viewportWidth * 0.5;
			const y = (1 - projectedPoint.y) * viewportHeight * 0.5;
			left = Math.min(left, x);
			top = Math.min(top, y);
			right = Math.max(right, x);
			bottom = Math.max(bottom, y);
		}

		if (![left, top, right, bottom].every(Number.isFinite)) return null;
		return { x: left, y: top, width: right - left, height: bottom - top };
	}
	syncMinimapProjection(minimap: StageMinimapState, panelWidth: number, panelHeight: number) {
		minimap.layer.updateWorldMatrix(true, true);
		minimap.displayModel.updateWorldMatrix(true, true);

		const panelCenter = minimap.layer.getWorldPosition(this.minimapPanelCenter);
		const viewportWidth = Math.max(window.innerWidth, 1);
		const viewportHeight = Math.max(window.innerHeight, 1);
		const desiredNdc = this.minimapDesiredNdc.copy(panelCenter).project(this.panelCamera);
		const screenCamera = minimap.screenCamera;
		// Renderer switches coordinate systems on first draw and rebuilds the projection.
		// Do this before installing our off-axis terms, including hidden/new minimaps.
		screenCamera.coordinateSystem = this.renderer.coordinateSystem;
		screenCamera.fov = PANEL_CAMERA_FOV;
		screenCamera.aspect = viewportWidth / viewportHeight;
		screenCamera.position.set(panelCenter.x, panelCenter.y, this.panelCamera.position.z);
		screenCamera.quaternion.copy(this.panelCamera.quaternion);
		screenCamera.clearViewOffset();
		screenCamera.updateMatrixWorld(true);

		const panelDistance = -this.minimapDepthPoint
			.copy(panelCenter)
			.applyMatrix4(screenCamera.matrixWorldInverse).z;
		const modelDistance = -this.minimapDepthPoint
			.copy(minimap.displayModel.getWorldPosition(this.minimapModelCenter))
			.applyMatrix4(screenCamera.matrixWorldInverse).z;
		const modelWorldScale = minimap.displayModel.getWorldScale(this.minimapModelWorldScale);
		const layerWorldScale = minimap.layer.getWorldScale(this.minimapLayerWorldScale);
		const modelDepthRadius =
			minimap.modelRadius *
			Math.max(
				Math.abs(modelWorldScale.x),
				Math.abs(modelWorldScale.y),
				Math.abs(modelWorldScale.z)
			);
		const panelDepthRadius =
			Math.hypot(panelWidth, panelHeight) *
			0.5 *
			Math.max(
				Math.abs(layerWorldScale.x),
				Math.abs(layerWorldScale.y),
				Math.abs(layerWorldScale.z)
			);
		const depthRange = getMinimapDepthRange([
			{ distance: panelDistance, radius: panelDepthRadius },
			{ distance: modelDistance, radius: modelDepthRadius }
		]);
		screenCamera.near = depthRange.near;
		screenCamera.far = depthRange.far;
		screenCamera.updateProjectionMatrix();

		// This is the original pre-split projection: the optical axis stays centred
		// on the minimap while an off-axis frustum preserves its page position.
		screenCamera.projectionMatrix.elements[8] = -desiredNdc.x;
		screenCamera.projectionMatrix.elements[9] = -desiredNdc.y;
		screenCamera.projectionMatrixInverse.copy(screenCamera.projectionMatrix).invert();
		this.alignMinimapModelToDockTop(minimap);

		const localPanelDistance = Math.max(screenCamera.position.z - panelCenter.z, 1);
		minimap.camera.fov = getPanelLocalCameraFov(panelHeight, localPanelDistance);
		minimap.camera.aspect = Math.max(panelWidth, 1) / Math.max(panelHeight, 1);
		minimap.camera.near = Math.max(localPanelDistance / 10000, 0.01);
		minimap.camera.far = localPanelDistance + minimap.modelRadius * 8 + MINIMAP_POINTER_MODEL_LIFT;
		minimap.camera.position.set(0, 0, localPanelDistance);
		minimap.camera.quaternion.identity();
		minimap.camera.clearViewOffset();
		minimap.camera.updateProjectionMatrix();
		minimap.camera.updateMatrixWorld(true);

		const captureWidth = minimap.captureExtentWidth;
		const captureHeight = minimap.captureExtentHeight;
		const captureCenterNdc = panelCenter.clone().project(screenCamera);
		const captureScaleX = viewportWidth / captureWidth;
		const captureScaleY = viewportHeight / captureHeight;
		const cropProjection = new THREE.Matrix4().set(
			captureScaleX,
			0,
			0,
			-captureScaleX * captureCenterNdc.x,
			0,
			captureScaleY,
			0,
			-captureScaleY * captureCenterNdc.y,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1
		);
		// Crop the exact live minimap projection instead of rebuilding an
		// approximation with a second panel-local camera. This keeps every rotated
		// part of the blurred clone in precisely the same frustum as the visible
		// model while retaining guard pixels for the blur kernel.
		minimap.captureCamera.copy(screenCamera, false);
		minimap.captureCamera.projectionMatrix.premultiply(cropProjection);
		minimap.captureCamera.projectionMatrixInverse
			.copy(minimap.captureCamera.projectionMatrix)
			.invert();
		minimap.captureCamera.updateMatrixWorld(true);
		minimap.captureUvScale.value.set(panelWidth / captureWidth, panelHeight / captureHeight);

		// The capture contains only the model. The live glass and live model remain
		// visible below the compositor, so fading the overlay cannot reveal a
		// differently positioned duplicate or bake glass edge shading into it.
		minimap.captureLayer.position.copy(minimap.layer.position);
		minimap.captureLayer.quaternion.copy(minimap.layer.quaternion);
		minimap.captureLayer.scale.copy(minimap.layer.scale);
		minimap.model.position.copy(minimap.displayModel.position);
		minimap.model.quaternion.copy(minimap.displayModel.quaternion);
		minimap.model.scale.copy(minimap.displayModel.scale);
		minimap.captureLayer.updateWorldMatrix(true, true);
	}
	updateMinimapViewport(
		minimap: StageMinimapState,
		panelWidth: number,
		panelHeight: number,
		contentWidth: number,
		contentHeight: number,
		rectX: number,
		rectY: number,
		rectWidth: number,
		rectHeight: number,
		focus: number
	) {
		const target = this.ports.target(minimap.panelIndex);
		if (!target) return;

		const progress = smoothstep(0.04, 0.72, focus);
		const viewportWidth = Math.min(rectWidth, panelWidth);
		const viewportHeight = Math.min(rectHeight, panelHeight);
		const targetLeft = THREE.MathUtils.clamp(
			panelWidth * 0.5 + rectX - viewportWidth * 0.5,
			0,
			panelWidth - viewportWidth
		);
		const targetTop = THREE.MathUtils.clamp(
			panelHeight * 0.5 - rectY - viewportHeight * 0.5,
			0,
			panelHeight - viewportHeight
		);
		const left = THREE.MathUtils.lerp(0, targetLeft, progress);
		const top = THREE.MathUtils.lerp(0, targetTop, progress);
		const currentWidth = THREE.MathUtils.lerp(panelWidth, viewportWidth, progress);
		const currentHeight = THREE.MathUtils.lerp(panelHeight, viewportHeight, progress);
		const radius = THREE.MathUtils.lerp(minimap.baseRadius, 2, progress);
		const cornerRadii = getMinimapViewportCornerRadii(
			panelWidth,
			panelHeight,
			left,
			top,
			currentWidth,
			currentHeight,
			radius,
			minimap.baseRadius
		);
		const overlayProgress = smoothstep(0.02, 0.14, progress);

		target.content.style.width = `${contentWidth}px`;
		target.content.style.height = `${contentHeight}px`;
		this.updateMinimapRenderMask(
			minimap,
			panelWidth,
			panelHeight,
			left,
			top,
			currentWidth,
			currentHeight,
			cornerRadii,
			overlayProgress
		);
	}
	updateMinimapRenderMask(
		minimap: StageMinimapState,
		panelWidth: number,
		panelHeight: number,
		viewportLeft: number,
		viewportTop: number,
		viewportWidth: number,
		viewportHeight: number,
		cornerRadii: MinimapCornerRadii,
		overlayProgress: number
	) {
		const panelW = Math.max(panelWidth, 0.001);
		const panelH = Math.max(panelHeight, 0.001);
		const width = THREE.MathUtils.clamp(viewportWidth, 0.001, panelW);
		const height = THREE.MathUtils.clamp(viewportHeight, 0.001, panelH);
		const left = THREE.MathUtils.clamp(viewportLeft, 0, panelW - width);
		const top = THREE.MathUtils.clamp(viewportTop, 0, panelH - height);
		const lineWidth = MINIMAP_VIEWPORT_BORDER_THICKNESS;
		if (
			Math.abs(minimap.overlayGeometryWidth - panelW) > MINIMAP_OVERLAY_CAPTURE_EPSILON ||
			Math.abs(minimap.overlayGeometryHeight - panelH) > MINIMAP_OVERLAY_CAPTURE_EPSILON
		) {
			minimap.overlayGeometryDirty = true;
		}
		minimap.overlayPanelSize.value.set(panelW, panelH);
		minimap.overlayViewportCenter.value.set(left + width * 0.5, top + height * 0.5);
		minimap.overlayViewportHalfSize.value.set(width * 0.5, height * 0.5);
		minimap.overlayViewportRadii.value.set(
			cornerRadii.topLeft,
			cornerRadii.topRight,
			cornerRadii.bottomRight,
			cornerRadii.bottomLeft
		);
		updateMinimapViewportRingGeometry(
			minimap.overlayRing.geometry,
			panelW,
			panelH,
			left,
			top,
			width,
			height,
			cornerRadii,
			lineWidth
		);

		minimap.overlayProgress = overlayProgress;
		this.updateMinimapOverlayVisibility(minimap);
		if (minimap.overlayComposite.visible && minimap.overlayGeometryDirty) {
			updateMinimapPanelGeometry(
				minimap.overlayComposite.geometry,
				panelW,
				panelH,
				minimap.baseRadius
			);
			minimap.overlayGeometryWidth = panelW;
			minimap.overlayGeometryHeight = panelH;
			minimap.overlayGeometryDirty = false;
		}
	}
	updateMinimapOverlayVisibility(minimap: StageMinimapState) {
		const reveal = smoothstep(0.38, 0.95, THREE.MathUtils.clamp(minimap.pointerReveal, 0, 1));
		const overlayProgress = THREE.MathUtils.clamp(minimap.overlayProgress, 0, 1);
		const overlayFade = 1 - reveal;
		const transitionOpacity = this.getPanelTransitionOpacity(this.ports.panel(minimap.panelIndex));
		const visibleOverlay = overlayProgress * overlayFade * transitionOpacity;
		const surfaceOpacity = THREE.MathUtils.clamp(
			this.ports.target(minimap.panelIndex)?.getSurfaceOpacity?.() ?? 1,
			0,
			1
		);
		const ringOpacity =
			0.96 *
			THREE.MathUtils.lerp(1, overlayFade, overlayProgress) *
			surfaceOpacity *
			transitionOpacity;
		const ringInForeground = overlayProgress > 0.001;
		minimap.overlayRing.material = ringInForeground
			? minimap.ringForegroundMaterial
			: minimap.ringRestMaterial;

		minimap.overlayComposite.visible =
			this.measurementMode !== 'no-overlay' && visibleOverlay > 0.001;
		minimap.overlayVisibility.value = visibleOverlay;
		minimap.overlayRing.visible = ringOpacity > 0.001;
		minimap.overlayRing.material.opacity = ringOpacity;

		// The live model is the sole sharp source. The opaque outside compositor
		// hides it beneath the overlay while the viewport hole reveals it unchanged.
		// Keeping it stable also removes the white cross-fade haze on hover.
		this.setMinimapDisplayModelOpacity(minimap, transitionOpacity);
	}
	setMinimapDisplayModelOpacity(minimap: StageMinimapState, opacity: number) {
		const resolvedOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
		// Exact endpoints restore authored transparency/depth ownership after a transition.
		if (resolvedOpacity === minimap.displayOpacity) return;

		minimap.displayOpacity = resolvedOpacity;
		minimap.displayModel.visible = resolvedOpacity > 0.001;
		minimap.displayMaterials.forEach((state) => {
			const transparent = state.transparent || resolvedOpacity < 0.999;
			if (state.material.transparent !== transparent) {
				state.material.transparent = transparent;
				state.material.needsUpdate = true;
			}
			state.material.opacity = state.opacity * resolvedOpacity;
			state.material.depthWrite = state.depthWrite && resolvedOpacity > 0.999;
		});
	}
	renderMinimapBlur(minimap: StageMinimapState) {
		return withRendererState(this.renderer, () => {
			this.ensureMinimapBlurTargetSize(minimap);

			const previousClearAlpha = this.renderer.getClearAlpha();
			const previousClearColor = this.renderer.getClearColor(new THREE.Color());
			// Capture and tone-map the model with transparency intact, then blur its
			// premultiplied display-space color. The overlay tint is applied later by the
			// compositor, so a black opacity of 0.4 remains a true translucent black.
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.setRenderTarget(minimap.contextTarget);
			this.renderer.clear();
			this.renderer.render(minimap.sourceScene, minimap.captureCamera);

			this.renderer.setClearColor(0x000000, 0);
			this.renderer.setRenderTarget(minimap.displayTarget);
			this.renderer.clear();
			minimap.displayQuad.render(this.renderer);

			if (this.measurementMode !== 'no-blur')
				minimap.blurPipeline.render(
					this.renderer,
					minimap.displayTarget.width / minimap.captureExtentWidth,
					minimap.displayTarget.height / minimap.captureExtentHeight
				);

			this.renderer.setRenderTarget(null);
			this.renderer.setClearColor(previousClearColor, previousClearAlpha);
		});
	}
	renderMinimapPanelCapture(minimap: StageMinimapState) {
		return withRendererState(this.renderer, () => {
			const pixelRatio = this.getFullPixelRatio();
			const targetWidth = Math.max(1, Math.round(window.innerWidth * pixelRatio));
			const targetHeight = Math.max(1, Math.round(window.innerHeight * pixelRatio));
			if (
				minimap.panelTarget.width !== targetWidth ||
				minimap.panelTarget.height !== targetHeight
			) {
				minimap.panelTarget.setSize(targetWidth, targetHeight);
			}

			const previousClearAlpha = this.renderer.getClearAlpha();
			const previousClearColor = this.renderer.getClearColor(new THREE.Color());
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.setRenderTarget(minimap.panelTarget);
			this.renderer.clear();
			this.renderer.render(this.panelScene, minimap.screenCamera);
			this.renderer.setRenderTarget(null);
			this.renderer.setClearColor(previousClearColor, previousClearAlpha);
		});
	}
	ensureMinimapBlurTargetSize(minimap: StageMinimapState) {
		const pixelRatio = this.getFullPixelRatio();
		const targetWidth = Math.max(16, Math.round(minimap.captureExtentWidth * pixelRatio));
		const targetHeight = Math.max(16, Math.round(minimap.captureExtentHeight * pixelRatio));
		if (
			minimap.contextTarget.width === targetWidth &&
			minimap.contextTarget.height === targetHeight &&
			minimap.displayTarget.width === targetWidth &&
			minimap.displayTarget.height === targetHeight &&
			minimap.blurPipeline.outputTarget.width === targetWidth &&
			minimap.blurPipeline.outputTarget.height === targetHeight
		)
			return;

		minimap.contextTarget.setSize(targetWidth, targetHeight);
		minimap.displayTarget.setSize(targetWidth, targetHeight);
		minimap.blurPipeline.setSize(targetWidth, targetHeight);
	}
}
