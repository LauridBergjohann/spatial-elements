import { readFileSync, writeFileSync } from 'node:fs';
import { layoutTokens } from '@page-sections/core';
import { detailRules } from './layout-detail-css.mjs';
import { carouselRules } from './layout-carousel-css.mjs';
import { paneRules } from './layout-pane-css.mjs';

const source = new URL('../packages/core/src/spatial-element/layoutTokens.json', import.meta.url);
const destination = new URL('../packages/sveltekit/src/spatial-element/layout.generated.css', import.meta.url);
const tokens = { ...layoutTokens, ...JSON.parse(readFileSync(source, 'utf8')) };
const properties = {
	columns: ['columns', ''], gap: ['gap', 'px'],
	headlineSize: ['headline-size', 'px'], headlineLineHeight: ['headline-line-height', 'px'],
	bodySize: ['body-size', 'px'], bodyLineHeight: ['body-line-height', 'px'],
	headlineGap: ['headline-gap', 'px']
};
function dockRules() {
	return Object.entries(tokens.hero).filter(([name]) => name !== '3xl').map(([name, hero]) => {
		const rules = `.stage { --spatial-detail-dock-height: ${hero.dockHeight}px; --spatial-detail-submenu-height: ${hero.submenuHeight}px; --spatial-detail-submenu-after-gap: ${hero.submenuAfterGap}px; }`;
		return tokens.layoutMinWidths[name] === 0 ? rules : `@media (min-width: ${tokens.layoutMinWidths[name]}px) {\n\t${rules}\n}`;
	});
}
const css = [
	'/* Generated from @page-sections/core plus spatial-only layoutTokens.json. Run npm run layout:generate. */',
	`.spatial-content-width { width: min(100%, ${tokens.contentMax}px); margin-inline: auto; }`,
	`.spatial-content-container { container: ps-content / inline-size; min-width: 0; }`,
	`@media (min-width: ${tokens.layoutMinWidths.xl}px) {\n\t.spatial-content-width { width: min(${tokens.contentMax}px, max(0px, calc(100% - ${tokens.xlContentInset * 2}px))); }\n}`,
	`@media (min-width: ${tokens.layoutMinWidths['2xl']}px) {\n\t.spatial-content-width { width: min(100%, ${tokens.contentMax}px); }\n}`,
	...dockRules(),
	...detailRules(tokens),
	...carouselRules(tokens),
	paneRules(tokens),
	'.ps-grid-scope {\n' + Object.values(properties).map(([property]) => '\t--spatial-grid-' + property + ': var(--ps-grid-' + property + ');').join('\n') + '\n}',
	`@media (min-width: ${tokens.layoutMinWidths.xl}px) {\n\t.spatial-section-surface { border-radius: var(--spatial-section-top-radius, 0px) var(--spatial-section-top-radius, 0px) var(--spatial-section-bottom-radius, 0px) var(--spatial-section-bottom-radius, 0px); }\n}`,
	`@media (min-width: ${tokens.layoutMinWidths['3xl']}px) {\n\t[data-spatial-detail-pane] .spatial-section-surface { border-radius: 0; }\n}`,
	`.stage { --spatial-shell-fixed: 0; }`,
	`@media (min-width: ${tokens.layoutMinWidths['3xl']}px) and (min-height: ${tokens.pane.minUsableHeight}px) {\n\t.stage:has([data-spatial-element-root]) { --spatial-shell-fixed: 1; }\n\t.stage:not(.stage-virtual-scroll-active):has([data-spatial-element-root]) .spatial-shell-rack { position: fixed; top: 0; left: 0; right: 0; }\n\t[data-spatial-element-root] .breadcrumbs li:last-child [aria-current='page'] { display: none; }\n}`
].join('\n\n') + '\n';

if (process.argv.includes('--check')) {
	if (readFileSync(destination, 'utf8') !== css) {
		throw new Error('Responsive layout CSS is stale. Run npm run layout:generate and commit the generated file.');
	}
	console.log('Shared layout CSS matches core tokens.');
} else {
	writeFileSync(destination, css);
	console.log('Generated shared responsive layout CSS.');
}
