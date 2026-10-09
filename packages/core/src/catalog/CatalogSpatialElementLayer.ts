import { CatalogGeometryFade } from './CatalogGeometryFade.js';
import { cardModelFit } from './cardModelFit.js';
import { CatalogDepthBlur, type BlurRect } from './CatalogDepthBlur.js';
import { CatalogModelOutline } from './CatalogModelOutline.js';
import { DEFAULT_INTERACTION_THEME } from '../stage/stageConstants.js';
import type { StageInteractionTheme } from '../stage/stageTypes.js';
import { recordCarouselPanel } from './carouselPanelProjection.js';
import type { SpatialElementProjection } from './SpatialGeometryCapture.js';
import { prepareSpatialElementFrame } from '../stage/spatialElementFrame.js';
import type { SpatialElementRefinement } from '../stage/SpatialElementRefinement.js';
import { resolveSpatialElementLodPair } from './spatialElementLodPair.js';
import * as THREE from 'three/webgpu';
import type { SpatialListItem } from '../spatial-element/types.js';
import { getSpatialElementScene, hasSpatialElementScene, type SpatialElementScene } from '../spatial-element/spatialElementScene.js';
import { getStageVisualScrollPosition } from '../stage/scrollFrame.js';
import {
	getCameraOrbitQuaternion,
	getPanelPointerInfluence,
	getPanelPointerRotation,
	setPanelLocalPerspectiveMatrix
} from '../stage/stageMath.js';
import {
	applyModelMaterialOverrides,
	centerAndScale,
	getMeshBounds,
	getMeshMaterials,
	isMesh
} from '../stage/stageSceneUtils.js';
import { SpatialElementAssetManager, type SpatialElementAssetInstance } from './assets/SpatialElementAssetManager.js';
import { getSpatialElementEntityKey } from './spatialElementAssets.js';
import { applyCatalogMaterialOpacity, captureCatalogMaterialOpacity } from './catalogPresentation.js';
import { CATALOG_POSE_CHANGED, type CatalogPoseProvider } from './catalogPose.js';
import { getProjectiveCssMatrix3d, type CssProjectionQuad } from '../stage/cssProjection.js';
import { CarouselGlassCompositor } from './CarouselGlassCompositor.js';

interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface CatalogActor {
	key: string;
	brandId: string;
	spatialElementId: string;
	occurrence?: string;
	pose?: CatalogPoseProvider;
	clip?: Rect;
	band?: 'front' | 'rear';
	stage: SpatialElementScene;
	instance: SpatialElementAssetInstance;
	model: THREE.Group;
	root: THREE.Group;
	tilt: THREE.Group;
	view: THREE.Group;
	radius: number;
	hitCorners: THREE.Vector3[];
	fitCorners: THREE.Vector3[];
	cardScale: number;
	hover: number;
	blur?: number;
	renderRect?: BlurRect;
	referencePoint: THREE.Vector3;
	overrides: Set<THREE.Material>;
	materials: ReturnType<typeof captureCatalogMaterialOpacity>;
	card?: HTMLElement;
	slot?: HTMLElement;
	cardRect?: Rect;
	slotRect?: Rect;
	hitTarget?: HTMLElement;
	summaryPanel?: HTMLElement;
	summarySize?: { width: number; height: number };
	summaryOrigin?: { x: number; y: number };
	scrollX: number;
	scrollY: number;
	rotationX: number;
	rotationY: number;
	lift: number;
	rendered: boolean;
}

interface Handoff {
	sourceEnvironmentIntensity: number;
	sourceEnvironment: THREE.Texture | null;
	high?: THREE.Object3D;
	blend?: SpatialElementRefinement;
	blendProgress?: number;
	highEnvironment?: THREE.Texture;
	actor: CatalogActor;
	sourceClip: THREE.Matrix4;
	sourceModel: THREE.Matrix4;
	sourceCamera: THREE.Matrix4;
	target?: {
		camera: THREE.PerspectiveCamera;
		model: THREE.Object3D;
		progress: number;
		environmentIntensity?: number;
	};
}

/** Removes irrelevant homogeneous scale so the reference point follows a continuous screen path. */
export function normalizeSpatialElementClipMatrix(matrix: THREE.Matrix4, point: THREE.Vector3) {
	const clip = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(matrix);
	if (clip.w > 0.000001) matrix.multiplyScalar(1 / clip.w);
	return matrix;
}

/** Factor camera-relative rotation out of clip space before interpolating framing.
 * Interpolating complete MVP matrices collapses opposite rotations into a flat image.
 * Residual matrices retain authored shear and exact endpoint projections.
 */
export function getSpatialElementHandoffProjection(
	sourceClip: THREE.Matrix4,
	targetClip: THREE.Matrix4,
	progress: number,
	modelWorld: THREE.Matrix4,
	cameraWorld: THREE.Matrix4,
	poses: {
		sourceModel: THREE.Matrix4;
		sourceCamera: THREE.Matrix4;
		targetModel: THREE.Matrix4;
		targetCamera: THREE.Matrix4;
		reference?: THREE.Vector3;
	},
	target = new THREE.Matrix4()
) {
	const t = THREE.MathUtils.clamp(progress, 0, 1);
	const rotation = (model: THREE.Matrix4, camera: THREE.Matrix4) => {
		const q = new THREE.Quaternion();
		camera.clone().invert().multiply(model).decompose(new THREE.Vector3(), q, new THREE.Vector3());
		return q.normalize();
	};
	const from = rotation(poses.sourceModel, poses.sourceCamera);
	const to = rotation(poses.targetModel, poses.targetCamera);
	const a = sourceClip
		.clone()
		.multiply(new THREE.Matrix4().makeRotationFromQuaternion(from.clone().invert()));
	const b = targetClip
		.clone()
		.multiply(new THREE.Matrix4().makeRotationFromQuaternion(to.clone().invert()));
	for (let i = 0; i < 16; i++)
		target.elements[i] = THREE.MathUtils.lerp(a.elements[i], b.elements[i], t);
	target.multiply(new THREE.Matrix4().makeRotationFromQuaternion(from.slerp(to, t)));
	// Keep the framing anchor on its screen path even for an off-centre asset pivot.
	const point = poses.reference ?? new THREE.Vector3();
	const project = (matrix: THREE.Matrix4) =>
		new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(matrix);
	const start = project(sourceClip),
		end = project(targetClip),
		current = project(target);
	const dx = THREE.MathUtils.lerp(start.x / start.w, end.x / end.w, t) - current.x / current.w;
	const dy = THREE.MathUtils.lerp(start.y / start.w, end.y / end.w, t) - current.y / current.w;
	target.premultiply(new THREE.Matrix4().makeTranslation(dx, dy, 0));
	return target.multiply(modelWorld.clone().invert()).multiply(cameraWorld);
}

/** Lightweight catalog geometry sharing the stage's renderer and foreground canvas. */
export class CatalogSpatialElementLayer {
	getRenderTargets() {
		return [
			...this.outline.getRenderTargets(),
			...this.depthBlur.getRenderTargets(),
			...this.glass.getRenderTargets(),
			...this.geometryFade.getRenderTargets(),
			...(this.handoff?.blend?.getRenderTargets() ?? [])
		];
	}
	private readonly scene = new THREE.Scene();
	private passes = 0;
	getStats() {
		return {
			instances: this.actors.size,
			detachedInstances: this.detachedInstances,
			visible: [...this.actors.values()].filter((actor) => actor.root.visible).length,
			passes: this.passes,
			glass: this.glass.getStats(),
			depthBlur: this.depthBlur.getStats(),
			outline: this.outline.getStats(),
			actors: [...this.actors.values()].map((actor) => ({
				spatialElementId: actor.spatialElementId,
				band: actor.band,
				clip: actor.clip ? { ...actor.clip } : undefined,
				opacity: this.exitOpacity * (actor.materials[0]?.material.opacity ?? 0),
				materialOpacity: actor.materials[0]?.material.opacity ?? 0,
				depthWrite: actor.materials[0]?.material.depthWrite,
				modelScale: actor.view.scale.x, modelDepth: actor.view.position.z,
				blur: actor.blur ?? 0,
				hover: actor.hover
			}))
		};
	}
	private readonly depthBlur = new CatalogDepthBlur();
	private readonly outline = new CatalogModelOutline();
	private readonly glass = new CarouselGlassCompositor(this.depthBlur);
	private readonly geometryFade = new CatalogGeometryFade();
	private readonly handoffScene = new THREE.Scene();
	private readonly camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
	// The carousel sits ~2500 units from the lens. A near plane of 1 wastes depth
	// precision and makes closely spaced CAD surfaces fight after the longer-lens change.
	private readonly carouselCamera = new THREE.PerspectiveCamera(45, 1, 250, 6000);
	private readonly carouselFog = new THREE.Fog(0xffffff, 2700, 4000);
	private readonly handoffCamera = new THREE.PerspectiveCamera();
	private readonly actors = new Map<string, CatalogActor>();
	private readonly requests = new Set<AbortController>();
	private readonly desired = new Set<string>();
	private readonly spatialElements = new Map<string, { brandId: string; spatialElement: SpatialListItem }>();
	private readonly loadingKeys = new Set<string>();
	private readonly failedKeys = new Set<string>();
	private readonly motion = window.matchMedia('(prefers-reduced-motion: reduce)');
	private readonly pointer = { x: 0, y: 0, active: false, pressed: false };
	private handoff?: Handoff;
	private handoffPoint?: { x: number; y: number };
	private generation = 0;
	private disposed = false;
	private layoutDirty = true;
	private layoutObserver = new ResizeObserver(() => this.resize());
	private queueDirty = true;
	private lastScrollX = Number.NaN;
	private lastScrollY = Number.NaN;
	private lastTime = 0;
	private exitOpacity = 1;
	private transitionActive = false;
	private destinationSpatialElement?: string;
	private destinationOccurrences = new Set<string>();
	private detachedInstances = 0;
	private readonly pointerMove = (event: PointerEvent) => {
		if (event.pointerType !== 'mouse') {
			this.pointerLeave();
			return;
		}
		if (this.pointer.active && this.pointer.x === event.clientX && this.pointer.y === event.clientY)
			return;
		this.pointer.x = event.clientX;
		this.pointer.y = event.clientY;
		this.pointer.active = true;
		this.invalidate();
	};
	private readonly pointerDown = (event: PointerEvent) => {
		if (event.pointerType !== 'mouse') this.pointerLeave();
		this.pointer.pressed = true;
		this.invalidate();
	};
	private readonly pointerUp = () => {
		this.pointer.pressed = false;
		this.invalidate();
	};
	private readonly pointerLeave = () => {
		if (!this.pointer.active) return;
		this.pointer.active = false;
		this.pointer.pressed = false;
		this.invalidate();
	};
	private readonly resize = () => {
		this.layoutDirty = true;
		this.queueDirty = true;
		this.invalidate();
	};
	private readonly motionChange = () => this.invalidate();
	setPageBackground(value: string) {
		(this.scene.fog as THREE.Fog).color.set(value);
		this.carouselFog.color.set(value);
		this.invalidate();
	}

	constructor(
		private readonly assets: SpatialElementAssetManager,
		private readonly invalidate: () => void,
		private readonly interactionTheme: () => StageInteractionTheme = () => DEFAULT_INTERACTION_THEME
	) {
		this.scene.environmentIntensity = 0.5;
		this.scene.fog = new THREE.Fog(0xffffff, 1200, 2500);
		this.handoffScene.fog = this.scene.fog;
		this.handoffScene.environmentIntensity = 0.5;
		this.carouselCamera.position.z = 2500;
		this.carouselCamera.updateMatrixWorld();
		this.camera.position.z = 1000;
		this.camera.updateMatrixWorld();
		window.addEventListener('pointermove', this.pointerMove, { passive: true });
		window.addEventListener('pointerdown', this.pointerDown, { capture: true, passive: true });
		window.addEventListener('pointerup', this.pointerUp, { passive: true });
		window.addEventListener('pointercancel', this.pointerUp, { passive: true });
		window.addEventListener('focusin', this.motionChange);
		window.addEventListener('focusout', this.motionChange);
		window.addEventListener('pointerleave', this.pointerLeave);
		window.addEventListener('blur', this.pointerLeave);
		window.addEventListener('resize', this.resize);
		this.motion.addEventListener('change', this.motionChange);
		window.addEventListener(CATALOG_POSE_CHANGED, this.motionChange);
	}

	async setSpatialElements(brandId: string, spatialElements: SpatialListItem[]) {
		if (this.disposed) return;
		const generation = ++this.generation;
		this.layoutObserver.disconnect();
		const page = document.querySelector('[data-catalog-list]');
		if (page) {
			this.layoutObserver.observe(page);
			for (const section of page.querySelectorAll('section')) this.layoutObserver.observe(section);
		}
		for (const request of this.requests) request.abort();
		this.requests.clear();
		this.loadingKeys.clear();
		this.failedKeys.clear();
		this.desired.clear();
		this.spatialElements.clear();
		for (const spatialElement of spatialElements) {
			if (!hasSpatialElementScene(spatialElement)) continue;
			const key = JSON.stringify([
				getSpatialElementEntityKey(brandId, spatialElement.id),
				spatialElement.occurrence ?? null
			]);
			this.desired.add(key);
			this.spatialElements.set(key, { brandId, spatialElement });
		}
		for (const actor of this.actors.values()) {
			const nextElement = this.spatialElements.get(actor.key)?.spatialElement;
			actor.pose = nextElement?.pose ?? actor.pose;
			if (this.handoff && actor.rendered) continue;
			if (
				this.handoff?.actor !== actor &&
				(!this.desired.has(actor.key) ||
					JSON.stringify(actor.stage) !==
						JSON.stringify(nextElement && hasSpatialElementScene(nextElement) ? getSpatialElementScene(nextElement) : undefined))
			)
				this.disposeActor(actor);
		}
		this.layoutDirty = true;
		this.queueDirty = false;
		await this.loadVisibleSpatialElements(generation);
		this.invalidate();
	}

	private async loadVisibleSpatialElements(generation: number) {
		if (this.disposed || generation !== this.generation) return;
		const remaining = Math.min(
			2 - this.requests.size,
			16 - this.actors.size - this.detachedInstances - this.requests.size
		);
		if (remaining <= 0) return;
		const candidates = [...this.spatialElements.entries()]
			.filter(([key, { brandId, spatialElement }]) => {
				if (this.actors.has(key) || this.loadingKeys.has(key) || this.failedKeys.has(key))
					return false;
				const list = document.querySelector<HTMLElement>(
					`[data-catalog-list][data-brand-id="${CSS.escape(brandId)}"]`
				);
				const slot = list?.querySelector<HTMLElement>(
					`[data-catalog-geometry][data-spatial-element-id="${CSS.escape(spatialElement.id)}"]${spatialElement.occurrence ? `[data-catalog-occurrence="${CSS.escape(spatialElement.occurrence)}"]` : ''}`
				);
				const rect = slot?.getBoundingClientRect();
				return (
					rect &&
					rect.top < window.innerHeight + 300 &&
					rect.bottom > -300 &&
					rect.left < window.innerWidth &&
					rect.right > 0
				);
			})
			.slice(0, remaining);
		if (!candidates.length) return;
		await Promise.all(
			candidates.map(async ([key, { brandId, spatialElement }]) => {
				if (!hasSpatialElementScene(spatialElement)) return;
				const request = new AbortController();
				this.requests.add(request);
				this.loadingKeys.add(key);
				const lease = this.assets.acquire(
					getSpatialElementScene(spatialElement).lodPair!.low,
					{ signal: request.signal }
				);
				let instance: SpatialElementAssetInstance | undefined;
				try {
					instance = await lease.createInstance();
					if (this.disposed || generation !== this.generation) {
						instance.dispose();
						return;
					}
					const actor = this.createActor(key, brandId, spatialElement.id, getSpatialElementScene(spatialElement), instance);
					actor.occurrence = spatialElement.occurrence;
					actor.pose = spatialElement.pose;
					this.actors.set(key, actor);
					this.scene.add(actor.root);
					this.layoutDirty = true;
					this.invalidate();
				} catch (error) {
					instance?.dispose();
					if (!(error instanceof DOMException && error.name === 'AbortError')) {
						if (generation === this.generation) this.failedKeys.add(key);
						console.warn(`Catalog preview unavailable for ${spatialElement.id}`, error);
					}
				} finally {
					lease.release();
					this.requests.delete(request);
					if (generation === this.generation) this.loadingKeys.delete(key);
				}
			})
		);
		await this.loadVisibleSpatialElements(generation);
	}

	update(renderer: THREE.WebGPURenderer, environment: THREE.Texture | null, now: number) {
		if (this.disposed) return false;
		const width = Math.max(window.innerWidth, 1);
		const height = Math.max(window.innerHeight, 1);
		this.camera.coordinateSystem = renderer.coordinateSystem;
		this.camera.aspect = width / height;
		this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / 2000));
		this.camera.updateProjectionMatrix();
		this.carouselCamera.coordinateSystem = renderer.coordinateSystem;
		this.carouselCamera.aspect = width / height;
		this.carouselCamera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / 5000));
		this.carouselCamera.updateProjectionMatrix();
		this.scene.environment = environment;
		this.handoffScene.environment = this.handoff?.sourceEnvironment ?? environment;
		const scroll = getStageVisualScrollPosition();
		if (scroll.scrollX !== this.lastScrollX || scroll.scrollY !== this.lastScrollY) {
			this.lastScrollX = scroll.scrollX;
			this.lastScrollY = scroll.scrollY;
			this.queueDirty = true;
		}
		if (this.layoutDirty) this.measureActors(scroll.scrollX, scroll.scrollY);
		const delta = Math.min(this.lastTime ? (now - this.lastTime) / 1000 : 1 / 60, 0.05);
		this.lastTime = now;
		let animating = false;
		this.glass.beginFrame();

		for (const actor of this.actors.values()) {
			if (this.handoff?.actor === actor) continue;
			if (this.handoff) {
				// The outgoing DOM has been snapshotted. Keep these already-rendered
				// spatialElements at their captured screen pose until the shared fade completes.
				actor.root.visible = actor.rendered && actor.root.visible && this.exitOpacity > 0.001;

				continue;
			}
			if (!actor.card?.isConnected || !actor.slot?.isConnected) {
				actor.root.visible = false;
				continue;
			}
			const card = actor.cardRect;
			const slot = actor.slotRect;
			if (!card || !slot) continue;
			const dx = actor.scrollX - scroll.scrollX;
			const dy = actor.scrollY - scroll.scrollY;
			if (slot.top + dy > height + 700 || slot.top + dy + slot.height < -700) {
				this.disposeActor(actor);
				this.queueDirty = true;
				continue;
			}
			actor.root.visible =
				this.exitOpacity > 0.001 &&
				slot.top + dy < height + 96 &&
				slot.top + dy + slot.height > -96 &&
				slot.left + dx < width &&
				slot.left + dx + slot.width > 0;
			if (!actor.root.visible) continue;

			if (actor.pose) {
				const pose = actor.pose.read();
				const hoverTarget = !this.transitionActive && !this.pointer.pressed &&
					((this.pointer.active && actor.hitTarget?.hasAttribute('data-mouse-hover')) ||
						actor.hitTarget?.matches(':focus-visible')) ? 1 : 0;
				actor.hover = this.motion.matches ? hoverTarget : THREE.MathUtils.damp(actor.hover, hoverTarget, 18, delta);
				if (Math.abs(actor.hover - hoverTarget) < 0.01) actor.hover = hoverTarget;
				animating ||= actor.hover !== hoverTarget;
				// Reuse the outline's settled hover state: inspecting a neighbour brings it
				// into focus without changing selection or allocating another render target.
				actor.blur = (pose.blur ?? 0) * (1 - actor.hover);
				actor.band = pose.front ? 'front' : 'rear';
				actor.root.visible &&= pose.visible;
				applyCatalogMaterialOpacity(actor.materials, pose.opacity);
				const compact = slot.width < 700;
				// Anchor each coupled group at its spatialElement, so recession cannot pull neighbours together.
				const x = slot.left + dx + slot.width * (pose.x - (compact ? 0 : 0.19));
				const y = slot.top + dy + slot.height * pose.y;
				const perspective = 1 - pose.depth / this.carouselCamera.position.z;
				actor.root.matrix.makeTranslation(
					(x - width / 2) * perspective,
					(height / 2 - y) * perspective,
					pose.depth
				);
				actor.root.matrixWorldNeedsUpdate = true;
				// One physical group transform for spatialElement, panel surface and DOM projection.
				actor.tilt.scale.setScalar(perspective * (pose.size / 0.82));
				actor.tilt.rotation.set(0, pose.yaw, 0);
				actor.tilt.position.set(0, 0, 0);
				// Keep compact models in the 360px visual area even as their parent shrinks.
				// Scaling the old offset pulled side previews down into the summary panel.
				actor.view.position.set(0, compact
					? (slot.height - 360) * pose.y / (pose.size / 0.82)
					: 0, 0);
				actor.view.scale.setScalar(
					(Math.min(slot.width, compact ? 360 : slot.height) * 0.82) / (actor.radius * 2)
				);
				actor.root.updateMatrixWorld(true);
				const hitTarget = actor.hitTarget;
				if (hitTarget) {
					// Project cached model bounds, not the framing sphere: empty foreground
					// margins must not intercept clicks on visible neighbouring spatialElements.
					let left = Infinity,
						top = Infinity,
						right = -Infinity,
						bottom = -Infinity;
					const point = new THREE.Vector3();
					for (const corner of actor.hitCorners) {
						point.copy(corner).applyMatrix4(actor.view.matrixWorld).project(this.carouselCamera);
						const px = ((point.x + 1) * width) / 2 - slot.left - dx;
						const py = ((1 - point.y) * height) / 2 - slot.top - dy;
						left = Math.min(left, px);
						right = Math.max(right, px);
						top = Math.min(top, py);
						bottom = Math.max(bottom, py);
					}
					hitTarget.style.left = `${(left + right) / 2}px`;
					hitTarget.style.top = `${(top + bottom) / 2}px`;
					hitTarget.style.width = `${right - left}px`;
					hitTarget.style.height = `${bottom - top}px`;
					hitTarget.style.maxWidth = 'none';
					actor.renderRect = { left: left + slot.left + dx, top: top + slot.top + dy,
						width: right - left, height: bottom - top };
				}
				const panel = actor.summaryPanel;
				if (panel && actor.summarySize) {
					const { width: pw, height: ph } = actor.summarySize;
					const matrix = actor.tilt.matrixWorld
						.clone()
						.multiply(
							new THREE.Matrix4().makeTranslation(
								compact ? 0 : slot.width * 0.39,
								compact ? slot.height / 2 - 360 - ph / 2 : 0,
								0
							)
						);
					const corners = [
						[-pw / 2, ph / 2],
						[pw / 2, ph / 2],
						[pw / 2, -ph / 2],
						[-pw / 2, -ph / 2]
					].map(([x, y]) => {
						const point = new THREE.Vector3(x, y, 0)
							.applyMatrix4(matrix)
							.project(this.carouselCamera);
						return {
							x: ((point.x + 1) * width) / 2 - slot.left - dx,
							y: ((1 - point.y) * height) / 2 - slot.top - dy
						};
					}) as unknown as CssProjectionQuad;
					// The semantic summary keeps its intrinsic layout slot before and after
					// enhancement. Project relative to that slot instead of moving it to (0, 0).
					const origin = actor.summaryOrigin ?? { x: 0, y: 0 };
					const localCorners = corners.map(({ x, y }) => ({
						x: x - origin.x, y: y - origin.y
					})) as unknown as CssProjectionQuad;
					panel.style.transform = getProjectiveCssMatrix3d(localCorners, pw, ph) ?? '';
					recordCarouselPanel(
						panel,
						corners.map((point) => ({
							x: point.x + slot.left + dx,
							y: point.y + slot.top + dy
						})) as unknown as CssProjectionQuad,
						pw,
						ph
					);
					const hidden =
						actor.card.style.visibility === 'hidden' || panel.style.visibility === 'hidden';
					this.glass.panel(
						actor.card,
						matrix,
						pw,
						ph,
						hidden ? 0 : pose.panelOpacity * this.exitOpacity,
						(1 - pose.panelOpacity) * 6
					);
				}
				actor.clip = {
					left: 0,
					top: slot.top + dy,
					width,
					height: slot.height
				};
				if (this.isDestinationActor(actor)) actor.root.visible = false;
				continue;
			}
			actor.tilt.scale.setScalar(1);
			const centerX = card.left + dx + card.width / 2;
			const centerY = card.top + dy + card.height / 2;
			const px = this.pointer.x - centerX;
			const py = this.pointer.y - centerY;
			const distance = Math.hypot(
				Math.max(Math.abs(px) - card.width / 2, 0),
				Math.max(Math.abs(py) - card.height / 2, 0)
			);
			const influence =
				this.pointer.active && !this.motion.matches && !this.transitionActive
					? getPanelPointerInfluence(distance, card.width, card.height)
					: 0;
			const rotation = getPanelPointerRotation(
				px / (card.width / 2),
				py / (card.height / 2),
				influence,
				card.width,
				card.height
			);
			// CSS has a downward Y axis; use the same physical rotation as DETAIL panels.
			const targets = [
				-THREE.MathUtils.radToDeg(rotation.x),
				THREE.MathUtils.radToDeg(rotation.y),
				-influence * 8,
				!this.motion.matches && !this.transitionActive &&
					((this.pointer.active && distance === 0) || actor.card.matches?.(':focus-visible')) ? 1 : 0
			];
			const previous = [actor.rotationX, actor.rotationY, actor.lift, actor.hover];
			const values = previous.map((value, index) => {
				const next = this.motion.matches
					? targets[index]
					: THREE.MathUtils.damp(value, targets[index], 14, delta);
				return Math.abs(next - targets[index]) < 0.01 ? targets[index] : next;
			});
			[actor.rotationX, actor.rotationY, actor.lift, actor.hover] = values;
			animating ||= values.some((value, index) => value !== targets[index]);
			actor.card.style.setProperty('--catalog-rotate-x', `${actor.rotationX}deg`);
			actor.card.style.setProperty('--catalog-rotate-y', `${actor.rotationY}deg`);
			actor.card.style.setProperty('--catalog-lift', `${actor.lift}px`);
			setPanelLocalPerspectiveMatrix(
				actor.root.matrix,
				centerX - width / 2,
				height / 2 - centerY,
				0,
				1000
			);
			actor.root.matrixWorldNeedsUpdate = true;
			actor.tilt.rotation.set(
				-THREE.MathUtils.degToRad(actor.rotationX),
				THREE.MathUtils.degToRad(actor.rotationY),
				0
			);
			actor.tilt.position.y = -actor.lift;
			actor.view.position.set(
				slot.left + slot.width / 2 - card.left - card.width / 2,
				card.top + card.height / 2 - slot.top - slot.height / 2,
				96 * actor.hover
			);
			actor.view.scale.setScalar(actor.cardScale * (1 + 0.12 * actor.hover));
			if (this.isDestinationActor(actor)) actor.root.visible = false;
		}
		if (this.queueDirty) {
			this.queueDirty = false;
			void this.loadVisibleSpatialElements(this.generation);
		}
		this.glass.endFrame();
		return animating;
	}

	draw(renderer: THREE.WebGPURenderer, band: 'rear' | 'front') {
		const width = window.innerWidth,
			height = window.innerHeight;
		const all = [...this.actors.values()].filter(
			(actor) => actor.root.visible && this.handoff?.actor !== actor
		);
		if (!all.some((actor) => (actor.band ?? 'front') === band)) {
			if (band === 'front' && this.handoff) this.renderHandoff(renderer);
			return;
		}
		this.passes++;
		for (const actor of all) actor.root.visible = (actor.band ?? 'front') === band;
		this.geometryFade.render(renderer, this.exitOpacity, () => {
			renderer.clearDepth();
			const shown = [...this.actors.values()].filter(
				(actor) => actor.root.visible && this.handoff?.actor !== actor
			);
			const clipped = shown.filter((actor) => actor.clip);
			for (const actor of clipped) actor.root.visible = false;
			if (shown.length > clipped.length) renderer.render(this.scene, this.camera);
			if (clipped.length) {
				const oldScissor = renderer.getScissor(new THREE.Vector4());
				const oldTest = renderer.getScissorTest();
				for (const actor of shown) actor.root.visible = false;
				// One submission per section viewport, with shared depth among its ring spatialElements.
				const groups = new Map<string, CatalogActor[]>();
				for (const actor of clipped) {
					const key = JSON.stringify(actor.clip);
					groups.set(key, [...(groups.get(key) ?? []), actor]);
				}
				for (const group of groups.values()) {
					const rect = group[0].clip!;
					const left = Math.max(0, rect.left),
						top = Math.max(0, rect.top);
					const right = Math.min(width, rect.left + rect.width),
						bottom = Math.min(height, rect.top + rect.height);
					if (right <= left || bottom <= top) continue;
					renderer.setScissor(left, top, right - left, bottom - top);
					renderer.setScissorTest(true);
					const fog = this.scene.fog;
					this.scene.fog = this.carouselFog;
					try {
						if (group.some((actor) => ((actor.blur ?? 0) >= 0.05 || actor.hover > 0) && actor.renderRect)) {
							// Resolve far-to-near into the same output; scratch buffers are shared by every seat.
							group.sort((a, b) => a.root.matrix.elements[14] - b.root.matrix.elements[14]);
							for (const actor of group) {
								actor.root.visible = true;
								this.depthBlur.render(renderer, this.carouselCamera, actor.renderRect ?? rect,
									actor.blur ?? 0, (camera) => renderer.render(this.scene, camera), rect);
								if (actor.hover > 0 && actor.renderRect)
									this.outline.render(renderer, this.carouselCamera, actor.model, actor.renderRect, rect,
										actor.hover * (actor.materials[0]?.material.opacity ?? 1), this.interactionTheme());
								actor.root.visible = false;
							}
						} else {
							for (const actor of group) actor.root.visible = true;
							renderer.render(this.scene, this.carouselCamera);
						}
					} finally {
						this.scene.fog = fog;
					}
					for (const actor of group) actor.root.visible = false;
				}
				renderer.setScissor(oldScissor);
				renderer.setScissorTest(oldTest);
			}
			for (const actor of shown) actor.root.visible = true;
			for (const actor of this.actors.values()) {
				if (actor.root.visible && this.handoff?.actor !== actor) {
					actor.rendered = true;
					actor.card?.setAttribute('data-catalog-model-ready', '');
				}
			}
		});
		for (const actor of all) actor.root.visible = true;
		if (band === 'front' && this.handoff) this.renderHandoff(renderer);
	}

	/** Rear elements are the backdrop source, independent of DETAIL High/HDR ownership. */
	hasCarousel() {
		return [...this.actors.values()].some((actor) => Boolean(actor.pose));
	}

	renderRear(renderer: THREE.WebGPURenderer) {
		this.glass.render(renderer, this.carouselCamera, () => this.draw(renderer, 'rear'));
	}

	/** Warm the existing Low material passes in an offscreen preparation target. */
	renderForPreparation(renderer: THREE.WebGPURenderer) {
		this.geometryFade.render(renderer, 0.5, () => renderer.render(this.scene, this.camera));
	}

	/** Applies only to outgoing list actors; the shared handoff geometry keeps its authored alpha. */
	setExitOpacity(opacity: number, active = false) {
		this.exitOpacity = Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 0;
		this.transitionActive = active;
		this.invalidate();
	}

	capture(spatialElementId: string, occurrence?: string) {
		const actor = [...this.actors.values()].find(
			(item) =>
				item.spatialElementId === spatialElementId &&
				this.desired.has(item.key) &&
				(occurrence
					? item.occurrence === occurrence
					: !item.occurrence || item.card?.hasAttribute('data-catalog-selected'))
		);
		if (!actor?.rendered || !actor.root.visible) return false;
		this.finishHandoff();
		this.handoffPoint = undefined;
		actor.model.updateWorldMatrix(true, true);
		const camera = actor.pose ? this.carouselCamera : this.camera;
		this.handoffScene.fog = actor.pose ? this.carouselFog : this.scene.fog;
		camera.updateMatrixWorld();
		const sourceModel = actor.model.matrixWorld.clone();
		const sourceClip = normalizeSpatialElementClipMatrix(
			new THREE.Matrix4()
				.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
				.multiply(sourceModel),
			actor.referencePoint
		);
		this.handoff = {
			sourceEnvironmentIntensity: this.scene.environmentIntensity,
			sourceEnvironment: this.scene.environment,
			actor,
			sourceClip,
			sourceModel,
			sourceCamera: camera.matrixWorld.clone()
		};
		applyCatalogMaterialOpacity(actor.materials, 1);
		actor.root.removeFromParent();
		this.handoffScene.add(actor.model);
		actor.model.matrixAutoUpdate = false;
		actor.model.matrix.copy(sourceModel);
		this.invalidate();
		return true;
	}

	/** Last submitted geometry position; diagnostics never advance animation or read DOM layout. */
	setDestinationSpatialElement(spatialElementId?: string) {
		this.destinationSpatialElement = spatialElementId;
		if (!spatialElementId) this.destinationOccurrences.clear();
		this.invalidate();
	}

	setDestinationOccurrences(endpoints: { spatialElementId: string; occurrence?: string }[]) {
		this.destinationOccurrences = new Set(
			endpoints.map((p) => JSON.stringify([p.spatialElementId, p.occurrence]))
		);
		this.invalidate();
	}

	private isDestinationActor(actor: CatalogActor) {
		return (
			this.destinationOccurrences.has(JSON.stringify([actor.spatialElementId, actor.occurrence])) ||
			(actor.spatialElementId === this.destinationSpatialElement &&
				(!actor.occurrence || actor.card?.hasAttribute('data-catalog-selected')))
		);
	}

	getDestinationProjection(spatialElementId: string, occurrence?: string): SpatialElementProjection | undefined {
		const actor = [...this.actors.values()].find(
			(item) =>
				item.spatialElementId === spatialElementId &&
				(occurrence
					? item.occurrence === occurrence
					: !item.occurrence || item.card?.hasAttribute('data-catalog-selected'))
		);
		if (!actor?.slot?.isConnected) return;
		const rect = actor.slot.getBoundingClientRect();
		if (
			rect.width <= 0 ||
			rect.height <= 0 ||
			(actor.pose
				? rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight
				: rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight)
		)
			return;
		actor.model.updateWorldMatrix(true, true);
		const camera = actor.pose ? this.carouselCamera : this.camera;
		return {
			environmentIntensity: this.scene.environmentIntensity,
			fog: actor.pose ? this.carouselFog : this.scene.fog,
			viewportClip: actor.clip ? { ...actor.clip } : undefined,
			model: actor.model.matrixWorld.clone(),
			camera: camera.matrixWorld.clone(),
			clip: normalizeSpatialElementClipMatrix(
				new THREE.Matrix4()
					.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
					.multiply(actor.model.matrixWorld),
				new THREE.Vector3()
			)
		};
	}

	getHandoffPoint() {
		return this.handoff && this.handoffPoint ? { ...this.handoffPoint } : null;
	}

	/** Detach the last submitted moving element without releasing the actor's Low instance. */
	detachHandoff() {
		const handoff = this.handoff;
		if (!handoff) return;
		const actor = handoff.actor;
		const model = actor.model;
		model.updateWorldMatrix(true, true);
		const camera = this.handoffPoint
			? this.handoffCamera
			: actor.pose
				? this.carouselCamera
				: this.camera;
		camera.updateMatrixWorld();
		const projection = {
			fog: actor.pose ? this.carouselFog : this.scene.fog,
			viewportClip: actor.clip ? { ...actor.clip } : undefined,
			model: model.matrixWorld.clone(),
			camera: camera.matrixWorld.clone(),
			clip: normalizeSpatialElementClipMatrix(
				new THREE.Matrix4()
					.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
					.multiply(model.matrixWorld),
				new THREE.Vector3()
			),
			environmentIntensity: this.handoffPoint
				? this.handoffScene.environmentIntensity
				: handoff.sourceEnvironmentIntensity
		};
		this.handoff = undefined;
		if (this.actors.get(actor.key) === actor) this.actors.delete(actor.key);
		this.detachedInstances++;
		let released = false;
		return {
			model,
			projection,
			referencePoint: actor.referencePoint.clone(),
			environment: handoff.sourceEnvironment,
			highEnvironment: handoff.highEnvironment,
			release: () => {
				if (!released) {
					released = true;
					this.detachedInstances--;
					this.disposeActor(actor);
				}
			}
		};
	}

	setHandoffTarget(target: {
		camera: THREE.PerspectiveCamera;
		model: THREE.Object3D;
		progress: number;
		environmentIntensity?: number;
	}) {
		if (!this.handoff) return;
		this.handoff.target = target;
		this.invalidate();
	}

	setHighHandoff(
		high: THREE.Object3D | undefined,
		blend: SpatialElementRefinement | undefined,
		progress: number,
		environment?: THREE.Texture
	) {
		if (this.handoff)
			Object.assign(this.handoff, {
				high,
				blend,
				blendProgress: progress,
				highEnvironment: environment
			});
	}

	finishHandoff() {
		const handoff = this.handoff;
		if (!handoff) return;
		this.handoff = undefined;
		const actor = handoff.actor;
		applyCatalogMaterialOpacity(actor.materials, 1);
		if (this.desired.has(actor.key)) {
			applyCatalogMaterialOpacity(actor.materials, 1);
			actor.model.matrixAutoUpdate = true;
			actor.model.updateMatrix();
			actor.view.add(actor.model);
			this.scene.add(actor.root);
			this.layoutDirty = true;
		} else this.disposeActor(actor);
		for (const other of this.actors.values()) {
			if (!this.desired.has(other.key)) this.disposeActor(other);
		}
		this.invalidate();
	}

	/** Crossfade the stationary Low overlay against the revealed background hero. */
	setHandoffOpacity(opacity: number) {
		if (this.handoff) applyCatalogMaterialOpacity(this.handoff.actor.materials, opacity);
	}

	dispose() {
		this.glass.dispose();
		this.depthBlur.dispose();
		this.geometryFade.dispose();
		this.outline.dispose();
		if (this.disposed) return;
		this.disposed = true;
		this.generation += 1;
		for (const request of this.requests) request.abort();
		this.requests.clear();
		this.handoff = undefined;
		for (const actor of this.actors.values()) this.disposeActor(actor);
		window.removeEventListener('pointermove', this.pointerMove);
		window.removeEventListener('pointerdown', this.pointerDown, true);
		window.removeEventListener('pointerup', this.pointerUp);
		window.removeEventListener('pointercancel', this.pointerUp);
		window.removeEventListener('focusin', this.motionChange);
		window.removeEventListener('focusout', this.motionChange);
		window.removeEventListener('pointerleave', this.pointerLeave);
		window.removeEventListener('blur', this.pointerLeave);
		window.removeEventListener('resize', this.resize);
		this.motion.removeEventListener('change', this.motionChange);
		window.removeEventListener(CATALOG_POSE_CHANGED, this.motionChange);
		this.layoutObserver.disconnect();
	}

	private createActor(
		key: string,
		brandId: string,
		spatialElementId: string,
		stage: SpatialElementScene,
		instance: SpatialElementAssetInstance
	): CatalogActor {
		const pair = resolveSpatialElementLodPair(stage.glb, stage.lodPair);
		const rotation = pair ? undefined : stage.model?.rotation;
		if (rotation)
			instance.scene.rotation.set(
				instance.scene.rotation.x + (rotation.x ?? 0),
				instance.scene.rotation.y + (rotation.y ?? 0),
				instance.scene.rotation.z + (rotation.z ?? 0)
			);
		applyModelMaterialOverrides(instance.scene, stage.model?.materialOverrides);
		const overrides = new Set<THREE.Material>();
		const excluded = new Set(stage.model?.excludeMeshes ?? []);
		instance.scene.traverse((object) => {
			if (!isMesh(object)) return;
			if (excluded.has(object.name)) object.visible = false;
			if (stage.model?.materialOverrides?.[object.name])
				getMeshMaterials(object).forEach((material) => overrides.add(material));
		});
		const sourceBounds = getMeshBounds(instance.scene, (mesh) => !excluded.has(mesh.name));
		if (sourceBounds.isEmpty()) {
			for (const material of overrides) material.dispose();
			throw new Error('Catalog asset contains no spatialElement geometry');
		}
		const referencePoint = sourceBounds.getCenter(new THREE.Vector3());
		const model = new THREE.Group();
		let bounds: THREE.Box3;
		if (pair) {
			bounds = prepareSpatialElementFrame(model, instance.scene, pair, stage.model ?? {});
			referencePoint.set(0, 0, 0);
		} else {
			model.add(instance.scene);
			centerAndScale(model, (mesh) => !excluded.has(mesh.name));
			bounds = getMeshBounds(model, (mesh) => !excluded.has(mesh.name));
		}
		if (bounds.isEmpty()) {
			for (const material of overrides) material.dispose();
			throw new Error('Catalog asset contains no spatialElement geometry');
		}
		const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.001);
		const root = new THREE.Group();
		root.matrixAutoUpdate = false;
		const tilt = new THREE.Group();
		const view = new THREE.Group();
		view.quaternion.copy(
			getCameraOrbitQuaternion(stage.camera?.azimuth, stage.camera?.elevation).invert()
		);
		root.add(tilt);
		tilt.add(view);
		view.add(model);
		const materials = captureCatalogMaterialOpacity(model);
		applyCatalogMaterialOpacity(materials, 1);
		const hitCorners = [bounds.min.x, bounds.max.x].flatMap((x) =>
			[bounds.min.y, bounds.max.y].flatMap((y) =>
				[bounds.min.z, bounds.max.z].map((z) => new THREE.Vector3(x, y, z))
			)
		);
		return {
			key,
			brandId,
			spatialElementId,
			stage,
			instance,
			model,
			root,
			tilt,
			view,
			radius,
			hitCorners,
			fitCorners: hitCorners.map((corner) => corner.clone().applyQuaternion(view.quaternion)),
			cardScale: 1,
			hover: 0,
			referencePoint,
			overrides,
			materials,
			scrollX: 0,
			scrollY: 0,
			rotationX: 0,
			rotationY: 0,
			lift: 0,
			rendered: false
		};
	}

	private measureActors(scrollX: number, scrollY: number) {
		if (this.handoff) return;
		const measured: Array<{ actor: CatalogActor; previousTransform: string }> = [];
		for (const actor of this.actors.values()) {
			const list = document.querySelector<HTMLElement>(
				`[data-catalog-list][data-brand-id="${CSS.escape(actor.brandId)}"]`
			);
			actor.slot =
				list?.querySelector<HTMLElement>(
					`[data-catalog-geometry][data-spatial-element-id="${CSS.escape(actor.spatialElementId)}"]${actor.occurrence ? `[data-catalog-occurrence="${CSS.escape(actor.occurrence)}"]` : ''}`
				) ?? undefined;
			actor.card =
				actor.slot?.closest<HTMLElement>('[data-catalog-card], [data-carousel-spatial-element]') ??
				undefined;
			if (!actor.card || !actor.slot) continue;
			measured.push({ actor, previousTransform: actor.card.style.transform });
			actor.card.style.transform = 'none';
		}
		// Batch neutral-pose writes, measurements, and restoration to avoid per-card layout thrashing.
		for (const { actor } of measured) {
			actor.cardRect = actor.card!.getBoundingClientRect();
			actor.slotRect = actor.slot!.getBoundingClientRect();
			if (!actor.pose)
				actor.cardScale = cardModelFit(actor.fitCorners, actor.slotRect.width, actor.slotRect.height);
			if (actor.pose) {
				actor.hitTarget = actor.card!.querySelector<HTMLElement>('.spatial-element-target') ?? undefined;
				const panel = actor.card!.querySelector<HTMLElement>('.summary') ?? undefined;
				if (actor.summaryPanel && actor.summaryPanel !== panel)
					this.layoutObserver.unobserve(actor.summaryPanel);
				actor.summaryPanel = panel;
				actor.summarySize = panel ? { width: panel.offsetWidth, height: panel.offsetHeight } : undefined;
				actor.summaryOrigin = panel ? { x: panel.offsetLeft ?? 0, y: panel.offsetTop ?? 0 } : undefined;
				// Summary content can resize without changing its section's fixed height.
				if (panel) this.layoutObserver.observe(panel);
			}
			actor.scrollX = scrollX;
			actor.scrollY = scrollY;
		}
		for (const { actor, previousTransform } of measured)
			actor.card!.style.transform = previousTransform;
		this.layoutDirty = false;
	}

	private renderHandoff(renderer: THREE.WebGPURenderer) {
		const handoff = this.handoff!;
		const target = handoff.target;
		// Otherwise Renderer would replace the custom projection on its first WebGPU draw.
		this.handoffCamera.coordinateSystem = renderer.coordinateSystem;
		if (target && target.camera.coordinateSystem !== renderer.coordinateSystem) {
			target.camera.coordinateSystem = renderer.coordinateSystem;
			target.camera.updateProjectionMatrix();
		}
		const progress = THREE.MathUtils.clamp(target?.progress ?? 0, 0, 1);
		this.handoffScene.environmentIntensity = THREE.MathUtils.lerp(
			handoff.sourceEnvironmentIntensity,
			target?.environmentIntensity ?? 0.5,
			progress
		);
		target?.model.updateWorldMatrix(true, true);
		target?.camera.updateMatrixWorld();
		const targetModel = target?.model.matrixWorld ?? handoff.sourceModel;
		const targetCamera = target?.camera.matrixWorld ?? handoff.sourceCamera;
		const targetClip = target
			? normalizeSpatialElementClipMatrix(
					new THREE.Matrix4()
						.multiplyMatrices(target.camera.projectionMatrix, target.camera.matrixWorldInverse)
						.multiply(targetModel),
					handoff.actor.referencePoint
				)
			: handoff.sourceClip;
		const modelWorld = interpolatePose(handoff.sourceModel, targetModel, progress);
		const cameraWorld = interpolatePose(handoff.sourceCamera, targetCamera, progress);
		handoff.actor.model.matrix.copy(modelWorld);
		handoff.actor.model.matrixWorldNeedsUpdate = true;
		cameraWorld.decompose(
			this.handoffCamera.position,
			this.handoffCamera.quaternion,
			this.handoffCamera.scale
		);
		this.handoffCamera.updateMatrixWorld();
		getSpatialElementHandoffProjection(
			handoff.sourceClip,
			targetClip,
			progress,
			modelWorld,
			this.handoffCamera.matrixWorld,
			{
				sourceModel: handoff.sourceModel,
				sourceCamera: handoff.sourceCamera,
				targetModel,
				targetCamera,
				reference: handoff.actor.referencePoint
			},
			this.handoffCamera.projectionMatrix
		);
		this.handoffCamera.projectionMatrixInverse.copy(this.handoffCamera.projectionMatrix).invert();
		renderer.clearDepth();
		if (handoff.high && handoff.blend && (handoff.blendProgress ?? 0) > 0) {
			const high = handoff.high;
			const parent = high.parent;
			const visibility = high.visible;
			const children = [...handoff.actor.model.children];
			const environment = this.handoffScene.environment;
			handoff.actor.model.add(high);
			try {
				handoff.blend.render(
					renderer,
					(useHigh) => {
						for (const child of children) child.visible = !useHigh;
						high.visible = useHigh;
						this.handoffScene.environment = useHigh
							? (handoff.highEnvironment ?? environment)
							: environment;
						renderer.clear();
						renderer.render(this.handoffScene, this.handoffCamera);
					},
					false,
					handoff.blendProgress
				);
			} finally {
				for (const child of children) child.visible = true;
				if (parent) parent.add(high);
				else high.removeFromParent();
				high.visible = visibility;
				this.handoffScene.environment = environment;
			}
		} else renderer.render(this.handoffScene, this.handoffCamera);
		const point = handoff.actor.referencePoint
			.clone()
			.applyMatrix4(handoff.actor.model.matrixWorld)
			.project(this.handoffCamera);
		this.handoffPoint = {
			x: ((point.x + 1) * window.innerWidth) / 2,
			y: ((1 - point.y) * window.innerHeight) / 2
		};
	}

	private disposeActor(actor: CatalogActor) {
		this.outline.release(actor.model);
		if (actor.summaryPanel) this.layoutObserver.unobserve(actor.summaryPanel);
		actor.root.removeFromParent();
		actor.model.removeFromParent();
		actor.card?.removeAttribute('data-catalog-model-ready');
		actor.card?.style.removeProperty('--catalog-rotate-x');
		actor.card?.style.removeProperty('--catalog-rotate-y');
		actor.card?.style.removeProperty('--catalog-lift');
		for (const material of actor.overrides) material.dispose();
		actor.instance.dispose();
		if (this.actors.get(actor.key) === actor) this.actors.delete(actor.key);
	}
}

export function interpolatePose(source: THREE.Matrix4, target: THREE.Matrix4, progress: number) {
	if (progress === 0) return source.clone();
	if (progress === 1) return target.clone();
	const position = new THREE.Vector3();
	const rotation = new THREE.Quaternion();
	const scale = new THREE.Vector3();
	const targetPosition = new THREE.Vector3();
	const targetRotation = new THREE.Quaternion();
	const targetScale = new THREE.Vector3();
	source.decompose(position, rotation, scale);
	target.decompose(targetPosition, targetRotation, targetScale);
	return new THREE.Matrix4().compose(
		position.lerp(targetPosition, progress),
		rotation.slerp(targetRotation, progress),
		scale.lerp(targetScale, progress)
	);
}
