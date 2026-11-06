/** CSS equivalents of the pure detail resolver. 3XL composition is added separately by step 10. */
export function detailRules(tokens) {
	return Object.entries(tokens.hero).filter(([name]) => name !== '3xl').map(([name, hero]) => {
		const compact = name === 'xs' || name === 's';
		const grid = tokens.grid[name === 'm' ? 'm' : 'l'];
		const content = name === 'xl' ? `min(${tokens.contentMax}px, calc(100% - ${tokens.xlContentInset * 2}px))` : `min(100%, ${tokens.contentMax}px)`;
		const railSize = name === '2xl' ? `min(${hero.railWidthRatio * 100}%, ${hero.railSize}px, max(0px, calc((100% - ${tokens.contentMax}px) / 2 - ${hero.railStageGap + (hero.railMinInset ?? 8)}px)))` : `${hero.railSize}px`;
		const railLeft = name === '2xl' ? `calc((100% - ${tokens.contentMax}px) / 2 - ${hero.railStageGap}px - var(--spatial-detail-media-size))` : `${hero.railInset}px`;
		const summaryWidth = compact ? `calc(100% - ${hero.summaryInset * 2}px)` : `calc((var(--spatial-detail-content-width) - ${grid.gap}px) * ${hero.summaryColumns} / ${grid.columns} - ${grid.gap}px)`;
		const fitLeft = compact ? `${hero.railInset}px` : `calc(var(--spatial-detail-media-left) + var(--spatial-detail-media-size) + ${hero.railStageGap}px)`;
		const summaryRight = name === '2xl' ? 'var(--spatial-detail-media-left)' : `${hero.summaryInset}px`;
		const fitRight = compact ? `${hero.railInset}px` : `calc(var(--spatial-detail-summary-right) + var(--spatial-detail-summary-width) + ${hero.summaryGap}px)`;
		const rules = `.stage {
	--spatial-detail-content-width: ${content};
	--spatial-detail-fit-height: clamp(${hero.minHeight}px, calc(100svh - ${hero.heightOffset}px), ${hero.maxHeight}px);
	--spatial-detail-fit-left: ${fitLeft};
	--spatial-detail-fit-right: ${fitRight};
	--spatial-detail-media-size: ${railSize};
	--spatial-detail-media-left: ${railLeft};
	--spatial-detail-media-gap: ${hero.railGap}px;
	--spatial-detail-media-stage-gap: ${hero.railStageGap}px;
	--spatial-detail-summary-width: ${summaryWidth};
	--spatial-detail-summary-right: ${summaryRight};
	--spatial-detail-summary-gap: ${hero.summaryGap}px;
	--spatial-detail-summary-max-height: ${compact ? '100000px' : 'var(--spatial-detail-fit-height)'};
}`;
		return tokens.layoutMinWidths[name] === 0 ? rules : `@media (min-width: ${tokens.layoutMinWidths[name]}px) {\n${rules}\n}`;
	});
}
