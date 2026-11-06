import { expect, test } from 'vitest';
import { createSpatialTheme, resolveSpatialSectionBackgrounds, resolveSpatialThemeRadii } from './spatialTheme.js';
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

test('layout radius roles default independently and preserve an explicitly authored legacy radius', () => {
	expect(createSpatialTheme({ id: 'shop', name: 'Shop' }).radii).toEqual({ control: 12, panel: 16 });
	expect(createSpatialTheme({ id: 'shop', name: 'Shop', panelShape: { radius: 7 } }).radii)
		.toEqual({ control: 7, panel: 7 });
	expect(createSpatialTheme({
		id: 'shop', name: 'Shop', panelShape: { radius: 7 }, radii: { panel: 20 }
	}).radii).toEqual({ control: 7, panel: 20 });
});

test('manual legacy themes resolve new roles without mutation and invalid radii never reach CSS', () => {
	const legacy = Object.freeze({ panelShape: Object.freeze({ radius: 0 }) });
	expect(resolveSpatialThemeRadii(legacy)).toEqual({ control: 0, panel: 0 });
	expect(legacy).not.toHaveProperty('radii');
	const theme = createSpatialTheme({
		id: 'shop', name: 'Shop',
		panelShape: { radius: Infinity, contentInset: NaN },
		radii: { control: -4, panel: NaN }
	});
	expect(theme.radii).toEqual({ control: 0, panel: 16 });
	expect(theme.panelShape).toEqual({ radius: 16, contentInset: 26 });
	expect(resolveSpatialThemeRadii({ radii: { control: Infinity }, panelShape: { radius: 6 } }))
		.toEqual({ control: 6, panel: 6 });
});

test('section background roles do not overwrite legacy tint or share objects between themes', () => {
	const options = { id: 'shop', name: 'Shop', sectionBackgrounds: { standard: ' #102030 ' } };
	const first = createSpatialTheme({ ...options, sectionTheme: { tint: '#223344', tintOpacity: 0.4 } });
	const second = createSpatialTheme(options);
	expect(first.sectionBackgrounds).toEqual({ standard: '#102030', muted: '#f5f7f9' });
	expect(first.sectionTheme).toEqual({ tint: '#223344', tintOpacity: 0.4, backdropBlur: 8 });
	first.sectionBackgrounds!.standard = '#000000';
	first.radii!.control = 99;
	expect(second.sectionBackgrounds!.standard).toBe('#102030');
	expect(second.radii!.control).toBe(12);
	expect(options.sectionBackgrounds.standard).toBe(' #102030 ');
	expect(resolveSpatialSectionBackgrounds({ sectionBackgrounds: { standard: '  ' } }))
		.toEqual({ standard: '#ffffff', muted: '#f5f7f9' });
});
