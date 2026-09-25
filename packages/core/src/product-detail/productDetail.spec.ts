import { describe, expect, it } from 'vitest';
import {
	findProduct,
	getProductOverviewItems,
	getProductSectionStyle,
	isProductSectionId
} from './productDetail.js';

describe('product detail helpers', () => {
	it('accepts stable section anchor ids', () => {
		expect(isProductSectionId('technical-data')).toBe(true);
		expect(isProductSectionId('3d-data')).toBe(false);
		expect(isProductSectionId('Technical Data')).toBe(false);
	});

	it('serializes optional section presentation as CSS properties', () => {
		expect(
			getProductSectionStyle({
				tint: '#101820',
				tintOpacity: 0.64,
				backdropBlur: 24,
				textColor: '#ffffff',
				width: '72rem'
			})
		).toBe(
			'--product-section-tint: #101820; --product-section-tint-opacity: 64%; --product-section-backdrop-blur: 24px; --product-section-color: #ffffff; --product-section-width: 72rem'
		);
		expect(getProductSectionStyle({ tintOpacity: 2, backdropBlur: -4 })).toBe(
			'--product-section-tint-opacity: 100%; --product-section-backdrop-blur: 0px'
		);
		expect(getProductSectionStyle(undefined)).toBe('');
	});

	it('selects products by their route id', () => {
		const products = [
			{ id: 'alpha', title: 'Alpha' },
			{ id: 'beta', title: 'Beta' }
		] as const;
		expect(findProduct(products, 'beta')).toEqual({ id: 'beta', title: 'Beta' });
		expect(findProduct(products, 'missing')).toBeUndefined();
	});

	it('projects complete product documents into lightweight overview cards', () => {
		const products = [
			{
				id: 'alpha',
				eyebrow: 'Series A',
				title: 'Alpha',
				features: [{ label: 'Compact' }, { label: 'Connected' }],
				stage: { glb: '/detail-only-stage-data.glb' }
			}
		] as const;

		expect(getProductOverviewItems(products, '/products/')).toEqual([
			{
				id: 'alpha',
				href: '/products/alpha',
				eyebrow: 'Series A',
				title: 'Alpha',
				features: ['Compact', 'Connected']
			}
		]);
	});
});
