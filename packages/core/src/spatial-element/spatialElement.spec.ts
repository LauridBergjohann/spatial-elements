import { describe, expect, it } from 'vitest';
import {
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
				stage: { glb: '/detail-only-stage-data.glb' }
			}
		] as const;

		expect(getSpatialListItems(spatialElements, '/elements/')).toEqual([
			{
				id: 'alpha',
				href: '/elements/alpha',
				eyebrow: 'Series A',
				title: 'Alpha',
				features: ['Compact', 'Connected']
			}
		]);
	});
});
