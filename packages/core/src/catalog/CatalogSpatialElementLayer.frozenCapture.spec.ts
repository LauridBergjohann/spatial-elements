import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import { CatalogGeometryFade } from './CatalogGeometryFade.js';
import { DEFAULT_INTERACTION_THEME } from '../stage/stageConstants.js';
import type { CatalogWarmOutputContext } from './CatalogWarmOutputContext.js';

afterEach(() => vi.unstubAllGlobals());

/** Actual layer draw path and fade owner, with only GPU submission replaced. */
function fixture() {
	vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900 });
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), handoffScene = new THREE.Scene();
	scene.fog = new THREE.Fog(0xffffff, 1200, 2500);
	const actors = ['rear', 'front'].map((band, index) => {
		const root = new THREE.Group(), view = new THREE.Group(), model = new THREE.Group();
		root.add(view); view.add(model); scene.add(root); root.visible = index === 0;
		return { key: String(index), spatialElementId: String(index), band, root, view, model,
			rendered: true, materials: [], referencePoint: new THREE.Vector3() };
	});
	const geometryFade = new CatalogGeometryFade(), theme = { ...DEFAULT_INTERACTION_THEME };
	const layer = Object.assign(Object.create(CatalogSpatialElementLayer.prototype), {
		scene, camera, carouselCamera: camera, handoffScene, handoffCamera: camera.clone(), geometryFade,
		actors: new Map(actors.map(actor => [actor.key, actor])), desired: new Set(['0', '1']),
		exitOpacity: 0.8, passes: 0, invalidate: vi.fn(), interactionTheme: () => theme, detachedInstances: 0
	}) as CatalogSpatialElementLayer;
	let target: THREE.RenderTarget | null = null;
	const canvas = {} as THREE.CanvasTarget;
	const captured: string[][] = [];
	const renderer = {
		coordinateSystem: THREE.WebGPUCoordinateSystem, toneMapping: THREE.ACESFilmicToneMapping,
		toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
		getRenderTarget: () => target, setRenderTarget: (value: THREE.RenderTarget | null) => { target = value; },
		getCanvasTarget: () => canvas, getDrawingBufferSize: (out: THREE.Vector2) => out.set(1440, 900),
		getClearColor: (out: THREE.Color) => out.set(0xffffff), getClearAlpha: () => 1, setClearColor: vi.fn(),
		getScissor: (out: THREE.Vector4) => out.set(0, 0, 1440, 900), setScissor: vi.fn(),
		getScissorTest: () => false, setScissorTest: vi.fn(), clear: vi.fn(), clearDepth: vi.fn(),
		render: vi.fn((input: THREE.Scene) => {
			if (input === scene) captured.push(actors.filter(actor => actor.root.visible && actor.model.parent === actor.view).map(actor => actor.key));
		})
	} as unknown as THREE.WebGPURenderer;
	const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {});
	return { layer, actors, scene, renderer, captured, theme, quad,
		draw(band: 'rear' | 'front' = 'rear', warm?: CatalogWarmOutputContext) { layer.draw(renderer, band, warm); },
		dispose() { geometryFade.dispose(); quad.mockRestore(); }
	};
}

test('only a frozen source reuses the actor capture while every alpha remains a live composite', () => {
	const f = fixture();
	try {
		f.draw(); f.draw(); expect(f.captured).toHaveLength(2);
		f.layer.freezeStagedSource(); f.draw(); f.layer.setExitOpacity(0.4, true); f.draw();
		expect(f.captured).toEqual([['0'], ['0'], ['0']]); expect(f.quad).toHaveBeenCalledTimes(4);
		f.layer.finishStagedPanel(); f.draw(); f.draw(); expect(f.captured).toHaveLength(5);
		f.layer.freezeStagedSource(); f.draw(); f.draw(); expect(f.captured).toHaveLength(6);
		f.layer.freezeStagedSource(); f.draw(); expect(f.captured).toHaveLength(7);
	} finally { f.dispose(); }
});

test('an empty front band preserves rear pixels, while an actual front capture replaces the single scratch', () => {
	const f = fixture();
	try {
		f.layer.freezeStagedSource(); f.draw(); f.draw('front'); f.draw();
		expect(f.captured).toEqual([['0']]);
		f.actors[1].root.visible = true;
		f.draw('front'); f.draw(); f.draw();
		expect(f.captured).toEqual([['0'], ['1'], ['0']]);
		expect(f.actors.map(actor => actor.root.visible)).toEqual([true, true]);
	} finally { f.dispose(); }
});

test.each(['viewport', 'environment', 'environment-version', 'environment-intensity', 'fog', 'outline', 'background'] as const)(
	'a changed %s ends reuse for the frozen source instead of retaining old pixels', change => {
		const f = fixture(), environment = new THREE.Texture();
		try {
			f.scene.environment = environment; f.layer.freezeStagedSource(); f.draw(); f.draw();
			expect(f.captured).toHaveLength(1);
			switch (change) {
				case 'viewport': window.innerWidth = 1200; break;
				case 'environment': f.scene.environment = null; break;
				case 'environment-version': environment.needsUpdate = true; break;
				case 'environment-intensity': f.scene.environmentIntensity = 0.7; break;
				case 'fog': (f.scene.fog as THREE.Fog).near += 10; break;
				case 'outline': f.theme.outlineThickness = 2; break;
				case 'background': f.layer.setPageBackground('#000000'); break;
			}
			f.draw(); f.draw(); expect(f.captured).toHaveLength(3);
		} finally { f.dispose(); environment.dispose(); }
	}
);

test.each(['warm-output', 'preparation'] as const)('%s overwrites scratch pixels without acquiring a frozen source token', change => {
	const f = fixture();
	try {
		f.layer.freezeStagedSource(); f.draw(); f.draw();
		if (change === 'warm-output') f.draw('rear', { usesCanvasOwner: () => false } as unknown as CatalogWarmOutputContext);
		else f.layer.renderForPreparation(f.renderer);
		f.draw(); f.draw(); expect(f.captured).toHaveLength(3);
	} finally { f.dispose(); }
});

test.each(['capture', 'detach', 'finish-handoff'] as const)('%s invalidates the frozen source when ownership changes', change => {
	const f = fixture();
	try {
		f.actors[1].band = 'rear'; f.actors[1].root.visible = true;
		if (change !== 'capture') expect(f.layer.capture('1')).toBe(true);
		f.layer.freezeStagedSource(); f.draw(); f.draw(); expect(f.captured).toHaveLength(1);
		if (change === 'capture') expect(f.layer.capture('1')).toBe(true);
		else if (change === 'detach') f.layer.detachHandoff();
		else f.layer.finishHandoff();
		f.draw(); f.draw(); expect(f.captured).toHaveLength(3);
		expect(f.captured.at(-1)).toEqual(change === 'finish-handoff' ? ['0', '1'] : ['0']);
	} finally { f.dispose(); }
});
