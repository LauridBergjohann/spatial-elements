import { optimizedSpatialElements } from './optimized';
import type { SpatialTheme, SpatialElementData } from '@spatial-elements/sveltekit';

/** Application-owned defaults shared by element documents; the layout needs no overview model. */
export const watchesElementDefaults = {
	background: { blurriness: 0.5, tint: '#b6deff', tintIntensity: 0 },
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
} satisfies Pick<SpatialElementData, 'hdr' | 'background' | 'model'>;

/** Visual language shared by the watch catalog. */
export const watchesTheme: SpatialTheme = {
	id: 'showcase/watches',
	name: 'CHRONOS',
	background: '#4d525e',
	minimapTheme: {
		expandedHeight: 244,
		overlayColor: '#000000',
		overlayOpacity: 0.4,
		overlayBlur: 5,
		contextColor: '#000000',
		contextOpacity: 0,
		viewportColor: '#f2c766'
	},
	interactionTheme: { outlineColor: '#f2c766' },
	panelShape: { radius: 22, contentInset: 30 },
	panelTheme: {
		surface: 'glass',
		backdropBlur: 5,
		refraction: 20,
		tint: '#1f1f1f',
		tintOpacity: 0.6,
		bezel: 20,
		thickness: 0.45,
		specularOpacity: 0.2,
		shadowIntensity: 0.65,
		opacity: 1
	},
	dockedPanelTheme: {
		backdropBlur: 5,
		tint: '#464646',
		tintOpacity: 0.9,
		shadowIntensity: 1
	},
	sectionTheme: { tint: '#2f3135', tintOpacity: 0.7, backdropBlur: 10 },
	sectionBackgrounds: { standard: '#2f3135', muted: '#464646' },
	colors: {
		ink: '#fff',
		body: '#f7f7f4',
		accent: '#caa75c',
		onAccent: '#161718',
		tabBackground: 'rgb(29 30 32 / 0.76)'
	}
};

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

			background: watchesElementDefaults.background,
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
