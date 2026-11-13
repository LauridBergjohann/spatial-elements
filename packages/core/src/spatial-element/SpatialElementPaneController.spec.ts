import { expect, test } from 'vitest';
import { resolvePaneScrollClip, resolvePaneFocusPresentation } from './SpatialElementPaneController.js';
import { resolveDetailLayout } from './responsiveLayout.js';

test.each([2300, 2456, 3128, 3440])('pane paint and native document coordinates agree at width %s', width => {
	const pane = resolveDetailLayout({ width, height: 900 }).pane!;
	const bodyHeight = 1800 + pane.body.y + 60;
	for (const scrollY of [0, 100, 500.5, bodyHeight - 900]) {
		const clip = resolvePaneScrollClip(0, bodyHeight, pane.body.y, pane.body.y + pane.body.height, scrollY);
		expect(clip.top - scrollY).toBe(182);
		expect(bodyHeight - clip.bottom - scrollY).toBe(862);
		expect(bodyHeight - clip.top - clip.bottom).toBe(pane.body.height);
	}
});

test('clip accounts for a nonzero document origin without applying scroll twice', () => {
	const clip = resolvePaneScrollClip(80, 2000, 182, 840, 400);
	// content at the upper and lower clip edges occupies the exact pane window.
	expect(80 + clip.top - 400).toBe(182);
	expect(80 + 2000 - clip.bottom - 400).toBe(840);
});

test.each([2300, 2456, 3440])('pane zoom leaves document layout intact and clears the right side at %s', width => {
	const viewport = { width, height: 900 };
	const pane = resolveDetailLayout(viewport).pane!.surface;
	const rest = resolvePaneFocusPresentation(pane, viewport, 0);
	expect(rest).toMatchObject({ x: 0, scale: 1, opacity: 1, blur: 0 });
	expect(Math.abs(rest.y)).toBe(0);
	const partial = resolvePaneFocusPresentation(pane, viewport, 0.5);
	expect(partial.x).toBeGreaterThan(0);
	expect(partial.scale).toBeGreaterThan(1);
	expect(partial.opacity).toBeGreaterThan(0);
	expect(partial.opacity).toBeLessThan(1);
	expect(partial.blur).toBeGreaterThan(0);
	expect(resolvePaneFocusPresentation(pane, viewport, 1).opacity).toBe(0);
	// The same viewport pivot must map the clipped body and fixed header edge
	// to one location, irrespective of the document's current scroll position.
	for (const scroll of [0, 200, 900]) {
		const bodyOrigin = partial.pivotY + scroll;
		const headerOrigin = partial.pivotY - pane.y;
		const bodyEdge = -scroll + bodyOrigin + partial.y + (pane.y + scroll - bodyOrigin) * partial.scale;
		const headerEdge = pane.y + headerOrigin + partial.y - headerOrigin * partial.scale;
		expect(bodyEdge).toBeCloseTo(headerEdge, 8);
	}
});
