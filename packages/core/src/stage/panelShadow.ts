export interface PanelShadowLayer {
	offsetY: number;
	blur: number;
	alphaScale: number;
}

export const PANEL_SHADOW_INTENSITY_EXPONENT = 1.35;

/** Shared shadow geometry and strength for CSS and WebGPU panel surfaces. */
export const PANEL_SHADOW_RECIPE = [
	{ offsetY: 0, blur: 8, alphaScale: 0.36 },
	{ offsetY: 0, blur: 28, alphaScale: 0.6 }
] as const satisfies readonly PanelShadowLayer[];

export function getCssPanelBoxShadow(shadowIntensity: number) {
	const strength = resolvePanelShadowStrength(shadowIntensity);
	return PANEL_SHADOW_RECIPE.map(
		({ offsetY, blur, alphaScale }) =>
			`0 ${offsetY}px ${blur}px rgb(0 0 0 / ${formatAlpha(strength * alphaScale)})`
	).join(', ');
}

/** Preserves subtle low values while giving the upper half of the scale more visual range. */
export function resolvePanelShadowStrength(shadowIntensity: number) {
	return Math.pow(clamp(shadowIntensity, 0, 1), PANEL_SHADOW_INTENSITY_EXPONENT);
}

function formatAlpha(value: number) {
	return Number(value.toFixed(4));
}

function clamp(value: number, min: number, max: number) {
	const finiteValue = Number.isFinite(value) ? value : min;
	return Math.min(Math.max(finiteValue, min), max);
}
