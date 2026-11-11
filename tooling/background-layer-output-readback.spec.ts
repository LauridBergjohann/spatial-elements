import { describe, expect, it } from 'vitest';
import { unpackHalfFloatRgbaRows } from '../apps/tests/src/routes/proof/background-layer-output/readback';

describe('experimental Background RGBA16F readback', () => {
	it('keeps every channel and row while excluding nonzero padding from unaligned widths', () => {
		const width = 300, height = 3, stride = 1280, rowValues = width * 4;
		const raw = new Uint16Array((height - 1) * stride + rowValues).fill(0xffff);
		const expected = new Uint16Array(width * height * 4);
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let channel = 0; channel < 4; channel++) {
			const value = y * 4000 + x * 4 + channel;
			raw[y * stride + x * 4 + channel] = value;
			expected[(y * width + x) * 4 + channel] = value;
		}
		const result = unpackHalfFloatRgbaRows(raw, width, height);
		expect(result.pixels).toEqual(expected);
		expect(result.layout).toEqual({ width, height, bytesPerRow: 2560, rowBytes: 2400, rawValues: 3760,
			pixelValues: 3600, paddingValues: 160, format: 'RGBA16F' });
	});
	it('preserves tightly aligned rows and accounts for the actual final row extent', () => {
		const aligned = new Uint16Array(160 * 2 * 4); aligned[aligned.length - 1] = 0x3c00;
		expect(unpackHalfFloatRgbaRows(aligned, 160, 2).pixels).toEqual(aligned);
		expect(unpackHalfFloatRgbaRows(new Uint16Array(300 * 4), 300, 1).layout.paddingValues).toBe(0);
	});
	it('rejects unknown/truncated layouts instead of comparing incomplete images', () => {
		expect(() => unpackHalfFloatRgbaRows(new Uint16Array(300 * 2 * 4), 300, 2)).toThrow('Unexpected RGBA16F readback length');
		expect(() => unpackHalfFloatRgbaRows(new Uint16Array(1280 * 2), 300, 2)).toThrow('Unexpected RGBA16F readback length');
		expect(() => unpackHalfFloatRgbaRows(new Uint16Array(), 0, 2)).toThrow('positive integers');
	});
});
