import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { StageExperience } from '../stage/StageExperience.js';

afterEach(() => vi.unstubAllGlobals());

function fixture(rect: { x: number; y: number; width: number; height: number }, adoptedForward = true) {
	vi.stubGlobal('innerWidth', 430); vi.stubGlobal('innerHeight', 1000);
	const minimap = { viewportVisible: true, spatialElementRoot: new THREE.Group(), screenCamera: new THREE.PerspectiveCamera() };
	return Object.assign(Object.create(StageExperience.prototype), {
		minimapController: { views: new Map([[0, minimap]]), scene: new THREE.Scene() },
		getProjectedMinimapModelRect: () => rect, adoptedForward
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
