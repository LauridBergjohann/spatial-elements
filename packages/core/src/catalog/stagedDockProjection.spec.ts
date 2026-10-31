import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { StageExperience } from '../stage/StageExperience.js';
import { PageBindingController } from '../stage/PageBindingController.js';
import { PanelPresentationController, type PanelPresentationPorts } from '../stage/PanelPresentationController.js';
import { resolveLiquidGlassPanelOptions } from '../stage/LiquidGlassPanel.js';
import type { StagePanelRuntime } from '../stage/StagePanelRuntime.js';
import type { StagePanelTarget } from '../stage/stageTypes.js';
import type { StageMinimapState } from '../stage/minimap/MinimapState.js';

afterEach(() => vi.unstubAllGlobals());

function fixture(rect: { x: number; y: number; width: number; height: number }, adoptedForward = true) {
	vi.stubGlobal('innerWidth', 430); vi.stubGlobal('innerHeight', 1000);
	const minimap = { viewportVisible: true, spatialElementRoot: new THREE.Group(), screenCamera: new THREE.PerspectiveCamera() };
	return Object.assign(Object.create(StageExperience.prototype), {
		minimapController: { views: new Map([[0, minimap]]), scene: new THREE.Scene() },
		getProjectedMinimapModelRect: () => rect, adoptedForward,
		syncPanelLayouts: vi.fn(), updatePanelPointerInteraction: vi.fn()
	}) as StageExperience;
}

test.each([true, false])('a canonical partially clipped 430px Dock is a valid forward target (retained=%s)', retained => {
	// Real column-low.glb, authored modelScale1.1/dockedScale1.25 and 25°/15° view.
	const stage = fixture({ x: 8.6386, y: -3.4863, width: 78.0274, height: 84.557 }, retained);
	expect(stage.getDockProjection()).toBeUndefined();
	expect(stage.prepareGeometryDestination({ spatialElementId: 'column', kind: 'dock' })).toBe(true);
	expect(stage.getDockProjection()).toBeUndefined();
});

test.each([
	{ x: 10, y: -80, width: 80, height: 80 },
	{ x: 430, y: 10, width: 80, height: 80 },
	{ x: -80, y: 10, width: 80, height: 80 },
	{ x: 10, y: 1000, width: 80, height: 80 },
	{ x: 10, y: 10, width: 0, height: 80 }
])('a Dock with no visible viewport intersection remains ineligible: %j', rect => {
	expect(fixture(rect).prepareGeometryDestination({ spatialElementId: 'column', kind: 'dock' })).toBe(false);
});

test('fully visible dock geometry remains eligible for forward targeting and reverse capture', () => {
	const stage = fixture({ x: 8, y: 2, width: 78, height: 85 });
	expect(stage.getDockProjection()).toBeDefined();
	expect(stage.prepareGeometryDestination({ spatialElementId: 'column', kind: 'dock' })).toBe(true);
});

test.each([true, false])('Dock binding refreshes a stale culled Hero anchor without another render frame (retained=%s)', adoptedForward => {
	const width = 1440, height = 1000, scrollY = 628;
	vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height);
	vi.stubGlobal('window', { innerWidth: width, innerHeight: height, location: { search: '' },
		getComputedStyle: () => ({ position: 'fixed', top: '631px' }) });
	const measure = vi.fn(() => ({ left: 8, top: 3, width: 80, height: 80 }));
	const frame = { getBoundingClientRect: measure, closest: () => null } as unknown as HTMLElement;
	const target = { frame, nativeContent: true, options: { width: 80, height: 80 } } as StagePanelTarget;
	const pageBinding = new PageBindingController();
	pageBinding.attach([target]);
	pageBinding.setPanelRect(frame, { fixed: false, left: 8, top: 106, width: 80, height: 80 });
	const runtime = {
		group: new THREE.Group(), pointerLift: 0, pointerReactive: false, focusReactive: false,
		options: resolveLiquidGlassPanelOptions({ width: 80, height: 80,
			position: { x: 48 - width / 2, y: height / 2 - (106 - scrollY + 40) } }),
		surface: 'glass', glass: { setVisibilityAlpha: vi.fn(), setVisualSize: vi.fn() }, transitionGroup: 'enter'
	} as unknown as StagePanelRuntime;
	const minimap = {
		viewportVisible: false, baseWidth: 80, baseHeight: 80, baseRadius: 12, currentWidth: 80, currentHeight: 80,
		options: { expandedHeight: 244 }, layer: new THREE.Group(), pointerReveal: 0,
		spatialElementRoot: new THREE.Group(), screenCamera: new THREE.PerspectiveCamera()
	} as unknown as StageMinimapState;
	const minimaps = new Map([[0, minimap]]);
	const stage = Object.assign(Object.create(StageExperience.prototype), {
		pageBinding, currentScrollX: 0, currentScrollY: scrollY, detailMedia: 'minimap',
		layoutDirty: true, panelMeasurementsDirty: true, adoptedForward,
		minimapController: { views: minimaps, scene: new THREE.Scene() },
		getProjectedMinimapModelRect: () => ({ x: width / 2 + minimap.layer.position.x - 40,
			y: height / 2 - minimap.layer.position.y - 40, width: 80, height: 80 }),
		renderFrame: vi.fn(), flushCatalogFrame: vi.fn()
	});
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 1400;
	const updateMinimap = vi.fn();
	const panels = new PanelPresentationController({
		camera, registrations: () => pageBinding.panels, minimaps: () => minimaps, updateMinimap,
		visible: index => stage.isPanelTargetVisible(index), transitionOpacity: () => 0,
		frame: () => ({ pointer: { active: false, x: 0, y: 0 }, uiFocus: 0, minimapFocus: 0,
			presentation: { active: true } })
	} as PanelPresentationPorts);
	panels.add(runtime); stage.panels = panels;
	expect(stage.getDockProjection(true)).toBeUndefined();
	expect(pageBinding.resolve(pageBinding.getPanelRect(frame)!, 0, scrollY).top).toBe(-522);
	expect(stage.prepareGeometryDestination({ spatialElementId: 'column', kind: 'dock' })).toBe(true);
	expect(measure).toHaveBeenCalledOnce();
	expect(pageBinding.resolve(pageBinding.getPanelRect(frame)!, 0, scrollY).top).toBe(3);
	expect(minimap.viewportVisible).toBe(true);
	expect(panels.visibleMinimaps).toBe(1);
	expect(stage.getProjectedMinimapModelRect()).toEqual({ x: 8, y: 3, width: 80, height: 80 });
	expect(updateMinimap).toHaveBeenCalledWith(minimap, 0);
	// The destination remains hidden until reveal; only its CPU pose becomes current.
	expect(minimap.layer.visible).toBe(false);
	expect(runtime.glass!.setVisibilityAlpha).toHaveBeenLastCalledWith(0);
	expect(stage.renderFrame).not.toHaveBeenCalled();
	expect(stage.flushCatalogFrame).not.toHaveBeenCalled();
});
