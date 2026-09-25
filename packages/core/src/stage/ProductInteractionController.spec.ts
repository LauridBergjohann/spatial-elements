import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
	ProductInteractionController,
	type ProductInteractionPorts
} from './ProductInteractionController.js';

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
	}
}));

function fixture() {
	const camera = new THREE.PerspectiveCamera(50);
	camera.position.z = 10;
	let poseOwner: 'page' | 'transition' | 'none' = 'page';
	const ports: ProductInteractionPorts = {
		camera,
		canvas: { style: {} } as HTMLCanvasElement,
		container: {} as HTMLElement,
		cssRoot: {} as HTMLElement,
		requestRender: vi.fn(),
		markActivity: vi.fn(),
		updateProjection: vi.fn(),
		readGeometry: () => ({
			poseOwner,
			visible: true,
			viewport: new THREE.Vector4(0, 0, 100, 100),
			bounds: new THREE.Box3()
		})
	};
	const owner = new ProductInteractionController(ports);
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
	expect(ports.markActivity).not.toHaveBeenCalled();
	setOwner('page');
	owner.applySpaceMouseNavigationUpdate({
		viewMatrix: new THREE.Matrix4().makeTranslation(3, 0, 8).toArray()
	});
	expect(camera.position.x).toBe(3);
	expect(ports.markActivity).toHaveBeenCalledTimes(1);
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
