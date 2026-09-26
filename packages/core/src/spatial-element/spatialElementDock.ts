/** A viewport-aligned rectangle expressed in CSS pixels. */
export interface SpatialElementDockRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

const MAX_DOCKED_MINIMAP_MODEL_SCALE = 1.4;
const MIN_CONFIGURED_DOCKED_MINIMAP_MODEL_SCALE = 0.2;
const MAX_CONFIGURED_DOCKED_MINIMAP_MODEL_SCALE = 2;
export const SPATIAL_ELEMENT_TABS_DOCK_SEAM_OVERLAP = 1;

/** Resolves the fixed spatial-element-header rectangle for a viewport. */
export function getSpatialElementDockDestination(
	viewportWidth: number,
	top = 8,
	height = 86
): SpatialElementDockRect {
	const inset = 16;
	return {
		left: inset,
		top,
		width: Math.max(viewportWidth - inset * 2, 1),
		height
	};
}

/** Pins the unchanged minimap to the top edge of the viewport. */
export function getMinimapDockDestination(source: SpatialElementDockRect): SpatialElementDockRect {
	return {
		...source,
		top: 0
	};
}

/** Fits the docked minimap around a compact header without consuming most of its copy width. */
export function getCompactMinimapDockDestination(
	source: SpatialElementDockRect,
	header: SpatialElementDockRect,
	viewportWidth: number,
	inset = 4
): SpatialElementDockRect {
	const safeInset = Math.max(inset, 0);
	const size = Math.max(
		Math.min(source.width, header.height + 8, viewportWidth - safeInset * 2),
		1
	);
	const minimumLeft = header.left + safeInset;
	const maximumLeft = Math.max(header.left + header.width - size - safeInset, minimumLeft);

	return {
		left: Math.min(Math.max(source.left, minimumLeft), maximumLeft),
		top: Math.max(header.top - (size - header.height) * 0.5, 0),
		width: size,
		height: size
	};
}

/** Overlaps the subnavigation with the header edge to avoid a compositing seam between surfaces. */
export function getSpatialElementTabsDockDestination(
	source: SpatialElementDockRect,
	header: SpatialElementDockRect,
	viewportWidth: number,
	inset = 8,
	seamOverlap = SPATIAL_ELEMENT_TABS_DOCK_SEAM_OVERLAP
): SpatialElementDockRect {
	const safeInset = Math.max(inset, 0);
	const safeSeamOverlap = Number.isFinite(seamOverlap) ? Math.max(seamOverlap, 0) : 0;
	const left = Math.min(
		Math.max(source.left, safeInset),
		Math.max(viewportWidth - safeInset, safeInset)
	);
	const width = Math.max(Math.min(source.width, viewportWidth - left - safeInset), 1);

	return {
		left,
		top: header.top + header.height - safeSeamOverlap,
		width,
		height: Math.max(source.height, 1)
	};
}

/** Returns the exact visual-scroll point where the source tabs meet their dock destination. */
export function getSpatialElementTabsDockBreakpoint(sourceDocumentTop: number, dockTop: number) {
	return Math.max(sourceDocumentTop - dockTop, 0);
}

/** Tabs only dock after the element header is available as their visible anchor. */
export function getSpatialElementTabsDockTarget(
	scrollY: number,
	breakpoint: number,
	headerDocked: boolean,
	currentlyDocked = false,
	releaseOffset = 1
) {
	if (!headerDocked) return false;
	return currentlyDocked
		? scrollY >= Math.max(breakpoint - Math.max(releaseOffset, 0), 0)
		: scrollY >= breakpoint;
}

/** Morphs the dock shell over a short, reversible distance after the visual handoff. */
export function getSpatialElementTabsDockProgress(scrollY: number, breakpoint: number, distance = 24) {
	const safeDistance = Number.isFinite(distance) ? Math.max(distance, 0) : 0;
	if (safeDistance === 0) return scrollY >= breakpoint ? 1 : 0;
	return Math.min(Math.max((scrollY - breakpoint) / safeDistance, 0), 1);
}

/** Leaves a small reading gap below the complete docked header stack for anchor navigation. */
export function getSpatialElementSectionScrollOffset(tabs: SpatialElementDockRect, gap = 16) {
	return Math.max(tabs.top + tabs.height + Math.max(gap, 0), 0);
}

/**
 * Makes the docked element overhang as deliberately as the minimap is taller than
 * the header, without requiring spatial-element-specific optical tuning.
 */
export function getDockedMinimapModelScale(
	minimap: SpatialElementDockRect,
	header: SpatialElementDockRect,
	configuredScale?: number
) {
	if (configuredScale !== undefined && Number.isFinite(configuredScale)) {
		return Math.min(
			Math.max(configuredScale, MIN_CONFIGURED_DOCKED_MINIMAP_MODEL_SCALE),
			MAX_CONFIGURED_DOCKED_MINIMAP_MODEL_SCALE
		);
	}

	const minimapHeight = Number.isFinite(minimap.height) ? Math.max(minimap.height, 0) : 0;
	const headerHeight = Number.isFinite(header.height) ? Math.max(header.height, 0) : 0;
	if (minimapHeight === 0 || headerHeight === 0) return 1;

	return Math.min(Math.max(minimapHeight / headerHeight, 1), MAX_DOCKED_MINIMAP_MODEL_SCALE);
}

/** Reserves the scaled model's potential right-side overhang before header copy. */
export function getDockedMinimapCopyReserve(
	minimap: SpatialElementDockRect,
	header: SpatialElementDockRect,
	modelScale: number,
	gap = 16
) {
	const safeScale = Number.isFinite(modelScale) ? Math.max(modelScale, 1) : 1;
	const modelOverflow = Math.max(minimap.width, 0) * (safeScale - 1) * 0.5;
	return Math.max(minimap.left + minimap.width + modelOverflow + gap - header.left, 0);
}

/** Covers the complete scaled model overhang with a viewport-aligned interaction target. */
export function getDockedMinimapInteractionRect(
	minimap: SpatialElementDockRect,
	header: SpatialElementDockRect,
	modelScale: number
): SpatialElementDockRect {
	const safeScale = Number.isFinite(modelScale) ? Math.max(modelScale, 1) : 1;
	const width = Math.max(minimap.width, 1) * safeScale;
	const height = Math.max(minimap.height, 1) * safeScale;

	return {
		left: minimap.left - (width - minimap.width) * 0.5,
		top: header.top,
		width,
		height
	};
}

/** Returns the scroll position where the minimap naturally reaches its fixed position. */
export function getSpatialElementDockBreakpoint(minimapDocumentTop: number, minimapDockTop: number) {
	return Math.max(minimapDocumentTop - minimapDockTop, 0);
}

/**
 * Maps page scroll directly to the minimap/header handoff. The transition starts
 * at the top of the page and completes when the source minimap has fully left the viewport.
 */
export function getSpatialElementDockPresentationProgress(
	scrollY: number,
	minimapDocumentBottom: number,
	startScrollY = 0
) {
	const start = Number.isFinite(startScrollY) ? Math.max(startScrollY, 0) : 0;
	const end = Number.isFinite(minimapDocumentBottom)
		? Math.max(minimapDocumentBottom, start)
		: start;
	if (end === start) return scrollY >= end ? 1 : 0;
	return Math.min(Math.max((scrollY - start) / (end - start), 0), 1);
}

/** Adds a small release hysteresis so trackpad momentum cannot flicker the header. */
export function getSpatialElementDockTarget(
	scrollY: number,
	breakpoint: number,
	currentlyDocked: boolean,
	releaseOffset = 16
) {
	return currentlyDocked
		? scrollY >= Math.max(breakpoint - releaseOffset, 0)
		: scrollY >= breakpoint;
}
