import { describe, expect, it } from 'vitest';
import { resolveActiveDetailSection } from './activeDetailSection.js';

describe('detail section scroll spy', () => {
	it('keeps overview until a section reaches the upper reading area', () => {
		expect(resolveActiveDetailSection([{ id: 'first', top: 500, bottom: 800 }], 138, 1000, 0, 830)).toBe('overview');
		expect(resolveActiveDetailSection([{ id: 'first', top: 350, bottom: 650 }], 138, 1000, 150, 830)).toBe('first');
	});
	it.each([
		{ top: 138, bottom: 1000, scroll: 830, lastTop: 772, lastBottom: 1000 },
		{ top: 182, bottom: 940, scroll: 568, lastTop: 712, lastBottom: 940 }
	])('reaches a short final section at the document end: %j', ({ top, bottom, scroll, lastTop, lastBottom }) => {
		const sections = [{ id: 'previous', top: top + 40, bottom: lastTop }, { id: 'service', top: lastTop, bottom: lastBottom }];
		expect(resolveActiveDetailSection(sections, top, bottom, scroll - 10, scroll)).toBe('previous');
		expect(resolveActiveDetailSection(sections, top, bottom, scroll, scroll)).toBe('service');
	});
	it('does not select the last section immediately on a non-scrolling page', () => {
		expect(resolveActiveDetailSection([
			{ id: 'first', top: 250, bottom: 500 }, { id: 'last', top: 700, bottom: 900 }
		], 138, 1000, 0, 0)).toBe('first');
	});
	it('does not select a section still below the clipped pane during scrolling', () => {
		expect(resolveActiveDetailSection([
			{ id: 'first', top: 250, bottom: 800 }, { id: 'last', top: 950, bottom: 1150 }
		], 182, 940, 568, 568)).toBe('first');
	});
	it('returns overview for pages without sections', () => {
		expect(resolveActiveDetailSection([], 138, 1000, 0, 0)).toBe('overview');
	});
});
