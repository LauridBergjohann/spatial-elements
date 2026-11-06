import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { PanelPresentationController, type PanelPresentationPorts } from './PanelPresentationController.js';
import { resolveLiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import { getPanelFocusOpacity, getPerspectiveDistance, getStageUiFocus } from './stageMath.js';
import { PANEL_CAMERA_FOV } from './stageConstants.js';
import type { StagePanelRuntime } from './StagePanelRuntime.js';
import type { StagePanelTarget } from './stageTypes.js';

afterEach(() => vi.unstubAllGlobals());

test.each(['frosted', 'glass'] as const)('native %s shell follows the GPU focus pose without changing its measured frame or DOM owner', surfaceKind => {
	const width = 1440, height = 900;
	vi.stubGlobal('window', { innerWidth: width, innerHeight: height, location: { search: '' } });
	let focus = 0;
	const style = () => ({
		setProperty(name: string, value: string) { (this as Record<string, unknown>)[name] = value; },
		getPropertyValue(name: string) { return String((this as Record<string, unknown>)[name] ?? ''); }
	});
	const frame = { closest: () => ({}), getBoundingClientRect() { throw new Error('Focus must not remeasure or move the anchor'); } };
	const surface = { style: style(), inert: false, parentElement: frame };
	const content = { style: style(), parentElement: surface };
	const target = { frame, surfaceElement: surface, content, nativeContent: true } as unknown as StagePanelTarget;
	const camera = new THREE.PerspectiveCamera(PANEL_CAMERA_FOV, width / height, .1, 5000);
	camera.position.z = getPerspectiveDistance(height, PANEL_CAMERA_FOV); camera.updateMatrixWorld(true);
	const group = new THREE.Group(), projectionRoot = new THREE.Group();
	projectionRoot.matrixAutoUpdate = false; projectionRoot.add(group);
	const panel = { group, projectionRoot, pointerLift: 0, pointerReactive: false, focusReactive: true,
		options: resolveLiquidGlassPanelOptions({ width: 1328, height: 64, position: { x: 0, y: 402 } }),
		surface: surfaceKind, glass: surfaceKind === 'glass' ? { setVisibilityAlpha: vi.fn(), dispose: vi.fn() } : undefined
	} as unknown as StagePanelRuntime;
	const owner = new PanelPresentationController({ camera, registrations: () => [target], minimaps: () => new Map(),
		visible: () => true, transitionOpacity: () => 1,
		frame: () => ({ pointer: { active: false, x: 0, y: 0 }, uiFocus: getStageUiFocus(focus), minimapFocus: 0,
			presentation: { active: false } })
	} as PanelPresentationPorts);
	owner.add(panel);
	let intermediateDelta = 0;
	for (focus of [0, .3, .6, 1, .6, .3, 0]) {
		owner.updatePanelPointerInteraction(1 / 60);
		const css = (surface.style as unknown as CSSStyleDeclaration).transform;
		const [, x, y, scale] = css.match(/^translate\(([^p]+)px, ([^p]+)px\) scale\(([^)]+)\)$/)!.map(Number);
		projectionRoot.updateMatrixWorld(true);
		const center = new THREE.Vector3().applyMatrix4(group.matrixWorld).project(camera);
		const corner = new THREE.Vector3(panel.options.width / 2, panel.options.height / 2, 0)
			.applyMatrix4(group.matrixWorld).project(camera);
		expect(width / 2 + x).toBeCloseTo((center.x + 1) * width / 2, 8);
		expect(48 + y).toBeCloseTo((1 - center.y) * height / 2, 8);
		expect(panel.options.width * scale / 2).toBeCloseTo((corner.x - center.x) * width / 2, 8);
		expect(panel.options.height * scale / 2).toBeCloseTo((corner.y - center.y) * height / 2, 8);
		expect(content.parentElement).toBe(surface); expect(surface.parentElement).toBe(frame);
		expect(Number((content.style as Record<string, unknown>)['--stage-panel-content-opacity']))
			.toBeCloseTo(getPanelFocusOpacity(getStageUiFocus(focus)), 10);
		if (focus === .6) intermediateDelta = y;
		if (focus === 1) {
			expect(surface.inert).toBe(true);
			expect((surface.style as unknown as CSSStyleDeclaration).visibility).toBe('hidden');
		}
	}
	expect(intermediateDelta).toBeLessThan(-120);
	expect(surface.inert).toBe(false);
	expect((surface.style as unknown as CSSStyleDeclaration).transform).toBe('translate(0px, 0px) scale(1)');
	expect((content.style as unknown as CSSStyleDeclaration).filter).toBe('');
	focus = 1; owner.updatePanelPointerInteraction(1 / 60);
	owner.release();
	expect(surface.inert).toBe(false);
});
