import type { SpatialElementData, SpatialListItem } from './types.js';
import type { SpatialElementLodPair } from '../catalog/spatialElementLodPair.js';
import { resolveSpatialElementGeometry } from './spatialElementGeometry.js';

type ElementAppearance = Pick<
	SpatialElementData,
	| 'hdr'
	| 'background'
	| 'model'
	| 'camera'
	| 'assetManifest'
	| 'fallbackImage'
	| 'fallbackImageSize'
>;
/** @internal Legacy renderer projection, derived from the single public geometry field. */
export interface SpatialElementScene extends ElementAppearance {
	glb: string;
	lodPair?: SpatialElementLodPair;
}
/** @internal Authoring inputs; never pass a renderer projection back through this boundary. */
export type SpatialElementSceneSource = ElementAppearance & Pick<SpatialElementData, 'geometry'>;

/** @internal Content and runtime pose callbacks never participate in asset identity. */
export function getSpatialElementScene(element: SpatialElementSceneSource): SpatialElementScene {
	const { hdr, background, model, camera, assetManifest, fallbackImage, fallbackImageSize } =
		element;
	const lodPair = resolveSpatialElementGeometry(element.geometry);
	return {
		glb: lodPair.sourceUrl,
		lodPair,
		hdr,
		background,
		model,
		camera,
		assetManifest,
		fallbackImage,
		fallbackImageSize
	};
}
/** @internal Text-only cards intentionally have no geometry. */
export function hasSpatialElementScene(
	element: SpatialListItem
): element is SpatialListItem & SpatialElementSceneSource {
	return Boolean(element.geometry && element.hdr);
}
