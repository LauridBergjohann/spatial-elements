/** Test-only comparisons, including incomplete views; normal pages retain complete rendering. */
export function parseRenderMeasurement(
	search: string
):
	| 'fixed-minimap-size'
	| 'full'
	| 'no-halo'
	| 'frozen-backdrop'
	| 'halo-unconditional'
	| 'halo-mask-only'
	| 'halo-frozen-mask'
	| 'halo-half-mask'
	| 'halo-fused'
	| 'halo-separate' {
	const query = new URLSearchParams(search);
	if (query.get('stage-test') !== '1') return 'full';
	const mode = query.get('render-measurement');
	return mode === 'fixed-minimap-size' ||
		mode === 'no-halo' ||
		mode === 'frozen-backdrop' ||
		mode === 'halo-unconditional' ||
		mode === 'halo-mask-only' ||
		mode === 'halo-frozen-mask' ||
		mode === 'halo-half-mask' ||
		mode === 'halo-fused' ||
		mode === 'halo-separate'
		? mode
		: 'full';
}
