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
	getViewResetInterpolation
} from './stageMath.js';
import { SpaceMouseAdapter, type SpaceMouseNavigationUpdate } from './SpaceMouseAdapter.js';
import { dampAndSnap } from './damping.js';
export interface ProductInteractionPorts {
	camera: THREE.PerspectiveCamera;
	canvas: HTMLCanvasElement;
	container: HTMLElement;
	cssRoot: HTMLElement;
	requestRender(): void;
	markActivity(): void;
	updateProjection(): void;
	readGeometry(): {
		poseOwner: 'page' | 'transition' | 'none';
		visible: boolean;
		viewport: THREE.Vector4;
		bounds: THREE.Box3;
	};
}
/** Owns user navigation state; consumes the facade clock and never creates a RAF loop. */
export class ProductInteractionController {
	private disposed = false;
	constructor(private readonly ports: ProductInteractionPorts) {
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
	}
	releasePage() {
		this.clearWheelZoom();
		this._zoomResetTargetDistance = undefined;
		this._viewResetActive = false;
		this._modelHover = this._modelInteractionActive = false;
		if (!this.disposed) this.recreateOrbitControls();
	}
	dispose() {
		this.disposed = true;
		this._controls?.removeEventListener('change', this._controlsChange);
		this._controls?.dispose();
		this._spaceMouse?.dispose();
		this._spaceMouse = undefined;
	}
	captureInitialView() {
		if (!this._controls) return;
		this._initialCameraPosition.copy(this.camera.position);
		this._initialControlsTarget.copy(this._controls.target);
		this._initialCameraFov = this.camera.fov;
		this._initialViewCaptured = true;
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
	private _spaceMouseMoving = false;
	private _modelHover = false;
	private _modelInteractionActive = false;
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
		this.backgroundCanvas.style.touchAction = 'pan-y';

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

		const adapter = await SpaceMouseAdapter.connect({
			viewport: this.backgroundCanvas,
			applicationName: 'Spatial Panels Product Viewer',
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
		this._spaceMouseConnecting = false;

		if (this.disposed) {
			adapter.dispose();
			return;
		}

		this._spaceMouse = adapter;
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
		this.ports.markActivity();
		this.requestRender();
	}
	setSpaceMouseMoving(moving: boolean) {
		if (this.disposed || !this.canInteract) return;
		if (this.disposed) {
			this._spaceMouseMoving = false;
			return;
		}
		if (this._spaceMouseMoving === moving) return;

		if (moving) this.recreateOrbitControls();
		this._spaceMouseMoving = moving;
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
		const pointerChanged =
			!this._pointer.active ||
			this._pointer.x !== event.clientX ||
			this._pointer.y !== event.clientY;
		this._pointer.x = event.clientX;
		this._pointer.y = event.clientY;
		this._pointer.active = true;
		if (pointerChanged) this.requestRender();

		if (!this._modelInteractionActive) {
			this.setModelHover(this.hitTestModel(event.clientX, event.clientY, event.target));
		}
	}
	handlePointerDown(event: PointerEvent) {
		const hit = this.hitTestModel(event.clientX, event.clientY, event.target);
		if (hit) {
			this.backgroundCanvas.focus({ preventScroll: true });
			this.clearWheelZoom();
			this.normalizeCameraFovForOrbitControls();
			this._viewResetActive = false;
		}
		this._modelInteractionActive = hit;
		this.setModelHover(hit);
		this.updateControlsAvailability();
		this.requestRender();
	}
	handlePointerUp(event: PointerEvent) {
		this._modelInteractionActive = false;
		this.setModelHover(this.hitTestModel(event.clientX, event.clientY, event.target));
		this.updateControlsAvailability();
		this.requestRender();
	}
	handleWheel(event: WheelEvent) {
		const hit = this.hitTestModel(event.clientX, event.clientY, event.target);
		this.setModelHover(hit);
		this.updateControlsAvailability();
		if (!hit || !this._controls) {
			this.requestRender();
			return;
		}

		// OrbitControls applies wheel dolly immediately even when rotation damping is
		// enabled. Own the product wheel gesture so camera, panels, and minimap can
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
		this.ports.markActivity();
		this.requestRender();
	}
	requestScrollZoomReset(scrollDelta: number) {
		if (!this._controls) return;
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
		this._pointer.active = false;
		this._modelInteractionActive = false;
		this.setModelHover(false);
		this.updateControlsAvailability();
		this.requestRender();
	}
	hitTestModel(clientX: number, clientY: number, target: EventTarget | null) {
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
		// raycast the remaining detailed meshes once one product surface was hit.
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
		if (this._modelHover === hover) return;

		this._modelHover = hover;
		this.updateControlsAvailability();
		this.requestRender();
	}
	updateControlsAvailability() {
		const enabled =
			this.canInteract &&
			!this._spaceMouseMoving &&
			(this._modelHover || this._modelInteractionActive);
		if (this._controls) {
			this._controls.enabled = enabled;
		}

		this.backgroundCanvas.style.cursor = this._modelInteractionActive
			? 'grabbing'
			: enabled
				? 'grab'
				: 'auto';
		this.backgroundCanvas.style.touchAction = enabled ? 'none' : 'pan-y';
	}
	getZoomFocusFactor() {
		if (!this._controls) return 0;
		const viewTargetDistance = this.camera.position.distanceTo(this._controls.target);
		const productCenterDistance = this.camera.position.distanceTo(this._initialControlsTarget);

		return getCameraZoomFocus(
			getCameraZoomReferenceDistance(viewTargetDistance, productCenterDistance),
			this.camera.fov,
			this._initialCameraFov,
			this._focusCloseDistance,
			this._focusRestDistance
		);
	}
	getZoomReferenceTarget() {
		if (!this._controls) return this._initialControlsTarget;

		const viewTargetDistance = this.camera.position.distanceTo(this._controls.target);
		const productCenterDistance = this.camera.position.distanceTo(this._initialControlsTarget);
		return productCenterDistance < viewTargetDistance
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
		return { controls, wheel };
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
