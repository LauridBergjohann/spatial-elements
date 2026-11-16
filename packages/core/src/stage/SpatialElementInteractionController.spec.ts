import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { getInteractionGuidance } from './interactionGuidance.js';
import { SpaceMouseAdapter, type SpaceMouseAdapterOptions } from './SpaceMouseAdapter.js';
import {
	SpatialElementInteractionController,
	type SpatialElementInteractionPorts
} from './SpatialElementInteractionController.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test('SpaceMouse connects only on demand and disabling cancels an unfinished connection', async () => {
	vi.stubGlobal('window', {});
	let finish!: (adapter: SpaceMouseAdapter) => void;
	let options!: SpaceMouseAdapterOptions;
	const dispose = vi.fn();
	const connect = vi.spyOn(SpaceMouseAdapter, 'connect').mockImplementation(value => {
		options = value;
		return new Promise(resolve => { finish = resolve; });
	});
	const { owner } = fixture();
	expect(connect).not.toHaveBeenCalled();
	const pending = owner.initializeSpaceMouse();
	await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce());
	expect(options.viewport).toBe(window);
	await owner.initializeSpaceMouse();
	expect(connect).toHaveBeenCalledOnce();
	owner.disconnectSpaceMouse();
	expect(options.signal?.aborted).toBe(true);
	finish({ dispose } as unknown as SpaceMouseAdapter);
	await pending;
	expect(dispose).toHaveBeenCalledOnce();
	owner.dispose();
});

test('cancelling during the dynamic import never starts the device adapter', async () => {
 vi.stubGlobal('window', {});
 const connect = vi.spyOn(SpaceMouseAdapter, 'connect');
 const { owner } = fixture();
 const pending = owner.initializeSpaceMouse();
 owner.disconnectSpaceMouse();
 await pending;
 expect(connect).not.toHaveBeenCalled();
 owner.dispose();
});

test.each([false, true])('SpaceMouse reveals an offscreen model unless the detail layout is split (%s)', split => {
	const scrollTo = vi.fn();
	vi.stubGlobal('window', { scrollY: 800, scrollTo, matchMedia: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
	const { owner, ports, camera } = fixture();
	const read = ports.readGeometry;
	ports.readGeometry = () => ({ ...read(), visible: split, detail: { media: 'minimap', split, paneHidden: false, paneLeft: 500 } });
	owner.setSpaceMouseMoving(true);
	owner.setSpaceMouseMoving(true);
	expect(scrollTo).not.toHaveBeenCalled();
	owner.applySpaceMouseNavigationUpdate({ viewMatrix: new THREE.Matrix4().makeTranslation(3, 0, 8).toArray() });
	if (split) expect(scrollTo).not.toHaveBeenCalled();
	else {
		expect(scrollTo).toHaveBeenCalledOnce();
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
	}
	expect(camera.position.x).toBe(3);
	owner.setSpaceMouseMoving(false);
	expect(owner.spaceMouseMoving).toBe(false);
	owner.dispose();
});

test('SpaceMouse reveal respects reduced motion and ignores transition-owned geometry', () => {
	const scrollTo = vi.fn();
	vi.stubGlobal('window', { scrollY: 800, scrollTo, matchMedia: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
	const { owner, setOwner } = fixture();
	setOwner('transition');
	owner.setSpaceMouseMoving(true);
	expect(scrollTo).not.toHaveBeenCalled();
	setOwner('page');
	owner.setSpaceMouseMoving(true);
	owner.applySpaceMouseNavigationUpdate({ viewMatrix: new THREE.Matrix4().makeTranslation(3, 0, 10).toArray() });
	expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
	owner.dispose();
});

test('SpaceMouse zoom uses the progressive reveal instead of starting an independent scroll animation', () => {
	const viewport = { scrollY: 800, scrollTo: vi.fn(({ top }: { top: number }) => { viewport.scrollY = top; }) };
	vi.stubGlobal('window', viewport);
	const { owner } = fixture();
	owner.setFocusRange(10, 4);
	owner.setSpaceMouseMoving(true);
	owner.applySpaceMouseNavigationUpdate({ fov: THREE.MathUtils.degToRad(40) });
	expect(viewport.scrollTo).not.toHaveBeenCalled();
	owner.advance(100, 0.016);
	expect(viewport.scrollY).toBeGreaterThan(0);
	expect(viewport.scrollY).toBeLessThan(800);
	expect(viewport.scrollTo).toHaveBeenCalledWith({ top: viewport.scrollY, behavior: 'instant' });
	owner.dispose();
});

test('boolean picking stops after the first exact hit and retains miss behavior', () => {
	vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100 });
	vi.stubGlobal('HTMLElement', class {});
	vi.stubGlobal('Element', class {});
	const { owner } = fixture();
	vi.spyOn(owner, 'isPointerOccludedByHtml').mockReturnValue(false);
	const group = new THREE.Group();
	const first = new THREE.Mesh();
	const second = new THREE.Mesh();
	group.add(first, second);
	owner.setPickTargets(group, () => true);
	const hit = vi.spyOn(first, 'raycast').mockImplementation((_ray, hits) => {
		hits.push({ distance: 1 } as THREE.Intersection);
	});
	const next = vi.spyOn(second, 'raycast').mockImplementation(() => {});
	expect(owner.hitTestModel(50, 50, null)).toBe(true);
	expect(next).not.toHaveBeenCalled();
	hit.mockImplementation(() => {});
	expect(owner.hitTestModel(50, 50, null)).toBe(false);
	expect(next).toHaveBeenCalledOnce();
	owner.dispose();
});

test('split free-space input belongs to the model on the left, keeps contact ownership and respects UI/media', () => {
	vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100 });
	vi.stubGlobal('HTMLElement', class {}); vi.stubGlobal('Element', class {});
	const { owner, ports, setOwner } = fixture();
	const original = ports.readGeometry;
	const detail = { media: 'minimap' as const, split: true, paneHidden: false, paneLeft: 60 };
	ports.readGeometry = () => ({ ...original(), detail });
	const occluded = vi.spyOn(owner, 'isPointerOccludedByHtml').mockReturnValue(false);
	expect(owner.hitTestModel(20, 20, ports.canvas)).toBe(true);
	expect(owner.hitTestModel(80, 20, ports.canvas)).toBe(false);
	expect(owner.hitTestModel(20, 20, ports.cssRoot)).toBe(false);
	owner.handlePointerDown({ pointerType: 'touch', pointerId: 1, clientX: 20, clientY: 20, target: ports.canvas } as unknown as PointerEvent);
	expect(owner.modelInteractionActive).toBe(true);
	owner.handlePointerMove({ pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 20, target: ports.canvas } as unknown as PointerEvent);
	expect(owner.modelInteractionActive).toBe(true);
	owner.handlePointerUp({ pointerType: 'touch', pointerId: 1 } as PointerEvent);
	expect(owner.modelInteractionActive).toBe(false);
	detail.paneHidden = true;
	expect(owner.hitTestModel(80, 20, ports.canvas)).toBe(true);
	occluded.mockReturnValue(true);
	expect(owner.hitTestModel(20, 20, ports.canvas)).toBe(false);
	occluded.mockReturnValue(false);
	setOwner('none');
	expect(owner.hitTestModel(20, 20, ports.canvas)).toBe(false);
	owner.dispose();
});

vi.mock('three/addons/controls/OrbitControls.js', () => ({
	OrbitControls: class {
		target = new THREE.Vector3();
		minDistance = 1;
		maxDistance = 10;
		zoomSpeed = 1;
		enableZoom = true;
		enablePan = true;
		update = vi.fn(() => false);
		dispose = vi.fn();
		addEventListener() {}
		removeEventListener() {}
		saveState() {}
	}
}));

function fixture() {
	const camera = new THREE.PerspectiveCamera(50);
	camera.position.z = 10;
	let poseOwner: 'page' | 'transition' | 'none' = 'page';
	const ports: SpatialElementInteractionPorts = {
		camera,
		canvas: { style: {}, focus: vi.fn() } as unknown as HTMLCanvasElement,
		container: {} as HTMLElement,
		cssRoot: {} as HTMLElement,
		requestRender: vi.fn(),
		updateProjection: vi.fn(),
		readGeometry: () => ({
			poseOwner,
			visible: true,
			viewport: new THREE.Vector4(0, 0, 100, 100),
			bounds: new THREE.Box3()
		})
	};
	const owner = new SpatialElementInteractionController(ports);
	owner.initialize();
	owner.captureInitialView();
	return {
		owner,
		camera,
		ports,
		setOwner(value: typeof poseOwner) {
			poseOwner = value;
		}
	};
}

test('fullscreen background input bypasses picking, disables hover and retains SpaceMouse', () => {
	const { owner, ports, camera } = fixture();
	const occlusion = vi.spyOn(owner, 'isPointerOccludedByHtml');
	const raycast = vi.spyOn(THREE.Raycaster.prototype, 'intersectObject');
	owner.setModelHover(true);
	owner.setFullscreen(true);
	expect(owner.modelHover).toBe(false);
	expect(owner.controls!.enabled).toBe(true);
	expect(ports.canvas.style.touchAction).toBe('none');
	expect(owner.hitTestModel(1, 1, ports.canvas)).toBe(true);
	expect(owner.hitTestModel(1, 1, ports.cssRoot)).toBe(false);
	expect(occlusion).not.toHaveBeenCalled();
	expect(raycast).not.toHaveBeenCalled();
	owner.setModelHover(true);
	expect(owner.modelHover).toBe(false);
	owner.applySpaceMouseNavigationUpdate({ viewMatrix: new THREE.Matrix4().makeTranslation(3, 0, 8).toArray() });
	expect(camera.position.x).toBe(3);
	owner.setFullscreen(false);
	expect(ports.canvas.style.touchAction).toBe('manipulation');
	expect(owner.controls!.enabled).toBe(false);
	owner.dispose();
});

test('outline fades with the interface and remains absent in the split viewer', () => {
	const { owner, ports } = fixture();
	const geometry = ports.readGeometry();
	const detail = { media: 'minimap' as const, split: false, paneHidden: false, paneLeft: 60, uiFocus: 0 };
	ports.readGeometry = () => ({ ...geometry, detail });
	expect(owner.outlineOpacity).toBe(1);
	detail.uiFocus = 0.5;
	expect(owner.outlineOpacity).toBeGreaterThan(0);
	expect(owner.outlineOpacity).toBeLessThan(1);
	detail.uiFocus = 1;
	expect(owner.outlineOpacity).toBe(0);
	detail.uiFocus = 0;
	detail.split = true;
	expect(owner.outlineOpacity).toBe(0);
	owner.dispose();
});

test('the first inward dolly reveals the page before UI focus starts, except in 3XL', () => {
	const viewport = { scrollY: 400, scrollTo: vi.fn(({ top }: { top: number }) => { viewport.scrollY = top; }) };
	vi.stubGlobal('window', viewport);
	const { owner, ports } = fixture();
	const geometry = ports.readGeometry();
	const detail = { media: 'minimap' as const, split: false, paneHidden: false, paneLeft: 60 };
	ports.readGeometry = () => ({ ...geometry, detail });
	owner.setFocusRange(8.4, 1);
	owner.setCameraDistance(9.9);
	expect(owner.getZoomFocusFactor()).toBe(0);
	owner.advance(100, 0.016);
	expect(viewport.scrollY).toBeGreaterThan(0);
	expect(viewport.scrollY).toBeLessThan(400);
	owner.setCameraDistance(6);
	owner.advance(116, 0.016);
	expect(viewport.scrollY).toBe(0);
	detail.split = true;
	viewport.scrollY = 400;
	owner.setCameraDistance(5);
	owner.advance(132, 0.016);
	expect(viewport.scrollY).toBe(400);
	owner.dispose();
});

test('pinch owns zoom once and preserves its world point across scrolling projection changes', () => {
	vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100, scrollY: 0 });
	const { owner, ports, camera } = fixture();
	const geometry = ports.readGeometry();
	ports.readGeometry = () => ({ ...geometry, detail: { media: 'minimap', split: false, paneHidden: false, paneLeft: 60, contentTop: 100 } });
	const touches = (distance: number) => [{ clientX: 60 - distance, clientY: 40 }, { clientX: 60 + distance, clientY: 40 }];
	const event = (distance: number) => ({ touches: touches(distance), preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() } as unknown as TouchEvent);
	owner.handleTouchStart(event(10));
	expect(owner.controls!.enableZoom).toBe(false);
	expect(owner.controls!.enablePan).toBe(false);
	const ray = new THREE.Raycaster();
	ray.setFromCamera(new THREE.Vector2(0.2, 0.2), camera);
	const anchor = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3())!;
	owner.handleTouchMove(event(12));
	// A 20% finger spread produces exactly one 1.2x dolly, independent of scroll.
	expect(owner.wheelZoomTargetDistance).toBeCloseTo(10 / 1.2, 8);
	for (let step = 1; step <= 12; step++) {
		owner.advance(step * 16, 0.016);
		camera.setViewOffset(100, 100, 0, -step * 2, 100, 100);
		owner.compensateZoomAnchor();
		const projected = anchor.clone().project(camera);
		expect(projected.x).toBeCloseTo(0.2, 7);
		expect(projected.y).toBeCloseTo(0.2, 7);
	}
	owner.handleTouchEnd({ touches: [touches(12)[0]] } as unknown as TouchEvent);
	expect(owner.controls!.enableZoom).toBe(true);
	expect(owner.controls!.enablePan).toBe(true);
	owner.dispose();
});

test('transition ownership prevents SpaceMouse and ordinary frame damping from writing the camera', () => {
	const { owner, camera, ports, setOwner } = fixture();
	setOwner('transition');
	const before = camera.matrixWorld.clone();
	owner.applySpaceMouseNavigationUpdate({
		viewMatrix: new THREE.Matrix4().makeTranslation(3, 0, 8).toArray()
	});
	expect(camera.matrixWorld.equals(before)).toBe(true);
	expect(owner.advance(100, 0.016)).toEqual({ controls: false, wheel: false });
	expect(owner.controls!.update).not.toHaveBeenCalled();
	expect(ports.requestRender).not.toHaveBeenCalled();
	setOwner('page');
	owner.applySpaceMouseNavigationUpdate({
		viewMatrix: new THREE.Matrix4().makeTranslation(3, 0, 8).toArray()
	});
	expect(camera.position.x).toBe(3);
	expect(ports.requestRender).toHaveBeenCalledTimes(1);
	owner.dispose();
});

test('reset starts at the current non-default FOV and ends at the fitted FOV', () => {
	const { owner, camera } = fixture();
	camera.fov = 25;
	owner.resetView();
	owner.applyViewReset(0);
	expect(camera.fov).toBe(25);
	owner.applyViewReset(10);
	expect(camera.fov).toBe(50);
	expect(owner.viewResetActive).toBe(false);
	owner.dispose();
});

function pointer(pointerId: number, pointerType = 'touch', type = 'pointerdown') {
	return { pointerId, pointerType, type, clientX: 50, clientY: 50, target: null } as PointerEvent;
}

test('touch claims geometry on the first contact and leaves the next background gesture native', () => {
	const { owner, ports } = fixture();
	const hit = vi.spyOn(owner, 'hitTestModel').mockReturnValue(true);
	owner.handlePointerDown(pointer(1));
	const preventDefault = vi.fn();
	owner.handleTouchStart({ cancelable: true, preventDefault } as unknown as TouchEvent);
	expect(preventDefault).toHaveBeenCalledOnce();
	expect(owner.controls!.enabled).toBe(true);
	expect(owner.modelHover).toBe(false);
	expect(owner.pointer.active).toBe(false);
	expect(ports.canvas.style.touchAction).toBe('manipulation');
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	expect(owner.controls!.enabled).toBe(false);
	hit.mockReturnValue(false);
	owner.handlePointerDown(pointer(2));
	preventDefault.mockClear();
	owner.handleTouchStart({ cancelable: true, preventDefault } as unknown as TouchEvent);
	expect(preventDefault).not.toHaveBeenCalled();
	expect(owner.modelInteractionActive).toBe(false);
	expect(ports.canvas.style.touchAction).toBe('manipulation');
	owner.dispose();
});

test('pinch keeps ownership until both fingers lift and immediately accepts the next rotation', () => {
	const { owner } = fixture();
	const hit = vi.spyOn(owner, 'hitTestModel').mockReturnValue(true);
	owner.handlePointerDown(pointer(1));
	hit.mockReturnValue(false);
	owner.handlePointerDown(pointer(2));
	expect(hit).toHaveBeenCalledOnce();
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	expect(owner.modelInteractionActive).toBe(true);
	expect(owner.controls!.enabled).toBe(true);
	owner.handlePointerUp(pointer(2, 'touch', 'pointerup'));
	expect(owner.modelInteractionActive).toBe(false);
	expect(owner.controls!.enabled).toBe(false);
	hit.mockReturnValue(true);
	owner.handlePointerDown(pointer(3));
	expect(owner.modelInteractionActive).toBe(true);
	expect(owner.controls!.enabled).toBe(true);
	owner.dispose();
});

test('touch and pen clear mouse hover without raycasting on every move or release', () => {
	const { owner, ports } = fixture();
	const hit = vi.spyOn(owner, 'hitTestModel').mockReturnValue(true);
	owner.handlePointerMove(pointer(1, 'mouse', 'pointermove'));
	expect(owner.modelHover).toBe(true);
	expect(owner.pointer.active).toBe(true);
	for (const pointerType of ['touch', 'pen']) {
		hit.mockClear();
		owner.handlePointerContact(pointer(2, pointerType));
		owner.handlePointerMove(pointer(2, pointerType, 'pointermove'));
		owner.handlePointerUp(pointer(2, pointerType, 'pointerup'));
		expect(owner.modelHover).toBe(false);
		expect(owner.pointer.active).toBe(false);
		expect(hit).not.toHaveBeenCalled();
		expect(ports.canvas.style.touchAction).toBe('manipulation');
	}
	owner.dispose();
});

test('cancellation and focus loss do not leave an active gesture behind', () => {
	const { owner } = fixture();
	vi.spyOn(owner, 'hitTestModel').mockReturnValue(true);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointercancel'));
	expect(owner.modelInteractionActive).toBe(false);
	owner.handlePointerDown(pointer(2));
	const previous = owner.controls!;
	owner.handlePointerLeave();
	expect(previous.dispose).toHaveBeenCalledOnce();
	expect(owner.modelInteractionActive).toBe(false);
	expect(owner.controls!.enabled).toBe(false);
	owner.handlePointerDown(pointer(3));
	expect(owner.modelInteractionActive).toBe(true);
	owner.releasePage();
	expect(owner.pointer.active).toBe(false);
	expect(owner.modelInteractionActive).toBe(false);
	owner.dispose();
});

test('only a real geometry drag consumes the introductory guidance, not hover or a click', () => {
	vi.stubGlobal('window', {});
	const { owner } = fixture();
	vi.spyOn(owner, 'hitTestModel').mockReturnValue(true);
	const guidance = getInteractionGuidance();
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	expect(guidance.snapshot.interacted).toBe(false);
	owner.handlePointerDown(pointer(2));
	owner.handlePointerMove({ ...pointer(2, 'touch', 'pointermove'), clientX: 52 } as PointerEvent);
	expect(guidance.snapshot.interacted).toBe(false);
	owner.handlePointerMove({ ...pointer(2, 'touch', 'pointermove'), clientX: 70 } as PointerEvent);
	expect(guidance.snapshot.interacted).toBe(true);
	owner.dispose();
});
