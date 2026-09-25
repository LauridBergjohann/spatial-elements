import { describe, expect, it } from 'vitest';
import { StagePanelLayout } from './StagePanelLayout.js';

describe('StagePanelLayout', () => {
	it('retains panel layout without creating WebGPU surface geometry', () => {
		const panel = new StagePanelLayout({
			width: 420,
			height: 180,
			radius: 24,
			position: { x: 36, y: -12 }
		});

		expect(panel.group.children).toHaveLength(0);
		expect(panel.group.position.toArray()).toEqual([36, -12, 0]);
		expect(panel.options).toMatchObject({ width: 420, height: 180, radius: 24 });
	});

	it('resolves the direct glass controls without coupling tint and transparency', () => {
		const panel = new StagePanelLayout({
			tint: '#ffffff',
			tintOpacity: 0.82,
			backdropBlur: 18,
			refraction: 0,
			bezel: 0,
			thickness: 0,
			specularOpacity: 0,
			shadowIntensity: 0
		});

		expect(panel.options).toMatchObject({
			tint: '#ffffff',
			tintOpacity: 0.82,
			backdropBlur: 18,
			refraction: 0,
			bezel: 0,
			thickness: 0,
			specularOpacity: 0,
			shadowIntensity: 0
		});
	});

	it('clamps normalized opacity controls to predictable ranges', () => {
		const panel = new StagePanelLayout({
			tintOpacity: 2,
			thickness: -1,
			specularOpacity: Number.NaN,
			shadowIntensity: -0.5
		});

		expect(panel.options.tintOpacity).toBe(1);
		expect(panel.options.thickness).toBe(0);
		expect(panel.options.specularOpacity).toBe(0.18);
		expect(panel.options.shadowIntensity).toBe(0);
	});
});
