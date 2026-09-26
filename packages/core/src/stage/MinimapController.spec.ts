import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { MinimapController } from './MinimapController.js';
import { resolveLiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import type { StagePanelRuntime } from './StagePanelRuntime.js';

afterEach(() => vi.unstubAllGlobals());

test('minimap uses the independent Low representation and disposes local targets once', () => {
	vi.stubGlobal('window', { devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900 });
	const low = new THREE.Group();
	const lowMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
	lowMesh.name = 'low-housing';
	low.add(lowMesh);
	const high = new THREE.Group();
	const highMesh = lowMesh.clone();
	highMesh.name = 'high-detail';
	high.add(highMesh);
	const panel: StagePanelRuntime = {
		group: new THREE.Group(),
		options: resolveLiquidGlassPanelOptions({ width: 120, height: 120 }),
		domRenderMode: 'native',
		nativeRestFrames: 0,
		pointerLift: 0,
		pointerReactive: true,
		surface: 'frosted'
	};
	const capture = new THREE.RenderTarget(16, 16);
	const camera = new THREE.PerspectiveCamera();
	const panelCamera = new THREE.PerspectiveCamera();
	panelCamera.position.z = 1000;
	const owner = new MinimapController({
		renderer: {} as THREE.WebGPURenderer,
		camera,
		panelCamera,
		panelScene: new THREE.Scene(),
		panel: () => panel,
		target: () => undefined,
		spatialElement: () => ({
			model: high,
			low,
			camera: {},
			restCamera: new THREE.Quaternion(),
			restModel: new THREE.Quaternion(),
			hasControls: false,
			referenceTarget: new THREE.Vector3()
		}),
		frame: () => ({ hovering: false, interacting: false, scrolling: false }),
		environment: () => undefined,
		capture: () => ({ scale: 1, sceneCapture: capture }),
		blurTexture: () => capture.texture,
		transitionOpacity: () => 1,
		pixelRatio: () => 1,
		includeMesh: () => true
	});
	owner.createMinimap(0, {});
	const view = owner.views.get(0)!;
	owner.updateMinimapOverlayCaptureState(view);
	view.overlayCaptureDirty = false;
	view.panelCaptureDirty = false;
	// The main camera moves the viewport cutout/backdrop, not the captured Low pixels.
	view.overlayViewportCenter.value.x += 5;
	view.overlayProgress = 1;
	camera.position.x += 5;
	camera.updateMatrixWorld(true);
	owner.updateMinimapOverlayCaptureState(view);
	expect(view.overlayCaptureDirty).toBe(false);
	expect(view.panelCaptureDirty).toBe(true);
	view.screenCamera.position.x += 5;
	view.screenCamera.updateMatrixWorld(true);
	owner.updateMinimapOverlayCaptureState(view);
	expect(view.panelCaptureDirty).toBe(true);
	expect(view.overlayCaptureDirty).toBe(false);
	view.model.position.x += 1;
	view.model.updateMatrixWorld(true);
	owner.updateMinimapOverlayCaptureState(view);
	expect(view.overlayCaptureDirty).toBe(true);
	const restVersion = view.ringRestMaterial.version;
	const foregroundVersion = view.ringForegroundMaterial.version;
	owner.updateMinimapOverlayVisibility(view);
	expect(view.overlayRing.material).toBe(view.ringForegroundMaterial);
	view.overlayProgress = 0;
	owner.updateMinimapOverlayVisibility(view);
	expect(view.overlayRing.material).toBe(view.ringRestMaterial);
	expect(view.ringRestMaterial.version).toBe(restVersion);
	expect(view.ringForegroundMaterial.version).toBe(foregroundVersion);
	expect(view.spatialElementRoot.getObjectByName('low-housing')).toBeDefined();
	expect(view.spatialElementRoot.getObjectByName('high-detail')).toBeUndefined();
	high.clear();
	expect(view.spatialElementRoot.getObjectByName('low-housing')).toBeDefined();
	const disposed = vi.fn();
	view.contextTarget.addEventListener('dispose', disposed);
	const sourceDisposed = vi.spyOn(lowMesh.geometry, 'dispose');
	const retainedScene = new THREE.Scene();
	retainedScene.add(view.spatialElementRoot);
	const retainedMesh = view.spatialElementRoot.getObjectByName('low-housing') as THREE.Mesh<
		THREE.BufferGeometry,
		THREE.Material
	>;
	const retainedDisposed = vi.spyOn(retainedMesh.material, 'dispose');
	owner.dispose();
	owner.dispose();
	expect(disposed).toHaveBeenCalledTimes(1);
	expect(sourceDisposed).not.toHaveBeenCalled();
	expect(owner.views.size).toBe(0);
	expect(retainedScene.getObjectByName('low-housing')).toBe(retainedMesh);
	expect(retainedDisposed).not.toHaveBeenCalled();
	retainedMesh.material.dispose();
	capture.dispose();
	lowMesh.geometry.dispose();
	lowMesh.material.dispose();
});
