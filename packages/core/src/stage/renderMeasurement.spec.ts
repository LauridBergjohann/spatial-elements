import { expect, test } from 'vitest';
import { parseRenderMeasurement } from './renderMeasurement.js';

test('render ablations require the explicit test gate and a known mode', () => {
	for (const mode of [
		'no-halo',
		'fixed-minimap-size',
		'frozen-backdrop',
		'halo-unconditional',
		'halo-mask-only',
		'halo-frozen-mask',
		'halo-half-mask',
		'halo-fused',
		'halo-separate'
	] as const) {
		expect(parseRenderMeasurement(`?render-measurement=${mode}`)).toBe('full');
		expect(parseRenderMeasurement(`?stage-test=0&render-measurement=${mode}`)).toBe('full');
		expect(parseRenderMeasurement(`?stage-test=1&render-measurement=${mode}`)).toBe(mode);
	}
	expect(parseRenderMeasurement('?stage-test=1&render-measurement=unknown')).toBe('full');
});
