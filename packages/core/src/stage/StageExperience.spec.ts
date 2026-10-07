import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { StageExperience } from './StageExperience.js';
import type { SpatialElementInteractionController } from './SpatialElementInteractionController.js';

vi.mock('three/webgpu', async (original) => ({
	...(await original<typeof import('three/webgpu')>()),
	WebGPURenderer: class {
		domElement = {
			style: {},
			getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
		};
		getCanvasTarget() { return {}; }
		onDeviceLost() {}
		setCanvasTarget() {}
		setClearColor() {}
	}
}));
vi.mock('./StageRenderPipeline.js', () => ({
	StageRenderPipeline: class {
		activeRenderTargets = {};
		stageDisplayQuad = {};
		setPageBackground() {}
		updateInteractionTheme() {}
		renderFrame() {}
	}
}));
vi.mock('three/addons/renderers/CSS3DRenderer.js', () => ({
	CSS3DRenderer: class {
		domElement = { style: {} };
		render() {}
	}
}));
vi.mock('three/addons/controls/OrbitControls.js', () => ({
	OrbitControls: class {
		target = new THREE.Vector3();
		minDistance = 1;
		maxDistance = 20;
		zoomSpeed = 1;
		update() { return false; }
		dispose() {}
		addEventListener() {}
		removeEventListener() {}
	}
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test('appearance updates restore element background defaults and preserve camera and lighting', () => {
	vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100, location: { search: '' } });
	vi.stubGlobal('document', { hidden: false, createElement: () => ({ style: {} }) });
	vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	const experience = new StageExperience({} as HTMLElement);
	const stage = experience as unknown as {
		camera: THREE.PerspectiveCamera;
		scene: THREE.Scene;
		backgroundScene: THREE.Scene;
		tintMaterial: THREE.MeshBasicMaterial;
		appliedEnvironment: { source: THREE.Texture; target: { texture: THREE.Texture } };
		interactionTheme: { outlineColor: string };
	};
	stage.camera.position.set(3, 4, 5);
	stage.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
	const orientation = stage.camera.quaternion.clone();
	stage.scene.environment = new THREE.Texture();
	const lighting = stage.scene.environment;
	stage.tintMaterial = new THREE.MeshBasicMaterial();
	stage.appliedEnvironment = { source: new THREE.Texture(), target: { texture: new THREE.Texture() } };
	experience.updateAppearance({ background: { tint: '#111820', tintIntensity: 0.85, blurriness: 0 }, interactionTheme: { outlineColor: '#80bfff' } });
	expect(stage.tintMaterial.color.getHexString()).toBe('111820');
	expect(stage.tintMaterial.opacity).toBe(0.85);
	expect(stage.backgroundScene.background).toBe(stage.appliedEnvironment.source);
	expect(stage.interactionTheme.outlineColor).toBe('#80bfff');
	experience.updateAppearance({ background: { tint: '#e6edf4', tintIntensity: 0.3, blurriness: 0.2 } });
	expect(stage.tintMaterial.color.getHexString()).toBe('e6edf4');
	expect(stage.backgroundScene.background).toBe(stage.appliedEnvironment.target.texture);
	expect(stage.camera.position.toArray()).toEqual([3, 4, 5]);
	expect(stage.camera.quaternion.equals(orientation)).toBe(true);
	expect(stage.scene.environment).toBe(lighting);
	stage.tintMaterial.dispose();
	lighting.dispose();
	stage.appliedEnvironment.source.dispose();
	stage.appliedEnvironment.target.texture.dispose();
	experience.assets.dispose();
});

test.each(['wheel', 'spacemouse'] as const)(
	'%s bursts immediately before rendering do not shorten the animation frame delta',
	(input) => {
		vi.stubGlobal('window', { innerWidth: 100, innerHeight: 100, location: { search: '' } });
		vi.stubGlobal('document', { hidden: false, createElement: () => ({ style: {} }) });
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
		const now = vi.spyOn(performance, 'now').mockReturnValue(0);
		const experience = new StageExperience({} as HTMLElement);
		// Exercise the actual stage/input wiring without creating a GPU device.
		const stage = experience as unknown as {
			camera: THREE.PerspectiveCamera;
			interaction: SpatialElementInteractionController;
			renderFrame(force: boolean): void;
		};
		stage.camera.position.z = 10;
		stage.interaction.initialize();
		stage.interaction.captureInitialView();
		vi.spyOn(stage.interaction, 'hitTestModel').mockReturnValue(true);
		const advance = vi.spyOn(stage.interaction, 'advance');
		now.mockReturnValue(16);
		stage.renderFrame(true);

		for (const time of [20, 24, 28, 31]) {
			now.mockReturnValue(time);
			if (input === 'wheel') {
				stage.interaction.handleWheel({
					clientX: 50, clientY: 50, deltaY: -1, deltaMode: 0, ctrlKey: false,
					target: null, preventDefault() {}, stopImmediatePropagation() {}
				} as unknown as WheelEvent);
			} else {
				stage.interaction.applySpaceMouseNavigationUpdate({
					viewMatrix: new THREE.Matrix4().makeTranslation(0, 0, 8).toArray()
				});
			}
		}
		now.mockReturnValue(32);
		stage.renderFrame(true);
		expect(advance.mock.calls.map(([, delta]) => delta)).toEqual([0.016, 0.016]);
		stage.interaction.dispose();
		experience.assets.dispose();
	}
);
