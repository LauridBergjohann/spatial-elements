import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { SpatialGeometryCapture, captureSpatialElementProjection } from './SpatialGeometryCapture.js';

afterEach(() => vi.unstubAllGlobals());

it('retains the exact submitted projection across a rebase and releases its resources once', () => {
	vi.stubGlobal('innerWidth', 1440);
	vi.stubGlobal('innerHeight', 900);
	const model = new THREE.Group();
	model.add(new THREE.Group());
	const camera = new THREE.PerspectiveCamera(45, 1.5, 0.1, 100);
	camera.position.set(1, 2, 8);
	camera.lookAt(0, 0, 0);
	const source = captureSpatialElementProjection(model, camera);
	source.viewportClip = { left: 10, top: 50, width: 500, height: 600 };
	source.fog = new THREE.Fog(0xffffff, 1200, 2500);
	const release = vi.fn();
	const capture = new SpatialGeometryCapture(model, source, {
		environment: null,
		lights: [],
		release
	});
	const renderer = {
		coordinateSystem: camera.coordinateSystem,
		clearDepth: vi.fn(),
		getScissor: () => new THREE.Vector4(0, 0, 1440, 900),
		getScissorTest: () => false,
		setScissor: vi.fn(),
		setScissorTest: vi.fn(),
		render: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	capture.render(renderer);
	expect(renderer.setScissor).toHaveBeenCalledWith(10, 50, 500, 600);
	expect(renderer.setScissorTest).toHaveBeenLastCalledWith(false);
	expect((vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene).fog).toBe(source.fog);
	capture
		.getSnapshot()
		.projection.forEach((value, i) => expect(value).toBeCloseTo(source.clip.elements[i], 10));
	const targetModel = new THREE.Group();
	targetModel.position.set(2, -1, 0);
	targetModel.scale.setScalar(0.2);
	const target = captureSpatialElementProjection(targetModel, camera);
	capture.setTarget(target, 0.43, 0.2);
	capture.render(renderer);
	const presented = capture.getSnapshot().projection;
	capture.freeze();
	capture.setTarget(source, 0, 0);
	capture.render(renderer);
	expect((vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene).fog).toBe(source.fog);
	capture
		.getSnapshot()
		.projection.forEach((value, i) => expect(value).toBeCloseTo(presented[i], 10));
	capture.dispose();
	capture.dispose();
	capture.render(renderer);
	expect(release).toHaveBeenCalledTimes(1);
	expect(model.parent).toBeNull();
	expect(capture.getSnapshot().frames).toBe(3);
});
