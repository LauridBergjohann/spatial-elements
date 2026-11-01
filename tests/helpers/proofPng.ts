import { inflateSync } from 'node:zlib';

export interface ProofPng { width: number; height: number; rgba: Uint8Array }

/** Decode Chromium's non-interlaced 8-bit RGB(A) screenshots without drawing any browser canvas. */
export function decodeProofPng(bytes: Uint8Array): ProofPng {
	const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Expected PNG signature');
	let width = 0, height = 0, channels = 0;
	const compressed: Buffer[] = [];
	for (let offset = 8; offset + 12 <= png.length;) {
		const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
		if (offset + 12 + length > png.length) throw new Error('Truncated PNG chunk');
		const data = png.subarray(offset + 8, offset + 8 + length);
		if (type === 'IHDR') {
			if (data.length !== 13) throw new Error('Invalid PNG header');
			width = data.readUInt32BE(0); height = data.readUInt32BE(4);
			if (!width || !height || data[8] !== 8 || ![2, 6].includes(data[9]) || data[10] || data[11] || data[12])
				throw new Error('Expected non-interlaced 8-bit RGB/RGBA PNG');
			channels = data[9] === 6 ? 4 : 3;
		} else if (type === 'IDAT') compressed.push(data);
		offset += length + 12;
		if (type === 'IEND') break;
	}
	if (!channels || !compressed.length) throw new Error('Missing PNG header or pixels');
	const stride = width * channels, filtered = inflateSync(Buffer.concat(compressed));
	if (filtered.length !== height * (stride + 1)) throw new Error('Unexpected PNG pixel extent');
	const decoded = new Uint8Array(height * stride);
	for (let y = 0; y < height; y++) {
		const filter = filtered[y * (stride + 1)];
		if (filter > 4) throw new Error(`Unsupported PNG filter ${filter}`);
		for (let x = 0; x < stride; x++) {
			const index = y * stride + x, a = x >= channels ? decoded[index - channels] : 0;
			const b = y ? decoded[index - stride] : 0, c = y && x >= channels ? decoded[index - stride - channels] : 0;
			let predictor = 0;
			if (filter === 1) predictor = a;
			else if (filter === 2) predictor = b;
			else if (filter === 3) predictor = Math.floor((a + b) / 2);
			else if (filter === 4) {
				const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
				predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			decoded[index] = (filtered[y * (stride + 1) + x + 1] + predictor) & 255;
		}
	}
	const rgba = new Uint8Array(width * height * 4);
	for (let pixel = 0; pixel < width * height; pixel++) {
		rgba[pixel * 4] = decoded[pixel * channels]; rgba[pixel * 4 + 1] = decoded[pixel * channels + 1];
		rgba[pixel * 4 + 2] = decoded[pixel * channels + 2]; rgba[pixel * 4 + 3] = channels === 4 ? decoded[pixel * channels + 3] : 255;
	}
	return { width, height, rgba };
}

export function proofPngDifference(a: ProofPng, b: ProofPng) {
	if (a.width !== b.width || a.height !== b.height) throw new Error('Screenshot dimensions differ');
	let max = 0; for (let i = 0; i < a.rgba.length; i++) max = Math.max(max, Math.abs(a.rgba[i] - b.rgba[i])); return max;
}

export function proofPngRgbRange(png: ProofPng) {
	const min = [255, 255, 255], max = [0, 0, 0];
	for (let i = 0; i < png.rgba.length; i += 4) for (let channel = 0; channel < 3; channel++) {
		min[channel] = Math.min(min[channel], png.rgba[i + channel]); max[channel] = Math.max(max[channel], png.rgba[i + channel]);
	}
	return Math.max(...max.map((value, channel) => value - min[channel]));
}
