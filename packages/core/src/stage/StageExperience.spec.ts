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
