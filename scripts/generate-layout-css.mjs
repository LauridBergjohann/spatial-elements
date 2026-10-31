import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../packages/core/src/spatial-element/layoutTokens.json', import.meta.url);
const destination = new URL('../packages/sveltekit/src/spatial-element/layout.generated.css', import.meta.url);
const tokens = JSON.parse(readFileSync(source, 'utf8'));
const properties = {
	columns: ['columns', ''], gap: ['gap', 'px'],
	headlineSize: ['headline-size', 'px'], headlineLineHeight: ['headline-line-height', 'px'],
	bodySize: ['body-size', 'px'], bodyLineHeight: ['body-line-height', 'px'],
	headlineGap: ['headline-gap', 'px']
};
function gridRules(name, grid) {
	return '.spatial-grid-scope {\n' + Object.entries(properties)
		.map(([key, [property, unit]]) => `\t--spatial-grid-${property}: ${grid[key]}${unit};`).join('\n') +
		`\n\t--spatial-card-large-span: ${name === 's' ? tokens.cards.l.gridSSpan : tokens.cards.l.span};\n}` +
		`\n.spatial-content-block { --spatial-content-block-span: var(--spatial-content-block-span-${name}); }`;
}
const css = [
	'/* Generated from core/spatial-element/layoutTokens.json. Run npm run layout:generate. */',
	`.spatial-content-width { width: min(100%, ${tokens.contentMax}px); margin-inline: auto; }`,
	`.spatial-content-container { container: spatial-content / inline-size; min-width: 0; }`,
	`@media (min-width: ${tokens.layoutMinWidths.xl}px) {\n\t.spatial-content-width { width: min(${tokens.contentMax}px, max(0px, calc(100% - ${tokens.xlContentInset * 2}px))); }\n}`,
	`@media (min-width: ${tokens.layoutMinWidths['2xl']}px) {\n\t.spatial-content-width { width: min(100%, ${tokens.contentMax}px); }\n}`,
	...Object.entries(tokens.grid).map(([name, grid]) => grid.minWidth === 0 ? gridRules(name, grid)
		: `@container spatial-content (min-width: ${grid.minWidth}px) {\n${gridRules(name, grid).split('\n').map(line => '\t' + line).join('\n')}\n}`),
	`@media (min-width: ${tokens.layoutMinWidths.xl}px) {\n\t.spatial-section-surface { border-radius: var(--spatial-section-top-radius, 0px) var(--spatial-section-top-radius, 0px) var(--spatial-section-bottom-radius, 0px) var(--spatial-section-bottom-radius, 0px); }\n}`,
	`@media (min-width: ${tokens.layoutMinWidths['3xl']}px) {\n\t[data-spatial-detail-pane] .spatial-section-surface { border-radius: 0; }\n}`,
	`.stage {\n\t--spatial-shell-fixed: 0;\n\t--spatial-shell-sticky-range: ${tokens.menu.scrollThreshold}px;\n\t--spatial-shell-menu-top: 0px;\n\t--spatial-shell-menu-height: ${tokens.menu.height}px;\n\t--spatial-shell-reserve: ${tokens.menu.height}px;\n\t--spatial-shell-satellite-top: ${tokens.satellite.top}px;\n\t--spatial-shell-satellite-inset: ${tokens.satellite.inset}px;\n\t--spatial-shell-satellite-width: ${tokens.satellite.width}px;\n\t--spatial-shell-satellite-height: ${tokens.satellite.height}px;\n}`,
	`.spatial-shell-menu.spatial-content-width { width: 100%; }\n.spatial-shell-satellite { display: none; }`,
	...Object.entries(tokens.breadcrumb).map(([name, value]) => {
		const rule = `.stage { --spatial-breadcrumb-height: ${value.height}px; --spatial-breadcrumb-font-size: ${value.fontSize}px; }`;
		return tokens.layoutMinWidths[name] === 0 ? rule : `@media (min-width: ${tokens.layoutMinWidths[name]}px) {\n\t${rule}\n}`;
	}),
	`@media (min-width: ${tokens.layoutMinWidths.xl}px) {\n\t.stage { --spatial-shell-menu-top: ${tokens.menu.wideTop}px; --spatial-shell-menu-height: ${tokens.menu.wideHeight}px; --spatial-shell-reserve: ${tokens.menu.wideTop + tokens.menu.wideHeight}px; }\n\t.spatial-shell-menu.spatial-content-width { width: min(${tokens.contentMax}px, max(0px, calc(100% - ${tokens.xlContentInset * 2}px))); }\n\t.spatial-shell-satellite { display: block; }\n\t.spatial-shell-compact-only { display: none !important; }\n}`,
	`@media (min-width: ${tokens.layoutMinWidths['2xl']}px) {\n\t.spatial-shell-menu.spatial-content-width { width: min(100%, ${tokens.contentMax}px); }\n}`,
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
