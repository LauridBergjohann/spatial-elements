import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
	CatalogSpatialElementLayer,
	getSpatialElementHandoffProjection,
	normalizeSpatialElementClipMatrix
} from './CatalogSpatialElementLayer.js';
import { SpatialElementAssetManager, type LoadedSpatialElementAsset } from './assets/SpatialElementAssetManager.js';

vi.mock('./CatalogGeometryFade.js', () => ({
	CatalogGeometryFade: class {
		render(_renderer: unknown, _opacity: number, draw: () => void) {
			draw();
		}
		dispose() {}
	}
}));
afterEach(() => vi.unstubAllGlobals());

function project(matrix: THREE.Matrix4, point: THREE.Vector3) {
	const result = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(matrix);
	return new THREE.Vector3(result.x / result.w, result.y / result.w, result.z / result.w);
}

function fixture() {
	const reference = new THREE.Vector3(0.2, -0.3, 0.1);
	const sourceCamera = new THREE.PerspectiveCamera(40, 1.6, 1, 4000);
	const targetCamera = new THREE.PerspectiveCamera(45, 1.6, 0.01, 100);
	sourceCamera.coordinateSystem = THREE.WebGPUCoordinateSystem;
	targetCamera.coordinateSystem = THREE.WebGPUCoordinateSystem;
	sourceCamera.position.set(0, 0, 1000);
	targetCamera.position.set(-1, 0.8, 4);
	targetCamera.lookAt(reference);
	sourceCamera.updateProjectionMatrix();
	targetCamera.updateProjectionMatrix();
	sourceCamera.updateMatrixWorld();
	targetCamera.updateMatrixWorld();
	const sourceModel = new THREE.Matrix4().compose(
		new THREE.Vector3(-340, 170, 0),
		new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.2, 0)),
		new THREE.Vector3(30, 30, 30)
	);
	const targetModel = new THREE.Matrix4().compose(
		new THREE.Vector3(-0.2, 0.3, -0.1),
		new THREE.Quaternion(),
		new THREE.Vector3(1, 1, 1)
	);
	const sourceClip = normalizeSpatialElementClipMatrix(
		new THREE.Matrix4()
			.multiplyMatrices(sourceCamera.projectionMatrix, sourceCamera.matrixWorldInverse)
			.multiply(sourceModel),
		reference
	);
	const targetClip = normalizeSpatialElementClipMatrix(
		new THREE.Matrix4()
			.multiplyMatrices(targetCamera.projectionMatrix, targetCamera.matrixWorldInverse)
			.multiply(targetModel),
		reference
	);
	return {
		reference,
		sourceCamera,
		targetCamera,
		sourceModel,
		targetModel,
		sourceClip,
		targetClip
	};
}

describe('catalog spatialElement clip-space handoff', () => {
	it('preserves the complete source and target projection for multiple geometry points', () => {
		const values = fixture();
		const points = [
			values.reference,
			new THREE.Vector3(-0.4, -0.4, 0.4),
			new THREE.Vector3(0.4, 0.4, -0.4)
		];
		for (const progress of [0, 1]) {
			const camera = progress ? values.targetCamera : values.sourceCamera;
			const model = progress ? values.targetModel : values.sourceModel;
			const projection = getSpatialElementHandoffProjection(
				values.sourceClip,
				values.targetClip,
				progress,
				model,
				camera.matrixWorld,
				{
					...values,
					sourceCamera: values.sourceCamera.matrixWorld,
					targetCamera: values.targetCamera.matrixWorld
				}
			);
			const actual = projection.multiply(camera.matrixWorldInverse).multiply(model);
			const expected = progress ? values.targetClip : values.sourceClip;
			for (const point of points)
				expect(project(actual, point).distanceTo(project(expected, point))).toBeLessThan(1e-10);
		}
	});

	it('rotates a half-turn without collapsing the spatialElement volume at the midpoint', () => {
		const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
		camera.position.z = 5;
		camera.updateMatrixWorld();
		const sourceModel = new THREE.Matrix4().makeRotationY(Math.PI);
		const targetModel = new THREE.Matrix4();
		const clip = (model: THREE.Matrix4) =>
			normalizeSpatialElementClipMatrix(
				camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).multiply(model),
				new THREE.Vector3()
			);
		const sourceClip = clip(sourceModel),
			targetClip = clip(targetModel);
		for (const progress of [0.25, 0.5, 0.75]) {
			const actual = getSpatialElementHandoffProjection(
				sourceClip,
				targetClip,
				progress,
				new THREE.Matrix4(),
				new THREE.Matrix4(),
				{
					sourceModel,
					targetModel,
					sourceCamera: camera.matrixWorld,
					targetCamera: camera.matrixWorld
				}
			);
			const expected = clip(new THREE.Matrix4().makeRotationY(Math.PI * (1 - progress)));
			for (const point of [new THREE.Vector3(0.5, 0.4, 0.3), new THREE.Vector3(-0.5, -0.4, -0.3)])
				expect(project(actual, point).distanceTo(project(expected, point))).toBeLessThan(1e-10);
			expect(Math.abs(actual.determinant())).toBeGreaterThan(1e-6);
		}
	});

	it('moves the reference point continuously in screen space despite different source and target depths', () => {
		const values = fixture();
		const start = project(values.sourceClip, values.reference);
		const end = project(values.targetClip, values.reference);
		const identity = new THREE.Matrix4();
		for (const progress of [0.1, 0.25, 0.5, 0.75, 0.9]) {
			const projection = getSpatialElementHandoffProjection(
				values.sourceClip,
				values.targetClip,
				progress,
				identity,
				identity,
				{
					...values,
					sourceCamera: values.sourceCamera.matrixWorld,
					targetCamera: values.targetCamera.matrixWorld
				}
			);
			const position = project(projection, values.reference);
			expect(position.x).toBeCloseTo(THREE.MathUtils.lerp(start.x, end.x, progress), 10);
			expect(position.y).toBeCloseTo(THREE.MathUtils.lerp(start.y, end.y, progress), 10);
		}
	});
});

describe('catalog preview lifetime', () => {
	it('clears mouse proximity immediately on touch or pen and accepts a mouse again', () => {
		const events = new EventTarget();
		vi.stubGlobal('window', Object.assign(events, {
			matchMedia: () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() })
		}));
		vi.stubGlobal('ResizeObserver', class { disconnect() {} });
		const invalidate = vi.fn();
		const manager = new SpatialElementAssetManager({ loader: { load: vi.fn() } });
		const layer = new CatalogSpatialElementLayer(manager, invalidate);
		const pointer = (type: string, pointerType: string) => events.dispatchEvent(Object.assign(
			new Event(type), { pointerType, clientX: 20, clientY: 30 }
		));
		const active = () => (layer as unknown as { pointer: { active: boolean } }).pointer.active;
		try {
			pointer('pointermove', 'mouse');
			expect(active()).toBe(true);
			pointer('pointerdown', 'touch');
			expect(active()).toBe(false);
			invalidate.mockClear();
			pointer('pointermove', 'touch');
			pointer('pointermove', 'pen');
			expect(active()).toBe(false);
			expect(invalidate).not.toHaveBeenCalled();
			pointer('pointermove', 'mouse');
			expect(active()).toBe(true);
			pointer('pointermove', 'pen');
			expect(active()).toBe(false);
		} finally {
			layer.dispose();
		}
	});

	it('loads only nearby cards with bounded concurrency and keeps the captured actor across page removal', async () => {
		const slots = new Map<string, unknown>();
		for (let index = 0; index < 5; index += 1) {
			const top = index === 4 ? 10_000 : 100;
			const rect = {
				left: index * 200,
				top,
				width: 180,
				height: 220,
				right: index * 200 + 180,
				bottom: top + 220
			};
			const card = {
				isConnected: true,
				style: { transform: '', setProperty: vi.fn(), removeProperty: vi.fn() },
				getBoundingClientRect: () => rect,
				setAttribute: vi.fn(),
				removeAttribute: vi.fn()
			};
			slots.set(String(index), {
				isConnected: true,
				getBoundingClientRect: () => rect,
				closest: () => card
			});
		}
		const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
		vi.stubGlobal('window', {
			innerWidth: 1440,
			innerHeight: 900,
			scrollX: 0,
			scrollY: 0,
			matchMedia: () => media,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		});
		vi.stubGlobal('CSS', { escape: (value: string) => value });
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				disconnect() {}
			}
		);
		vi.stubGlobal('document', {
			querySelector: () => ({
				querySelectorAll: () => [],
				querySelector: (selector: string) =>
					slots.get(selector.match(/data-spatial-element-id="([^"]+)"/)?.[1] ?? '')
			})
		});
		const pending: Array<(asset: LoadedSpatialElementAsset) => void> = [];
		const load = vi.fn(() => new Promise<LoadedSpatialElementAsset>((resolve) => pending.push(resolve)));
		const manager = new SpatialElementAssetManager({ loader: { load } });
		const layer = new CatalogSpatialElementLayer(manager, vi.fn());
		const spatialElements = Array.from({ length: 5 }, (_, index) => ({
			id: String(index),
			href: '/spatialElement',
			eyebrow: 'SpatialElement',
			title: 'SpatialElement',
			features: [],
			...{
				geometry: { low: `/assets/${index}.glb`, high: `/assets/${index}.glb` },
				hdr: '/assets/environment.hdr',
				background: { blurriness: 0, tint: '#fff', tintIntensity: 0 }
			}
		}));
		const createAsset = () => {
			const scene = new THREE.Group();
			scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
			return { scene };
		};
		const ready = layer.setSpatialElements('demo', spatialElements);
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
		pending[0](createAsset());
		pending[1](createAsset());
		await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(4));
		pending[2](createAsset());
		pending[3](createAsset());
		await ready;
		expect(load).toHaveBeenCalledTimes(4);
		const renderer = {
			coordinateSystem: THREE.WebGPUCoordinateSystem,
			clearDepth: vi.fn(),
			render: vi.fn((scene: THREE.Scene) => scene.updateMatrixWorld(true))
		} as unknown as THREE.WebGPURenderer;
		const renderFrame = (now: number) => {
			const animating = layer.update(renderer, null, now);
			layer.draw(renderer, 'front');
			return animating;
		};
		expect(renderFrame(100)).toBe(false);
		const listDraws = vi.mocked(renderer.render).mock.calls.length;
		layer.draw(renderer, 'rear');
		expect(renderer.render).toHaveBeenCalledTimes(listDraws);
		const opacities = (scene: THREE.Scene) => {
			const values: number[] = [];
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					const materials = Array.isArray(object.material) ? object.material : [object.material];
					values.push(...materials.map((material) => material.opacity));
				}
			});
			return values;
		};
		layer.setExitOpacity(0.25, true);
		renderFrame(116);
		expect(opacities(vi.mocked(renderer.render).mock.calls.at(-1)![0] as THREE.Scene)).toEqual([
			1, 1, 1, 1
		]);
		expect(layer.capture('0')).toBe(true);
		layer.setExitOpacity(0.1, true);
		renderFrame(132);
		const renderedScenes = vi.mocked(renderer.render).mock.calls.slice(-2);
		expect(opacities(renderedScenes[0][0] as THREE.Scene)).toEqual([1, 1, 1]);
		expect(opacities(renderedScenes[1][0] as THREE.Scene)).toEqual([1]);
		await layer.setSpatialElements('demo', []);
		expect(manager.getStats().activeInstances).toBe(4);
		renderFrame(148);
		expect(opacities(vi.mocked(renderer.render).mock.calls.at(-2)![0] as THREE.Scene)).toEqual([
			1, 1, 1
		]);
		layer.finishHandoff();
		expect(manager.getStats().activeInstances).toBe(0);
		const completedDraws = vi.mocked(renderer.render).mock.calls.length;
		layer.draw(renderer, 'front');
		layer.draw(renderer, 'rear');
		expect(renderer.render).toHaveBeenCalledTimes(completedDraws);
		layer.dispose();
		manager.dispose();
	});

	it('measures carousel summary sizes before animation writes and refreshes them on resize', async () => {
		const activity: string[] = [];
		let summaryWidth = 360;
		const summary = {
			style: { transform: '', visibility: '' },
			get offsetWidth() { activity.push('measure'); return summaryWidth; },
			get offsetHeight() { activity.push('measure'); return 200; }
		};
		const hitTarget = { style: new Proxy({}, {
			set(target, property, value) {
				activity.push('write');
				return Reflect.set(target, property, value);
			}
		}) };
		const rect = { left: 0, top: 100, width: 1200, height: 600, right: 1200, bottom: 700 };
		const card = {
			isConnected: true,
			dataset: {},
			style: { transform: '', visibility: '', removeProperty: vi.fn() },
			getBoundingClientRect: () => rect,
			querySelector: (selector: string) => selector === '.summary' ? summary : hitTarget,
			setAttribute: vi.fn(),
			removeAttribute: vi.fn()
		};
		const slot = { isConnected: true, getBoundingClientRect: () => rect, closest: () => card };
		let resized!: () => void;
		const observe = vi.fn(), unobserve = vi.fn();
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback: () => void) { resized = callback; }
			observe = observe;
			unobserve = unobserve;
			disconnect() {}
		});
		vi.stubGlobal('window', {
			innerWidth: 1440, innerHeight: 900, scrollX: 0, scrollY: 0,
			matchMedia: () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
			addEventListener: vi.fn(), removeEventListener: vi.fn()
		});
		vi.stubGlobal('CSS', { escape: (value: string) => value });
		vi.stubGlobal('document', {
			querySelector: () => ({ querySelectorAll: () => [], querySelector: () => slot })
		});
		const scene = new THREE.Group();
		scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
		const manager = new SpatialElementAssetManager({ loader: { load: async () => ({ scene }) } });
		const layer = new CatalogSpatialElementLayer(manager, vi.fn());
		try {
			await layer.setSpatialElements('demo', [{
				id: 'cube', href: '/cube', eyebrow: 'Form', title: 'Cube',
				geometry: { low: '/cube.glb', high: '/cube.glb' }, hdr: '/studio.hdr', background: { blurriness: 0, tint: '#fff', tintIntensity: 0 },
				pose: { kind: 'carousel', read: () => ({ x: 0.5, y: 0.5, size: 0.82, depth: 0, yaw: 0, visible: true, front: true, panelOpacity: 1, opacity: 1 }) }
			}]);
			const renderer = {
				coordinateSystem: THREE.WebGPUCoordinateSystem,
				getScissor: (out: THREE.Vector4) => out.set(0, 0, 1440, 900),
				getScissorTest: () => false,
				setScissor: vi.fn(), setScissorTest: vi.fn(), clearDepth: vi.fn(), render: vi.fn()
			} as unknown as THREE.WebGPURenderer;
			layer.update(renderer, null, 100);
			expect(activity.slice(0, 2)).toEqual(['measure', 'measure']);
			expect(activity.filter((item) => item === 'measure')).toHaveLength(2);
			expect(observe).toHaveBeenCalledWith(summary);
			layer.draw(renderer, 'front');
			// A clipped carousel group needs one scene submission, without an empty list pass.
			expect(renderer.render).toHaveBeenCalledTimes(1);
			activity.length = 0;
			layer.update(renderer, null, 116);
			expect(activity).not.toContain('measure');
			summaryWidth = 420;
			resized();
			activity.length = 0;
			layer.update(renderer, null, 132);
			expect(activity.slice(0, 2)).toEqual(['measure', 'measure']);
		} finally {
			layer.dispose();
			manager.dispose();
		}
		expect(unobserve).toHaveBeenCalledWith(summary);
	});
});
