/** Predeclared numerical bound: four binary16 ULPs, with a 2^-13 dark-value floor. */
export function pixelTolerance(a: number, b: number) {
	const magnitude = Math.max(Math.abs(a), Math.abs(b));
	const ulp = magnitude < 2 ** -14 ? 2 ** -24 : 2 ** (Math.floor(Math.log2(magnitude)) - 10);
	return Math.max(2 ** -13, 4 * ulp);
}

export function compareLinearPixels(actual: readonly number[], expected: readonly number[]) {
	if (actual.length !== expected.length || actual.length === 0 || actual.length % 4 !== 0)
		throw new Error('Expected equally sized, nonempty RGBA buffers');
	let maxError = 0, maxErrorIndex = 0, maxToleranceRatio = 0, squaredError = 0, outsideTolerance = 0;
	for (let i = 0; i < actual.length; i++) {
		if (!Number.isFinite(actual[i]) || !Number.isFinite(expected[i])) throw new Error(`Nonfinite channel ${i}`);
		const error = Math.abs(actual[i] - expected[i]);
		const ratio = error / pixelTolerance(actual[i], expected[i]);
		if (error > maxError) { maxError = error; maxErrorIndex = i; }
		maxToleranceRatio = Math.max(maxToleranceRatio, ratio);
		squaredError += error * error;
		if (ratio > 1) outsideTolerance++;
	}
	return { maxError, maxErrorIndex, actualAtMax: actual[maxErrorIndex], expectedAtMax: expected[maxErrorIndex],
		maxToleranceRatio, rmse: Math.sqrt(squaredError / actual.length), outsideTolerance,
		channels: actual.length, equivalent: outsideTolerance === 0 };
}

export const interiorPairs = [
	{ backgroundReveal: 0.17, refinementProgress: 0.23 },
	{ backgroundReveal: 0.5, refinementProgress: 0.5 },
	{ backgroundReveal: 0.83, refinementProgress: 0.71 },
	{ backgroundReveal: 0.71, refinementProgress: 0.17 }
] as const;
