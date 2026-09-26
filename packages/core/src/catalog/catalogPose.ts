/** Section-local screen framing, independent of assets and camera ownership. */
export interface CatalogPose {
	x: number;
	y: number;
	size: number;
	depth: number;
	yaw: number;
	visible: boolean;
	front: boolean;
	panelOpacity: number;
	opacity: number;
}

export interface CatalogPoseProvider {
	kind: 'carousel';
	read(): CatalogPose;
}

/** Presentation controls, never asset scale, URL or renderer ownership. */
export interface CarouselPresentation {
	/** Horizontal arc extent as a fraction of section width (default 0.48). */
	radius?: number;
	/** Maximum rearward travel in CSS-world pixels (default 700). */
	depth?: number;
}

export function carouselDistance(index: number, phase: number, count: number) {
	return count > 1 ? index - phase : 0;
}

/** Five visible seats, plus one preparation seat on either side. No duplicated elements. */
export function carouselResident(index: number, phase: number, count: number) {
	return Math.abs(carouselDistance(index, phase, count)) <= 3;
}

/** An ordered shallow arc of element/panel groups, independent of the asset's physical dimensions. */
export function carouselPose(
	index: number,
	phase: number,
	count: number,
	presentation: CarouselPresentation = {}
): CatalogPose {
	const distance = carouselDistance(index, phase, count);
	// Fixed angular spacing: adding spatialElements extends the arc, never closes a turntable.
	const angle = (distance * Math.PI) / 12;
	const back = Math.min(1, (1 - Math.cos(angle)) / (1 - Math.cos(Math.PI / 6)));
	const edge = Math.max(0, Math.min(1, (2.5 - Math.abs(distance)) * 2));
	const radius = Number.isFinite(presentation.radius)
		? Math.max(0.2, Math.min(0.7, presentation.radius!))
		: 0.48;
	const depth = Number.isFinite(presentation.depth)
		? Math.max(0, Math.min(1200, presentation.depth!))
		: 700;
	return {
		x: 0.5 + (Math.sin(angle) * radius) / Math.sin(Math.PI / 6),
		y: 0.5 - back * 0.1,
		size: 0.82 / (1 + Math.abs(distance) * 0.65),
		depth: -back * depth,
		// Strong near-centre turn, smoothly bounded before distant seats become edge-on.
		yaw: -Math.atan(distance * Math.tan((28 * Math.PI) / 180)),
		visible: Math.abs(distance) < 2.5,
		front: Math.abs(distance) <= 0.5,
		panelOpacity: Math.pow(Math.max(0, 1 - Math.abs(distance)), 2),
		opacity: edge
	};
}

export const CATALOG_POSE_CHANGED = 'catalog-pose-changed';
