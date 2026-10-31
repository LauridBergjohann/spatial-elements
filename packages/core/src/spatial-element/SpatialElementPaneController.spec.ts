import { expect, test } from 'vitest';
import { resolvePaneScrollClip } from './SpatialElementPaneController.js';
import { resolveDetailLayout } from './responsiveLayout.js';

test.each([2300, 2456, 3128, 3440])('pane paint and native document coordinates agree at width %s', width => {
	const pane = resolveDetailLayout({ width, height: 900 }).pane!;
	const bodyHeight = 1800 + pane.body.y + 60;
	for (const scrollY of [0, 100, 500.5, bodyHeight - 900]) {
		const clip = resolvePaneScrollClip(0, bodyHeight, pane.body.y, pane.body.y + pane.body.height, scrollY);
		expect(clip.top - scrollY).toBe(182);
		expect(bodyHeight - clip.bottom - scrollY).toBe(840);
		expect(bodyHeight - clip.top - clip.bottom).toBe(pane.body.height);
	}
});

test('clip accounts for a nonzero document origin without applying scroll twice', () => {
	const clip = resolvePaneScrollClip(80, 2000, 182, 840, 400);
	// content at the upper and lower clip edges occupies the exact pane window.
	expect(80 + clip.top - 400).toBe(182);
	expect(80 + 2000 - clip.bottom - 400).toBe(840);
});
