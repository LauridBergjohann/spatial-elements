export interface DetailSectionBounds {
	id: string;
	top: number;
	bottom: number;
}

/** Both flow detail and the clipped 3XL pane use the document's scroll clock. */
export function resolveActiveDetailSection(
	sections: readonly DetailSectionBounds[],
	readingTop: number,
	readingBottom: number,
	scrollY: number,
	maxScrollY: number,
	overviewId = 'overview'
) {
	const activationLine = readingTop + Math.max(readingBottom - readingTop, 0) * 0.25;
	let activeId = overviewId;
	for (const section of sections) {
		if (section.top > activationLine + 1) break;
		activeId = section.id;
	}
	const last = sections.at(-1);
	// A short final section may never reach the activation line. Select it at
	// the real document end only once it is visible in the reading region.
	// A page without scroll range must keep its ordinary initial selection.
	if (last && maxScrollY > 1 && scrollY >= maxScrollY - 1 &&
		last.top < readingBottom && last.bottom > readingTop) return last.id;
	return activeId;
}
