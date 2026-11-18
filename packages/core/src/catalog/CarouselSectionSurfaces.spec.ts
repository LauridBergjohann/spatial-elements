import { afterEach, expect, test, vi } from 'vitest';
import { CarouselSectionSurfaces } from './CarouselSectionSurfaces.js';

afterEach(() => vi.unstubAllGlobals());

test('decorative surfaces follow cached scroll bounds, inherit theme variables and release ownership', () => {
	const stage = { appendChild: vi.fn() };
	const output = { style: {}, setAttribute: vi.fn(), remove: vi.fn(), className: '' };
	const source = {
		closest: () => stage,
		style: { background: 'var(--ps-section-standard)' },
		setAttribute: vi.fn(),
		removeAttribute: vi.fn(),
		parentElement: { hasAttribute: () => false }
	} as unknown as HTMLElement;
	vi.stubGlobal('document', { createElement: vi.fn(() => output) });
	vi.stubGlobal('getComputedStyle', () => ({
		background: 'rgb(255, 255, 255)',
		borderRadius: '16px',
		backdropFilter: 'none'
	}));
	const surfaces = new CarouselSectionSurfaces();
	const rect = { left: 120, top: 300, width: 1200, height: 640 };
	surfaces.sync(new Map([[source, rect]]), 0, 100);
	surfaces.update(0, 160, 0.75);
	expect(output.style).toMatchObject({
		background: 'var(--ps-section-standard)',
		borderRadius: '16px',
		width: '1200px',
		height: '640px',
		transform: 'translate(120px, 240px)',
		opacity: '0.75'
	});
	expect(source.setAttribute).toHaveBeenCalledWith('data-carousel-surface-projected', '');
	surfaces.sync(new Map([[source, { ...rect, width: 1400 }]]), 0, 160);
	expect(stage.appendChild).toHaveBeenCalledOnce();
	surfaces.sync(new Map(), 0, 160);
	expect(output.remove).toHaveBeenCalledOnce();
	expect(source.removeAttribute).toHaveBeenCalledWith('data-carousel-surface-projected');
	surfaces.sync(new Map([[source, rect]]), 0, 160);
	surfaces.dispose();
	expect(output.remove).toHaveBeenCalledTimes(2);
});

test('model-only frames do not rewrite decorative surfaces; scroll, fade and remeasurement still apply', () => {
	const writes = vi.fn();
	const style = new Proxy({} as Record<string, string>, {
		set(target, property: string, value: string) { writes(property, value); target[property] = value; return true; }
	});
	const output = { style, setAttribute: vi.fn(), remove: vi.fn() };
	const source = { closest: () => ({ appendChild: vi.fn() }), style: {},
		setAttribute: vi.fn(), removeAttribute: vi.fn() } as unknown as HTMLElement;
	vi.stubGlobal('document', { createElement: () => output });
	vi.stubGlobal('getComputedStyle', () => ({ background: 'white', borderRadius: '8px', backdropFilter: 'blur(8px)' }));
	const surfaces = new CarouselSectionSurfaces();
	const rect = { left: 12, top: 200, width: 800, height: 400 };
	surfaces.sync(new Map([[source, rect]]), 0, 0);
	writes.mockClear();
	for (let frame = 0; frame < 120; frame++) surfaces.update(0, 20, 1);
	expect(writes.mock.calls).toEqual([['transform', 'translate(12px, 180px)'], ['opacity', '1']]);
	surfaces.update(0, 50, 1);
	surfaces.update(0, 50, 0.5);
	expect(writes.mock.calls.slice(2)).toEqual([['transform', 'translate(12px, 150px)'], ['opacity', '0.5']]);
	surfaces.sync(new Map([[source, { ...rect, left: 24 }]]), 0, 0);
	surfaces.update(0, 50, 0.5);
	expect(style.transform).toBe('translate(24px, 150px)');
	// Compare the owned DOM value, not a stale cache after a retained transition.
	style.opacity = '0';
	surfaces.update(0, 50, 0.5);
	expect(style.opacity).toBe('0.5');
	surfaces.dispose();
});
