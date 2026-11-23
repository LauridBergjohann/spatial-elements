/** SSR carousel constraints, generated from the same grid and fit tokens as core. */
export function carouselRules(tokens) {
	return Object.entries(tokens.carousel.layouts).map(([name, settings]) => {
		const compact = name === 'xs' || name === 's';
		const panelReserve = compact ? tokens.carousel.compactEyebrowHeight - tokens.carousel.compactOverlap : 0;
		const grid = tokens.grid[name === 'xs' || name === 's' || name === 'm' ? name : 'l'];
		const shell = name === 'xl' || name === '2xl' ? tokens.menu.wideTop + tokens.menu.wideHeight : tokens.menu.height;
		const pageHeadingReserve = grid.headlineLineHeight + grid.gap * 2;
		const budget = shell + tokens.breadcrumb[name].height + pageHeadingReserve + grid.gap * 2 + panelReserve + settings.dotsGap + tokens.carousel.dotsHeight + tokens.carousel.nextPreviewHeight - (compact ? 0 : tokens.carousel.fullPanelHeightAllowance);
		const column = `((100% - ${grid.gap * (grid.columns - 1)}px) / ${grid.columns})`;
		const fitLeft = compact ? '0px' : `calc((${column} + ${grid.gap}px) * ${settings.fitStartColumn - 1})`;
		const fitWidth = compact ? '100%' : `calc(${column} * ${settings.fitColumns} + ${grid.gap * (settings.fitColumns - 1)}px)`;
		const summaryLeft = compact ? `${tokens.carousel.compactControlInset}px` : `calc((${column} + ${grid.gap}px) * ${settings.summaryStartColumn - 1})`;
		const summaryWidth = compact ? `calc(100% - ${tokens.carousel.compactControlInset * 2}px)` : `calc(${column} * ${settings.summaryColumns} + ${grid.gap * (settings.summaryColumns - 1)}px)`;
		const rules = `.carousel-drag-section {
	--spatial-carousel-fit-height: clamp(${settings.minHeight}px, calc(100svh - ${budget}px - var(--spatial-carousel-headline-budget, 0px)), ${settings.maxHeight}px);
	--spatial-carousel-fit-left: ${fitLeft};
	--spatial-carousel-fit-width: ${fitWidth};
	--spatial-carousel-summary-left: ${summaryLeft};
	--spatial-carousel-summary-width: ${summaryWidth};
	--spatial-carousel-title-reserve: 0px;
	--spatial-carousel-panel-reserve: ${panelReserve}px;
	--spatial-carousel-compact-height: ${tokens.carousel.compactEyebrowHeight}px;
	--spatial-carousel-compact-overlap: ${tokens.carousel.compactOverlap}px;
	--spatial-carousel-dots-gap: ${settings.dotsGap}px;
	--spatial-carousel-dots-height: ${tokens.carousel.dotsHeight}px;
	--spatial-detail-summary-max-height: var(--spatial-carousel-fit-height);
}
.carousel-drag-section:has(> .ps-section-content > .section-heading .headline) { --spatial-carousel-headline-budget: ${grid.headlineLineHeight + grid.headlineGap}px; }`;
		return tokens.layoutMinWidths[name] === 0 ? rules : `@media (min-width: ${tokens.layoutMinWidths[name]}px) {\n${rules}\n}`;
	});
}
