import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { decodeProofPng, proofPngDifference, proofPngRgbRange } from '../tests/helpers/proofPng';

const fixture = (width: number, height: number, colorType: number, rows: number[], interlace = 0) => {
	const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
	header[8] = 8; header[9] = colorType; header[12] = interlace;
	// These decoder tests exercise scanline semantics, not the PNG CRC transport layer.
	const chunk = (type: string, data: Buffer) => { const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length); out.write(type, 4); data.copy(out, 8); return out; };
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from(rows))), chunk('IEND', Buffer.alloc(0))]);
};

describe('CPU screenshot PNG decoder', () => {
	it('decodes distinct RGBA values through all five PNG row filters', () => {
		const png = decodeProofPng(fixture(2, 5, 6, [
			0, 10, 20, 30, 255, 40, 50, 60, 128,
			1, 11, 21, 31, 254, 30, 30, 30, 129,
			2, 1, 1, 1, 255, 1, 1, 1, 255,
			3, 0, 0, 0, 0, 0, 0, 0, 255,
			4, 0, 0, 0, 0, 0, 0, 0, 0
		]));
		expect([...png.rgba]).toEqual([
			10, 20, 30, 255, 40, 50, 60, 128,
			11, 21, 31, 254, 41, 51, 61, 127,
			12, 22, 32, 253, 42, 52, 62, 126,
			6, 11, 16, 126, 24, 31, 39, 125,
			6, 11, 16, 126, 24, 31, 39, 125
		]);
		expect(proofPngRgbRange(png)).toBe(46); expect(proofPngDifference(png, png)).toBe(0);
		const changed = { ...png, rgba: png.rgba.slice() }; changed.rgba[3]--;
		expect(proofPngDifference(png, changed)).toBe(1);
	});
	it('decodes RGB screenshots with opaque alpha and rejects unsupported/invalid extents', () => {
		expect([...decodeProofPng(fixture(1, 1, 2, [0, 7, 8, 9])).rgba]).toEqual([7, 8, 9, 255]);
		expect(proofPngRgbRange(decodeProofPng(fixture(1, 1, 2, [0, 7, 8, 9])))).toBe(0);
		expect(() => decodeProofPng(fixture(1, 1, 2, [0, 7, 8, 9], 1))).toThrow('non-interlaced');
		expect(() => decodeProofPng(fixture(1, 1, 2, [5, 7, 8, 9]))).toThrow('filter');
		expect(() => decodeProofPng(fixture(2, 1, 2, [0, 7, 8, 9]))).toThrow('extent');
		expect(() => proofPngDifference({ width: 1, height: 1, rgba: new Uint8Array(4) }, { width: 2, height: 1, rgba: new Uint8Array(8) })).toThrow('dimensions');
	});
});
