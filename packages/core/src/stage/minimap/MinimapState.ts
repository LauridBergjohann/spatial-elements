import * as THREE from 'three/webgpu';
import type { Material, Object3D } from 'three';
import type { MinimapBlurPipeline } from '../MinimapBlurPipeline.js';
import type { StageMinimapOptions } from '../stageTypes.js';

export type ResolvedStageMinimapOptions = Required<Omit<StageMinimapOptions, 'dockedView'>>;

/** Original material state retained while the live minimap model fades in and out. */
export interface MinimapMaterialOpacityState {
	material: Material;
	opacity: number;
	transparent: boolean;
	depthWrite: boolean;
}

/**
 * Owns all resources and animated values for one panel-backed element minimap.
 *
 * The live display model stays separate from the isolated blur capture so pointer
 * interaction cannot change the pixels used by the overlay.
 */
export interface StageMinimapState {
	panelIndex: number;
	screenCamera: THREE.PerspectiveCamera;
	camera: THREE.PerspectiveCamera;
	captureCamera: THREE.PerspectiveCamera;
	model: Object3D;
	sourceRoot: Object3D;
	displayModel: Object3D;
	/** Canonical element root within the minimap's centering/orientation hierarchy. */
	spatialElementRoot: Object3D;
	/** Per-mesh bound points expressed in the centered display model's local coordinates. */
	modelBoundsPoints: THREE.Vector3[];
	/** Camera-relative element pose captured from the fitted initial stage view. */
	restQuaternion: THREE.Quaternion;
	/** Optional camera-relative element pose authored for the docked presentation. */
	dockedQuaternion?: THREE.Quaternion;
	displayMaterials: MinimapMaterialOpacityState[];
	displayOpacity: number;
	layer: THREE.Group;
	modelRadius: number;
	baseWidth: number;
	baseHeight: number;
	baseRadius: number;
	currentWidth: number;
	currentHeight: number;
	sourceScene: THREE.Scene;
	captureLayer: THREE.Group;
	contextTarget: THREE.RenderTarget;
	displayTarget: THREE.RenderTarget;
	panelTarget: THREE.RenderTarget;
	blurPipeline: MinimapBlurPipeline;
	displayMaterial: THREE.NodeMaterial;
	displayQuad: THREE.QuadMesh;
	overlayComposite: THREE.Mesh<THREE.BufferGeometry, THREE.NodeMaterial>;
	/** Live source used to composite the glass result over the active stage capture. */
	stageCaptureTexture: { value: THREE.Texture };
	/** Matching preallocated blur capture used by frosted minimap surfaces. */
	stageBlurTexture: { value: THREE.Texture };
	overlayVisibility: { value: number };
	overlayPanelSize: { value: THREE.Vector2 };
	overlayViewportCenter: { value: THREE.Vector2 };
	overlayViewportHalfSize: { value: THREE.Vector2 };
	overlayViewportRadii: { value: THREE.Vector4 };
	captureUvScale: { value: THREE.Vector2 };
	blurGuard: number;
	captureExtentWidth: number;
	captureExtentHeight: number;
	overlayRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
	/** Stable depth variants avoid material recompilation on each zoom boundary. */
	ringRestMaterial: THREE.MeshBasicMaterial;
	ringForegroundMaterial: THREE.MeshBasicMaterial;
	overlayProgress: number;
	overlayGeometryWidth: number;
	overlayGeometryHeight: number;
	overlayGeometryDirty: boolean;
	/** Reusable numeric snapshot used to invalidate the expensive overlay captures. */
	overlayCaptureState: number[];
	overlayCaptureDirty: boolean;
	overlayCaptureValid: boolean;
	panelCaptureState: number[];
	panelCaptureDirty: boolean;
	panelCaptureValid: boolean;
	pointerReveal: number;
	/** Whether the panel-backed minimap intersects the viewport preload area. */
	viewportVisible: boolean;
	options: ResolvedStageMinimapOptions;
}
