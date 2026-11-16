import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Mesh } from 'three';
import { recreateOrbitControlsForExternalNavigation } from './OrbitControlsInterop.js';
import { WHEEL_ZOOM_DAMPING, ZOOM_RESET_DAMPING } from './stageConstants.js';
import { isStageUiTarget } from './stageDom.js';
import {
	getCameraZoomFocus,
	getCameraZoomReferenceDistance,
	getEffectiveCameraDistance,
	getWheelZoomTargetDistance,
	normalizeWheelZoomDelta,
	getViewResetDuration,
	getViewResetInterpolation,
	getStageUiFocus
} from './stageMath.js';
import { markStageScrollInput } from './scrollFrame.js';
import type { SpaceMouseAdapter, SpaceMouseNavigationUpdate } from './SpaceMouseAdapter.js';
import { dampAndSnap } from './damping.js';
import { getInteractionGuidance, MODEL_INPUT_EVENT, type ModelInputState } from './interactionGuidance.js';
import { ModelPointerPreview } from './ModelPointerPreview.js';
import { resolveDetailGestureOwner } from '../spatial-element/spatialElementMedia.js';
import type { SpatialElementMediaItem } from '../spatial-element/types.js';
import { DetailWheelGesture } from './DetailWheelGesture.js';
import { getPanelFocusOpacity } from './panelFocusMath.js';
export interface SpatialElementInteractionPorts {
	onSpaceMouseStateChange?: (state: import("./spaceMousePlatform.js").SpaceMouseState) => void;
	camera: THREE.PerspectiveCamera;
	canvas: HTMLCanvasElement;
	container: HTMLElement;
	cssRoot: HTMLElement;
	requestRender(): void;
	updateProjection(): void;
	readGeometry(): {
		poseOwner: 'page' | 'transition' | 'none';
		visible: boolean;
		viewport: THREE.Vector4;
		bounds: THREE.Box3;
		detail?: { media: SpatialElementMediaItem['kind']; split: boolean; paneHidden: boolean; paneLeft: number; contentTop?: number; uiFocus?: number };
	};
}
/** Owns user navigation state; consumes the facade clock and never creates a RAF loop. */
export class SpatialElementInteractionController {
	private disposed = false;
	private readonly wheelGesture = new DetailWheelGesture();
	private pinch?: { distance: number; x: number; y: number };
	private zoomScroll?: { focus: number; scrollY: number };
	private previousZoomFocus = 0;
	private fullscreen = false;
	setFullscreen(fullscreen: boolean) {
		this.fullscreen = fullscreen;
		this.wheelGesture.reset();
		this.clearWheelZoom();
		this._viewResetActive = false;
		this.preview.clear();
		this._pointer.active = false;
		this.setModelHover(false);
		this.clearZoomReset();
		this.updateControlsAvailability();
		this.requestRender();
	}
	constructor(private readonly ports: SpatialElementInteractionPorts) {
		this._initialCameraFov = this._viewResetStartFov = ports.camera.fov;
	}
	private get camera() {
		return this.ports.camera;
	}
	private get backgroundCanvas() {
		return this.ports.canvas;
	}
	private get container() {
		return this.ports.container;
	}
	private get canInteract() {
		return this.ports.readGeometry().poseOwner === 'page';
	}
	private get stageViewportVisible() {
		return this.ports.readGeometry().visible;
	}
	private get viewportFrame() {
		return this.ports.readGeometry().viewport;
	}
	private get modelBounds() {
		return this.ports.readGeometry().bounds;
	}
	private requestRender() {
		this.ports.requestRender();
	}
	private updateStageCameraProjection() {
		this.ports.updateProjection();
	}
	initialize() {
		this._controls = this.createControls();
		this.reducedMotion = typeof window === 'undefined' ? undefined : window.matchMedia?.('(prefers-reduced-motion: reduce)');
		this.reducedMotion?.addEventListener('change', this.motionPreferenceChanged);
		this.stopGuidance = this.guidance.subscribe((state) => {
			if (state.interacted) this.preview.forget();
		});
	}
	releasePage() {
		this.wheelGesture.reset();
		this.pinch = undefined;
		this.zoomScroll = undefined;
		this.previousZoomFocus = 0;
		this.preview.forget();
		this._interactionPointers.clear();
		this._pointer.active = false;
		this.clearWheelZoom();
		this._zoomResetTargetDistance = undefined;
		this._viewResetActive = false;
		this._modelHover = this._modelInteractionActive = false;
		this.notifyModelInput();
		if (!this.disposed) this.recreateOrbitControls();
	}
	dispose() {
		this.disposed = true;
		this.stopGuidance?.();
		this.reducedMotion?.removeEventListener('change', this.motionPreferenceChanged);
		this._controls?.removeEventListener('change', this._controlsChange);
		this._controls?.dispose();
		this.disconnectSpaceMouse();
	}
	captureInitialView() {
		if (!this._controls) return;
		this._initialCameraPosition.copy(this.camera.position);
		this._initialControlsTarget.copy(this._controls.target);
		this._initialCameraFov = this.camera.fov;
		this._initialViewCaptured = true;
		if (!this.guidance.snapshot.interacted) this.preview.capture(this.camera, this._controls.target);
	}
	setFocusRange(rest: number, close: number) {
		this._focusRestDistance = rest;
		this._focusCloseDistance = close;
	}
	stopViewReset() {
		this._viewResetActive = false;
	}
	setPickTargets(model: THREE.Object3D | undefined, include: (mesh: Mesh) => boolean) {
		this._modelPickTargets.length = 0;
		model?.traverse((child) => {
			if ((child as Mesh).isMesh && include(child as Mesh))
				this._modelPickTargets.push(child as Mesh);
		});
	}
	private readonly _raycaster = new THREE.Raycaster();
	private readonly _pointerNdc = new THREE.Vector2();
	private readonly _wheelZoomDirection = new THREE.Vector3();
	private readonly _wheelZoomForward = new THREE.Vector3();
	private readonly _controlsChange = () => this.requestRender();
	private readonly _pointer = { x: 0, y: 0, active: false };
	private readonly _modelPickTargets: Mesh[] = [];
	private readonly _modelHits: THREE.Intersection[] = [];
	private readonly _spaceMouseMatrix = new THREE.Matrix4();
	private readonly _spaceMouseScale = new THREE.Vector3();
	private readonly _spaceMouseDirection = new THREE.Vector3();
	private readonly _spaceMouseFrustumMin = new THREE.Vector2();
	private readonly _spaceMouseFrustumMax = new THREE.Vector2();
	private _controls?: OrbitControls;
	private _spaceMouse?: SpaceMouseAdapter;
	private _spaceMouseConnecting = false;
	private spaceMouseGeneration = 0;
	private spaceMouseAbort?: AbortController;
	private _spaceMouseMoving = false;
	private spaceMouseRevealPending = false;
	private _modelHover = false;
	private _modelInteractionActive = false;
	private readonly _interactionPointers = new Map<number, { x: number; y: number }>();
	private readonly guidance = getInteractionGuidance();
	private readonly preview = new ModelPointerPreview();
	private reducedMotion?: MediaQueryList;
	private stopGuidance?: () => void;
	private readonly motionPreferenceChanged = () => {
		this.preview.clear();
		this.requestRender();
	};
	private _focusRestDistance = 1;
	private _focusCloseDistance = 0.4;
	private _zoomResetTargetDistance?: number;
	private _zoomResetStartDistance?: number;
	private _zoomResetScrollDistance = 0;
	private _wheelZoomTargetDistance?: number;
	private readonly _initialCameraPosition = new THREE.Vector3();
	private readonly _initialControlsTarget = new THREE.Vector3();
	private _initialCameraFov = 45;
	private _initialViewCaptured = false;
	private _viewResetActive = false;
	private readonly _viewResetStartCameraPosition = new THREE.Vector3();
	private readonly _viewResetStartControlsTarget = new THREE.Vector3();
	private _viewResetStartFov = 45;
	private _viewResetElapsed = 0;
	private _viewResetDuration = 0;
	resetView() {
		if (!this._controls || !this._initialViewCaptured) return;
		this.guidance.interact();

		this.clearWheelZoom();
		this.clearZoomReset();
		this._viewResetStartCameraPosition.copy(this.camera.position);
		this._viewResetStartControlsTarget.copy(this._controls.target);
		this._viewResetStartFov = this.camera.fov;
		this._viewResetElapsed = 0;
		this._viewResetDuration = getViewResetDuration(this.getZoomFocusFactor());
		this._viewResetActive = true;
		this.requestRender();
	}
	createControls() {
		const controls = new OrbitControls(this.camera, this.backgroundCanvas);
		controls.enableDamping = true;
		controls.dampingFactor = 0.06;
		controls.zoomToCursor = true;
		controls.enabled = false;
		controls.addEventListener('change', this._controlsChange);
		// Single-finger background gestures retain native page scrolling. The shell
		// blocks browser magnification; detail pinch gestures are routed below.
		this.backgroundCanvas.style.touchAction = 'manipulation';

		return controls;
	}
	async initializeSpaceMouse() {
		if (
			!this._controls ||
			!this._initialViewCaptured ||
			this._spaceMouse ||
			this._spaceMouseConnecting ||
			this.disposed
		)
			return;
		this._spaceMouseConnecting = true;
		const generation = ++this.spaceMouseGeneration;
		this.spaceMouseAbort = new AbortController();

		this.ports.onSpaceMouseStateChange?.('connecting');
		try {
			const { SpaceMouseAdapter } = await import('./SpaceMouseAdapter.js');
			if (this.disposed || generation !== this.spaceMouseGeneration) return;
			const adapter = await SpaceMouseAdapter.connect({
				onStateChange: (state) => { if (!this.disposed && generation === this.spaceMouseGeneration) this.ports.onSpaceMouseStateChange?.(state); },
				signal: this.spaceMouseAbort.signal,
				// The SDK follows focus/blur on this target. Canvas focus hands the device
				// back to browser scrolling as soon as another part of the page is clicked.
				viewport: window,
				applicationName: 'Spatial Panels SpatialElement Viewer',
				getViewMatrix: () => {
					this.camera.updateMatrixWorld(true);
					return [...this.camera.matrixWorld.elements];
				},
				getFov: () => THREE.MathUtils.degToRad(this.camera.fov),
				getViewFrustum: () => this.getSpaceMouseViewFrustum(),
				getViewTarget: () => this._controls?.target.toArray() ?? [0, 0, 0],
				getModelExtents: () => [
					this.modelBounds.min.x,
					this.modelBounds.min.y,
					this.modelBounds.min.z,
					this.modelBounds.max.x,
					this.modelBounds.max.y,
					this.modelBounds.max.z
				],
				applyNavigationUpdate: (update) => this.applySpaceMouseNavigationUpdate(update),
				onMotionChange: (moving) => this.setSpaceMouseMoving(moving)
			});
			if (this.disposed || generation !== this.spaceMouseGeneration) {
				adapter.dispose();
				return;
			}
			this._spaceMouseConnecting = false;
			this._spaceMouse = adapter;
		} catch {
			if (!this.disposed && generation === this.spaceMouseGeneration) {
				this._spaceMouseConnecting = false;
				this.ports.onSpaceMouseStateChange?.('unavailable');
			}
		}
	}
	disconnectSpaceMouse() {
		this.spaceMouseGeneration++;
		this.ports.onSpaceMouseStateChange?.('idle');
		this.spaceMouseAbort?.abort();
		this.spaceMouseAbort = undefined;
		this._spaceMouseConnecting = false;
		this._spaceMouse?.dispose();
		this._spaceMouse = undefined;
		this.setSpaceMouseMoving(false);
	}
	getSpaceMouseViewFrustum() {
		this.updateStageCameraProjection();
		this.camera.getViewBounds(
			this.camera.near,
			this._spaceMouseFrustumMin,
			this._spaceMouseFrustumMax
		);

		return [
			this._spaceMouseFrustumMin.x,
			this._spaceMouseFrustumMax.x,
			this._spaceMouseFrustumMin.y,
			this._spaceMouseFrustumMax.y,
			this.camera.near,
			this.camera.far
		];
	}
	applySpaceMouseNavigationUpdate(update: SpaceMouseNavigationUpdate) {
		if (!this._controls || this.disposed || !this.canInteract) return;
		const previousFocus = this.getZoomFocusFactor();
		if (update.viewMatrix || update.target || update.fov !== undefined) this.guidance.interact();

		this.clearWheelZoom();
		this.clearZoomReset();
		this._viewResetActive = false;
		const previousTargetDistance = this.camera.position.distanceTo(this._controls.target);

		if (update.viewMatrix) {
			this._spaceMouseMatrix.fromArray(update.viewMatrix);
			this._spaceMouseMatrix.decompose(
				this.camera.position,
				this.camera.quaternion,
				this._spaceMouseScale
			);
			this.camera.scale.set(1, 1, 1);
		}

		if (update.target) {
			this._controls.target.fromArray(update.target);
		} else if (update.viewMatrix) {
			this.camera.getWorldDirection(this._spaceMouseDirection);
			this._controls.target
				.copy(this.camera.position)
				.addScaledVector(this._spaceMouseDirection, Math.max(previousTargetDistance, 0.001));
		}

		if (update.fov !== undefined) {
			this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(update.fov), 1, 179);
		}

		const distance = this.camera.position.distanceTo(this._controls.target);
		if (distance < this._controls.minDistance || distance > this._controls.maxDistance) {
			this.setCameraDistance(
				THREE.MathUtils.clamp(distance, this._controls.minDistance, this._controls.maxDistance)
			);
		}

		this.camera.updateProjectionMatrix();
		this.constrainEffectiveZoom();
		this.camera.lookAt(this._controls.target);
		this.camera.updateMatrixWorld(true);
		if (this.spaceMouseRevealPending && (update.viewMatrix || update.target || update.fov !== undefined)) {
			this.spaceMouseRevealPending = false;
			// Zoom reveals the document progressively. Rotation/pan still reveals an
			// offscreen viewer immediately, as it does not change the zoom clock.
			if (this.getZoomFocusFactor() <= previousFocus && !this.ports.readGeometry().detail?.split && window.scrollY > 0) {
				window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
			}
		}
		this.requestRender();
	}
	setSpaceMouseMoving(moving: boolean) {
		if (this.disposed || (moving && !this.canInteract)) {
			this._spaceMouseMoving = false;
			return;
		}
		if (this._spaceMouseMoving === moving) return;

		if (moving) this.recreateOrbitControls();
		this._spaceMouseMoving = moving;
		this.spaceMouseRevealPending = moving;
		if (moving) {
			this.clearWheelZoom();
			this.clearZoomReset();
			this._viewResetActive = false;
		}
		this.updateControlsAvailability();
		this.requestRender();
	}
	recreateOrbitControls() {
		if (!this._controls) return;

		this._controls.removeEventListener('change', this._controlsChange);
		this._controls = recreateOrbitControlsForExternalNavigation(this._controls, () =>
			this.createControls()
		);
	}
	handlePointerMove(event: PointerEvent) {
		const start = this._interactionPointers.get(event.pointerId);
		if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) {
			this.guidance.interact();
		}
		if (event.pointerType !== 'mouse') {
			this.clearPointerHover();
			return;
		}
		const pointerChanged =
			!this._pointer.active ||
			this._pointer.x !== event.clientX ||
			this._pointer.y !== event.clientY;
		this._pointer.x = event.clientX;
		this._pointer.y = event.clientY;
		this._pointer.active = true;
		if (pointerChanged) this.requestRender();

		if (!this._modelInteractionActive && !this.fullscreen) {
			this.setModelHover(this.hitTestModel(event.clientX, event.clientY, event.target));
			if (this.canInteract && this.stageViewportVisible && !this.guidance.snapshot.interacted &&
				!this.reducedMotion?.matches && event.target === this.backgroundCanvas) {
				this.preview.pointAt(event.clientX, event.clientY, this.camera, this.modelBounds, window.innerWidth, window.innerHeight);
			} else this.preview.clear();
		}
	}
	handlePointerDown(event: PointerEvent) {
		if (event.pointerType !== 'mouse') this.clearPointerHover();
		// Once a model gesture owns contact, a second finger may land outside its
		// silhouette. Keep both fingers in the same orbit/pinch gesture.
		const hit =
			(event.pointerType === 'touch' && this._interactionPointers.size > 0) ||
			this.hitTestModel(event.clientX, event.clientY, event.target);
		if (hit) {
			this._interactionPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
			this.backgroundCanvas.focus({ preventScroll: true });
			this.clearWheelZoom();
			this.clearZoomReset();
			this.normalizeCameraFovForOrbitControls();
			this._viewResetActive = false;
		}
		this._modelInteractionActive = this._interactionPointers.size > 0;
		this.setModelHover(event.pointerType === 'mouse' && hit);
		this.notifyModelInput();
		this.updateControlsAvailability();
		this.requestRender();
	}
	handlePointerUp(event: PointerEvent) {
		this._interactionPointers.delete(event.pointerId);
		this._modelInteractionActive = this._interactionPointers.size > 0;
		if (event.pointerType !== 'mouse') this.clearPointerHover();
		this.setModelHover(
			event.pointerType === 'mouse' &&
				event.type !== 'pointercancel' &&
				this.hitTestModel(event.clientX, event.clientY, event.target)
		);
		this.notifyModelInput();
		this.updateControlsAvailability();
		this.requestRender();
	}
	handleTouchStart(event: TouchEvent) {
		// Preserve OrbitControls' two-finger state when both contacts already belong
		// to the canvas, including continuing to rotate with the remaining finger.
		if (event.touches?.length >= 2 && this._interactionPointers.size < 2) {
			const [a, b] = Array.from(event.touches);
			const x = (a.clientX + b.clientX) / 2, y = (a.clientY + b.clientY) / 2;
			if (this.isPinchArea(x, y)) {
				this.pinch = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x, y };
				this.handlePointerLeave();
				event.preventDefault();
				event.stopImmediatePropagation();
				return;
			}
		}
		// touch-action cannot be changed after pointerdown to claim the current
		// gesture. Cancel this start when model navigation owns the contacts.
		if (this._modelInteractionActive && this._controls?.enabled && event.cancelable) {
			event.preventDefault();
		}
	}
	handleTouchMove(event: TouchEvent) {
		if (!this.pinch || event.touches.length < 2) return;
		const [a, b] = Array.from(event.touches);
		const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
		event.preventDefault();
		event.stopImmediatePropagation();
		const delta = Math.log(Math.max(this.pinch.distance, 1) / Math.max(distance, 1)) * 100;
		this.handleWheel({ clientX: this.pinch.x, clientY: this.pinch.y, deltaY: delta,
			deltaMode: 0, ctrlKey: true, target: this.backgroundCanvas,
			preventDefault() {}, stopImmediatePropagation() {} } as unknown as WheelEvent);
		this.pinch.distance = distance;
	}
	handleTouchEnd(event: TouchEvent) {
		if (event.touches.length < 2) this.pinch = undefined;
	}
	private isPinchArea(x: number, y: number) {
		if (!this.canInteract || !this._controls) return false;
		if (this.fullscreen) return true;
		const detail = this.ports.readGeometry().detail;
		return Boolean(detail && detail.media === 'minimap' && (detail.paneHidden ||
			(detail.split ? x < detail.paneLeft : y < (detail.contentTop ?? this.viewportFrame.y + this.viewportFrame.w))));
	}
	handlePointerContact(event: PointerEvent) {
		if (event.pointerType !== 'mouse') this.clearPointerHover();
	}
	private clearPointerHover() {
		this.preview.clear();
		const changed = this._pointer.active || this._modelHover;
		this._pointer.active = false;
		this.setModelHover(false);
		if (changed) this.requestRender();
	}
	handleWheel(event: WheelEvent) {
		const pinch = event.ctrlKey && this.isPinchArea(event.clientX, event.clientY);
		const hit = pinch || this.hitTestModel(event.clientX, event.clientY, event.target);
		this.setModelHover(hit);
		this.updateControlsAvailability();
		if (!this._controls || !this.canInteract || event.deltaY === 0) return;
		const atOverview = !this.fullscreen && this.getEffectiveCameraDistance() >= this._controls.maxDistance - 0.001;
		const owner = this.wheelGesture.resolve(performance.now(), hit, event.deltaY > 0, atOverview, pinch);
		if (owner === 'scroll') {
			// Let the browser scroll, but never let OrbitControls consume this burst.
			this._controls.enabled = false;
			this.requestRender();
			return;
		}
		if (event.deltaY !== 0) this.guidance.interact();

		// OrbitControls applies wheel dolly immediately even when rotation damping is
		// enabled. Own the spatialElement wheel gesture so camera, panels, and minimap can
		// advance from one shared damped camera distance instead.
		event.preventDefault();
		event.stopImmediatePropagation();
		this.normalizeCameraFovForOrbitControls();
		this.clearZoomReset();
		this._viewResetActive = false;

		const deltaY = normalizeWheelZoomDelta(event.deltaY, event.deltaMode, event.ctrlKey);
		const currentDistance = this.camera.position.distanceTo(this._controls.target);
		const previousTargetDistance = this._wheelZoomTargetDistance ?? currentDistance;
		const targetDistance = getWheelZoomTargetDistance(
			previousTargetDistance,
			deltaY,
			this._controls.zoomSpeed,
			this._controls.minDistance,
			this._controls.maxDistance
		);
		this._wheelZoomTargetDistance =
			Math.abs(targetDistance - currentDistance) > 0.0001 ? targetDistance : undefined;

		const rect = this.backgroundCanvas.getBoundingClientRect();
		this._pointerNdc.set(
			((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
			-((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
		);
		this._wheelZoomDirection
			.set(this._pointerNdc.x, this._pointerNdc.y, 1)
			.unproject(this.camera)
			.sub(this.camera.position)
			.normalize();
		// A pinch on a panel should approach the model, not dolly toward that UI.
		if (pinch) this.camera.getWorldDirection(this._wheelZoomDirection);
		this.requestRender();
	}
	requestScrollZoomReset(scrollDelta: number) {
		if (!this._controls || this.fullscreen) return;
		if (this.pinch || this._interactionPointers.size > 1 ||
			(this._wheelZoomTargetDistance !== undefined && this.wheelGesture.zooming(performance.now()))) return;
		this.clearWheelZoom();
		this._viewResetActive = false;

		const currentDistance = this.getEffectiveCameraDistance();
		const overviewDistance = this._controls.maxDistance;
		if (
			currentDistance >= overviewDistance - 0.001 &&
			Math.abs(this.camera.fov - this._initialCameraFov) < 0.001
		) {
			this.clearZoomReset();
			return;
		}

		if (this._zoomResetStartDistance === undefined) {
			this._zoomResetStartDistance = currentDistance;
			this._zoomResetScrollDistance = 0;
		}

		this._zoomResetScrollDistance += scrollDelta;
		const resetAmount = THREE.MathUtils.clamp(
			this._zoomResetScrollDistance / Math.max(window.innerHeight, 1),
			0,
			1
		);
		this._zoomResetTargetDistance = THREE.MathUtils.lerp(
			this._zoomResetStartDistance,
			overviewDistance,
			resetAmount
		);
	}
	applyZoomReset(delta: number) {
		if (!this._controls || this._zoomResetTargetDistance === undefined) return;

		const currentDistance = this.camera.position.distanceTo(this._controls.target);
		const targetDistance = THREE.MathUtils.clamp(
			this._zoomResetTargetDistance,
			this._controls.minDistance,
			this._controls.maxDistance
		);
		const nextDistance = THREE.MathUtils.damp(
			currentDistance,
			targetDistance,
			ZOOM_RESET_DAMPING,
			delta
		);
		this.setCameraDistance(nextDistance);
		this.camera.fov = THREE.MathUtils.damp(
			this.camera.fov,
			this._initialCameraFov,
			ZOOM_RESET_DAMPING,
			delta
		);
		this.camera.updateProjectionMatrix();

		if (
			Math.abs(nextDistance - targetDistance) < 0.01 &&
			Math.abs(this.camera.fov - this._initialCameraFov) < 0.01
		) {
			this.setCameraDistance(targetDistance);
			this.camera.fov = this._initialCameraFov;
			this.camera.updateProjectionMatrix();
			if (targetDistance >= this._controls.maxDistance - 0.001) {
				this.clearZoomReset();
			} else {
				this._zoomResetTargetDistance = undefined;
			}
		}

		this._controls.update();
	}
	applyViewReset(delta: number) {
		if (!this._controls || !this._viewResetActive || !this._initialViewCaptured) return;

		this._viewResetElapsed += Math.max(delta, 0);
		const interpolation = getViewResetInterpolation(
			this._viewResetElapsed,
			this._viewResetDuration
		);
		this.camera.position
			.copy(this._viewResetStartCameraPosition)
			.lerp(this._initialCameraPosition, interpolation);
		this._controls.target
			.copy(this._viewResetStartControlsTarget)
			.lerp(this._initialControlsTarget, interpolation);
		this.camera.fov = THREE.MathUtils.lerp(
			this._viewResetStartFov,
			this._initialCameraFov,
			interpolation
		);
		this.camera.updateProjectionMatrix();

		if (interpolation >= 1) {
			this.camera.position.copy(this._initialCameraPosition);
			this._controls.target.copy(this._initialControlsTarget);
			this.camera.fov = this._initialCameraFov;
			this.camera.updateProjectionMatrix();
			this._viewResetActive = false;
		}

		this.camera.updateMatrixWorld();
		this._controls.update();
	}
	clearZoomReset() {
		this._zoomResetTargetDistance = undefined;
		this._zoomResetStartDistance = undefined;
		this._zoomResetScrollDistance = 0;
	}
	clearWheelZoom() {
		this._wheelZoomTargetDistance = undefined;
	}
	applyWheelZoom(delta: number) {
		if (!this._controls || this._wheelZoomTargetDistance === undefined) return false;

		const currentDistance = this.camera.position.distanceTo(this._controls.target);
		const targetDistance = THREE.MathUtils.clamp(
			this._wheelZoomTargetDistance,
			this._controls.minDistance,
			this._controls.maxDistance
		);
		const nextDistance = dampAndSnap(
			currentDistance,
			targetDistance,
			WHEEL_ZOOM_DAMPING,
			delta,
			0.001
		);
		const radiusDelta = currentDistance - nextDistance;
		this.camera.position.addScaledVector(this._wheelZoomDirection, radiusDelta);
		this.camera.updateMatrixWorld(true);
		this.camera.getWorldDirection(this._wheelZoomForward);
		this._controls.target
			.copy(this.camera.position)
			.addScaledVector(this._wheelZoomForward, nextDistance);
		this._controls.update();

		if (nextDistance === targetDistance) this._wheelZoomTargetDistance = undefined;
		return this._wheelZoomTargetDistance !== undefined;
	}
	setCameraDistance(distance: number) {
		if (!this._controls) return;

		const direction = this.camera.position.clone().sub(this._controls.target);
		if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
		direction.setLength(distance);
		this.camera.position.copy(this._controls.target).add(direction);
		this.camera.updateMatrixWorld();
	}
	getEffectiveCameraDistance() {
		if (!this._controls) return 0;

		return getEffectiveCameraDistance(
			this.camera.position.distanceTo(this._controls.target),
			this.camera.fov,
			this._initialCameraFov
		);
	}
	normalizeCameraFovForOrbitControls() {
		if (!this._controls || Math.abs(this.camera.fov - this._initialCameraFov) < 0.001) return;

		const distance = THREE.MathUtils.clamp(
			this.getEffectiveCameraDistance(),
			this._controls.minDistance,
			this._controls.maxDistance
		);
		this.camera.fov = this._initialCameraFov;
		this.setCameraDistance(distance);
		this.camera.updateProjectionMatrix();
		this._controls.update();
	}
	constrainEffectiveZoom() {
		if (!this._controls) return;

		const distance = Math.max(this.camera.position.distanceTo(this._controls.target), 0.001);
		const effectiveDistance = this.getEffectiveCameraDistance();
		const constrainedDistance = THREE.MathUtils.clamp(
			effectiveDistance,
			this._controls.minDistance,
			this._controls.maxDistance
		);
		if (Math.abs(effectiveDistance - constrainedDistance) < 0.0001) return;

		const referenceTangent = Math.tan(THREE.MathUtils.degToRad(this._initialCameraFov * 0.5));
		this.camera.fov = THREE.MathUtils.radToDeg(
			2 * Math.atan((referenceTangent * constrainedDistance) / distance)
		);
		this.camera.updateProjectionMatrix();
	}
	handlePointerLeave() {
		this.preview.clear();
		const wasInteracting = this._modelInteractionActive;
		this._interactionPointers.clear();
		this._pointer.active = false;
		this._modelInteractionActive = false;
		this.setModelHover(false);
		this.notifyModelInput();
		// Lost focus may not deliver pointerup. Drop OrbitControls' captured
		// pointer bookkeeping as well, so the next gesture starts immediately.
		if (wasInteracting) this.recreateOrbitControls();
		this.updateControlsAvailability();
		this.requestRender();
	}
	hitTestModel(clientX: number, clientY: number, target: EventTarget | null) {
		// Fullscreen owns the canvas, including its empty background. UI events
		// never reach this gate as canvas input; no geometry or DOM picking is needed.
		if (this.fullscreen) return this.canInteract && this.stageViewportVisible && target === this.backgroundCanvas;
		const detail = this.ports.readGeometry().detail;
		if (detail && (detail.split || detail.paneHidden)) {
			if (!this.canInteract || !this.stageViewportVisible) return false;
			return resolveDetailGestureOwner({ ...detail, clientX, modelHit: false,
				uiTarget: target !== this.backgroundCanvas || isStageUiTarget(target) || this.isPointerOccludedByHtml(clientX, clientY)
			}) === 'model';
		}
		if (
			!this.canInteract ||
			!this.stageViewportVisible ||
			clientX < this.viewportFrame.x ||
			clientX > this.viewportFrame.x + this.viewportFrame.z ||
			clientY < this.viewportFrame.y ||
			clientY > this.viewportFrame.y + this.viewportFrame.w ||
			!this._modelPickTargets.length ||
			isStageUiTarget(target) ||
			this.isPointerOccludedByHtml(clientX, clientY)
		) {
			return false;
		}

		this.updateStageCameraProjection();
		this._pointerNdc.set(
			(clientX / window.innerWidth) * 2 - 1,
			-(clientY / window.innerHeight) * 2 + 1
		);
		this._raycaster.setFromCamera(this._pointerNdc, this.camera);

		// This is a boolean interaction gate, not a nearest-surface query. Do not
		// raycast the remaining detailed meshes once one spatialElement surface was hit.
		for (const mesh of this._modelPickTargets) {
			this._modelHits.length = 0;
			this._raycaster.intersectObject(mesh, false, this._modelHits);
			if (this._modelHits.length) {
				this._modelHits.length = 0;
				return true;
			}
		}
		return false;
	}
	isPointerOccludedByHtml(clientX: number, clientY: number) {
		const elements = document.elementsFromPoint(clientX, clientY);

		for (const element of elements) {
			if (element === this.backgroundCanvas) return false;
			if (element === this.ports.cssRoot || element === this.container) continue;
			if (element === document.body || element === document.documentElement) continue;
			if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
			if (getComputedStyle(element).pointerEvents === 'none') continue;

			return true;
		}

		return false;
	}
	setModelHover(hover: boolean) {
		if (this.fullscreen) hover = false;
		if (this._modelHover === hover) return;

		this._modelHover = hover;
		this.notifyModelInput();
		this.updateControlsAvailability();
		this.requestRender();
	}
	private notifyModelInput() {
		this.container.dispatchEvent?.(new CustomEvent<ModelInputState>(MODEL_INPUT_EVENT, {
			detail: { hovered: this._modelHover, active: this._modelInteractionActive }
		}));
	}
	updateControlsAvailability() {
		const enabled =
			this.canInteract &&
			!this._spaceMouseMoving &&
			(this.fullscreen || this.ports.readGeometry().detail?.paneHidden || this._modelHover || this._modelInteractionActive);
		if (this._controls) {
			this._controls.enabled = enabled;
		}

		this.backgroundCanvas.style.cursor = this._modelInteractionActive
			? 'grabbing'
			: enabled
				? 'grab'
				: 'auto';
		this.backgroundCanvas.style.touchAction = this.fullscreen || this.ports.readGeometry().detail?.paneHidden ? 'none' : 'manipulation';
	}
	getZoomFocusFactor() {
		if (!this._controls) return 0;
		const viewTargetDistance = this.camera.position.distanceTo(this._controls.target);
		const spatialElementCenterDistance = this.camera.position.distanceTo(this._initialControlsTarget);

		return getCameraZoomFocus(
			getCameraZoomReferenceDistance(viewTargetDistance, spatialElementCenterDistance),
			this.camera.fov,
			this._initialCameraFov,
			this._focusCloseDistance,
			this._focusRestDistance
		);
	}
	getZoomReferenceTarget() {
		if (!this._controls) return this._initialControlsTarget;

		const viewTargetDistance = this.camera.position.distanceTo(this._controls.target);
		const spatialElementCenterDistance = this.camera.position.distanceTo(this._initialControlsTarget);
		return spatialElementCenterDistance < viewTargetDistance
			? this._initialControlsTarget
			: this._controls.target;
	}

	advance(now: number, delta: number) {
		this._spaceMouse?.updateFrame(now);
		if (!this.canInteract) return { controls: false, wheel: false };
		const controls = !this._spaceMouseMoving && Boolean(this._controls?.update());
		const wheel = this.applyWheelZoom(delta);
		this.applyZoomReset(delta);
		this.applyViewReset(delta);
		this.revealStageOnZoom();
		this.updateControlsAvailability();
		const preview = !this.fullscreen && !this._modelInteractionActive && !this._spaceMouseMoving &&
			this.preview.advance(this.camera, delta, this.reducedMotion?.matches);
		return { controls: controls || preview, wheel };
	}
	/** Couple document reveal to actual camera focus for wheel, touch and SpaceMouse. */
	private revealStageOnZoom() {
		const focus = getStageUiFocus(this.getZoomFocusFactor());
		if (focus > this.previousZoomFocus + 0.00001 && !this.ports.readGeometry().detail?.split) {
			if (!this.zoomScroll && window.scrollY > 0) this.zoomScroll = { focus: this.previousZoomFocus, scrollY: window.scrollY };
			if (this.zoomScroll) {
				const progress = Math.min(1, (focus - this.zoomScroll.focus) / Math.max(1 - this.zoomScroll.focus, 0.001));
				const y = Math.max(0, this.zoomScroll.scrollY * (1 - progress));
				if (window.scrollY > y) {
					markStageScrollInput('direct');
					window.scrollTo({ top: y < 1 ? 0 : y, behavior: 'instant' });
				}
			}
		} else if (focus < this.previousZoomFocus - 0.00001) this.zoomScroll = undefined;
		this.previousZoomFocus = focus;
	}
	get outlineOpacity() {
		const detail = this.ports.readGeometry().detail;
		return this.fullscreen || detail?.split ? 0 : getPanelFocusOpacity(detail?.uiFocus ?? 0);
	}
	get controls() {
		return this._controls;
	}

	get focusCloseDistance() {
		return this._focusCloseDistance;
	}

	get initialCameraFov() {
		return this._initialCameraFov;
	}

	get initialCameraPosition() {
		return this._initialCameraPosition;
	}

	get initialControlsTarget() {
		return this._initialControlsTarget;
	}

	get initialViewCaptured() {
		return this._initialViewCaptured;
	}

	get modelHover() {
		return this._modelHover;
	}

	get modelInteractionActive() {
		return this._modelInteractionActive;
	}

	get pointer() {
		return this._pointer;
	}

	get spaceMouseMoving() {
		return this._spaceMouseMoving;
	}

	get viewResetActive() {
		return this._viewResetActive;
	}

	get wheelZoomTargetDistance() {
		return this._wheelZoomTargetDistance;
	}

	get zoomResetTargetDistance() {
		return this._zoomResetTargetDistance;
	}
}
