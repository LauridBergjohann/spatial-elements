import { describe, expect, it } from 'vitest';
import { parseMinimapMeasurementMode } from './minimapMeasurement.js';

describe('minimap measurement isolation', () => {
	it('requires the explicit visual-test opt-in', () => {
		expect(parseMinimapMeasurementMode('?minimap-measurement=no-overlay')).toBe('full');
		expect(parseMinimapMeasurementMode('?stage-test=0&minimap-measurement=no-blur')).toBe('full');
	});
	it('accepts only the named diagnostic ablations', () => {
		for (const mode of ['full', 'no-overlay', 'no-blur', 'reuse-capture']) {
			expect(parseMinimapMeasurementMode(`?stage-test=1&minimap-measurement=${mode}`)).toBe(mode);
		}
		expect(parseMinimapMeasurementMode('?stage-test=1&minimap-measurement=unknown')).toBe('full');
	});
});
