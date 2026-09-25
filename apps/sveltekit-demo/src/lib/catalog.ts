import { getProductOverviewItems, type ProductBrandTheme, type ProductDetailData, type ProductLodPair } from '@spatial-elements/core';
export const theme: ProductBrandTheme = {
 id: 'demo', name: 'Spatial Elements', background: '#eef1f4', minimapTheme: { expandedHeight: 240, overlayColor: '#000000', overlayOpacity: 0.35, overlayBlur: 5, contextOpacity: 0, viewportColor: '#285c89' },
 interactionTheme: { outlineColor: '#50a5ea' }, panelShape: { radius: 16, contentInset: 26 },
 panelTheme: { surface: 'frosted', tint: '#ffffff', tintOpacity: 0.65, backdropBlur: 8, shadowIntensity: 0.2, opacity: 1 },
 dockedPanelTheme: { tint: '#ffffff', tintOpacity: 0.92, backdropBlur: 5, shadowIntensity: 0.2 },
 sectionTheme: { tint: '#ffffff', tintOpacity: 0.8, backdropBlur: 8 },
 colors: { ink: '#173047', body: '#263c4d', accent: '#285c89', onAccent: '#ffffff', tabBackground: '#e4ebf1' }
};
const identity: ProductLodPair['assetToFrame'] = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export const products: ProductDetailData[] = ['column','orb','ring'].map(id => {
 const url = '/assets/demo/' + id + '-high.glb';
 return { id, brandId: 'demo', pageTitle: id + ' | Spatial Elements', eyebrow: 'FORM STUDIES', title: id[0].toUpperCase() + id.slice(1), features: [{ label: 'Explore a sculptural form' }, { label: 'Rotate and zoom in three dimensions' }], action: { label: 'Explore features', href: '#features' },
 stage: { background: { blurriness: 0.2, tint: '#e6edf4', tintIntensity: 0.3 }, hdr: '/assets/demo/studio.hdr', glb: url, fallbackImage: '/assets/demo/' + id + '.svg', fallbackImageSize: [320,280], camera: { azimuth: 15, elevation: 10 },
 lodPair: { status: 'provisional-shared-frame', revision: 'demo-1', sourceUrl: url, low: { url: '/assets/demo/' + id + '-low.glb', format: 'glb', revision: 'demo-1' }, high: { url, format: 'glb', revision: 'demo-1' }, assetToFrame: identity, bounds: { min: [-1,-1,-1], max: [1,1,1] } } },
 breadcrumbs: [{ label: 'Collection', href: '/demo/categories/list' }, { label: id }], media: [{ id: 'model', kind: 'minimap', label: '3D view' }] };
});
export const overview = getProductOverviewItems(products, '/demo/products', { includeStage: true }).map((item,i) => ({ ...item, summary: { features: products[i].features, action: products[i].action, sectionLink: { href: item.href + '#features', label: 'Explore features' } } }));
