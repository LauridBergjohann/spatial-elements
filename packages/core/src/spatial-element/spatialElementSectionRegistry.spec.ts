import { describe, expect, it, vi } from 'vitest';
import { SpatialElementSectionRegistry } from './spatialElementSectionRegistry.js';

describe('SpatialElementSectionRegistry', () => {
	it('keeps sections in render order and emits immutable navigation snapshots', () => {
		const onChange = vi.fn();
		const registry = new SpatialElementSectionRegistry(onChange);

		registry.register({ id: 'features', title: 'Features' });
		registry.register({ id: 'technical-data', title: 'Technical data' });

		expect(registry.sections).toEqual([
			{ id: 'features', title: 'Features' },
			{ id: 'technical-data', title: 'Technical data' }
		]);
		expect(onChange).toHaveBeenLastCalledWith(registry.sections);
		expect(onChange.mock.calls[0][0]).not.toBe(onChange.mock.calls[1][0]);
	});

	it('updates navigation metadata without changing section order', () => {
		const registry = new SpatialElementSectionRegistry();
		const first = registry.register({ id: 'features', title: 'Features' });
		registry.register({ id: 'documents', title: 'Documents' });

		first.update({ id: 'highlights', title: 'Highlights' });

		expect(registry.sections).toEqual([
			{ id: 'highlights', title: 'Highlights' },
			{ id: 'documents', title: 'Documents' }
		]);
	});

	it('removes a section when its component is destroyed', () => {
		const registry = new SpatialElementSectionRegistry();
		const first = registry.register({ id: 'features', title: 'Features' });
		registry.register({ id: 'documents', title: 'Documents' });

		first.unregister();
		first.unregister();

		expect(registry.sections).toEqual([{ id: 'documents', title: 'Documents' }]);
	});

	it('rejects invalid, empty, and duplicate navigation metadata', () => {
		const registry = new SpatialElementSectionRegistry();

		expect(() => registry.register({ id: 'Technical Data', title: 'Data' })).toThrow(
			'Invalid spatialElement section id'
		);
		expect(() => registry.register({ id: 'data', title: '   ' })).toThrow(
			'requires a non-empty title'
		);

		registry.register({ id: 'data', title: 'Data' });
		expect(() => registry.register({ id: 'data', title: 'Other data' })).toThrow(
			'Duplicate spatialElement section id'
		);
	});

	it('prevents a reactive update from taking another section id', () => {
		const registry = new SpatialElementSectionRegistry();
		const first = registry.register({ id: 'features', title: 'Features' });
		registry.register({ id: 'documents', title: 'Documents' });

		expect(() => first.update({ id: 'documents', title: 'More documents' })).toThrow(
			'Duplicate spatialElement section id'
		);
	});
});
