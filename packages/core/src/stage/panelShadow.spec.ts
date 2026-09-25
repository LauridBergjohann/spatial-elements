import { describe, expect, it } from 'vitest';
import {
	getCssPanelBoxShadow,
	PANEL_SHADOW_RECIPE,
	resolvePanelShadowStrength
} from './panelShadow.js';

describe('panel shadows', () => {
	it('preserves subtle low values while using the full stronger maximum', () => {
		expect(resolvePanelShadowStrength(0)).toBe(0);
		expect(resolvePanelShadowStrength(0.25)).toBeCloseTo(0.154, 3);
		expect(resolvePanelShadowStrength(1)).toBe(1);
		expect(getCssPanelBoxShadow(1)).toBe(
			PANEL_SHADOW_RECIPE.map(
				({ offsetY, blur, alphaScale }) => `0 ${offsetY}px ${blur}px rgb(0 0 0 / ${alphaScale})`
			).join(', ')
		);
	});

	it('clamps values outside the supported intensity range', () => {
		expect(resolvePanelShadowStrength(-1)).toBe(0);
		expect(resolvePanelShadowStrength(2)).toBe(1);
	});
});
