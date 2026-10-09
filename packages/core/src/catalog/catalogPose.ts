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
	/** CSS-pixel defocus; zero at the selected seat and continuous during dragging. */
	blur?: number;
	opacity: number;
}

export interface CatalogPoseProvider {
	kind: 'carousel';
	read(): CatalogPose;
}

/** Presentation controls, never asset scale, URL or renderer ownership. */
export interface CarouselPresentation {
	/** Horizontal spacing multiplier, normalized around the default 0.48. */
	radius?: number;
	/** Maximum rearward travel in CSS-world pixels (default 700). */
	depth?: number;
}

/** Cached section metrics, shared by DOM hit targets, posters and GPU poses. */
export interface CarouselLayout {
	width: number;
	height: number;
	left: number;
	viewportWidth: number;
}

const defaultLayout: CarouselLayout = { width: 1320, height: 560, left: 60, viewportWidth: 1440 };

function framing(distance: number, presentation: CarouselPresentation, layout: CarouselLayout) {
	const compact = layout.width < 700;
	// Compact layouts retain tappable side previews without crowding the focused model.
	const minimumScale = compact ? 0.24 : 0.36;
	const recession = compact ? 2.4 : 0.65;
	const diameter = Math.min(layout.width, compact ? 360 : layout.height) * 0.82;
	const gap = compact ? 28 : 44;
	const radius = Number.isFinite(presentation.radius)
		? Math.max(0.2, Math.min(0.7, presentation.radius!)) : 0.48;
	const travel = Math.abs(distance);
	const limit = (1 / minimumScale - 1) / recession;
	// Integrate the shrinking model envelope, then keep a readable minimum size.
	// Unlike a sine arc, this stays ordered even on ultrawide screens and long lists.
	const envelope = Math.log1p(Math.min(travel, limit) * recession) / recession + Math.max(0, travel - limit) * minimumScale;
	const offset = Math.sign(distance) * (diameter * (compact ? 1.18 : 1.12) * envelope + gap * travel) * radius / 0.48;
	const scale = Math.max(minimumScale, 1 / (1 + travel * recession));
	const center = layout.left + layout.width * (compact ? 0.5 : 0.31) + offset;
	const extent = diameter * scale * 0.6;
	return { offset, scale, center, extent, overscan: diameter + gap };
}

export function carouselDistance(index: number, phase: number, count: number) {
	return count > 1 ? index - phase : 0;
}

/** Prepare only the viewport and a small margin, including fractional drag movement. */
export function carouselResident(index: number, phase: number, count: number,
	presentation: CarouselPresentation = {}, layout: CarouselLayout = defaultLayout) {
	const { center, extent, overscan } = framing(carouselDistance(index, phase, count), presentation, layout);
	return center + extent > -overscan && center - extent < layout.viewportWidth + overscan;
}

/** An ordered shallow arc of element/panel groups, independent of the asset's physical dimensions. */
export function carouselPose(
	index: number,
	phase: number,
	count: number,
	presentation: CarouselPresentation = {},
	layout: CarouselLayout = defaultLayout
): CatalogPose {
	const distance = carouselDistance(index, phase, count);
	const angle = (Math.min(2, Math.abs(distance)) * Math.PI) / 12;
	const back = Math.min(1, (1 - Math.cos(angle)) / (1 - Math.cos(Math.PI / 6)));
	const { offset, scale, center, extent } = framing(distance, presentation, layout);
	const edge = Math.max(0, Math.min(1, (center + extent) / 48, (layout.viewportWidth - center + extent) / 48));
	const depth = Number.isFinite(presentation.depth)
		? Math.max(0, Math.min(1200, presentation.depth!))
		: 700;
	return {
		x: 0.5 + offset / Math.max(1, layout.width),
		y: 0.5 - back * 0.1,
		size: 0.82 * scale,
		depth: -back * depth,
		// Strong near-centre turn, smoothly bounded before distant seats become edge-on.
		yaw: -Math.atan(distance * Math.tan((28 * Math.PI) / 180)),
		visible: edge > 0,
		front: Math.abs(distance) <= 0.5,
		panelOpacity: Math.pow(Math.max(0, 1 - Math.abs(distance)), 2),
		blur: Math.min(7, Math.max(0, Math.abs(distance) - 0.15) ** 1.4 * 3),
		opacity: edge
	};
}

export const CATALOG_POSE_CHANGED = 'catalog-pose-changed';
