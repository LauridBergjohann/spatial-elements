import { optimizedSpatialElements } from './optimized';
import type { SpatialElementData } from '@spatial-elements/sveltekit';

/** Application-owned defaults shared by element documents; the layout needs no overview model. */
export const watchesElementDefaults = {
	hdr: '/assets/lobe.hdr',
	model: {
		rotation: { x: Math.PI * 0.25 },
		excludeMeshes: ['floor'],
		materialOverrides: {
			glass: {
				type: 'physical',
				color: '#020205',
				transparent: true,
				opacity: 0.8,
				metalness: 0,
				roughness: 0,
				iridescence: 0.3,
				clearcoat: 1,
				blending: 'additive'
			}
		}
	}
} satisfies Pick<SpatialElementData, 'hdr' | 'model'>;

/** Serializable watches addressable through `[productId]`. */
export const watchesSpatialElements: readonly SpatialElementData[] = optimizedSpatialElements(
	'watches',
	[
		{
			id: 'chronograph',
			brandId: 'watches',
			pageTitle: 'Chronograph | CHRONOS',
			eyebrow: 'Rolex',
			title: 'Chronograph',
			features: [
				{ label: 'Mechanisches Automatikwerk', marker: '01' },
				{ label: 'Zweifarbige Glieder', marker: '02' },
				{ label: 'Praezise Zeitmessung', marker: '03' },
				{ label: 'Handpolierte Oberflaechen', marker: '04' }
			],
			action: { label: 'Beratung vereinbaren' },

			hdr: watchesElementDefaults.hdr,
			geometry: { low: '/assets/rolex.glb', high: '/assets/rolex.glb' },
			fallbackImage: '/assets/posters/watches-chronograph.png',
			fallbackImageSize: [336, 480],
			model: watchesElementDefaults.model,
			camera: { fitScale: 1.25, azimuth: 30, elevation: 20 },
			breadcrumbs: [
				{ label: 'Kollektion', href: '/watches/categories/list' },
				{ label: 'Zeitmesser' },
				{ label: 'Chronograph' }
			],
			media: [
				{ id: 'three-dimensional-view', kind: 'minimap', label: 'Watch view' },
				{ id: 'technical-drawing', kind: 'drawing', label: 'Movement drawing' }
			],
			minimap: {
				modelScale: 1.4,
				hoverModelScale: 1.6,
				expandedHoverModelScale: 1.05,
				dockedView: {
					scale: 1.2,
					azimuth: -20,
					elevation: 20
				}
			}
		}
	]
);
