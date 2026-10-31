import tokens from './layoutTokens.json' with { type: 'json' };

/** Canonical values also consumed by the generated, SSR-safe stylesheet. */
export const spatialLayoutTokens = tokens;
export const contentGridSizes = ['xs', 's', 'm', 'l'] as const;
export const viewportLayoutSizes = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl'] as const;
export type ContentGridSize = typeof contentGridSizes[number];
export type ViewportLayoutSize = typeof viewportLayoutSizes[number];
export type SpatialCardSize = keyof typeof tokens.cards;
export type ContentSpan = number | Partial<Record<ContentGridSize, number>>;
export interface LayoutRect { x: number; y: number; width: number; height: number }
export interface LayoutInsets { top: number; right: number; bottom: number; left: number }
export interface ResponsiveLayoutInput {
	width: number;
	/** Reserved classic scrollbar/gutter width. Media-query width remains `width`. */
	scrollbarWidth?: number;
	/** Stable CSS layout height, supplied by the viewport owner; never physical screen height. */
	height: number;
	safeArea?: Partial<LayoutInsets>;
}
/** A natural-height panel has a known width and anchor, never an invented rectangle. */
export interface SummaryLayoutConstraint {
	x: number;
	width: number;
	anchor: { y: number; alignment: 'start' | 'center' };
	height: { kind: 'natural'; maxHeight?: number } | { kind: 'fixed'; value: number };
	placement: 'flow' | 'floating' | 'pane' | 'compact';
}
export interface SubmenuLayoutConstraint {
	x: number;
	y: number;
	maxWidth: number;
	height: number;
	inlineAlignment: 'start' | 'center';
	position: 'document' | 'fixed';
}
export interface CarouselLayoutInput extends ResponsiveLayoutInput {
	/** Document coordinate. Omitted means immediately after the normal breadcrumb. */
	sectionTop?: number;
	hasHeadline?: boolean;
	hasEyebrow?: boolean;
}

const size = (value: number | undefined) => Number.isFinite(value) ? Math.max(0, value!) : 0;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function resolveViewportLayout(width: number): ViewportLayoutSize {
	const w = size(width);
	return [...viewportLayoutSizes].reverse().find((name) => w >= tokens.layoutMinWidths[name]) ?? 'xs';
}

/** Width includes the grid's two outer margins, implemented once as section padding. */
export function resolveContentGrid(width: number) {
	const w = Math.min(size(width), tokens.contentMax);
	const name = [...contentGridSizes].reverse().find((key) => w >= tokens.grid[key].minWidth) ?? 'xs';
	const grid = tokens.grid[name];
	return {
		size: name,
		width: w,
		...grid,
		columnWidth: Math.max(0, (w - (grid.columns + 1) * grid.gap) / grid.columns)
	};
}

/** Mobile-first spans inherit; omitted/invalid spans fill the row, excessive spans clamp. */
export function resolveContentSpan(span: ContentSpan | undefined, grid: ContentGridSize): number {
	let requested: number | undefined = typeof span === 'number' ? span : undefined;
	if (span && typeof span === 'object') {
		for (const key of contentGridSizes) {
			if (span[key] !== undefined) requested = span[key];
			if (key === grid) break;
		}
	}
	const columns = tokens.grid[grid].columns;
	return requested !== undefined && Number.isInteger(requested) && requested > 0
		? Math.min(requested, columns) : columns;
}

export function contentSpanWidth(width: number, span: number) {
	const grid = resolveContentGrid(width);
	const columns = resolveContentSpan(span, grid.size);
	return Math.min(grid.width, columns * grid.columnWidth + (columns - 1) * grid.gap);
}

/** Uses the same slot for poster containment and measured 3D fitting. */
export function resolveCardLayout(containerWidth: number, cardSize: SpatialCardSize = 'm') {
	const grid = resolveContentGrid(containerWidth);
	const card = tokens.cards[cardSize];
	const span = cardSize === 'l' && grid.size === 's' ? tokens.cards.l.gridSSpan : card.span;
	const width = contentSpanWidth(grid.width, span);
	const textHeight = Math.min(width, Math.max(width / 4, card.rows * card.lineHeight + 2 * tokens.cardTextInset.block));
	const availableHeight = width - textHeight;
	const fitWidth = Math.min(width, availableHeight * 4 / 3);
	const fitHeight = fitWidth * 3 / 4;
	return {
		...card,
		span, width, height: width, textHeight,
		media: { x: (width - fitWidth) / 2, y: (availableHeight - fitHeight) / 2, width: fitWidth, height: fitHeight }
	};
}

export function resolveResponsiveLayout(input: ResponsiveLayoutInput) {
	const width = size(input.width);
	const layoutWidth = Math.max(0, width - size(input.scrollbarWidth));
	const height = size(input.height);
	const safeArea: LayoutInsets = {
		top: Math.min(height, size(input.safeArea?.top)),
		right: Math.min(layoutWidth, size(input.safeArea?.right)),
		bottom: Math.min(height, size(input.safeArea?.bottom)),
		left: Math.min(layoutWidth, size(input.safeArea?.left))
	};
	const available = {
		x: safeArea.left, y: safeArea.top,
		width: Math.max(0, layoutWidth - safeArea.left - safeArea.right),
		height: Math.max(0, height - safeArea.top - safeArea.bottom)
	};
	const layout = resolveViewportLayout(width);
	const contentWidth = Math.min(tokens.contentMax, Math.max(0,
		available.width - (layout === 'xl' ? tokens.xlContentInset * 2 : 0)));
	const content = { x: available.x + (available.width - contentWidth) / 2, width: contentWidth };
	const grid = resolveContentGrid(content.width);
	const wide = tokens.layoutMinWidths[layout] >= tokens.layoutMinWidths.xl;
	const menu = {
		x: wide ? content.x : available.x,
		y: available.y + (wide ? tokens.menu.wideTop : 0),
		width: wide ? content.width : available.width,
		height: wide ? tokens.menu.wideHeight : tokens.menu.height
	};
	const breadcrumb = {
		x: content.x, y: menu.y + menu.height, width: content.width,
		height: tokens.breadcrumb[layout].height,
		fontSize: tokens.breadcrumb[layout].fontSize
	};
	const paneLeft = Math.min(layoutWidth, layoutWidth / 2 + tokens.pane.centerGap);
	const pane = {
		x: paneLeft, y: available.y + tokens.pane.top,
		width: Math.min(tokens.contentMax, Math.max(0, layoutWidth - safeArea.right - tokens.pane.rightInset - paneLeft)),
		height: Math.max(0, available.height - tokens.pane.top - tokens.pane.bottom - tokens.pane.submenuHeight)
	};
	const paneGrid = resolveContentGrid(pane.width);
	const paneSubmenu: LayoutRect = {
		x: pane.x, y: pane.y + pane.height,
		width: pane.width, height: Math.min(tokens.pane.submenuHeight,
			Math.max(0, available.height - tokens.pane.top - tokens.pane.bottom))
	};
	const paneHeader = { ...pane, height: Math.min(pane.height, tokens.pane.headerHeight) };
	const paneBody = { ...pane, y: pane.y + paneHeader.height, height: Math.max(0, pane.height - paneHeader.height) };
	const satellites = wide ? {
		left: { x: available.x + tokens.satellite.inset, y: available.y + tokens.satellite.top,
			width: tokens.satellite.width, height: tokens.satellite.height },
		right: { x: available.x + available.width - tokens.satellite.inset - tokens.satellite.width,
			y: available.y + tokens.satellite.top, width: tokens.satellite.width, height: tokens.satellite.height }
	} : undefined;
	return { layout, viewport: { width, height }, layoutWidth, safeArea, available, content, grid, menu, breadcrumb,
		satellites, pane, paneGrid, paneHeader, paneBody, paneSubmenu };
}

function stageControls(right: number, top: number) {
	const { buttonSize, groupButtons, gap } = tokens.stageControls;
	const groupWidth = buttonSize * groupButtons;
	return {
		help: { x: right - groupWidth - gap - buttonSize, y: top, width: buttonSize, height: buttonSize },
		viewSelector: { x: right - groupWidth, y: top, width: groupWidth, height: buttonSize }
	};
}

/** Fitted detail anchors and overflow policies. Natural summary height stays unresolved. */
export function resolveDetailLayout(input: ResponsiveLayoutInput) {
	const base = resolveResponsiveLayout(input);
	const { available, content } = base;
	const split = base.layout === '3xl' && available.height >= tokens.pane.minUsableHeight;
	const layout = base.layout === '3xl' && !split ? '2xl' : base.layout;
	const hero = tokens.hero[layout];
	const horizontal = layout === 'xs' || layout === 's';
	const wide = layout === 'xl' || layout === '2xl';
	const right = available.x + available.width;
	const contentLeft = content.x - available.x;
	const railSize = layout === '2xl'
		? Math.min(available.width * tokens.hero['2xl'].railWidthRatio, hero.railSize) : hero.railSize;
	const railInset = layout === '2xl' ? contentLeft - hero.railStageGap - railSize : hero.railInset;
	const top = split ? base.pane.y : base.breadcrumb.y + base.breadcrumb.height;
	const fitHeight = split ? Math.max(0, available.height - hero.heightOffset)
		: clamp(available.height - hero.heightOffset, hero.minHeight, hero.maxHeight);
	const summaryWidth = split ? base.pane.width : horizontal
		? Math.max(0, available.width - hero.summaryInset * 2)
		: contentSpanWidth(content.width, hero.summaryColumns);
	const summaryRight = right - (layout === '2xl' ? railInset : hero.summaryInset);
	const stageLeft = available.x + (horizontal ? hero.railInset : railInset + railSize + hero.railStageGap);
	const stageRight = split ? base.pane.x - tokens.pane.centerGap * 2 : horizontal
		? right - hero.railInset : summaryRight - summaryWidth - hero.summaryGap;
	const mediaFit: LayoutRect = { x: stageLeft, y: top, width: Math.max(0, stageRight - stageLeft), height: fitHeight };
	const rail = {
		rect: horizontal
			? { x: available.x + railInset, y: top + fitHeight + hero.railStageGap,
				width: Math.max(0, available.width - hero.railInset * 2), height: railSize }
			: { x: available.x + railInset, y: top, width: railSize, height: fitHeight },
		axis: horizontal ? 'horizontal' as const : 'vertical' as const,
		itemSize: railSize, gap: hero.railGap, overflow: 'local-scroll' as const
	};
	const summary: SummaryLayoutConstraint = {
		x: split ? base.pane.x : summaryRight - summaryWidth,
		width: summaryWidth,
		anchor: { y: split ? base.paneBody.y : horizontal
			? rail.rect.y + rail.rect.height + hero.summaryGap : top, alignment: 'start' },
		height: horizontal || split ? { kind: 'natural' } : { kind: 'natural', maxHeight: fitHeight },
		placement: split ? 'pane' : horizontal ? 'flow' : 'floating'
	};
	const submenu: SubmenuLayoutConstraint | undefined = horizontal ? undefined : split ? {
		x: base.paneSubmenu.x, y: base.paneSubmenu.y, maxWidth: base.paneSubmenu.width,
		height: base.paneSubmenu.height, inlineAlignment: 'center', position: 'fixed'
	} : {
		x: wide ? content.x : available.x + hero.submenuLeft,
		y: top + fitHeight + hero.submenuGap,
		maxWidth: wide ? content.width : Math.max(0, available.width - hero.submenuLeft - hero.submenuRight),
		height: hero.submenuHeight, inlineAlignment: 'start', position: 'document'
	};
	const dock = split ? undefined : {
		surface: { x: available.x + (wide ? railInset : 0), y: available.y,
			width: Math.max(0, available.width - (wide ? railInset * 2 : 0)), height: hero.dockHeight },
		minimap: { x: available.x + railInset, y: available.y + (hero.dockHeight - railSize) / 2,
			width: railSize, height: railSize },
		titleLeft: available.x + railInset + railSize + hero.railStageGap
	};
	const contentStart = horizontal ? { kind: 'after-summary' as const, gap: 0 }
		: split ? { kind: 'pane-body' as const, y: base.paneBody.y }
			: { kind: 'fixed' as const, y: submenu!.y + submenu!.height + hero.submenuAfterGap };
	return {
		base, layout, composition: split ? 'split' as const : 'flow' as const,
		shortHeightFallback: base.layout === '3xl' && !split,
		mediaFit, rail, summary, submenu, dock, contentStart,
		controls: stageControls(mediaFit.x + mediaFit.width, mediaFit.y),
		content: split ? { x: base.pane.x, width: base.pane.width } : base.content,
		grid: split ? base.paneGrid : base.grid,
		pane: split ? { surface: base.pane, header: base.paneHeader, body: base.paneBody } : undefined,
		scrollOwner: 'document' as const,
		menuFixed: split
	};
}

/** Ordinary-section carousel geometry; its title strip does not change when the eyebrow changes. */
export function resolveCarouselLayout(input: CarouselLayoutInput) {
	const base = resolveResponsiveLayout(input);
	const layout = base.layout === '3xl' ? '2xl' : base.layout;
	const settings = tokens.carousel.layouts[layout];
	const compact = layout === 'xs' || layout === 's';
	const { content, grid, available } = base;
	const padding = grid.gap;
	const headlineHeight = input.hasHeadline ? grid.headlineLineHeight : 0;
	const headlineGap = input.hasHeadline ? grid.headlineGap : 0;
	const titleStrip = compact ? tokens.carousel.compactEyebrowHeight : 0;
	const sectionTop = input.sectionTop === undefined ? base.breadcrumb.y + base.breadcrumb.height : size(input.sectionTop);
	const shellBudget = base.breadcrumb.y + base.breadcrumb.height - available.y;
	const heightOffset = shellBudget + padding * 2 + headlineHeight + headlineGap + titleStrip
		+ settings.dotsGap + tokens.carousel.dotsHeight + tokens.carousel.nextPreviewHeight;
	const fitHeight = clamp(available.height - heightOffset, settings.minHeight, settings.maxHeight);
	const columnX = (column: number) => content.x + padding + (column - 1) * (grid.columnWidth + grid.gap);
	const fitX = compact ? content.x + padding + settings.sideAllowance : columnX(settings.fitStartColumn);
	const fitWidth = compact ? Math.max(0, content.width - (padding + settings.sideAllowance) * 2)
		: contentSpanWidth(content.width, settings.fitColumns);
	const fitTop = sectionTop + padding + headlineHeight + headlineGap + titleStrip;
	const mediaFit: LayoutRect = { x: fitX, y: fitTop, width: fitWidth, height: fitHeight };
	const compactHeight = input.hasEyebrow ? tokens.carousel.compactEyebrowHeight : tokens.carousel.compactTitleHeight;
	const summary: SummaryLayoutConstraint = {
		x: compact ? fitX : columnX(settings.summaryStartColumn),
		width: compact ? fitWidth : contentSpanWidth(content.width, settings.summaryColumns),
		anchor: { y: compact ? fitTop - compactHeight : fitTop + fitHeight / 2, alignment: compact ? 'start' : 'center' },
		height: compact ? { kind: 'fixed', value: compactHeight } : { kind: 'natural', maxHeight: fitHeight },
		placement: compact ? 'compact' : 'floating'
	};
	const dots: SubmenuLayoutConstraint = {
		x: content.x + padding, y: fitTop + fitHeight + settings.dotsGap,
		maxWidth: Math.max(0, content.width - padding * 2), height: tokens.carousel.dotsHeight,
		inlineAlignment: 'center', position: 'document'
	};
	const sectionEnd = dots.y + dots.height + padding;
	return {
		base, layout, content, grid, mediaFit, summary, dots, heightOffset,
		section: { x: content.x, y: sectionTop, width: content.width, height: Math.max(0, sectionEnd - sectionTop) },
		headline: input.hasHeadline ? { x: content.x + padding, y: sectionTop + padding,
			width: Math.max(0, content.width - padding * 2), height: headlineHeight } : undefined,
		sectionEnd, scrollOwner: 'document' as const
	};
}

/** Fullscreen presentation uses the actual viewport layout, independent of the short-detail fallback. */
export function resolveZoomLayout(input: ResponsiveLayoutInput) {
	const base = resolveResponsiveLayout(input);
	const settings = tokens.hero[base.layout];
	const bottom = base.layout === 'xs' || base.layout === 's';
	const { available } = base;
	const inset = settings.zoomInset;
	const minimap: LayoutRect = {
		x: available.x + inset,
		y: bottom ? available.y + available.height - inset - settings.zoomMinimap : available.y + inset,
		width: settings.zoomMinimap, height: settings.zoomMinimap
	};
	return {
		base, interactionArea: available,
		canvas: { x: 0, y: 0, width: base.viewport.width, height: base.viewport.height },
		minimap, minimapAnchor: bottom ? 'bottom-left' as const : 'top-left' as const,
		controls: stageControls(available.x + available.width - inset, available.y + inset)
	};
}

/** Bounded sticky behavior, driven by the same visual scroll clock as the scene. */
export function resolveMenuOffset(scrollY: number, fixed = false) {
	const offset = Math.max(0, size(scrollY) - tokens.menu.scrollThreshold);
	return fixed || offset === 0 ? 0 : -offset;
}

/** Requested source height is used during handoff; intrinsic destination height remains unknown. */
export function resolvePanelHeight(sourceHeight: number, maxHeight?: number) {
	return maxHeight === undefined ? size(sourceHeight) : clamp(size(sourceHeight), 0, size(maxHeight));
}
