import { describe, expect, it } from 'vitest';
import {
	getCompactMinimapDockDestination,
	getDockedMinimapCopyReserve,
	getDockedMinimapInteractionRect,
	getDockedMinimapModelScale,
	getMinimapDockDestination,
	getSpatialElementDockBreakpoint,
	getSpatialElementDockDestination,
	getSpatialElementDockPresentationProgress,
	getSpatialElementDockTarget,
	getSpatialElementSectionScrollOffset,
	getSpatialElementTabsDockBreakpoint,
	getSpatialElementTabsDockDestination,
	getSpatialElementTabsDockProgress,
	getSpatialElementTabsDockTarget,
	resolveSpatialElementDockLayout,
	type SpatialElementDockRect
} from './spatialElementDock.js';

const source: SpatialElementDockRect = { left: 40, top: 150, width: 120, height: 120 };

describe('spatialElement dock geometry', () => {
	it.each([
		[430, 76, 80, 0], [600, 76, 80, 0], [840, 80, 80, 40],
		[1200, 86, 80, 44], [1600, 86, 112, 44], [2100, 86, 138, 44]
	])('uses canonical dock and submenu dimensions at %ipx', (width, height, minimapWidth, tabsHeight) => {
		const result = resolveSpatialElementDockLayout({ width, height: 900 }, 400)!;
		expect(result.header.top).toBe(0);
		expect(result.header.height).toBe(height);
		expect(result.minimap.width).toBe(minimapWidth);
		expect(result.minimap.top + result.minimap.height / 2).toBe(height / 2);
		expect(result.submenu?.height ?? 0).toBe(tabsHeight);
		if (result.submenu) {
			expect(result.submenu.width).toBe(400);
			expect(result.submenu.top).toBe(height);
		}
	});
	it('shares safe area and scrollbar geometry with navigation obstruction insets', () => {
		const result = resolveSpatialElementDockLayout({ width: 900, height: 900, scrollbarWidth: 15,
			safeArea: { left: 20, right: 30, top: 24 } }, 3000)!;
		expect(result.header).toEqual({ left: 20, top: 24, width: 835, height: 80 });
		expect(result.submenu).toEqual({ left: 28, top: 104, width: 819, height: 40 });
		expect(result.sectionOffset).toBe(152);
	});
	it('leaves the fixed split-pane header to its own composition', () => {
		expect(resolveSpatialElementDockLayout({ width: 2400, height: 900 })).toBeUndefined();
		expect(resolveSpatialElementDockLayout({ width: 2400, height: 500 })?.layout).toBe('2xl');
	});
	it('fits the rail into the narrow outer band at the lower 2XL boundary', () => {
		const result = resolveSpatialElementDockLayout({ width: 1809, height: 900 })!;
		expect(result.minimap).toEqual({ left: 8, top: -9.25, width: 104.5, height: 104.5 });
		expect(result.header).toEqual({ left: 8, top: 0, width: 1793, height: 86 });
		expect(result.header.left + result.titleReserve).toBe(136.5);
	});
	it('creates a restrained full-width destination', () => {
		expect(getSpatialElementDockDestination(1000)).toEqual({
			left: 16,
			top: 8,
			width: 968,
			height: 86
		});
		expect(getSpatialElementDockDestination(4000).left).toBe(16);
	});

	it('moves the minimap to the viewport top only on the vertical axis', () => {
		expect(getMinimapDockDestination(source)).toEqual({
			left: source.left,
			top: 0,
			width: source.width,
			height: source.height
		});
	});

	it('shrinks and centers the minimap around a compact header', () => {
		const compactHeader = { left: 8, top: 8, width: 374, height: 72 };
		expect(getCompactMinimapDockDestination(source, compactHeader, 390)).toEqual({
			left: 40,
			top: 4,
			width: 80,
			height: 80
		});
	});

	it('derives one bounded docked model scale from the minimap and header geometry', () => {
		const header = { left: 16, top: 8, width: 968, height: 86 };
		expect(getDockedMinimapModelScale(source, header)).toBeCloseTo(120 / 86);
		expect(getDockedMinimapModelScale(source, { ...header, height: 120 })).toBe(1);
		expect(getDockedMinimapModelScale({ ...source, height: 300 }, header)).toBe(1.4);
		expect(getDockedMinimapModelScale(source, { ...header, height: 0 })).toBe(1);
	});

	it('prefers a bounded spatial-element-specific docked model scale when configured', () => {
		const header = { left: 16, top: 8, width: 968, height: 86 };
		expect(getDockedMinimapModelScale(source, header, 1.18)).toBe(1.18);
		expect(getDockedMinimapModelScale(source, header, 5)).toBe(2);
		expect(getDockedMinimapModelScale(source, header, 0)).toBe(0.2);
		expect(getDockedMinimapModelScale(source, header, Number.NaN)).toBeCloseTo(120 / 86);
	});

	it('keeps header copy clear of the scaled model overhang', () => {
		const header = { left: 16, top: 8, width: 968, height: 86 };
		const modelScale = getDockedMinimapModelScale(source, header);
		expect(getDockedMinimapCopyReserve(source, header, modelScale)).toBeCloseTo(
			40 + 120 + (120 * (modelScale - 1)) / 2 + 16 - 16
		);
	});

	it('covers the scaled docked minimap from its visible top edge', () => {
		const source = { left: 32, top: 0, width: 120, height: 120 };
		const header = { left: 16, top: 8, width: 968, height: 86 };

		expect(getDockedMinimapInteractionRect(source, header, 1.4)).toEqual({
			left: 8,
			top: 8,
			width: 168,
			height: 168
		});
	});

	it.each([430, 840, 1200, 1600, 2100])('keeps the dock hit target below the safe top at %ipx', width => {
		const layout = resolveSpatialElementDockLayout({ width, height: 900 })!;
		const hit = getDockedMinimapInteractionRect(layout.minimap, layout.header, 1.4);
		expect(hit.left + hit.width / 2).toBeCloseTo(layout.minimap.left + layout.minimap.width / 2);
		expect(hit.top).toBe(layout.header.top);
		expect(hit.top + hit.height).toBeGreaterThan(layout.minimap.top + layout.minimap.height);
	});

	it('uses the minimap natural arrival as a discrete dock breakpoint', () => {
		expect(getSpatialElementDockBreakpoint(160, 0)).toBe(160);
		expect(getSpatialElementDockBreakpoint(-12, 0)).toBe(0);
	});

	it('maps the full source minimap exit to a linear presentation progress', () => {
		expect(getSpatialElementDockPresentationProgress(0, 280)).toBe(0);
		expect(getSpatialElementDockPresentationProgress(70, 280)).toBe(0.25);
		expect(getSpatialElementDockPresentationProgress(140, 280)).toBe(0.5);
		expect(getSpatialElementDockPresentationProgress(280, 280)).toBe(1);
		expect(getSpatialElementDockPresentationProgress(400, 280)).toBe(1);
		expect(getSpatialElementDockPresentationProgress(-20, 280)).toBe(0);
	});

	it('holds the dock across a small release hysteresis', () => {
		expect(getSpatialElementDockTarget(99, 100, false)).toBe(false);
		expect(getSpatialElementDockTarget(100, 100, false)).toBe(true);
		expect(getSpatialElementDockTarget(84, 100, true)).toBe(true);
		expect(getSpatialElementDockTarget(83, 100, true)).toBe(false);
	});

	it('docks tabs at the header edge while preserving their source alignment', () => {
		const header = { left: 16, top: 8, width: 968, height: 86 };
		const tabs = { left: 120, top: 500, width: 620, height: 52 };
		const destination = getSpatialElementTabsDockDestination(tabs, header, 1000);

		expect(destination).toEqual({ left: 120, top: 93, width: 620, height: 52 });
		expect(getSpatialElementTabsDockBreakpoint(500, destination.top)).toBe(407);
		expect(getSpatialElementTabsDockTarget(406, 407, true)).toBe(false);
		expect(getSpatialElementTabsDockTarget(407, 407, false)).toBe(false);
		expect(getSpatialElementTabsDockTarget(407, 407, true)).toBe(true);
		expect(getSpatialElementTabsDockTarget(406.5, 407, true, true)).toBe(true);
		expect(getSpatialElementTabsDockTarget(405.9, 407, true, true)).toBe(false);
		expect(getSpatialElementTabsDockProgress(406, 407)).toBe(0);
		expect(getSpatialElementTabsDockProgress(407, 407)).toBe(0);
		expect(getSpatialElementTabsDockProgress(419, 407)).toBe(0.5);
		expect(getSpatialElementTabsDockProgress(431, 407)).toBe(1);
		expect(getSpatialElementTabsDockProgress(500, 407)).toBe(1);
		expect(getSpatialElementSectionScrollOffset(destination)).toBe(161);
	});
});
