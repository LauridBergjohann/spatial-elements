import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
	SpatialElementInteractionController,
	type SpatialElementInteractionPorts
} from './SpatialElementInteractionController.js';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
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

vi.mock('three/addons/controls/OrbitControls.js', () => ({
	OrbitControls: class {
		target = new THREE.Vector3();
		minDistance = 1;
		maxDistance = 20;
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
