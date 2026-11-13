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
