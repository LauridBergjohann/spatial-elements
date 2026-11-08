import { describe, expect, it } from 'vitest';
import {
	contentSpanWidth, resolveCardLayout, resolveContentGrid, resolveContentSpan,
	resolveCarouselLayout, resolveDetailLayout, resolveMenuOffset, resolvePanelHeight,
	resolveResponsiveLayout, resolveViewportLayout, resolveZoomLayout, spatialLayoutTokens
} from './responsiveLayout.js';

describe('responsive layout contract', () => {
	it('distinguishes media-query width from space reserved for a classic scrollbar', () => {
		const result = resolveResponsiveLayout({ width: 1600, height: 900, scrollbarWidth: 15 });
		expect(result.layout).toBe('xl');
		expect(result.layoutWidth).toBe(1585);
		expect(result.content).toEqual({ x: 136, width: 1313 });
		expect(resolveResponsiveLayout({ width: 2400, height: 900, scrollbarWidth: 15 }).pane.x).toBe(1200.5);
	});
	it.each([[600, 'xs', 's'], [840, 's', 'm'], [1200, 'm', 'l'], [1600, 'l', 'xl'],
		[1809, 'xl', '2xl'], [2300, '2xl', '3xl']] as const)('uses CSS width at %i', (boundary, before, after) => {
		expect(resolveViewportLayout(boundary - 0.1)).toBe(before);
		expect(resolveViewportLayout(boundary)).toBe(after);
		expect(resolveViewportLayout(boundary + 0.1)).toBe(after);
	});

	it.each([320, 599.5, 600, 839.5, 840, 1199.5, 1200, 1536])('fills a %i grid exactly once', width => {
		const grid = resolveContentGrid(width);
		expect(grid.columnWidth * grid.columns + (grid.columns + 1) * grid.gap).toBeCloseTo(width);
		expect(contentSpanWidth(width, grid.columns)).toBeCloseTo(width - grid.gap * 2);
	});

	it('classifies the unpadded container independently of the viewport', () => {
		expect(resolveResponsiveLayout({ width: 2400, height: 900 }).layout).toBe('3xl');
		expect(resolveContentGrid(840).size).toBe('m');
		expect(resolveContentGrid(808).size).toBe('s');
		expect(resolveContentGrid(9000).width).toBe(1536);
	});

	it('inherits responsive spans without dense reordering or invalid arithmetic', () => {
		expect(resolveContentSpan({ s: 3, l: 4 }, 'xs')).toBe(4);
		expect(resolveContentSpan({ s: 3, l: 4 }, 'm')).toBe(3);
		expect(resolveContentSpan({ s: 3, l: 4 }, 'l')).toBe(4);
		for (const invalid of [0, -1, 1.5, NaN, Infinity]) expect(resolveContentSpan(invalid, 'm')).toBe(8);
		expect(resolveContentSpan(20, 's')).toBe(6);
	});

	it('fits two large cards into the six-column grid', () => {
		const card = resolveCardLayout(600, 'l');
		expect(card.span).toBe(3);
		expect(card.span).toBe(spatialLayoutTokens.cards.l.gridSSpan);
		expect(card.width * 2 + 16 + 32).toBeCloseTo(600);
	});

	it('reserves text in a 320px grid without distorting the media', () => {
		const medium = resolveCardLayout(320, 'm');
		expect(medium.width).toBe(142);
		expect(medium.height).toBe(206);
		expect(medium.textHeight).toBe(64);
		expect(medium.media.height).toBe(126);
		expect(medium.media.width / medium.media.height).toBeCloseTo(1);
		expect(resolveCardLayout(320, 's').textHeight).toBe(60);
		expect(resolveCardLayout(320, 'm', { reserveEyebrow: true }).height).toBe(226);
		const landscape = resolveCardLayout(320, 'm', { mediaAspect: '3/2', mediaFit: 'cover' });
		expect(landscape.media.width / landscape.media.height).toBeCloseTo(3 / 2);
		expect(landscape.height).toBeCloseTo(142 * 2 / 3 + 64);
	});

	it('caps L content and retains the intended XL composition', () => {
		expect(resolveResponsiveLayout({ width: 1599, height: 900 }).content.width).toBe(1536);
		expect(resolveResponsiveLayout({ width: 1600, height: 900 }).content.width).toBe(1328);
		expect(resolveResponsiveLayout({ width: 1808, height: 900 }).content.width).toBe(1536);
		expect(resolveResponsiveLayout({ width: 2300, height: 900 }).content.width).toBe(1536);
	});

	it.each([[2300, 1122, 'm'], [2455.5, 1199.75, 'm'], [2456, 1200, 'l'],
		[3128, 1536, 'l'], [3840, 1536, 'l']] as const)('anchors and caps the pane at %i', (width, paneWidth, grid) => {
		const result = resolveResponsiveLayout({ width, height: 900 });
		expect(result.pane.x).toBe(width / 2 + 8);
		expect(result.pane.width).toBe(paneWidth);
		expect(result.paneGrid.size).toBe(grid);
		expect(result.paneSubmenu.y + result.paneSubmenu.height).toBe(884);
	});

	it('handles safe areas and invalid/short viewports without inverted rectangles', () => {
		for (const width of [NaN, Infinity, -1, 0, 320, 2400]) {
			const result = resolveResponsiveLayout({ width, height: 30, safeArea: { top: 40, left: 20, right: 70 } });
			for (const rect of [result.available, result.content, result.pane, result.paneSubmenu]) {
				expect(Number.isFinite(rect.x)).toBe(true);
				expect(rect.width).toBeGreaterThanOrEqual(0);
				if ('height' in rect) expect(rect.height).toBeGreaterThanOrEqual(0);
			}
		}
		const safe = resolveResponsiveLayout({ width: 2400, height: 900, safeArea: { top: 20, right: 12, bottom: 10, left: 8 } });
		expect(safe.pane.x).toBe(1208);
		expect(safe.pane.width).toBe(1160);
		expect(safe.pane.y).toBe(116);
		expect(safe.pane.height).toBe(714);
		expect(safe.paneHeader).toEqual({ x: 1208, y: 116, width: 1160, height: 86 });
		expect(safe.paneBody).toEqual({ x: 1208, y: 202, width: 1160, height: 628 });
		expect(safe.paneSubmenu).toEqual({ x: 1208, y: 830, width: 1160, height: 44 });
	});

	it('keeps the header until 112px and does not reveal it merely on upward scrolling', () => {
		expect([0, 48, 112, 140, 300, 140].map(y => resolveMenuOffset(y))).toEqual([0, 0, 0, -28, -188, -28]);
		expect(resolveMenuOffset(300, true)).toBe(0);
		expect(resolvePanelHeight(700, 400)).toBe(400);
		expect(resolvePanelHeight(700)).toBe(700);
	});
});

describe('detail presentation constraints', () => {
	it.each([
		[390, 844, 400, 374, 586],
		[600, 900, 500, 584, 686]
	])('keeps width %i summary height intrinsic and downstream flow unresolved', (width, height, fitHeight, fitWidth, summaryY) => {
		const detail = resolveDetailLayout({ width, height });
		expect(detail.mediaFit).toEqual({ x: 8, y: 90, width: fitWidth, height: fitHeight });
		expect(detail.rail.axis).toBe('horizontal');
		expect(detail.rail.rect.height).toBe(80);
		expect(detail.rail.rect.y).toBe(summaryY - 88);
		expect(detail.summary).toEqual({ x: 8, width: fitWidth,
			anchor: { y: summaryY, alignment: 'start' }, height: { kind: 'natural' }, placement: 'flow' });
		expect(detail.contentStart).toEqual({ kind: 'after-summary', gap: 0 });
		expect(detail.submenu).toBeUndefined();
		expect(detail.dock?.surface.height).toBe(76);
	});

	it('matches the M reference and makes the height cap different from actual panel height', () => {
		const detail = resolveDetailLayout({ width: 840, height: 900 });
		expect(detail.mediaFit).toEqual({ x: 96, y: 96, width: 435, height: 500 });
		expect(detail.rail.rect).toEqual({ x: 8, y: 96, width: 80, height: 500 });
		expect(detail.rail.gap).toBe(12);
		expect(detail.summary).toEqual({ x: 539, width: 293,
			anchor: { y: 96, alignment: 'start' }, height: { kind: 'natural', maxHeight: 500 }, placement: 'floating' });
		expect(detail.submenu).toEqual({ x: 8, y: 604, maxWidth: 824, height: 40,
			inlineAlignment: 'start', position: 'document' });
		expect(detail.contentStart).toEqual({ kind: 'fixed', y: 652 });
		expect(detail.dock?.surface.height).toBe(80);
	});

	it('uses the capped content grid for L summary widths independently from the hero position', () => {
		const detail = resolveDetailLayout({ width: 1200, height: 900 });
		expect(detail.mediaFit).toEqual({ x: 96, y: 106, width: 704, height: 600 });
		expect(detail.summary.x).toBe(808);
		expect(detail.summary.width).toBe(368);
		expect(detail.submenu).toMatchObject({ x: 8, y: 714, maxWidth: 1168, height: 44 });
		expect(detail.dock?.surface.height).toBe(86);
		const capped = resolveDetailLayout({ width: 1599, height: 900 });
		expect(capped.summary.width).toBe(480);
		expect(capped.summary.x).toBe(1095);
		expect(capped.base.menu.width).toBe(1599);
	});

	it('derives XL widths from the narrower container and keeps its shell satellites separate from the rail', () => {
		const detail = resolveDetailLayout({ width: 1600, height: 900 });
		expect(detail.mediaFit).toMatchObject({ x: 136, y: 120, height: 664 });
		expect(detail.mediaFit.width).toBeCloseTo(1033.3333333333333);
		expect(detail.summary.width).toBeCloseTo(410.6666666666667);
		expect(detail.summary.x).toBeCloseTo(1177.3333333333333);
		expect(detail.submenu).toMatchObject({ x: 136, y: 796, maxWidth: 1328 });
		expect(detail.rail.rect.x).toBe(12);
		expect(detail.base.satellites).toEqual({
			left: { x: 28, y: 28, width: 80, height: 40 },
			right: { x: 1492, y: 28, width: 80, height: 40 }
		});
	});

	it('grows the 2XL rail to 138px and uses the mirrored outer summary alignment', () => {
		const detail = resolveDetailLayout({ width: 1920, height: 1000 });
		expect(detail.rail.itemSize).toBeCloseTo(134.4);
		expect(detail.rail.rect.x).toBeCloseTo(33.6);
		expect(detail.mediaFit.x).toBe(192);
		expect(detail.mediaFit.y).toBe(120);
		expect(detail.mediaFit.width).toBeCloseTo(1190.4);
		expect(detail.mediaFit.height).toBe(784);
		expect(detail.summary.x).toBeCloseTo(1406.4);
		expect(detail.summary.width).toBe(480);
		const capped = resolveDetailLayout({ width: 2000, height: 1000 });
		expect(capped.rail.itemSize).toBe(138);
		expect(capped.rail.rect.x).toBe(70);
		expect(capped.summary.x).toBe(1450);
	});

	it('separates the fixed 3XL pane, its header/body and bottom submenu', () => {
		const detail = resolveDetailLayout({ width: 2300, height: 900 });
		expect(detail.composition).toBe('split');
		expect(detail.mediaFit).toEqual({ x: 178, y: 96, width: 964, height: 788 });
		expect(detail.rail.rect).toEqual({ x: 28, y: 96, width: 138, height: 788 });
		expect(detail.rail.gap).toBe(24);
		expect(detail.pane).toEqual({
			surface: { x: 1158, y: 96, width: 1122, height: 744 },
			header: { x: 1158, y: 96, width: 1122, height: 86 },
			body: { x: 1158, y: 182, width: 1122, height: 658 }
		});
		expect(detail.summary).toEqual({ x: 1158, width: 1122,
			anchor: { y: 182, alignment: 'start' }, height: { kind: 'natural' }, placement: 'pane' });
		expect(detail.submenu).toEqual({ x: 1158, y: 840, maxWidth: 1122, height: 44,
			inlineAlignment: 'center', position: 'fixed' });
		expect(detail.grid.size).toBe('m');
		expect(detail.scrollOwner).toBe('document');
		expect(detail.menuFixed).toBe(true);
		expect(detail.dock).toBeUndefined();
	});

	it('applies safe insets once without shifting the authored full-viewport 3XL midpoint', () => {
		const detail = resolveDetailLayout({ width: 2400, height: 900,
			safeArea: { top: 20, right: 12, bottom: 10, left: 8 } });
		expect(detail.mediaFit).toEqual({ x: 186, y: 116, width: 1006, height: 758 });
		expect(detail.pane?.surface.x).toBe(1208);
		expect(detail.pane?.body.y).toBe(202);
		expect(detail.submenu?.y).toBe(830);
	});

	it('uses flow for a short 3XL viewport, including safe-area height, without changing its viewport class', () => {
		const short = resolveDetailLayout({ width: 2400, height: 511 });
		expect(short.base.layout).toBe('3xl');
		expect(short.layout).toBe('2xl');
		expect(short.composition).toBe('flow');
		expect(short.shortHeightFallback).toBe(true);
		expect(short.mediaFit.height).toBe(400);
		expect(short.summary.width).toBe(480);
		expect(short.pane).toBeUndefined();
		expect(short.menuFixed).toBe(false);
		expect(resolveDetailLayout({ width: 2400, height: 512 }).composition).toBe('split');
		expect(resolveDetailLayout({ width: 2400, height: 512, safeArea: { bottom: 1 } }).composition).toBe('flow');
	});
});

describe('carousel and fullscreen presentation constraints', () => {
	it.each([
		[390, 276, 240], [600, 284, 248], [840, 244, 200],
		[1200, 286, 230], [1600, 300, 244], [1920, 300, 244], [2300, 300, 244]
	])('uses the consolidated headline height budget at %i', (width, withHeadline, withoutHeadline) => {
		expect(resolveCarouselLayout({ width, height: 900, hasHeadline: true }).heightOffset).toBe(withHeadline);
		expect(resolveCarouselLayout({ width, height: 900 }).heightOffset).toBe(withoutHeadline);
	});

	it('holds the small geometry steady when an eyebrow appears or disappears', () => {
		const input = { width: 390, height: 844, hasHeadline: true };
		const eyebrow = resolveCarouselLayout({ ...input, hasEyebrow: true });
		const plain = resolveCarouselLayout(input);
		expect(eyebrow.mediaFit).toEqual({ x: 48, y: 204, width: 294, height: 300 });
		expect(plain.mediaFit).toEqual(eyebrow.mediaFit);
		expect(eyebrow.summary).toEqual({ x: 48, width: 294, anchor: { y: 138, alignment: 'start' },
			height: { kind: 'fixed', value: 66 }, placement: 'compact' });
		expect(plain.summary.anchor.y).toBe(164);
		expect(plain.summary.height).toEqual({ kind: 'fixed', value: 40 });
		expect(eyebrow.dots).toMatchObject({ x: 12, y: 504, maxWidth: 366, height: 32 });
		expect(eyebrow.sectionEnd).toBe(548);
		const mediumPhone = resolveCarouselLayout({ width: 600, height: 900, hasHeadline: true });
		expect(mediumPhone.mediaFit).toEqual({ x: 88, y: 208, width: 424, height: 400 });
		expect(mediumPhone.sectionEnd).toBe(656);
	});

	it('expresses M summary centering as an anchor rather than a fabricated natural height', () => {
		const carousel = resolveCarouselLayout({ width: 840, height: 900, hasHeadline: true });
		expect(carousel.mediaFit).toEqual({ x: 119, y: 156, width: 293, height: 500 });
		expect(carousel.summary).toEqual({ x: 428, width: 293, anchor: { y: 406, alignment: 'center' },
			height: { kind: 'natural', maxHeight: 500 }, placement: 'floating' });
		expect(carousel.dots.y).toBe(668);
		expect(carousel.sectionEnd).toBe(716);
	});

	it('preserves the labelled large-grid spans and detail summary width', () => {
		const large = resolveCarouselLayout({ width: 1200, height: 900, hasHeadline: true });
		expect(large.mediaFit).toEqual({ x: 220, y: 186, width: 466, height: 600 });
		expect(large.summary.x).toBe(710);
		expect(large.summary.width).toBe(368);
		const xl = resolveCarouselLayout({ width: 1600, height: 1000, hasHeadline: true });
		expect(xl.mediaFit.x).toBeCloseTo(268.6666666666667);
		expect(xl.mediaFit.width).toBeCloseTo(519.3333333333334);
		expect(xl.summary.x).toBe(812);
		expect(xl.sectionEnd).toBe(972);
		for (const width of [840, 1000, 1200, 1536, 1599, 1600, 1808, 1809, 2299]) {
			expect(resolveCarouselLayout({ width, height: 900 }).summary.width)
				.toBe(resolveDetailLayout({ width, height: 900 }).summary.width);
		}
	});

	it('keeps 3XL carousel in the normal 1536px grid instead of the narrow detail pane', () => {
		const carousel = resolveCarouselLayout({ width: 2300, height: 1000, hasHeadline: true });
		expect(carousel.layout).toBe('2xl');
		expect(carousel.grid.size).toBe('l');
		expect(carousel.content).toEqual({ x: 382, width: 1536 });
		expect(carousel.mediaFit).toEqual({ x: 532, y: 200, width: 732, height: 700 });
		expect(carousel.summary.x).toBe(1288);
		expect(carousel.summary.width).toBe(480);
		expect(resolveDetailLayout({ width: 2300, height: 1000 }).grid.size).toBe('m');
	});

	it('allows document placement without changing its stable viewport sizing', () => {
		const initial = resolveCarouselLayout({ width: 840, height: 700, hasHeadline: true });
		const later = resolveCarouselLayout({ width: 840, height: 700, hasHeadline: true, sectionTop: 1096 });
		expect(initial.mediaFit.height).toBe(456);
		expect(later.mediaFit.height).toBe(456);
		expect(later.mediaFit.y - initial.mediaFit.y).toBe(1000);
		expect(later.summary.anchor.y - initial.summary.anchor.y).toBe(1000);
		expect(later.section.height).toBe(initial.section.height);
	});

	it.each([[390, 112, 8, 'bottom-left'], [600, 112, 8, 'bottom-left'],
		[840, 168, 8, 'top-left'], [1200, 178, 8, 'top-left'],
		[1600, 220, 12, 'top-left'], [1920, 242, 16, 'top-left'], [2400, 242, 28, 'top-left']] as const)
	('uses the fullscreen minimap at %i', (width, square, inset, anchor) => {
		const zoom = resolveZoomLayout({ width, height: 900 });
		expect(zoom.minimap).toEqual({ x: inset, y: anchor === 'top-left' ? inset : 900 - inset - square,
			width: square, height: square });
		expect(zoom.minimapAnchor).toBe(anchor);
		expect(zoom.controls.viewSelector).toEqual({ x: width - inset - 80, y: inset, width: 80, height: 40 });
		expect(zoom.controls.help).toEqual({ x: width - inset - 128, y: inset, width: 40, height: 40 });
	});

	it('uses safe positioning for fullscreen controls while rendering the canvas across the whole viewport', () => {
		const zoom = resolveZoomLayout({ width: 390, height: 844, safeArea: { top: 20, bottom: 10, left: 8, right: 12 } });
		expect(zoom.minimap).toEqual({ x: 16, y: 714, width: 112, height: 112 });
		expect(zoom.controls.viewSelector).toEqual({ x: 290, y: 28, width: 80, height: 40 });
		expect(zoom.canvas).toEqual({ x: 0, y: 0, width: 390, height: 844 });
		expect(resolveZoomLayout({ width: 2400, height: 400 }).minimap.x).toBe(28);
	});

	it('returns finite constraints and nonnegative sizes for invalid dimensions and oversized insets', () => {
		function assertFinite(value: unknown) {
			if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
			else if (value && typeof value === 'object') {
				for (const [key, child] of Object.entries(value)) {
					assertFinite(child);
					if (typeof child === 'number' && ['width', 'height', 'maxWidth', 'maxHeight'].includes(key)) {
						expect(child).toBeGreaterThanOrEqual(0);
					}
				}
			}
		}
		for (const width of [NaN, Infinity, -1, 0, 1, 320, 840, 1600, 2400]) {
			for (const height of [NaN, Infinity, -1, 0, 1, 30, 511, 900]) {
				const input = { width, height, safeArea: { top: 40, bottom: 80, left: 300, right: 800 } };
				assertFinite(resolveDetailLayout(input));
				assertFinite(resolveCarouselLayout({ ...input, sectionTop: NaN, hasHeadline: true }));
				assertFinite(resolveZoomLayout(input));
			}
		}
	});
});
