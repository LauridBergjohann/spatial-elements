import { resolveCarouselLayout, spatialLayoutTokens, type CarouselLayoutInput, type LayoutRect } from '../spatial-element/responsiveLayout.js';

export interface CarouselFraming {
	compact: boolean;
	fit: LayoutRect;
	summary: { x: number; width: number; anchorY: number; alignment: 'center' | 'end' };
}

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
	/** Camera-space offsets from the shared section origin; no per-item perspective compensation. */
	orbit?: { x: number; y: number; pitch: number };
	framing?: CarouselFraming;
}

export interface CatalogPoseProvider {
	kind: 'carousel';
	read(): CatalogPose;
}

/** Presentation controls, never asset scale, URL or renderer ownership. */
export interface CarouselPresentation {
	/** Horizontal spacing multiplier, normalized around the default 0.48. */
	radius?: number;
	/** Turntable depth control in CSS-world pixels (default 700). */
	depth?: number;
}

/** Cached section metrics, shared by DOM hit targets, posters and GPU poses. */
export interface CarouselLayout {
	width: number;
	height: number;
	left: number;
	viewportWidth: number;
	framing?: CarouselFraming;
}

/** Convert predictable viewport rules to the existing section-local scene clock. */
export function resolveCarouselPoseLayout(input: CarouselLayoutInput, ring: { width: number; left: number }): CarouselLayout {
	const resolved = resolveCarouselLayout(input);
	const compact = resolved.summary.placement === 'compact';
	const titleHeight = compact ? spatialLayoutTokens.carousel.compactEyebrowHeight : 0;
	const ringTop = resolved.mediaFit.y - titleHeight;
	return {
		width: ring.width, height: resolved.mediaFit.height + titleHeight,
		left: ring.left, viewportWidth: resolved.base.layoutWidth,
		framing: {
			compact,
			fit: { ...resolved.mediaFit, x: resolved.mediaFit.x - ring.left, y: titleHeight },
			summary: { x: resolved.summary.x - ring.left, width: resolved.summary.width,
				anchorY: compact ? titleHeight : resolved.summary.anchor.y - ringTop,
				alignment: compact ? 'end' : 'center' }
		}
	};
}

const defaultLayout: CarouselLayout = { width: 1320, height: 560, left: 60, viewportWidth: 1440 };

export interface CarouselEmphasis { advance: number; panel: number }

export function carouselEmphasis(distance: number): CarouselEmphasis {
	return { advance: Math.max(0, 1 - distance * distance) ** 2,
		panel: Math.max(0, 1 - Math.abs(distance)) ** 2 };
}

/** A gesture can only withdraw its initial presentation, never select passing seats. */
export class CarouselDragEmphasis {
	private travel = 0;
	constructor(private readonly phase: number, private readonly initial: readonly CarouselEmphasis[]) {}
	move(phase: number): CarouselEmphasis[] {
		this.travel = Math.max(this.travel, Math.abs(phase - this.phase));
		const remaining = carouselEmphasis(this.travel);
		return this.initial.map(value => ({
			advance: value.advance * remaining.advance,
			panel: value.panel * remaining.panel
		}));
	}
}

function framing(distance: number, presentation: CarouselPresentation, layout: CarouselLayout,
	emphasis = carouselEmphasis(distance)) {
	const compact = layout.framing?.compact ?? layout.viewportWidth < spatialLayoutTokens.layoutMinWidths.m;
	const fit = layout.framing?.fit;
	const frame = fit ? Math.min(fit.width, fit.height) : Math.min(layout.width, compact ? 360 : layout.height);
	const spacing = Number.isFinite(presentation.radius)
		? Math.max(0.2, Math.min(0.7, presentation.radius!)) : 0.48;
	const depth = Number.isFinite(presentation.depth)
		? Math.max(0, Math.min(1200, presentation.depth!)) : 700;
	// A larger, shallower turntable: keep useful seat spacing by reducing the
	// angle between products rather than packing the same angle onto a larger ring.
	const radius = frame * (compact ? 2.2 : 3.4) * spacing / 0.48 * (0.75 + depth / 2800);
	const step = 0.4;
	const travel = Math.abs(distance);
	// Only the front arc is presented. Never wrap a long catalog onto occupied seats.
	const angle = Math.max(-1.35, Math.min(1.35, distance * step));
	const pitch = 10 * Math.PI / 180;
	const pull = frame * 1.25;
	// Smooth at both the selected seat and the point where it rejoins the ring.
	const advance = pull * emphasis.advance;
	const recession = radius * (1 - Math.cos(angle)) + pull - advance;
	const z = -recession * Math.cos(pitch);
	// Selection changes depth only; every seat retains its horizontal position.
	const orbit = {
		x: radius * Math.sin(angle),
		y: recession * Math.sin(pitch),
		pitch
	};
	const scale = 2500 / (2500 - z);
	const anchor = layout.left + (fit ? fit.x + fit.width / 2 : layout.width * (compact ? 0.5 : 0.31));
	const center = layout.viewportWidth / 2 + (anchor - layout.viewportWidth / 2 + orbit.x) * scale;
	const offset = center - anchor;
	const extent = frame * 0.82 * scale * 0.6;
	const seats = compact ? 1.49 : 3.24;
	const arcOpacity = Math.max(0, Math.min(1, (seats - travel) / 0.38));
	return { offset, scale, center, extent, orbit, z, angle, arcOpacity, seats };
}

export function carouselDistance(index: number, phase: number, count: number) {
	return count > 1 ? index - phase : 0;
}

/** Prepare only the viewport and a small margin, including fractional drag movement. */
export function carouselResident(index: number, phase: number, count: number,
	presentation: CarouselPresentation = {}, layout: CarouselLayout = defaultLayout) {
	const distance = carouselDistance(index, phase, count);
	const { seats } = framing(distance, presentation, layout);
	// Include the neighbouring animation window before the front arc enters view.
	return Math.abs(distance) < seats + 1;
}

/** A shared circular turntable, tilted toward the viewer, with a smooth foreground advance. */
export function carouselPose(
	index: number,
	phase: number,
	count: number,
	presentation: CarouselPresentation = {},
	layout: CarouselLayout = defaultLayout,
	emphasis = carouselEmphasis(carouselDistance(index, phase, count)),
	/** Shared foreground focus: zero keeps the whole turntable sharp. */
	focus = 1
): CatalogPose {
	const distance = carouselDistance(index, phase, count);
	const { offset, scale, center, extent, orbit, z, angle, arcOpacity } = framing(distance, presentation, layout, emphasis);
	const edge = Math.max(0, Math.min(1, (center + extent) / 48, (layout.viewportWidth - center + extent) / 48)) * arcOpacity;
	return {
		x: (layout.framing ? layout.framing.fit.x + layout.framing.fit.width / 2 : layout.width * 0.5) / Math.max(1, layout.width) + offset / Math.max(1, layout.width),
		y: (layout.framing ? layout.framing.fit.y + layout.framing.fit.height / 2 : layout.height * 0.54) / Math.max(1, layout.height) - orbit.y * scale / Math.max(1, layout.height),
		size: 0.82 * scale,
		depth: z,
		orbit,
		...(layout.framing ? { framing: layout.framing } : {}),
		yaw: angle,
		visible: edge > 0,
		front: Math.abs(distance) <= 0.5,
		panelOpacity: emphasis.panel,
		blur: Math.min(5, Math.max(0, Math.abs(distance) - 0.15) ** 1.4 * 2.2) * focus,
		opacity: edge
	};
}

export const CATALOG_POSE_CHANGED = 'catalog-pose-changed';
