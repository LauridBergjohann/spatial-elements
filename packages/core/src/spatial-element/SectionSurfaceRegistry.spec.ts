import { describe, expect, it } from 'vitest';
import { SectionSurfaceRegistry } from './SectionSurfaceRegistry.js';

describe('section surface groups', () => {
	it('joins standard and muted sections but separates transparent and full surfaces', () => {
		const registry = new SectionSurfaceRegistry();
		for (const surface of [
			{ color: 'standard', size: 'standard' }, { color: 'muted', size: 'standard' },
			{ color: 'transparent', size: 'standard' }, { color: 'muted', size: 'standard' },
			{ color: 'standard', size: 'full' }, { color: 'standard', size: 'standard' }
		] as const) registry.register(surface);
		expect(registry.corners.map(({ top, bottom }) => [top, bottom])).toEqual([
			[true, false], [false, true], [false, false], [true, true], [false, false], [true, true]
		]);
	});
	it('recomputes adjacent boundaries when a surface changes or unmounts', () => {
		const registry = new SectionSurfaceRegistry();
		registry.register({ color: 'standard', size: 'standard' });
		const middle = registry.register({ color: 'transparent', size: 'standard' });
		registry.register({ color: 'muted', size: 'standard' });
		expect(registry.corners[0].bottom).toBe(true);
		middle.update({ color: 'muted', size: 'standard' });
		expect(registry.corners[0].bottom).toBe(false);
		middle.unregister(); middle.unregister();
		expect(registry.corners).toEqual([{ id: 0, top: true, bottom: false }, { id: 2, top: false, bottom: true }]);
	});
	it('follows keyed DOM reordering while retaining registration identities', () => {
		const registry = new SectionSurfaceRegistry();
		registry.register({ color: 'standard', size: 'standard' });
		registry.register({ color: 'transparent', size: 'standard' });
		registry.register({ color: 'muted', size: 'standard' });
		registry.order([2, 0, 1]);
		expect(registry.corners).toEqual([
			{ id: 2, top: true, bottom: false }, { id: 0, top: false, bottom: true },
			{ id: 1, top: false, bottom: false }
		]);
	});
});
