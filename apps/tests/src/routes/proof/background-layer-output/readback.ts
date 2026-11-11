/** Proof-only decoder for Three r186's WebGPU RGBA16F readback, which retains row padding. */
export function unpackHalfFloatRgbaRows(raw: Uint16Array, width: number, height: number) {
	if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
		throw new Error('Readback dimensions must be positive integers');
	const rowValues = width * 4,
		rowBytes = rowValues * Uint16Array.BYTES_PER_ELEMENT;
	const bytesPerRow = Math.ceil(rowBytes / 256) * 256;
	const rowStride = bytesPerRow / Uint16Array.BYTES_PER_ELEMENT;
	const expectedLength = (height - 1) * rowStride + rowValues;
	if (raw.length !== expectedLength)
		throw new Error(
			`Unexpected RGBA16F readback length: ${raw.length}; expected ${expectedLength} for ${width}x${height} at ${bytesPerRow} bytes/row`
		);
	const pixels = new Uint16Array(width * height * 4);
	for (let y = 0; y < height; y++)
		pixels.set(raw.subarray(y * rowStride, y * rowStride + rowValues), y * rowValues);
	return {
		pixels,
		layout: {
			width,
			height,
			bytesPerRow,
			rowBytes,
			rawValues: raw.length,
			pixelValues: pixels.length,
			paddingValues: raw.length - pixels.length,
			format: 'RGBA16F' as const
		}
	};
}
