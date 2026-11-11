import { optimizedSpatialElements } from './optimized';
import type { SpatialTheme, SpatialElementData } from '@spatial-elements/sveltekit';

/** Application-owned defaults shared by element documents; the layout needs no overview model. */
export const weraElementDefaults = {
	background: { blurriness: 0.5, tint: '#4b4b4b', tintIntensity: 0.6 },
	hdr: '/assets/lobe.hdr'
} satisfies Pick<SpatialElementData, 'hdr' | 'background' | 'model'>;

/** Visual language shared by every Wera element route. */
export const weraTheme: SpatialTheme = {
	id: 'showcase/wera',
	name: 'WERA',
	background: '#3a3c3d',
	minimapTheme: {
		expandedHeight: 244,
		overlayColor: '#000000',
		overlayOpacity: 0.4,
		overlayBlur: 5,
		contextColor: '#000000',
		contextOpacity: 0,
		viewportColor: '#059669'
	},
	interactionTheme: { outlineColor: '#059669' },
	panelShape: { radius: 12, contentInset: 30 },
	panelTheme: {
		surface: 'frosted',
		backdropBlur: 5,
		refraction: 20,
		tint: '#1f1f1f',
		tintOpacity: 0.6,
		bezel: 14,
		thickness: 0.5,
		specularOpacity: 0.16,
		shadowIntensity: 0.65,
		opacity: 1
	},
	dockedPanelTheme: {
		backdropBlur: 5,
		tint: '#363636',
		tintOpacity: 0.9,
		shadowIntensity: 1
	},
	sectionTheme: { tint: '#1f1f1f', tintOpacity: 0.6, backdropBlur: 18 },
	sectionBackgrounds: { standard: '#1f1f1f', muted: '#363636' },
	colors: {
		ink: '#fff',
		body: '#f7f7f4',
		accent: '#059669',
		onAccent: '#161718',
		tabBackground: 'rgb(29 30 32 / 0.76)'
	}
};

/** Serializable Wera elements addressable through `[productId]`. */
export const weraSpatialElements: readonly SpatialElementData[] = optimizedSpatialElements('wera', [
	{
		id: 'tool-check-plus',
		brandId: 'wera',
		pageTitle: 'Tool-Check Plus | WERA',
		eyebrow: 'Tool-Check',
		title: 'Tool-Check Plus',
		features: [
			{ label: 'Kompaktes 39-teiliges Set' },
			{ label: 'Feinverzahnte Zyklop Mini Ratsche' },
			{ label: 'Farbcodierte Steckschluesseleinsaetze' },
			{ label: 'Robuste textile Aufbewahrung' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: { low: '/assets/wera/tool-check-plus.glb', high: '/assets/wera/tool-check-plus.glb' },
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		camera: {
			azimuth: 15, // negativ: von links, positiv: von rechts
			elevation: 60, // positiv: von oben
			fitScale: 1.1
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			hoverModelScale: 1.2,
			// The optimized Tool-Check assembly is wider than the old overview source.
			expandedHoverModelScale: 1.05
		}
	},
	{
		id: 'joker',
		brandId: 'wera',
		pageTitle: 'Joker Maulschlüssel | WERA',
		eyebrow: 'Mit verblüffender Haltefunktion',
		title: 'Joker Maulschlüssel',
		features: [
			{ label: 'Endanschlag für schnelleres Schrauben' },
			{ label: 'Praktische Haltefunktion' },
			{ label: 'Sicherer mit Anti-Wegrutsch-Effekt' },
			{ label: 'Sehr kleiner Rückholwinkel' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: { low: '/assets/wera/joker.glb', high: '/assets/wera/joker.glb' },
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		camera: {
			azimuth: 30, // negativ: von links, positiv: von rechts
			elevation: 60, // positiv: von oben
			fitScale: 1.2
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			hoverModelScale: 1.2,
			expandedHoverModelScale: 1.15
		}
	},
	{
		id: 'kraftform-xxl',
		brandId: 'wera',
		pageTitle: 'Kraftform XXL | WERA',
		eyebrow: 'Begreifbare Ergonomie.',
		title: 'Kraftform XXL',
		features: [
			{ label: 'An die Hand angepasst' },
			{ label: 'Hohe Kraftübertragung durch Weichzonen' },
			{ label: 'Schnelles Umgreifen' },
			{ label: 'Abrollschutz' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: { low: '/assets/wera/kraftform-xxl.glb', high: '/assets/wera/kraftform-xxl.glb' },
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		camera: {
			azimuth: 40, // negativ: von links, positiv: von rechts
			elevation: 20, // positiv: von oben
			fitScale: 1.1
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			hoverModelScale: 1.2,
			expandedHoverModelScale: 1.15
		}
	},
	{
		id: 'ph-kreuzschlitz',
		brandId: 'wera',
		pageTitle: 'PH Kreuzschlitz-Schraubendreher | WERA',
		eyebrow: 'Begreifbare Ergonomie.',
		title: 'PH Kreuzschlitz-Schraubendreher',
		features: [
			{ label: 'Schraubendreher für Kreuzschlitzschrauben Phillips' },
			{
				label:
					'Harte Griffzonen für hohe Arbeitsgeschwindigkeit, weiche Griffzonen für hohe Drehmomentübertragung'
			},
			{
				label:
					'Mit Werkzeugfinder Take it easy: Farbkennzeichnung nach Profilen und Größenstempelung'
			},
			{ label: 'Mit Sechskantabrollschutz gegen Wegrollen' },
			{ label: 'Lasertip-Spitze für mehr Halt im Schraubenkopf' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: { low: '/assets/wera/ph-kreuzschlitz.glb', high: '/assets/wera/ph-kreuzschlitz.glb' },
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		camera: {
			azimuth: -135, // negativ: von links, positiv: von rechts
			elevation: 35, // positiv: von oben
			fitScale: 1.5
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			modelScale: 1.9,
			hoverModelScale: 1.6,
			expandedHoverModelScale: 0.95,
			dockedView: {
				scale: 1.2,
				azimuth: -135,
				elevation: 35
			}
		}
	},
	{
		id: 'kraftform-kompakt',
		brandId: 'wera',
		pageTitle: 'Kraftform Kompakt | WERA',
		eyebrow: 'Jede Abmessung immer dabei.',
		title: 'Kraftform Kompakt',
		features: [
			{ label: 'Hand- und maschinenbetätigte Verschraubung' },
			{ label: 'Griff-/Wechselklingen-System' },
			{ label: 'Flexibilität durch Griff + Wechselklingen' },
			{ label: 'Kraftform Kompakt VDE' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: {
			low: '/assets/wera/kraftform-kompakt.glb',
			high: '/assets/wera/kraftform-kompakt.glb'
		},
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		camera: {
			azimuth: 5, // negativ: von links, positiv: von rechts
			elevation: 60, // positiv: von oben
			fitScale: 1.1
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			hoverModelScale: 1.2,
			expandedHoverModelScale: 1.15,
			dockedView: {
				scale: 1.6
			}
		}
	},
	{
		id: 'kraftform-kompakt-20',
		brandId: 'wera',
		pageTitle: 'Kraftform Kompakt 20 | WERA',
		eyebrow: 'Hat alles im Griff.',
		title: 'Kraftform Kompakt 20',
		features: [
			{ label: 'Die Werkzeuggattung für Maschine und Hand' },
			{ label: 'Federunterstützter Öffnungsmechanismus' },
			{ label: 'Herausgefahrene Teleskopklinge' },
			{ label: 'Entnehmbare und als Maschinenadapter einsetzbare Bajonettklinge' },
			{ label: 'Rapidaptor Schnellwechselfutter' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: {
			low: '/assets/wera/kraftform-kompakt-20.glb',
			high: '/assets/wera/kraftform-kompakt-20.glb'
		},
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		camera: {
			azimuth: -55, // negativ: von links, positiv: von rechts
			elevation: 30, // positiv: von oben
			fitScale: 1.5
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			modelScale: 1.9,
			hoverModelScale: 1.6,
			expandedHoverModelScale: 0.5,
			dockedView: {
				scale: 1.2,
				azimuth: -55,
				elevation: 30
			}
		}
	},
	{
		id: 'winkelschluessel',
		brandId: 'wera',
		pageTitle: 'Winkelschlüssel | WERA',
		eyebrow: 'Hat alles im Griff.',
		title: 'Winkelschlüssel',
		features: [
			{ label: 'Vollgummimaterial für lange Lebensdauer' },
			{ label: 'Komfortabler Öffnungs-/ Schließmechanismus' },
			{ label: 'Größenkennzeichnung auf dem Clip' },
			{ label: 'Take it easy Werkzeugfinder' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: {
			low: '/assets/wera/winkelschluessel.glb',
			high: '/assets/wera/winkelschluessel.glb'
		},
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		model: {
			rotation: { z: Math.PI * 0.5 }
		},
		camera: {
			azimuth: 20, // negativ: von links, positiv: von rechts
			elevation: 20, // positiv: von oben
			fitScale: 1.5
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			modelScale: 1.2,
			hoverModelScale: 1.4,
			expandedHoverModelScale: 1,
			dockedView: {
				azimuth: 0,
				elevation: 0,
				scale: 1.2
			}
		}
	},
	{
		id: 'zyklop-speed',
		brandId: 'wera',
		pageTitle: 'Zyklop Speed | WERA',
		eyebrow: 'Ein echter Schnelldreher.',
		title: 'Zyklop Speed',
		features: [
			{ label: 'Niedriger Rückschwenkwinkel' },
			{ label: 'Frei schwenkbarer Knarrenkopf' },
			{ label: 'Kugelarretierung' },
			{ label: 'Rechts- /Linksgang' }
		],
		action: { label: 'Haendler finden' },

		background: weraElementDefaults.background,
		hdr: weraElementDefaults.hdr,
		geometry: { low: '/assets/wera/zyklop-speed.glb', high: '/assets/wera/zyklop-speed.glb' },
		fallbackImage: '/assets/posters/wera-tool-check-plus.png',
		fallbackImageSize: [336, 480],

		model: {
			rotation: { x: Math.PI * 0.5 }
		},
		camera: {
			azimuth: 35, // negativ: von links, positiv: von rechts
			elevation: 30, // positiv: von oben
			fitScale: 1.6
		},
		breadcrumbs: [
			{ label: 'Werkzeuge', href: '/wera/categories/list' },
			{ label: 'Sets' },
			{ label: 'Tool-Check Plus' }
		],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Tool set view' },
			{ id: 'technical-drawing', kind: 'drawing', label: 'Tool layout drawing' }
		],
		minimap: {
			modelScale: 1,
			hoverModelScale: 1.4,
			expandedHoverModelScale: 1.2,
			dockedView: {
				scale: 1.4
			}
		}
	}
]);
