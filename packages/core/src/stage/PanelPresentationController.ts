import type { StagePanelRuntime } from './StagePanelRuntime.js';
import { parseRenderMeasurement } from './renderMeasurement.js';
import { dampAndSnap } from './damping.js';
import * as THREE from 'three/webgpu';
import { type CatalogTransitionPresentation } from '../catalog/catalogPresentation.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

import type { Object3D } from 'three';
import {
	MINIMAP_FOCUSED_VIEWPORT_INSET,
	MINIMAP_OVERLAY_REVEAL_DAMPING,
	PANEL_CONTENT_Z,
	PANEL_POINTER_DAMPING,
	PANEL_POINTER_MAX_LIFT
} from './stageConstants.js';
import {
	getMinimapFocusPositionOffset,
	getNativePanelDomPosition,
	getPanelFocusBlur,
	getPanelFocusOffset,
	getPanelFocusPerspectiveOffset,
	getPanelFocusOpacity,
	getPanelPointerInfluence,
	getPanelPointerRotation,
	getPerspectiveAnchoredPanelPosition,
	setPanelLocalPerspectiveMatrix
} from './stageMath.js';
import { getProjectiveCssMatrix3d, type CssProjectionQuad } from './minimap/MinimapProjection.js';
import type { StageMinimapState } from './minimap/MinimapState.js';
import type { StagePanelTarget } from './stageTypes.js';
const PANEL_NATIVE_REST_FRAMES = 2;
const PANEL_NATIVE_ROTATION_EPSILON = 0.000001;
const PANEL_NATIVE_DEPTH_EPSILON = 0.0001;
function getFlatCss3DTransform(matrix: THREE.Matrix4) {
	const elements = matrix.elements;
	const epsilon = (value: number) => (Math.abs(value) < 1e-10 ? 0 : value);

	// CSS3DRenderer flips the Y axis in its preserve-3d camera element. Frosted
	// surfaces live in a flat backdrop-capable layer, so fold that camera-axis
	// conversion into the object's final matrix instead.
	return `translate(-50%, -50%) matrix3d(${[
		elements[0],
		-elements[1],
		elements[2],
		elements[3],
		-elements[4],
		elements[5],
		-elements[6],
		-elements[7],
		elements[8],
		-elements[9],
		elements[10],
		elements[11],
		elements[12],
		-elements[13],
		elements[14],
		elements[15]
	]
		.map(epsilon)
		.join(',')})`;
}

export interface PanelPresentationPorts {
	camera: THREE.PerspectiveCamera;
	contentScene: THREE.Scene;
	flatLayer: HTMLElement;
	nativeLayer: HTMLElement;
	registrations(): readonly StagePanelTarget[];
	minimaps(): ReadonlyMap<number, StageMinimapState>;
	updateMinimap(minimap: StageMinimapState, focus: number): void;
	frame(): {
		presentation: CatalogTransitionPresentation;
		minimapFocus: number;
		uiFocus: number;
		pointer: Readonly<{ x: number; y: number; active: boolean }>;
	};
	visible(index: number): boolean;
	transitionOpacity(panel?: StagePanelRuntime): number;
	requestRender(): void;
}
/** Owns panel surfaces, hover and focus-safe DOM presentation independently of product loading. */
export class PanelPresentationController {
	private readonly fixedMinimapSize =
		parseRenderMeasurement(typeof window === 'undefined' ? '' : (window.location?.search ?? '')) ===
		'fixed-minimap-size';
	constructor(private readonly ports: PanelPresentationPorts) {}
	get runtimes(): ReadonlyArray<StagePanelRuntime> {
		return this.panelRuntimes;
	}
	get visiblePanels() {
		return this.visiblePanelCount;
	}
	get visibleMinimaps() {
		return this.visibleMinimapCount;
	}
	add(runtime: StagePanelRuntime) {
		this.panelRuntimes.push(runtime);
	}
	set(index: number, runtime: StagePanelRuntime) {
		this.panelRuntimes[index] = runtime;
	}
	release() {
		for (const runtime of this.panelRuntimes) {
			runtime.content?.removeFromParent();
			runtime.contentProjectionRoot?.removeFromParent();
			(runtime.projectionRoot ?? runtime.group).removeFromParent();
			runtime.glass?.dispose();
		}
		this.panelRuntimes.length = 0;
		for (const [element, home] of [...this.domHomes].reverse()) {
			if (home.next?.parentNode === home.parent) home.parent.insertBefore(element, home.next);
			else home.parent.appendChild(element);
			if (home.style === null) element.removeAttribute('style');
			else element.setAttribute('style', home.style);
			if (home.draggable === null) element.removeAttribute('draggable');
			else element.setAttribute('draggable', home.draggable);
			delete element.dataset.stagePanelRenderMode;
		}
		this.domHomes.clear();
	}
	private get panelCamera() {
		return this.ports.camera;
	}
	private get panelContentScene() {
		return this.ports.contentScene;
	}
	private get flatPanelLayer() {
		return this.ports.flatLayer;
	}
	private get nativePanelLayer() {
		return this.ports.nativeLayer;
	}
	private get panelTargets() {
		return this.ports.registrations();
	}
	private get minimaps() {
		return this.ports.minimaps();
	}
	private get catalogPresentation() {
		return this.ports.frame().presentation;
	}
	private get minimapFocus() {
		return this.ports.frame().minimapFocus;
	}
	private get panelUiFocus() {
		return this.ports.frame().uiFocus;
	}
	private get pointer() {
		return this.ports.frame().pointer;
	}
	private requestRender() {
		this.ports.requestRender();
	}
	private getPanelTransitionOpacity(panel?: StagePanelRuntime) {
		return this.ports.transitionOpacity(panel);
	}
	private isPanelTargetVisible(index: number) {
		return this.ports.visible(index);
	}
	private updateMinimapState(minimap: StageMinimapState, focus: number) {
		this.ports.updateMinimap(minimap, focus);
	}
	private readonly domHomes = new Map<
		HTMLElement,
		{ parent: Node; next: ChildNode | null; style: string | null; draggable: string | null }
	>();
	private readonly minimapCssLocalCorners = [
		new THREE.Vector3(),
		new THREE.Vector3(),
		new THREE.Vector3(),
		new THREE.Vector3()
	] as const;
	private readonly minimapCssProjectionCorners = [
		new THREE.Vector2(),
		new THREE.Vector2(),
		new THREE.Vector2(),
		new THREE.Vector2()
	] as const satisfies CssProjectionQuad;
	private readonly panelRuntimes: StagePanelRuntime[] = [];
	private visiblePanelCount = 0;
	private visibleMinimapCount = 0;
	rememberDomHome(element: HTMLElement) {
		if (!element.parentNode || this.domHomes.has(element)) return;
		this.domHomes.set(element, {
			parent: element.parentNode,
			next: element.nextSibling,
			style: element.getAttribute('style'),
			draggable: element.getAttribute('draggable')
		});
	}
	attachPanelContent(element: HTMLElement, panelIndex = 0, inset = 28) {
		this.rememberDomHome(element);
		const runtime = this.panelRuntimes[panelIndex];
		if (!runtime) {
			throw new Error(`No panel exists at index ${panelIndex}`);
		}

		this.updateContentElement(element, runtime, inset);
		element.dataset.stagePanelRenderMode = runtime.domRenderMode;
		element.style.zIndex = `${panelIndex}`;

		const object = new CSS3DObject(element);
		if (runtime.projectionRoot) {
			const projectionRoot = this.createPanelProjectionRoot(object);
			this.setPanelProjectionTransform(
				projectionRoot,
				runtime.options.position.x,
				runtime.options.position.y,
				PANEL_CONTENT_Z
			);
			runtime.contentProjectionRoot = projectionRoot;
			this.panelContentScene.add(projectionRoot);
		} else {
			object.position.set(runtime.options.position.x, runtime.options.position.y, PANEL_CONTENT_Z);
			this.panelContentScene.add(object);
		}
		object.updateMatrixWorld(true);
		element.style.transform = getFlatCss3DTransform(object.matrixWorld);
		runtime.content = object;
		this.requestRender();

		return object;
	}
	attachPanelSurface(element: HTMLElement, panelIndex: number, minimap = false) {
		this.rememberDomHome(element);
		const runtime = this.panelRuntimes[panelIndex];
		if (!runtime) {
			throw new Error(`No panel exists at index ${panelIndex}`);
		}

		this.updateSurfaceElement(
			element,
			runtime,
			runtime.options.width,
			runtime.options.height,
			minimap
		);
		element.dataset.stagePanelRenderMode = runtime.domRenderMode;
		element.style.zIndex = `${panelIndex}`;
		const object = new CSS3DObject(element);
		if (runtime.projectionRoot) {
			const projectionRoot = this.createPanelProjectionRoot(object);
			this.setPanelProjectionTransform(
				projectionRoot,
				runtime.options.position.x,
				runtime.options.position.y,
				PANEL_CONTENT_Z
			);
			runtime.contentProjectionRoot = projectionRoot;
		} else {
			object.position.set(runtime.options.position.x, runtime.options.position.y, PANEL_CONTENT_Z);
		}
		runtime.content = object;
		this.flatPanelLayer.appendChild(element);
		this.requestRender();

		return object;
	}
	updateContentElement(element: HTMLElement, runtime: StagePanelRuntime, inset = 28) {
		const contentInset = Math.max(inset, 0);
		element.style.width = `${Math.max(runtime.options.width - contentInset * 2, 1)}px`;
		element.style.height = `${Math.max(runtime.options.height - contentInset * 2, 1)}px`;
		element.style.boxSizing = 'border-box';
		element.style.left = '0';
		element.style.top = '0';
		element.style.pointerEvents = 'auto';
		element.style.userSelect = 'auto';
	}
	updateSurfaceElement(
		element: HTMLElement,
		runtime: StagePanelRuntime,
		width = runtime.options.width,
		height = runtime.options.height,
		projected = false
	) {
		const widthValue = `${Math.max(width, 1).toFixed(2)}px`;
		const heightValue = `${Math.max(height, 1).toFixed(2)}px`;
		if (element.style.width !== widthValue) element.style.width = widthValue;
		if (element.style.height !== heightValue) element.style.height = heightValue;
		element.style.boxSizing = 'border-box';
		// CSS3DObject also enforces absolute positioning. Keep every flat surface
		// out of normal flow so sibling panels cannot alter each other's projection.
		element.style.position = 'absolute';
		element.style.left = projected ? '0' : '50%';
		element.style.top = projected ? '0' : '50%';
		element.style.transformOrigin = projected ? '0 0' : '';
		element.style.pointerEvents = 'auto';
		element.style.userSelect = 'auto';
	}
	createPanelProjectionRoot(child: Object3D) {
		const root = new THREE.Group();
		root.matrixAutoUpdate = false;
		child.position.set(0, 0, 0);
		root.add(child);
		return root;
	}
	setPanelProjectionTransform(
		root: THREE.Group,
		targetX: number,
		targetY: number,
		targetZ: number
	) {
		setPanelLocalPerspectiveMatrix(
			root.matrix,
			targetX,
			targetY,
			targetZ,
			this.panelCamera.position.z
		);
		root.matrixWorldNeedsUpdate = true;
	}
	getPanelPointerLayout(
		panel: StagePanelRuntime,
		index: number,
		viewportWidth: number,
		viewportHeight: number,
		uiFocus: number
	) {
		const minimap = this.minimaps.get(index);
		const baseX = panel.options.position.x;
		const baseY = panel.options.position.y;
		const baseWidth = minimap ? minimap.baseWidth : panel.options.width;
		const baseHeight = minimap ? minimap.baseHeight : panel.options.height;
		const minimapFocus = minimap ? this.minimapFocus : 0;
		const expansion =
			minimap && !this.fixedMinimapSize
				? THREE.MathUtils.lerp(1, minimap.options.expandedHeight / minimap.baseHeight, minimapFocus)
				: 1;
		const visualWidth = baseWidth * expansion;
		const visualHeight = baseHeight * expansion;
		const rawFocusOffset = getPanelFocusOffset(
			panel.options,
			uiFocus,
			viewportWidth,
			viewportHeight
		);
		const focusDepth = minimap ? rawFocusOffset.z * 0.12 : rawFocusOffset.z;
		const minimapProjectionScale = minimap
			? this.panelCamera.position.z / Math.max(this.panelCamera.position.z - focusDepth, 1)
			: 1;
		const minimapPositionOffset = minimap
			? getMinimapFocusPositionOffset(
					{ x: baseX, y: baseY },
					{ width: minimap.baseWidth, height: minimap.baseHeight },
					{
						width: visualWidth * minimapProjectionScale,
						height: visualHeight * minimapProjectionScale
					},
					{ width: viewportWidth, height: viewportHeight },
					minimapFocus,
					MINIMAP_FOCUSED_VIEWPORT_INSET
				)
			: undefined;
		const focusPerspectiveOffset = minimap
			? undefined
			: getPanelFocusPerspectiveOffset(
					{
						x: baseX + rawFocusOffset.x,
						y: baseY + rawFocusOffset.y
					},
					focusDepth,
					this.panelCamera.position.z
				);
		const focusOffset = minimap
			? {
					x: minimapPositionOffset?.x ?? 0,
					y: minimapPositionOffset?.y ?? 0,
					z: focusDepth
				}
			: {
					x: rawFocusOffset.x + (focusPerspectiveOffset?.x ?? 0),
					y: rawFocusOffset.y + (focusPerspectiveOffset?.y ?? 0),
					z: focusDepth
				};

		return {
			baseX,
			baseY,
			centerX: viewportWidth * 0.5 + baseX + focusOffset.x,
			centerY: viewportHeight * 0.5 - (baseY + focusOffset.y),
			focusOffset,
			minimap,
			minimapFocus,
			visualHeight,
			visualWidth,
			viewportVisible: this.isPanelTargetVisible(index)
		};
	}
	updatePanelPointerInteraction(delta: number) {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const uiFocus = this.panelUiFocus;
		const focusOpacity = getPanelFocusOpacity(uiFocus);
		const layouts = this.panelRuntimes.map((panel, index) =>
			this.getPanelPointerLayout(panel, index, viewportWidth, viewportHeight, uiFocus)
		);
		let animationActive = false;
		this.visiblePanelCount = 0;
		this.visibleMinimapCount = 0;

		this.panelRuntimes.forEach((panel, index) => {
			const {
				baseX,
				baseY,
				centerX,
				centerY,
				focusOffset,
				minimap,
				minimapFocus,
				visualHeight,
				visualWidth,
				viewportVisible
			} = layouts[index];
			const transitionOpacity = this.getPanelTransitionOpacity(panel);
			const transitionBlocked = this.catalogPresentation.active && Boolean(panel.transitionGroup);
			if (viewportVisible) this.visiblePanelCount += 1;
			if (minimap) {
				minimap.viewportVisible = viewportVisible;
				minimap.layer.visible = viewportVisible && transitionOpacity > 0.001;
				if (viewportVisible) this.visibleMinimapCount += 1;
			}
			if (minimap) {
				// The camera distance is already damped. Applying another size damping
				// would make the minimap trail behind the geometry and miss its phase endpoint.
				minimap.currentWidth = visualWidth;
				minimap.currentHeight = visualHeight;
				panel.glass?.setVisualSize(minimap.currentWidth, minimap.currentHeight, minimap.baseRadius);
				panel.group.scale.x = dampAndSnap(
					panel.group.scale.x,
					1,
					PANEL_POINTER_DAMPING,
					delta,
					0.0001
				);
				panel.group.scale.y = dampAndSnap(
					panel.group.scale.y,
					1,
					PANEL_POINTER_DAMPING,
					delta,
					0.0001
				);
			} else {
				panel.group.scale.x = dampAndSnap(
					panel.group.scale.x,
					1,
					PANEL_POINTER_DAMPING,
					delta,
					0.0001
				);
				panel.group.scale.y = dampAndSnap(
					panel.group.scale.y,
					1,
					PANEL_POINTER_DAMPING,
					delta,
					0.0001
				);
			}
			panel.group.scale.z = dampAndSnap(
				panel.group.scale.z,
				1,
				PANEL_POINTER_DAMPING,
				delta,
				0.0001
			);
			animationActive ||= panel.group.scale.x !== 1;
			animationActive ||= panel.group.scale.y !== 1;
			animationActive ||= panel.group.scale.z !== 1;

			const halfWidth = visualWidth * 0.5;
			const halfHeight = visualHeight * 0.5;
			const focusBlur = getPanelFocusBlur(uiFocus, panel.options);
			let targetX = 0;
			let targetY = 0;
			let targetPointerLift = 0;
			let pointerInfluence = 0;

			if (panel.pointerReactive && this.pointer.active && viewportVisible && !transitionBlocked) {
				const pointerX = this.pointer.x - centerX;
				const pointerY = this.pointer.y - centerY;
				const outsideX = Math.max(Math.abs(pointerX) - halfWidth, 0);
				const outsideY = Math.max(Math.abs(pointerY) - halfHeight, 0);
				const distance = Math.hypot(outsideX, outsideY);
				const influence = getPanelPointerInfluence(distance, visualWidth, visualHeight);
				pointerInfluence = influence;
				const lookX = THREE.MathUtils.clamp(pointerX / halfWidth, -1, 1);
				const lookY = THREE.MathUtils.clamp(pointerY / halfHeight, -1, 1);
				const rotation = getPanelPointerRotation(
					lookX,
					lookY,
					influence,
					visualWidth,
					visualHeight
				);

				targetX = rotation.x;
				targetY = rotation.y;
				targetPointerLift = PANEL_POINTER_MAX_LIFT * influence;
			}
			panel.pointerLift = dampAndSnap(
				panel.pointerLift,
				targetPointerLift,
				PANEL_POINTER_DAMPING,
				delta,
				0.01
			);
			animationActive ||= panel.pointerLift !== targetPointerLift;
			const pointerProximity = THREE.MathUtils.clamp(
				PANEL_POINTER_MAX_LIFT > 0 ? panel.pointerLift / PANEL_POINTER_MAX_LIFT : 0,
				0,
				1
			);
			const panelOpacity = minimap ? 1 : focusOpacity;
			const surfaceOpacity = THREE.MathUtils.clamp(
				this.panelTargets[index]?.getSurfaceOpacity?.() ?? 1,
				0,
				1
			);
			panel.glass?.setVisibilityAlpha(panelOpacity * surfaceOpacity * transitionOpacity);
			panel.group.visible = panel.glass ? panel.group.visible && viewportVisible : viewportVisible;
			if (panel.surface !== 'glass') {
				const surfaceElement = this.panelTargets[index]?.surfaceElement;
				if (surfaceElement) {
					const opacityValue = surfaceOpacity.toFixed(4);
					if (
						surfaceElement.style.getPropertyValue('--stage-panel-surface-opacity') !== opacityValue
					) {
						surfaceElement.style.setProperty('--stage-panel-surface-opacity', opacityValue);
					}
					if (minimap) {
						this.updateSurfaceElement(
							surfaceElement,
							panel,
							minimap.currentWidth,
							minimap.currentHeight,
							true
						);
					}
					const focusOpacityValue = panelOpacity.toFixed(4);
					if (
						surfaceElement.style.getPropertyValue('--stage-panel-focus-opacity') !==
						focusOpacityValue
					) {
						surfaceElement.style.setProperty('--stage-panel-focus-opacity', focusOpacityValue);
					}
				}
			}
			animationActive =
				this.easePanelTransform(
					panel.group,
					targetX,
					targetY,
					baseX + focusOffset.x,
					baseY + focusOffset.y,
					focusOffset.z + panel.pointerLift,
					delta,
					panel.projectionRoot
				) || animationActive;

			if (minimap) {
				minimap.pointerReveal = dampAndSnap(
					minimap.pointerReveal,
					pointerInfluence,
					MINIMAP_OVERLAY_REVEAL_DAMPING,
					delta,
					0.001
				);
				animationActive ||= minimap.pointerReveal !== pointerInfluence;
				minimap.layer.position.copy(panel.group.position);
				minimap.layer.rotation.copy(panel.group.rotation);
				minimap.layer.scale.copy(panel.group.scale);
				// All minimap layers use the same atomic panel pose so the glass, viewport
				// ring, and floating model cannot drift apart during zoom.
				if (viewportVisible) this.updateMinimapState(minimap, minimapFocus);
			}

			const contentObject = panel.content;
			if (contentObject) {
				const contentOpacity = minimap ? 1 : focusOpacity;
				const contentBlur = minimap ? 0 : focusBlur;
				const interactiveContent =
					panel.surface === 'glass'
						? contentObject.element
						: (this.panelTargets[index]?.content ?? contentObject.element);
				const pointerProximityValue = pointerProximity.toFixed(4);
				if (
					interactiveContent.style.getPropertyValue('--stage-panel-pointer-proximity') !==
					pointerProximityValue
				) {
					interactiveContent.style.setProperty(
						'--stage-panel-pointer-proximity',
						pointerProximityValue
					);
				}
				// Shared destinations must remain measurable while their transition alpha is zero.
				// CSS visibility/opacity gate their paint; CSS3D visibility would set display:none.
				contentObject.visible = viewportVisible && contentOpacity >= 0.01;
				contentObject.element.style.setProperty(
					'--stage-panel-content-opacity',
					`${contentOpacity}`
				);
				if (panel.surface !== 'glass') {
					// Keep filter off the shell that owns backdrop-filter. Applying it
					// there turns the shell into a Backdrop Root in Chromium.
					contentObject.element.style.filter = '';
				}
				interactiveContent.style.filter =
					contentBlur > 0.05 ? `blur(${contentBlur.toFixed(2)}px)` : '';
				const pointerEvents =
					transitionBlocked || contentOpacity * transitionOpacity < 0.12 ? 'none' : 'auto';
				contentObject.element.style.pointerEvents = pointerEvents;
				interactiveContent.style.pointerEvents = pointerEvents;
				animationActive =
					this.easePanelTransform(
						contentObject,
						targetX,
						targetY,
						baseX + focusOffset.x,
						baseY + focusOffset.y,
						PANEL_CONTENT_Z + focusOffset.z + panel.pointerLift,
						delta,
						panel.contentProjectionRoot
					) || animationActive;
			}
		});

		return animationActive;
	}
	easePanelTransform(
		object: Object3D,
		targetRotationX: number,
		targetRotationY: number,
		targetX: number,
		targetY: number,
		targetZ: number,
		delta: number,
		projectionRoot?: THREE.Group
	) {
		object.rotation.x = dampAndSnap(
			object.rotation.x,
			targetRotationX,
			PANEL_POINTER_DAMPING,
			delta,
			0.00005
		);
		object.rotation.y = dampAndSnap(
			object.rotation.y,
			targetRotationY,
			PANEL_POINTER_DAMPING,
			delta,
			0.00005
		);
		if (projectionRoot) {
			object.position.set(0, 0, 0);
			this.setPanelProjectionTransform(projectionRoot, targetX, targetY, targetZ);
		} else {
			const anchoredPosition = getPerspectiveAnchoredPanelPosition(
				targetX,
				targetY,
				targetZ,
				this.panelCamera.position.z
			);
			// Commit the complete focus pose together. Independently damping Z and then
			// deriving X/Y from that lagging depth caused projected panels to overshoot
			// and briefly reverse direction during close-up transitions.
			object.position.set(anchoredPosition.x, anchoredPosition.y, targetZ);
		}

		return object.rotation.x !== targetRotationX || object.rotation.y !== targetRotationY;
	}
	updatePanelDomRenderModes() {
		let transitionPending = false;

		this.panelRuntimes.forEach((panel, index) => {
			const content = panel.content;
			const projectionRoot = panel.contentProjectionRoot;
			if (!content || !projectionRoot || this.minimaps.has(index)) {
				panel.nativeRestFrames = 0;
				this.setPanelDomRenderMode(panel, 'spatial');
				return;
			}

			const rotationAtRest =
				Math.abs(content.rotation.x) <= PANEL_NATIVE_ROTATION_EPSILON &&
				Math.abs(content.rotation.y) <= PANEL_NATIVE_ROTATION_EPSILON &&
				Math.abs(content.rotation.z) <= PANEL_NATIVE_ROTATION_EPSILON;
			const depthAtRest =
				Math.abs(projectionRoot.matrix.elements[14] - PANEL_CONTENT_Z) <=
				PANEL_NATIVE_DEPTH_EPSILON;

			if (!rotationAtRest || !depthAtRest) {
				panel.nativeRestFrames = 0;
				this.setPanelDomRenderMode(panel, 'spatial');
				return;
			}

			panel.nativeRestFrames = Math.min(panel.nativeRestFrames + 1, PANEL_NATIVE_REST_FRAMES);
			if (panel.nativeRestFrames >= PANEL_NATIVE_REST_FRAMES) {
				this.setPanelDomRenderMode(panel, 'native');
			} else if (panel.domRenderMode !== 'native') {
				transitionPending = true;
			}
		});

		return transitionPending;
	}
	setPanelDomRenderMode(panel: StagePanelRuntime, mode: 'native' | 'spatial') {
		if (!panel.content || panel.domRenderMode === mode) return;

		panel.domRenderMode = mode;
		const element = panel.content.element;
		const focused = element.contains(document.activeElement)
			? (document.activeElement as HTMLElement)
			: undefined;
		const restoreFocus = () => {
			if (focused?.isConnected && document.activeElement !== focused)
				focused.focus({ preventScroll: true });
		};
		element.dataset.stagePanelRenderMode = mode;

		if (mode === 'native') {
			if (panel.surface === 'glass') {
				(panel.contentProjectionRoot ?? panel.content).removeFromParent();
			}
			this.nativePanelLayer.appendChild(element);
			restoreFocus();
			return;
		}

		element.style.transform = '';
		element.style.transformOrigin = '';
		if (panel.surface === 'glass') {
			element.style.left = '0';
			element.style.top = '0';
			const contentRoot = panel.contentProjectionRoot ?? panel.content;
			if (contentRoot.parent !== this.panelContentScene) this.panelContentScene.add(contentRoot);
		} else {
			element.style.left = '50%';
			element.style.top = '50%';
			this.flatPanelLayer.appendChild(element);
		}
		restoreFocus();
	}
	renderFlatPanelSurfaces() {
		this.panelRuntimes.forEach((panel, index) => {
			if (!panel.content || (panel.surface === 'glass' && panel.domRenderMode === 'spatial'))
				return;

			const { content } = panel;
			content.element.style.display = content.visible ? '' : 'none';
			if (!content.visible) return;

			panel.contentProjectionRoot?.updateMatrixWorld(true);
			content.updateMatrixWorld(true);
			const minimap = this.minimaps.get(index);
			if (minimap) {
				this.renderFlatMinimapSurface(
					content.element,
					minimap,
					minimap.currentWidth,
					minimap.currentHeight
				);
				return;
			}
			if (panel.domRenderMode === 'native') {
				this.renderNativePanelSurface(panel);
				return;
			}
			content.element.style.transform = getFlatCss3DTransform(content.matrixWorld);
		});
	}
	renderNativePanelSurface(panel: StagePanelRuntime) {
		const content = panel.content;
		if (!content) return;

		panel.contentProjectionRoot?.updateMatrixWorld(true);
		content.updateMatrixWorld(true);
		const element = content.element;
		const width = Number.parseFloat(element.style.width) || element.offsetWidth;
		const height = Number.parseFloat(element.style.height) || element.offsetHeight;
		const matrix = content.matrixWorld.elements;
		const position = getNativePanelDomPosition(
			{ x: matrix[12], y: matrix[13] },
			{ width, height },
			{ width: window.innerWidth, height: window.innerHeight },
			window.devicePixelRatio
		);

		element.style.left = `${position.left}px`;
		element.style.top = `${position.top}px`;
		element.style.transform = 'none';
		element.style.transformOrigin = '0 0';
	}
	renderFlatMinimapSurface(
		element: HTMLElement,
		minimap: StageMinimapState,
		panelWidth: number,
		panelHeight: number
	) {
		const halfWidth = panelWidth * 0.5;
		const halfHeight = panelHeight * 0.5;
		const viewportWidth = Math.max(window.innerWidth, 1);
		const viewportHeight = Math.max(window.innerHeight, 1);
		const localCorners = this.minimapCssLocalCorners;
		const projectedCorners = this.minimapCssProjectionCorners;
		localCorners[0].set(-halfWidth, halfHeight, 0);
		localCorners[1].set(halfWidth, halfHeight, 0);
		localCorners[2].set(halfWidth, -halfHeight, 0);
		localCorners[3].set(-halfWidth, -halfHeight, 0);

		const offsetLeft = element.offsetLeft;
		const offsetTop = element.offsetTop;
		localCorners.forEach((corner, index) => {
			corner.applyMatrix4(minimap.layer.matrixWorld).project(minimap.screenCamera);
			projectedCorners[index].set(
				(corner.x + 1) * viewportWidth * 0.5 - offsetLeft,
				(1 - corner.y) * viewportHeight * 0.5 - offsetTop
			);
		});

		const cssWidth = Number.parseFloat(element.style.width) || panelWidth;
		const cssHeight = Number.parseFloat(element.style.height) || panelHeight;
		const transform = getProjectiveCssMatrix3d(projectedCorners, cssWidth, cssHeight);
		if (transform) element.style.transform = transform;
	}
}
