import { createSpatialTheme, getSpatialListItems } from '@spatial-elements/core';
import { spatialElements as originals, theme as originalTheme } from '$lib/catalog';
export const theme = createSpatialTheme({
	...originalTheme,
	id: 'staged',
	name: 'Staged navigation proof',
	panelTheme: { ...originalTheme.panelTheme, surface: 'glass' }
});
export const elements = originals.map((element) => ({
	...element,
	brandId: 'staged',
	action: { label: 'Read more', href: '#reading' },
	minimap: { modelScale: 1.1, dockedView: { scale: 1.25, azimuth: 25, elevation: 15 } },
	breadcrumbs: [{ label: 'Collection', href: '/staged/categories/list' }, { label: element.title }]
}));
export const items = getSpatialListItems(elements, '/staged/elements').map((item) => ({
	...item,
	href: `${item.href}#reading`,
	targetPresentation: 'dock' as const,
	summary: {
		...item.summary!,
		sectionLink: {
			href: `${item.href}#reading`,
			label: 'Open reading view',
			targetPresentation: 'dock' as const
		}
	}
}));
