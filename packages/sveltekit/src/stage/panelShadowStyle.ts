import type { LiquidGlassPanelOptions } from '@spatial-elements/core/stage/LiquidGlassPanel';

const colors = new Map<string, { color: number; alpha: number }>();
let context: CanvasRenderingContext2D | null | undefined;
function resolveColor(value: string) {
	if (colors.has(value)) return colors.get(value)!;
	// Resolve CSS color syntax (including transparent/color-mix) once per color.
	// This is a 1px color swatch, never a capture of the scene or a per-frame read.
	if (context === undefined) {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		context = canvas.getContext('2d', { willReadFrequently: true });
	}
	if (!context || !CSS.supports('color', value)) return undefined;
	context.clearRect(0, 0, 1, 1);
	context.fillStyle = value;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
	const result = { color: (r << 16) | (g << 8) | b, alpha: a / 255 };
	if (colors.size >= 64) colors.clear();
	colors.set(value, result);
	return result;
}

/** Read only when appearance is invalidated, never in the scroll/render loop. */
export function withSharedPanelShadow(element: HTMLElement, options: LiquidGlassPanelOptions): LiquidGlassPanelOptions {
	const css = getComputedStyle(element);
	const number = (name: string, fallback: number) => {
		const value = Number.parseFloat(css.getPropertyValue(name));
		return Number.isFinite(value) ? Math.max(0, value) : fallback;
	};
	const color = css.getPropertyValue('--ps-shadow-color').trim();
	const resolved = color ? resolveColor(color) : undefined;
	return {
		...options,
		...(resolved ? { shadowColor: resolved.color } : {}),
		shadowSize: number('--ps-shadow-size', options.shadowSize ?? 1),
		shadowIntensityScale: number('--ps-shadow-intensity', options.shadowIntensityScale ?? 1) * (resolved?.alpha ?? 1)
	};
}

/** Theme edits and responsive styles update GPU materials without per-frame CSS reads. */
export function observePanelShadowStyles(stage: HTMLElement, update: () => void) {
	const observer = new MutationObserver(update);
	for (let ancestor = stage.parentElement; ancestor; ancestor = ancestor.parentElement) {
		observer.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class', 'data-ps-theme', 'data-color-scheme'] });
	}
	observer.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'media', 'disabled'] });
	window.addEventListener('resize', update, { passive: true });
	return () => { observer.disconnect(); window.removeEventListener('resize', update); };
}
