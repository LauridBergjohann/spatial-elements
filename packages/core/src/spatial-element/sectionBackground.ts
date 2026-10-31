import type { SectionBackground, SectionBackgroundColor } from './types.js';

type SolidSectionColor = 'transparent' | 'standard' | 'muted';
export interface SectionBackgroundContext {
	pageKind: 'content' | 'detail';
}

export interface SectionBackgroundDiagnostic {
	code: 'gradient-requires-full-background';
	message: string;
	requestedColor: SectionBackgroundColor;
	requestedSize: 'standard' | 'full';
	pageKind: SectionBackgroundContext['pageKind'];
	effectiveColor: SolidSectionColor;
}

export interface ResolvedSectionBackground {
	color: SectionBackgroundColor;
	size: 'standard' | 'full';
	gradient: boolean;
	cssBackground: string;
	diagnostic?: SectionBackgroundDiagnostic;
}

const gradients: Partial<Record<SectionBackgroundColor, readonly [SolidSectionColor, SolidSectionColor]>> = {
	transparentToStandard: ['transparent', 'standard'],
	transparentToMuted: ['transparent', 'muted'],
	standardToTransparent: ['standard', 'transparent'],
	standardToMuted: ['standard', 'muted'],
	mutedToTransparent: ['muted', 'transparent'],
	mutedToStandard: ['muted', 'standard']
};

function solidCss(color: SolidSectionColor) {
	return color === 'transparent' ? 'transparent' : `var(--spatial-element-section-${color})`;
}

function gradientCss([from, to]: readonly [SolidSectionColor, SolidSectionColor]) {
	// Use the opaque endpoint's hue at zero alpha, instead of fading through transparent black.
	const transparent = `color-mix(in srgb, ${solidCss(from === 'transparent' ? to : from)} 0%, transparent)`;
	return `linear-gradient(to bottom, ${from === 'transparent' ? transparent : solidCss(from)}, ${to === 'transparent' ? transparent : solidCss(to)})`;
}

/** Pure normalization. Legacy section styles are deliberately not consumed or changed here. */
export function normalizeSectionBackground(
	background: SectionBackground | undefined,
	context: SectionBackgroundContext
): ResolvedSectionBackground {
	const requestedColor = background?.color ?? 'transparent';
	const requestedSize = background?.size ?? 'standard';
	const size = context.pageKind === 'detail' ? 'standard' : requestedSize;
	const stops = gradients[requestedColor];
	if (stops && size !== 'full') {
		const color = stops[1];
		return {
			color,
			size,
			gradient: false,
			cssBackground: solidCss(color),
			diagnostic: {
				code: 'gradient-requires-full-background',
				requestedColor,
				requestedSize,
				pageKind: context.pageKind,
				effectiveColor: color,
				message: `Section background "${requestedColor}" requires an effective full-width background; ${context.pageKind} resolves "${requestedSize}" to "${size}" and uses the end color "${color}".`
			}
		};
	}
	return {
		color: requestedColor,
		size,
		gradient: Boolean(stops),
		cssBackground: stops ? gradientCss(stops) : solidCss(requestedColor as SolidSectionColor)
	};
}

/**
 * Component-scoped diagnostics; pass a reporter only in development. There is no global
 * cache or console side effect, so an SSR request cannot suppress another request's report.
 */
export function createSectionBackgroundNormalizer(report?: (diagnostic: SectionBackgroundDiagnostic) => void) {
	const reported = new Set<string>();
	return (background: SectionBackground | undefined, context: SectionBackgroundContext) => {
		const result = normalizeSectionBackground(background, context);
		if (report && result.diagnostic) {
			const { requestedColor, requestedSize, pageKind } = result.diagnostic;
			const key = `${pageKind}:${requestedSize}:${requestedColor}`;
			if (!reported.has(key)) {
				reported.add(key);
				report(result.diagnostic);
			}
		}
		return result;
	};
}
