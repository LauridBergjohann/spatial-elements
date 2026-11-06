import { expect, test, vi } from 'vitest';
import { createSectionBackgroundNormalizer, normalizeSectionBackground } from './sectionBackground.js';
import { getSpatialElementSectionStyle } from './spatialElement.js';
import type { SectionBackgroundColor, SpatialElementSectionDefinition } from './types.js';

const gradients = [
	['transparentToStandard', 'standard'],
	['transparentToMuted', 'muted'],
	['standardToTransparent', 'transparent'],
	['standardToMuted', 'muted'],
	['mutedToTransparent', 'transparent'],
	['mutedToStandard', 'standard']
] as const;

test('the default is genuinely transparent and detail constrains solid backgrounds without warning', () => {
	expect(normalizeSectionBackground(undefined, { pageKind: 'content' })).toEqual({
		color: 'transparent', size: 'standard', gradient: false, cssBackground: 'transparent'
	});
	for (const color of ['transparent', 'standard', 'muted'] as const) {
		const content = normalizeSectionBackground({ color, size: 'full' }, { pageKind: 'content' });
		const detail = normalizeSectionBackground({ color, size: 'full' }, { pageKind: 'detail' });
		expect(content.size).toBe('full');
		expect(detail).toMatchObject({ color, size: 'standard', gradient: false });
		expect(detail.diagnostic).toBeUndefined();
	}
});

test.each(gradients)('%s retains its gradient only for an effective full content background', (color, endColor) => {
	const full = normalizeSectionBackground({ color, size: 'full' }, { pageKind: 'content' });
	expect(full).toMatchObject({ color, size: 'full', gradient: true });
	expect(full.cssBackground).toMatch(/^linear-gradient\(to bottom,/);
	expect(full.diagnostic).toBeUndefined();
	for (const pageKind of ['content', 'detail'] as const) {
		for (const size of ['standard', 'full'] as const) {
			if (pageKind === 'content' && size === 'full') continue;
			const result = normalizeSectionBackground({ color, size }, { pageKind });
			expect(result).toMatchObject({ color: endColor, size: 'standard', gradient: false });
			expect(result.cssBackground).toBe(endColor === 'transparent' ? 'transparent' : `var(--spatial-element-section-${endColor})`);
			expect(result.diagnostic).toMatchObject({ requestedColor: color, requestedSize: size, pageKind, effectiveColor: endColor });
		}
	}
});

test('transparent gradient endpoints keep the opaque endpoint hue', () => {
	for (const [color, opaque] of [
		['transparentToStandard', 'standard'], ['standardToTransparent', 'standard'],
		['transparentToMuted', 'muted'], ['mutedToTransparent', 'muted']
	] satisfies Array<[SectionBackgroundColor, string]>) {
		const result = normalizeSectionBackground({ color, size: 'full' }, { pageKind: 'content' });
		expect(result.cssBackground).toContain(`color-mix(in srgb, var(--spatial-element-section-${opaque}) 0%, transparent)`);
	}
});

test('diagnostics are once per component configuration/context, not once per frame or globally', () => {
	const report = vi.fn();
	const normalize = createSectionBackgroundNormalizer(report);
	const request = { color: 'transparentToMuted', size: 'full' } as const;
	for (let frame = 0; frame < 60; frame++) normalize(request, { pageKind: 'detail' });
	expect(report).toHaveBeenCalledTimes(1);
	normalize(request, { pageKind: 'content' });
	expect(report).toHaveBeenCalledTimes(1);
	normalize({ ...request, size: 'standard' }, { pageKind: 'detail' });
	expect(report).toHaveBeenCalledTimes(2);
	createSectionBackgroundNormalizer(report)(request, { pageKind: 'detail' });
	expect(report).toHaveBeenCalledTimes(3);
	// Production callers omit the reporter; normalization still supplies the same fallback.
	expect(createSectionBackgroundNormalizer()(request, { pageKind: 'detail' }).color).toBe('muted');
});

test('normalization neither mutates authored configuration nor discards legacy section styling', () => {
	const section: SpatialElementSectionDefinition = Object.freeze({
		id: 'features', title: 'Features', headline: 'Visible heading',
		background: Object.freeze({ color: 'mutedToStandard', size: 'full' }),
		style: Object.freeze({ tint: '#123456', tintOpacity: 0.4, backdropBlur: 9, textColor: '#abcdef', width: '72rem' })
	});
	const before = getSpatialElementSectionStyle(section.style);
	normalizeSectionBackground(section.background, { pageKind: 'detail' });
	expect(section.background).toEqual({ color: 'mutedToStandard', size: 'full' });
	expect(getSpatialElementSectionStyle(section.style)).toBe(before);
	expect(before).toContain('--spatial-element-section-tint: #123456');
	expect(before).toContain('--spatial-element-section-width: 72rem');
});
