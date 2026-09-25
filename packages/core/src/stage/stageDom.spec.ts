import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStagePositionFromRect, isStageUiTarget, isViewportRectVisible } from './stageDom.js';

class TestElement {
	constructor(private readonly match: string | null) {}

	closest(selector: string) {
		return this.match && selector.includes(this.match) ? this : null;
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('stage DOM helpers', () => {
	it.each([
		'button',
		'a',
		'input',
		'textarea',
		'select',
		'summary',
		'[data-stage-panel-content]',
		'[data-stage-panel-css-surface]',
		'[data-stage-panel-fallback]'
	])('classifies %s as stage UI', (selector) => {
		vi.stubGlobal('Element', TestElement);

		expect(isStageUiTarget(new TestElement(selector) as unknown as EventTarget)).toBe(true);
	});

	it('rejects non-elements and ordinary layout elements', () => {
		vi.stubGlobal('Element', TestElement);

		expect(isStageUiTarget(null)).toBe(false);
		expect(isStageUiTarget({} as EventTarget)).toBe(false);
		expect(isStageUiTarget(new TestElement('article') as unknown as EventTarget)).toBe(false);
	});

	it('converts a DOM center to centered, y-up stage coordinates', () => {
		vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
		const rect = { left: 100, top: 100, width: 200, height: 200 } as DOMRect;

		expect(getStagePositionFromRect(rect)).toEqual({ x: -300, y: 200 });
	});

	it('culls rectangles outside the viewport while honoring the preload margin', () => {
		expect(isViewportRectVisible({ left: 100, top: 100, right: 300, bottom: 300 }, 1000, 800)).toBe(
			true
		);
		expect(
			isViewportRectVisible({ left: 100, top: 900, right: 300, bottom: 1100 }, 1000, 800)
		).toBe(false);
		expect(
			isViewportRectVisible({ left: 100, top: 900, right: 300, bottom: 1100 }, 1000, 800, 120)
		).toBe(true);
	});
});
