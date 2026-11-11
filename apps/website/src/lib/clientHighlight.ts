import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import svelte from '@shikijs/langs/svelte';
import typescript from '@shikijs/langs/typescript';
import json from '@shikijs/langs/json';
import css from '@shikijs/langs/css';
import bash from '@shikijs/langs/bash';
import light from '@shikijs/themes/github-light';
import dark from '@shikijs/themes/github-dark';
import type { HighlightedCode } from '@page-sections/core';

const highlighter = createHighlighterCore({
	themes: [light, dark],
	langs: [svelte, typescript, json, css, bash],
	engine: createJavaScriptRegexEngine()
});

export async function highlight(code: string, language: string): Promise<HighlightedCode> {
	const engine = await highlighter;
	const result = engine.codeToTokensWithThemes(code, {
		lang: engine.getLoadedLanguages().includes(language) ? language : 'text',
		themes: { light: 'github-light', dark: 'github-dark' }
	});
	return {
		code,
		language,
		lines: result.map((line) =>
			line.map((token) => ({
				content: token.content,
				color: token.variants.light.color,
				darkColor: token.variants.dark.color,
				fontStyle: token.variants.light.fontStyle
			}))
		)
	};
}
