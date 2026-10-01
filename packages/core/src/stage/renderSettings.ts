import type { StageRenderSettings } from './stageTypes.js';

export interface ResolvedStageRenderSettings {
	maxPixelRatio: number;
	maxPixels: number | null;
}

export const DEFAULT_STAGE_RENDER_SETTINGS: Readonly<ResolvedStageRenderSettings> = {
	maxPixelRatio: 1,
	maxPixels: 1920 * 1080
};

export function resolveStageRenderSettings(
	settings: StageRenderSettings = {}
): ResolvedStageRenderSettings {
	return {
		maxPixelRatio:
			Number.isFinite(settings.maxPixelRatio) && settings.maxPixelRatio! > 0
				? settings.maxPixelRatio!
				: DEFAULT_STAGE_RENDER_SETTINGS.maxPixelRatio,
		maxPixels:
			settings.maxPixels === null
				? null
				: Number.isFinite(settings.maxPixels) && settings.maxPixels! > 0
					? Math.max(1, Math.floor(settings.maxPixels!))
					: DEFAULT_STAGE_RENDER_SETTINGS.maxPixels
	};
}

/** Keep the viewport aspect ratio and allow subsampling on very large displays. */
export function getStageRenderPixelRatio(
	width: number,
	height: number,
	devicePixelRatio: number,
	settings: Readonly<ResolvedStageRenderSettings> = DEFAULT_STAGE_RENDER_SETTINGS
) {
	const viewportWidth = Number.isFinite(width) && width > 0 ? width : 1;
	const viewportHeight = Number.isFinite(height) && height > 0 ? height : 1;
	const nativeRatio =
		Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
	const pixelBudgetRatio =
		settings.maxPixels === null
			? Infinity
			: Math.sqrt(settings.maxPixels / (viewportWidth * viewportHeight));
	return Math.min(nativeRatio, settings.maxPixelRatio, pixelBudgetRatio);
}
