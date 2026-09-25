import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
	CatalogProductLayer,
	getProductHandoffProjection,
	normalizeProductClipMatrix
} from './CatalogProductLayer.js';
import { ProductAssetManager, type LoadedProductAsset } from './assets/ProductAssetManager.js';

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
	const sourceClip = normalizeProductClipMatrix(
		new THREE.Matrix4()
			.multiplyMatrices(sourceCamera.projectionMatrix, sourceCamera.matrixWorldInverse)
			.multiply(sourceModel),
		reference
	);
	const targetClip = normalizeProductClipMatrix(
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

describe('catalog product clip-space handoff', () => {
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
			const projection = getProductHandoffProjection(
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

	it('rotates a half-turn without collapsing the product volume at the midpoint', () => {
		const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
		camera.position.z = 5;
		camera.updateMatrixWorld();
		const sourceModel = new THREE.Matrix4().makeRotationY(Math.PI);
		const targetModel = new THREE.Matrix4();
		const clip = (model: THREE.Matrix4) =>
			normalizeProductClipMatrix(
				camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).multiply(model),
				new THREE.Vector3()
			);
		const sourceClip = clip(sourceModel),
			targetClip = clip(targetModel);
		for (const progress of [0.25, 0.5, 0.75]) {
			const actual = getProductHandoffProjection(
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
			const projection = getProductHandoffProjection(
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
					slots.get(selector.match(/data-product-id="([^"]+)"/)?.[1] ?? '')
			})
		});
		const pending: Array<(asset: LoadedProductAsset) => void> = [];
		const load = vi.fn(() => new Promise<LoadedProductAsset>((resolve) => pending.push(resolve)));
		const manager = new ProductAssetManager({ loader: { load } });
		const layer = new CatalogProductLayer(manager, vi.fn());
		const products = Array.from({ length: 5 }, (_, index) => ({
			id: String(index),
			href: '/product',
			eyebrow: 'Product',
			title: 'Product',
			features: [],
			stage: {
				glb: `/assets/${index}.glb`,
				hdr: '/assets/environment.hdr',
				background: { blurriness: 0, tint: '#fff', tintIntensity: 0 }
			}
		}));
		const createAsset = () => {
			const scene = new THREE.Group();
			scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
			return { scene };
		};
		const ready = layer.setProducts('demo', products);
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
		await layer.setProducts('demo', []);
		expect(manager.getStats().activeInstances).toBe(4);
		renderFrame(148);
		expect(opacities(vi.mocked(renderer.render).mock.calls.at(-2)![0] as THREE.Scene)).toEqual([
			1, 1, 1
		]);
		layer.finishHandoff();
		expect(manager.getStats().activeInstances).toBe(0);
		layer.dispose();
		manager.dispose();
	});
});
