import { describe, expect, it } from 'vitest';
import {
	resolveSpatialElementData,
	findSpatialElement,
	getSpatialListItems,
	getSpatialElementSectionStyle,
	isSpatialElementSectionId
} from './spatialElement.js';

describe('spatialElement detail helpers', () => {
	it('accepts stable section anchor ids', () => {
		expect(isSpatialElementSectionId('technical-data')).toBe(true);
		expect(isSpatialElementSectionId('3d-data')).toBe(false);
		expect(isSpatialElementSectionId('Technical Data')).toBe(false);
	});

	it('serializes optional section presentation as CSS properties', () => {
		expect(
			getSpatialElementSectionStyle({
				tint: '#101820',
				tintOpacity: 0.64,
				backdropBlur: 24,
				textColor: '#ffffff',
				width: '72rem'
			})
		).toBe(
			'--spatial-element-section-tint: #101820; --spatial-element-section-tint-opacity: 64%; --spatial-element-section-backdrop-blur: 24px; --spatial-element-section-color: #ffffff; --spatial-element-section-width: 72rem'
		);
		expect(getSpatialElementSectionStyle({ tintOpacity: 2, backdropBlur: -4 })).toBe(
			'--spatial-element-section-tint-opacity: 100%; --spatial-element-section-backdrop-blur: 0px'
		);
		expect(getSpatialElementSectionStyle(undefined)).toBe('');
	});

	it('selects spatialElements by their route id', () => {
		const spatialElements = [
			{ id: 'alpha', title: 'Alpha' },
			{ id: 'beta', title: 'Beta' }
		] as const;
		expect(findSpatialElement(spatialElements, 'beta')).toEqual({ id: 'beta', title: 'Beta' });
		expect(findSpatialElement(spatialElements, 'missing')).toBeUndefined();
	});

	it('projects complete spatialElement documents into lightweight overview cards', () => {
		const spatialElements = [
			{
				id: 'alpha',
				eyebrow: 'Series A',
				title: 'Alpha',
				features: [{ label: 'Compact' }, { label: 'Connected' }],
				geometry: { low: '/model.glb', high: '/model.glb' },
				hdr: '/studio.hdr'
			}
		] as const;

		expect(getSpatialListItems(spatialElements, '/elements/')).toEqual([
			{
				id: 'alpha',
				href: '/elements/alpha',
				eyebrow: 'Series A',
				title: 'Alpha',
				features: ['Compact', 'Connected'],
				summary: { features: [{ label: 'Compact' }, { label: 'Connected' }], action: undefined },
				geometry: { low: '/model.glb', high: '/model.glb' },
				hdr: '/studio.hdr'
			}
		]);
	});
});

describe('minimal element documents', () => {
	const element = {
		id: 'cube',
		title: 'Cube',
		geometry: { low: '/cube.glb', high: '/cube.glb' },
		hdr: '/studio.hdr'
	};
	it('inherits the shell identity and supplies content defaults without mutating input', () => {
		const resolved = resolveSpatialElementData(element, 'shop');
		expect(resolved).toMatchObject({
			brandId: 'shop',
			pageTitle: 'Cube',
			features: [],
			breadcrumbs: [],
			media: [{ id: 'model', kind: 'minimap', label: '3D view' }]
		});
		expect(resolved.action).toBeUndefined();
		expect(element).not.toHaveProperty('brandId');
		expect(getSpatialListItems([element], '/shop/elements')[0]).toMatchObject({
			geometry: { low: '/cube.glb', high: '/cube.glb' },
			hdr: '/studio.hdr',
			href: '/shop/elements/cube',
			summary: { features: [] }
		});
	});
	it('rejects accidental cross-brand detail documents', () => {
		expect(() => resolveSpatialElementData({ ...element, brandId: 'other' }, 'shop')).toThrow(
			'shell uses "shop"'
		);
	});
	it('preserves an explicitly empty media rail', () => {
		expect(resolveSpatialElementData({ ...element, media: [] }, 'shop').media).toEqual([]);
	});
});
