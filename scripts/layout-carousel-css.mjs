/** SSR carousel constraints, generated from the same grid and fit tokens as core. */
export function carouselRules(tokens) {
	return Object.entries(tokens.carousel.layouts).map(([name, settings]) => {
		const compact = name === 'xs' || name === 's';
		const grid = tokens.grid[name === 'xs' || name === 's' || name === 'm' ? name : 'l'];
		const shell = name === 'xl' || name === '2xl' ? tokens.menu.wideTop + tokens.menu.wideHeight : tokens.menu.height;
		const budget = shell + tokens.breadcrumb[name].height + grid.gap * 2 + (compact ? tokens.carousel.compactEyebrowHeight : 0) + settings.dotsGap + tokens.carousel.dotsHeight + tokens.carousel.nextPreviewHeight;
		const column = `((100% - ${grid.gap * (grid.columns - 1)}px) / ${grid.columns})`;
		const fitLeft = compact ? `${settings.sideAllowance}px` : `calc((${column} + ${grid.gap}px) * ${settings.fitStartColumn - 1})`;
		const fitWidth = compact ? `calc(100% - ${settings.sideAllowance * 2}px)` : `calc(${column} * ${settings.fitColumns} + ${grid.gap * (settings.fitColumns - 1)}px)`;
		const summaryLeft = compact ? fitLeft : `calc((${column} + ${grid.gap}px) * ${settings.summaryStartColumn - 1})`;
		const summaryWidth = compact ? fitWidth : `calc(${column} * ${settings.summaryColumns} + ${grid.gap * (settings.summaryColumns - 1)}px)`;
		const rules = `.carousel-drag-section {
	--spatial-carousel-fit-height: clamp(${settings.minHeight}px, calc(100svh - ${budget}px - var(--spatial-carousel-headline-budget, 0px)), ${settings.maxHeight}px);
	--spatial-carousel-fit-left: ${fitLeft};
	--spatial-carousel-fit-width: ${fitWidth};
	--spatial-carousel-summary-left: ${summaryLeft};
	--spatial-carousel-summary-width: ${summaryWidth};
	--spatial-carousel-title-reserve: ${compact ? tokens.carousel.compactEyebrowHeight : 0}px;
	--spatial-carousel-dots-gap: ${settings.dotsGap}px;
	--spatial-carousel-dots-height: ${tokens.carousel.dotsHeight}px;
	--spatial-detail-summary-max-height: var(--spatial-carousel-fit-height);
}
.carousel-drag-section:has(> .ps-section-content > .section-heading .headline) { --spatial-carousel-headline-budget: ${grid.headlineLineHeight + grid.headlineGap}px; }`;
		return tokens.layoutMinWidths[name] === 0 ? rules : `@media (min-width: ${tokens.layoutMinWidths[name]}px) {\n${rules}\n}`;
	});
}
