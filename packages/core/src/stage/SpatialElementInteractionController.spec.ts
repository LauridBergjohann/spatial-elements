import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { getInteractionGuidance } from './interactionGuidance.js';
import { getPanelFocusOpacity } from './panelFocusMath.js';
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
		rotateSpeed = 1;
		panSpeed = 1;
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

test('a scrolled inward dolly reveals the page and fades UI on one reversible timeline, except in 3XL', () => {
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
	expect(getPanelFocusOpacity(owner.getUiFocus(owner.getZoomFocusFactor()))).toBeCloseTo(viewport.scrollY / 400, 8);
	owner.setCameraDistance(6);
	owner.advance(116, 0.016);
	expect(viewport.scrollY).toBe(0);
	expect(getPanelFocusOpacity(owner.getUiFocus(owner.getZoomFocusFactor()))).toBe(0);
	owner.setCameraDistance(9);
	owner.advance(124, 0.016);
	expect(getPanelFocusOpacity(owner.getUiFocus(owner.getZoomFocusFactor()))).toBeCloseTo(1 - 1 / 3.5, 8);
	owner.setCameraDistance(10);
	owner.advance(128, 0.016);
	expect(owner.getUiFocus(0)).toBe(0);
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

test.each([1, 1.2, 0.8])('two-finger pan follows its midpoint during a %sx pinch and its damped tail', spread => {
	vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100, scrollY: 0 });
	const { owner, ports, camera } = fixture();
	const geometry = ports.readGeometry();
	ports.readGeometry = () => ({ ...geometry, detail: { media: 'minimap', split: false, paneHidden: false, paneLeft: 60, contentTop: 100 } });
	owner.setCameraDistance(6);
	const event = (x: number, y: number, radius: number) => ({
		touches: [{ clientX: x - radius, clientY: y }, { clientX: x + radius, clientY: y }],
		preventDefault: vi.fn(), stopImmediatePropagation: vi.fn()
	} as unknown as TouchEvent);
	owner.handleTouchStart(event(50, 50, 10));
	const orientation = camera.quaternion.clone();
	owner.handleTouchMove(event(65, 60, 10 * spread));
	if (spread === 1) expect(owner.wheelZoomTargetDistance).toBeUndefined();
	else expect(owner.wheelZoomTargetDistance).toBeCloseTo(6 / spread, 8);
	for (let step = 1; step <= 80; step++) {
		owner.advance(step * 16, 0.016);
		// Scroll reveal also moves the stage projection during the first frames.
		camera.setViewOffset(100, 100, 0, -Math.min(step, 12) * 2, 100, 100);
		owner.compensateZoomAnchor();
		const projected = new THREE.Vector3().project(camera);
		expect(projected.x).toBeCloseTo(0.3, 7);
		expect(projected.y).toBeCloseTo(-0.2, 7);
		expect(camera.quaternion.angleTo(orientation)).toBeCloseTo(0, 7);
		if (step === 12) owner.handleTouchEnd({ touches: [] } as unknown as TouchEvent);
	}
	expect(camera.position.distanceTo(owner.controls!.target)).toBeCloseTo(6 / spread, 3);
	expect(owner.controls!.enablePan).toBe(true);
	expect(owner.controls!.enableZoom).toBe(true);
	owner.dispose();
});

test('a remaining touch resumes rotation without the preceding pinch anchor or dolly', () => {
	vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100, scrollY: 0 });
	const { owner, ports, camera } = fixture();
	owner.setFullscreen(true);
	const pointer = { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50, target: ports.canvas } as unknown as PointerEvent;
	owner.handlePointerDown(pointer);
	const event = (radius: number) => ({
		touches: [{ clientX: 50 - radius, clientY: 50 }, { clientX: 50 + radius, clientY: 50 }],
		preventDefault: vi.fn(), stopImmediatePropagation: vi.fn()
	} as unknown as TouchEvent);
	owner.handleTouchStart(event(10));
	owner.handleTouchMove(event(12));
	expect(owner.wheelZoomTargetDistance).toBeDefined();
	owner.handleTouchEnd({ touches: [event(12).touches[0]] } as unknown as TouchEvent);
	owner.handlePointerMove({ ...pointer, clientX: 70 });
	expect(owner.wheelZoomTargetDistance).toBeUndefined();
	const position = camera.position.clone();
	camera.setViewOffset(100, 100, 0, -20, 100, 100);
	owner.compensateZoomAnchor();
	expect(camera.position.equals(position)).toBe(true);
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

function detailFixture(split = false) {
	vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100, scrollY: 0 });
	const f = fixture();
	const geometry = f.ports.readGeometry();
	f.ports.readGeometry = () => ({ ...geometry, detail: { media: 'minimap', split, paneHidden: false, paneLeft: 60 } });
	f.owner.setFocusRange(8.4, 1);
	vi.spyOn(f.owner, 'hitTestModel').mockImplementation(x => x < 60);
	return f;
}
function wheel(x: number, deltaY: number) {
	return { clientX: x, clientY: 50, deltaY, deltaMode: 0, ctrlKey: false, target: null,
		preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() } as unknown as WheelEvent;
}

test('a fresh physical wheel gesture can zoom immediately after document inertia', () => {
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	const { owner } = detailFixture();
	owner.handleWheel({ ...wheel(80, 30), momentum: false } as WheelEvent);
	time.mockReturnValue(1000);
	const inertia = { ...wheel(50, -10), momentum: true } as WheelEvent;
	owner.handleWheel(inertia);
	expect(inertia.preventDefault).not.toHaveBeenCalled();
	time.mockReturnValue(1010);
	const fresh = { ...wheel(50, -10), momentum: false } as WheelEvent;
	owner.handleWheel(fresh);
	expect(fresh.preventDefault).toHaveBeenCalledOnce();
	owner.dispose();
});

test.each([0, 0.08, 0.0801, 0.5])('empty-stage wheel ownership starts with panel clearance at UI focus %s', uiFocus => {
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	const { owner, ports } = detailFixture();
	const geometry = ports.readGeometry();
	const detail = { ...geometry.detail!, uiFocus };
	ports.readGeometry = () => ({ ...geometry, detail });
	vi.spyOn(owner, 'isPointerOccludedByHtml').mockReturnValue(false);
	owner.setCameraDistance(7);
	const send = () => {
		const event = { ...wheel(80, 100), target: ports.canvas } as WheelEvent;
		owner.handleWheel(event);
		return vi.mocked(event.preventDefault).mock.calls.length > 0;
	};
	const clearing = uiFocus > 0.08;
	expect(send()).toBe(clearing);
	// A retained outward gesture survives the return to fully visible panels.
	detail.uiFocus = 0;
	owner.setCameraDistance(10);
	time.mockReturnValue(379);
	expect(send()).toBe(clearing);
	time.mockReturnValue(759);
	expect(send()).toBe(false);
	owner.dispose();
});

test('partially faded panels do not steal wheel input from visible HTML or the 3XL pane', () => {
	for (const split of [false, true]) {
		const { owner, ports } = detailFixture(split);
		const geometry = ports.readGeometry();
		ports.readGeometry = () => ({ ...geometry, detail: { ...geometry.detail!, uiFocus: 0.5 } });
		vi.spyOn(owner, 'isPointerOccludedByHtml').mockReturnValue(true);
		owner.setCameraDistance(7);
		const event = { ...wheel(80, 100), target: ports.canvas } as WheelEvent;
		owner.handleWheel(event);
		expect(event.preventDefault).not.toHaveBeenCalled();
		owner.dispose();
	}
});

test('3XL changes wheel owner immediately by area and never resets zoom from document scrolling', () => {
	const { owner, camera } = detailFixture(true);
	const pageWheel = wheel(80, 100);
	owner.handleWheel(pageWheel);
	expect(pageWheel.preventDefault).not.toHaveBeenCalled();
	const modelWheel = wheel(50, -100);
	owner.handleWheel(modelWheel);
	expect(modelWheel.preventDefault).toHaveBeenCalledOnce();
	owner.advance(100, 0.1);
	expect(camera.position.z).toBeLessThan(10);
	const target = owner.wheelZoomTargetDistance;
	owner.requestScrollZoomReset(600);
	expect(owner.zoomResetTargetDistance).toBeUndefined();
	expect(owner.wheelZoomTargetDistance).toBe(target);
	owner.clearWheelZoom();
	owner.setCameraDistance(10);
	const atOverview = wheel(50, 100);
	owner.handleWheel(atOverview);
	expect(atOverview.preventDefault).toHaveBeenCalledOnce();
	owner.dispose();
});

test('changing the wheel focus captures a new point instead of dragging the old point to the cursor', () => {
	const { owner, camera } = detailFixture();
	owner.handleWheel(wheel(40, -50));
	owner.advance(100, 0.016);
	owner.compensateZoomAnchor();
	const position = camera.position.clone();
	owner.handleWheel(wheel(55, -50));
	owner.compensateZoomAnchor();
	expect(camera.position.distanceTo(position)).toBeLessThan(1e-8);
	for (let i = 0; i < 200; i++) { owner.advance(116 + i * 16, 0.016); owner.compensateZoomAnchor(); }
	expect(owner.wheelZoomTargetDistance).toBeUndefined();
	// Once dolly has settled, an unrelated projection update must not retain an anchor.
	const settled = camera.position.clone();
	camera.setViewOffset(100, 100, 10, 0, 100, 100);
	owner.compensateZoomAnchor();
	expect(camera.position.distanceTo(settled)).toBeLessThan(1e-8);
	owner.dispose();
});

test('outward wheel zoom converges on the fitted centre regardless of cursor position', () => {
	const { owner, camera } = detailFixture();
	owner.controls!.target.set(2, -1, 0);
	camera.position.set(2, -1, 5);
	owner.handleWheel(wheel(10, 100));
	owner.applyWheelZoom(0.05);
	expect(owner.controls!.target.x).toBeLessThan(2);
	expect(owner.controls!.target.x).toBeGreaterThan(0);
	owner.handleWheel(wheel(55, 5000));
	for (let i = 0; i < 200; i++) { owner.applyWheelZoom(0.016); owner.compensateZoomAnchor(); }
	expect(owner.controls!.target.toArray()).toEqual([0, 0, 0]);
	expect(camera.position.toArray()).toEqual([0, 0, 10]);
	owner.dispose();
});

test.each(['mouse', 'touch'])('a %s tap enlarges to UI clearance and returns any zoom to the centered initial view', type => {
	const { owner, camera } = detailFixture();
	const tap = () => {
		owner.handlePointerDown({ ...pointer(1, type), button: 0 } as PointerEvent);
		owner.handlePointerUp({ ...pointer(1, type, 'pointerup'), button: 0 } as PointerEvent);
	};
	tap();
	expect(owner.viewResetActive).toBe(true);
	owner.advance(100, 0.05);
	expect(camera.position.z).toBeLessThan(10);
	owner.advance(200, 2);
	expect(getPanelFocusOpacity(owner.getUiFocus(owner.getZoomFocusFactor()))).toBe(0);
	expect(owner.getUiFocus(owner.getZoomFocusFactor())).toBeCloseTo(0.96, 5);
	expect(owner.viewportCentering).toBe(1);
	owner.controls!.target.x = 2;
	camera.position.set(2, 0, 1);
	tap();
	owner.advance(300, 2);
	expect(camera.position.toArray()).toEqual([0, 0, 10]);
	expect(owner.controls!.target.toArray()).toEqual([0, 0, 0]);
	expect(owner.viewportCentering).toBe(0);
	owner.dispose();
});

test('a click interrupts damped wheel zoom immediately even if the picked surface moves before release', () => {
	const { owner, camera } = detailFixture();
	owner.handleWheel(wheel(50, -700));
	owner.advance(1, 0.016);
	expect(owner.wheelZoomTargetDistance).toBeDefined();
	owner.handlePointerDown({ ...pointer(1, 'mouse'), button: 0 } as PointerEvent);
	vi.mocked(owner.hitTestModel).mockReturnValue(false);
	owner.handlePointerUp({ ...pointer(1, 'mouse', 'pointerup'), button: 0 } as PointerEvent);
	expect(owner.viewResetActive).toBe(true);
	expect(owner.wheelZoomTargetDistance).toBeUndefined();
	owner.advance(2, 2);
	expect(camera.position.toArray()).toEqual([0, 0, 10]);
	owner.dispose();
});

test('a click reset owns its animation despite delayed document scroll notification', () => {
	const { owner, camera } = detailFixture();
	owner.handleWheel(wheel(50, -700));
	owner.advance(1, 0.1);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	owner.advance(2, 0.016);
	owner.requestScrollZoomReset(2);
	expect(owner.viewResetActive).toBe(true);
	owner.advance(3, 2);
	expect(camera.position.toArray()).toEqual([0, 0, 10]);
	owner.dispose();
});

test('a click reset ignores the old inertial wheel tail but accepts a new burst after 380ms', () => {
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	const { owner, camera } = detailFixture();
	owner.handleWheel(wheel(50, -700));
	owner.advance(1, 0.1);
	time.mockReturnValue(30);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	owner.advance(2, 0.016);
	for (const now of [40, 90, 180]) {
		time.mockReturnValue(now);
		const tail = wheel(50, -30);
		owner.handleWheel(tail);
		expect(tail.preventDefault).toHaveBeenCalled();
		expect(owner.viewResetActive).toBe(true);
	}
	owner.advance(3, 2);
	expect(camera.position.toArray()).toEqual([0, 0, 10]);
	time.mockReturnValue(560);
	owner.handleWheel(wheel(50, -30));
	expect(owner.wheelZoomTargetDistance).toBeDefined();
	owner.dispose();
});

test('3XL content scrolling stays available while the spatial wheel tail is cancelled', () => {
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	const { owner, camera } = detailFixture(true);
	owner.handleWheel(wheel(50, -700));
	owner.advance(1, 0.1);
	time.mockReturnValue(30);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	time.mockReturnValue(40);
	const tail = wheel(50, -30);
	owner.handleWheel(tail);
	expect(tail.preventDefault).toHaveBeenCalled();
	const content = wheel(80, 100);
	owner.handleWheel(content);
	expect(content.preventDefault).not.toHaveBeenCalled();
	expect(content.stopImmediatePropagation).not.toHaveBeenCalled();
	expect(owner.viewResetActive).toBe(true);
	owner.requestScrollZoomReset(100);
	owner.advance(2, 2);
	expect(camera.position.toArray()).toEqual([0, 0, 10]);
	owner.dispose();
});

test.each([false, true])('a changed ctrl modifier starts a fresh wheel gesture after click reset (previous ctrl=%s)', ctrlKey => {
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	const { owner } = detailFixture();
	owner.handleWheel({ ...wheel(50, -100), ctrlKey } as WheelEvent);
	owner.advance(1, 0.1);
	time.mockReturnValue(30);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	expect(owner.viewResetActive).toBe(true);
	time.mockReturnValue(40);
	const fresh = { ...wheel(50, -30), ctrlKey: !ctrlKey } as WheelEvent;
	owner.handleWheel(fresh);
	expect(fresh.preventDefault).toHaveBeenCalled();
	expect(owner.viewResetActive).toBe(false);
	// With panels still visible, both modifiers use dolly rather than panning.
	expect(owner.wheelZoomTargetDistance).toBeDefined();
	owner.dispose();
});

test('viewport refitting preserves pending dolly but never starts scroll reveal', () => {
	const viewport = { scrollY: 450, innerWidth: 100, innerHeight: 100, scrollTo: vi.fn() };
	vi.stubGlobal('window', viewport);
	const { owner } = fixture();
	owner.controls!.minDistance = 1;
	owner.controls!.maxDistance = 10;
	owner.setCameraDistance(9);
	owner.rebaseViewportZoom(1, 10);
	owner.advance(100, 0.016);
	expect(viewport.scrollTo).not.toHaveBeenCalled();
	owner.controls!.maxDistance = 12;
	owner.setCameraDistance(10.8);
	owner.rebaseViewportZoom(1, 10);
	owner.advance(116, 0.016);
	expect(viewport.scrollTo).not.toHaveBeenCalled();
	owner.setCameraDistance(10.5);
	owner.advance(132, 0.016);
	expect(viewport.scrollTo).toHaveBeenCalled();
	owner.dispose();
});

test.each([10, 7, 2, 1])('rotation and pan retain native sensitivity at camera distance %s', distance => {
	const { owner } = fixture();
	owner.controls!.maxDistance = 10;
	owner.setCameraDistance(distance);
	owner.updateControlsAvailability();
	expect(owner.controls!.rotateSpeed).toBe(1);
	expect(owner.controls!.panSpeed).toBe(1);
	owner.dispose();
});

test('immersive trackpad pans both axes after pinch without dolly, while a later mouse notch still zooms', () => {
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	const { owner, camera, ports } = detailFixture();
	const geometry = ports.readGeometry();
	ports.readGeometry = () => ({ ...geometry, detail: { ...geometry.detail!, uiFocus: 1, paneHidden: true } });
	owner.handleWheel({ ...wheel(50, -50), deltaX: 0, ctrlKey: true } as WheelEvent);
	owner.advance(16, 0.1);
	const distance = owner.getEffectiveCameraDistance();
	const target = owner.controls!.target.clone();
	const direction = camera.getWorldDirection(new THREE.Vector3());
	for (const [deltaX, deltaY] of [[12, 8], [0, 9], [8, 0]]) {
		const event = { ...wheel(50, deltaY), deltaX } as WheelEvent;
		owner.handleWheel(event);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(owner.getEffectiveCameraDistance()).toBeCloseTo(distance, 8);
		expect(owner.wheelZoomTargetDistance).toBeUndefined();
	}
	expect(owner.controls!.target.distanceTo(target)).toBeGreaterThan(0.1);
	expect(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction)).toBeLessThan(1e-8);
	time.mockReturnValue(500);
	owner.handleWheel({ ...wheel(50, -120), deltaX: 0 } as WheelEvent);
	expect(owner.wheelZoomTargetDistance).toBeLessThan(distance);
	owner.dispose();
});

test('trackpad panning cannot steal an ongoing page-scroll gesture', () => {
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	const { owner } = detailFixture();
	owner.setCameraDistance(7);
	owner.handleWheel({ ...wheel(80, 12), deltaX: 4 } as WheelEvent);
	const before = owner.controls!.target.clone();
	time.mockReturnValue(30);
	const crossing = { ...wheel(50, 12), deltaX: 4 } as WheelEvent;
	owner.handleWheel(crossing);
	expect(crossing.preventDefault).not.toHaveBeenCalled();
	expect(owner.controls!.target.equals(before)).toBe(true);
	time.mockReturnValue(420);
	const fresh = { ...wheel(50, 12), deltaX: 4 } as WheelEvent;
	owner.handleWheel(fresh);
	expect(fresh.preventDefault).toHaveBeenCalled();
	expect(owner.controls!.target.equals(before)).toBe(true);
	expect(owner.wheelZoomTargetDistance).toBeGreaterThan(7);
	owner.dispose();
});

test.each([0, 0.5, 0.95])('visible or fading panels prevent trackpad panning at UI focus %s', uiFocus => {
	const { owner, ports } = detailFixture();
	const geometry = ports.readGeometry();
	ports.readGeometry = () => ({ ...geometry, detail: { ...geometry.detail!, uiFocus } });
	owner.setCameraDistance(7);
	const before = owner.controls!.target.clone();
	owner.handleWheel({ ...wheel(50, 0), deltaX: 12 } as WheelEvent);
	expect(owner.controls!.target.equals(before)).toBe(true);
	const scroll = { ...wheel(80, 12), deltaX: 4 } as WheelEvent;
	owner.handleWheel(scroll);
	expect(scroll.preventDefault).not.toHaveBeenCalled();
	expect(owner.controls!.target.equals(before)).toBe(true);
	owner.dispose();
});

test.each(['immersive', 'fullscreen', 'split'] as const)('%s trackpad pans empty canvas, including overview in 3XL', mode => {
	const { owner, ports } = detailFixture(mode === 'split');
	vi.mocked(owner.hitTestModel).mockRestore();
	vi.stubGlobal('HTMLElement', class {}); vi.stubGlobal('Element', class {});
	vi.spyOn(owner, 'isPointerOccludedByHtml').mockReturnValue(false);
	const geometry = ports.readGeometry();
	ports.readGeometry = () => ({ ...geometry, detail: { ...geometry.detail!,
		uiFocus: mode === 'immersive' ? 1 : 0, paneHidden: mode === 'immersive' } });
	owner.setFullscreen(mode === 'fullscreen');
	if (mode === 'immersive') owner.setCameraDistance(7);
	const distance = owner.getEffectiveCameraDistance();
	const before = owner.controls!.target.clone();
	const event = { ...wheel(mode === 'split' ? 20 : 80, 8), deltaX: 12, target: ports.canvas } as WheelEvent;
	owner.handleWheel(event);
	expect(event.preventDefault).toHaveBeenCalled();
	expect(owner.controls!.target.distanceTo(before)).toBeGreaterThan(0.01);
	expect(owner.getEffectiveCameraDistance()).toBeCloseTo(distance, 8);
	expect(owner.wheelZoomTargetDistance).toBeUndefined();
	const after = owner.controls!.target.clone();
	const ui = { ...wheel(80, 8), deltaX: 12, target: mode === 'split' ? ports.canvas : ports.cssRoot } as WheelEvent;
	owner.handleWheel(ui);
	if (mode !== 'immersive') expect(ui.preventDefault).not.toHaveBeenCalled();
	expect(owner.controls!.target.equals(after)).toBe(true);
	owner.dispose();
});

test('wheel zoom-out returns viewport-centered enlargement to the original stage alignment', () => {
	const { owner } = detailFixture(true);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	owner.advance(1, 2);
	expect(owner.viewportCentering).toBe(1);
	owner.handleWheel(wheel(50, 5000));
	owner.advance(2, 0.016);
	expect(owner.viewportCentering).toBeGreaterThan(0);
	expect(owner.viewportCentering).toBeLessThan(1);
	for (let i = 0; i < 200; i++) owner.advance(3 + i, 0.016);
	expect(owner.viewportCentering).toBe(0);
	owner.dispose();
});

test('drag, long press, cancelled contacts and multiple fingers never trigger tap zoom', () => {
	const { owner } = detailFixture();
	owner.handlePointerDown(pointer(1));
	owner.handlePointerMove({ ...pointer(1), clientX: 40 } as PointerEvent);
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	expect(owner.viewResetActive).toBe(false);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerDown(pointer(2));
	owner.handlePointerUp(pointer(2, 'touch', 'pointerup'));
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	expect(owner.viewResetActive).toBe(false);
	owner.handlePointerDown(pointer(1));
	owner.handlePointerUp(pointer(1, 'touch', 'pointercancel'));
	expect(owner.viewResetActive).toBe(false);
	const time = vi.spyOn(performance, 'now').mockReturnValue(0);
	owner.handlePointerDown(pointer(1));
	time.mockReturnValue(501);
	owner.handlePointerUp(pointer(1, 'touch', 'pointerup'));
	expect(owner.viewResetActive).toBe(false);
	owner.dispose();
});

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
