import { expect, test } from 'vitest';
import { createSpatialTheme } from './spatialTheme.js';
import { getSpatialListItems, resolveSpatialElementData } from './spatialElement.js';

test('partial themes preserve defaults and do not mutate another theme', () => {
	const first = createSpatialTheme({
		id: 'shop',
		name: 'Shop',
		colors: { accent: '#123456' },
		panelShape: { radius: 4 }
	});
	const second = createSpatialTheme({ id: 'other', name: 'Other' });
	expect(first.panelShape).toEqual({ radius: 4, contentInset: 26 });
	expect(first.minimapTheme.viewportColor).toBe('#123456');
	expect(first.interactionTheme.outlineColor).toBe('#123456');
	first.colors.ink = '#000000';
	expect(second.colors.ink).toBe('#173047');
});

test('a minimal element supplies both category assets and detail defaults', () => {
	const element = {
		id: 'a/b',
		title: 'Example',
		geometry: { low: '/example.glb', high: '/example.glb' },
		hdr: '/studio.hdr'
	};
	const [item] = getSpatialListItems([element], '/shop/elements/');
	expect(item).toMatchObject({
		id: 'a/b',
		href: '/shop/elements/a%2Fb',
		geometry: element.geometry,
		hdr: element.hdr,
		features: []
	});
	expect(item).not.toHaveProperty('stage');
	const detail = resolveSpatialElementData(element, 'shop');
	expect(detail).toMatchObject({
		brandId: 'shop',
		pageTitle: 'Example',
		features: [],
		breadcrumbs: [],
		media: [{ kind: 'minimap' }]
	});
	expect(detail.action).toBeUndefined();
	expect(element).not.toHaveProperty('brandId');
	expect(() => resolveSpatialElementData({ ...element, brandId: 'wrong' }, 'shop')).toThrow(
		'shell uses "shop"'
	);
});

test('HDR theme overrides are optional and independent of the source palette', () => {
	const sceneBackground = { tint: '#111820', tintIntensity: 0.85 };
	const dark = createSpatialTheme({ id: 'shop', name: 'Shop', sceneBackground });
	expect(dark.sceneBackground).toEqual(sceneBackground);
	dark.sceneBackground!.tintIntensity = 0.4;
	expect(sceneBackground.tintIntensity).toBe(0.85);
	expect(createSpatialTheme({ id: 'shop', name: 'Shop' }).sceneBackground).toBeUndefined();
});
