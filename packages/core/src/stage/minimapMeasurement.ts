/** Diagnostic ablations only; normal pages always retain the complete minimap. */
export type MinimapMeasurementMode = 'full' | 'no-overlay' | 'no-blur' | 'reuse-capture';

export function parseMinimapMeasurementMode(search: string): MinimapMeasurementMode {
	const params = new URLSearchParams(search);
	if (params.get('stage-test') !== '1') return 'full';
	const mode = params.get('minimap-measurement');
	return mode === 'no-overlay' || mode === 'no-blur' || mode === 'reuse-capture' ? mode : 'full';
}

export function getMinimapMeasurementMode(): MinimapMeasurementMode {
	return parseMinimapMeasurementMode(
		typeof window === 'undefined' ? '' : (window.location?.search ?? '')
	);
}
