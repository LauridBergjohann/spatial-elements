import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve(import.meta.dirname, '../apps/website/static/documentation/diagrams');
mkdirSync(out, { recursive: true });
const text = (x, y, value, cls = '') => `<text x="${x}" y="${y}" class="${cls}">${value}</text>`;
const box = (x, y, w, h, label, cls = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" class="${cls}"/>${label ? text(x + 20, y + 33, label) : ''}`;
const arrow = (x, y, x2, y2) => `<path d="M${x} ${y} L${x2} ${y2}" class="arrow" marker-end="url(#arrow)"/>`;
const model = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 -46 44 -22 44 28 0 52 -44 28 -44 -22Z" class="model"/><path d="M-44 -22 0 2 44 -22M0 2V52" class="edge"/></g>`;
function save(name, title, content) {
 writeFileSync(resolve(out, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="440" viewBox="0 0 960 440" role="img" aria-labelledby="title"><title id="title">${title}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#24836e"/></marker></defs><style>svg{background:#eef3f1;font-family:system-ui,sans-serif}rect{fill:#fff;stroke:#bfd0c9;stroke-width:2}text{fill:#1b3932;font-size:21px;font-weight:600}.small{font-size:17px;font-weight:400;fill:#45645c}.accent{fill:#d4eee4;stroke:#24836e}.muted{fill:#e2e9e6}.arrow{fill:none;stroke:#24836e;stroke-width:3}.model{fill:#4db197;stroke:#19715d;stroke-width:2}.edge{fill:none;stroke:#19715d;stroke-width:2}</style>${text(32, 38, title)}${content}</svg>\n`);
}
save('foundations', 'One website, two complementary layers',
 box(32, 72, 548, 126, 'Page Sections · the content foundation', 'accent') +
 text(52, 134, 'HTML • headings • cards • content grid', 'small') + text(52, 165, 'Responsive widths, surfaces and navigation', 'small') +
 box(32, 226, 548, 126, 'Spatial Elements · the spatial layer') +
 text(52, 288, 'Models • collection interactions • detail views', 'small') + text(52, 319, 'One shared stage, with HTML and poster fallback', 'small') +
 box(646, 72, 282, 280, 'Your page') + box(666, 128, 242, 42, '', 'muted') + model(787, 236, .85) + text(676, 324, 'Content + 3D', 'small') + arrow(590, 134, 635, 182) + arrow(590, 287, 635, 242) + text(32, 402, 'A section is a meaningful part of a page. A stage renders its spatial content.', 'small'));
save('site-shell', 'Shared layout outside · route content inside',
 box(32, 68, 896, 324, '', 'muted') + box(56, 88, 848, 50, 'Header · navigation and tools', 'accent') +
 box(56, 158, 848, 146, '+page.svelte → one main content area') +
 box(78, 211, 388, 68, 'ContentPage + sections', 'accent') + box(490, 211, 392, 68, 'SpatialElementPage + sections', 'accent') +
 box(56, 324, 848, 48, 'Footer · shared by every route') +
 text(32, 426, '+layout.svelte: PageShell → BrandStageShell → route content + footer', 'small'));
save('element-data', 'One element document, two presentations',
 box(32, 82, 310, 270, 'SpatialElementData', 'accent') + text(52, 156, 'id + title', 'small') + text(52, 198, 'geometry: low + high', 'small') + text(52, 240, 'hdr + fallbackImage', 'small') + text(52, 282, 'features + media + action', 'small') +
 box(468, 82, 460, 126, 'Collection: SpatialListItem[]') + text(488, 149, 'getSpatialListItems(elements, routePrefix)', 'small') + text(488, 180, 'CardGrid or Carousel → native detail links', 'small') +
 box(468, 252, 460, 100, 'Detail: SpatialElementPage') + text(488, 316, 'The original element + your content sections', 'small') + arrow(354, 158, 456, 145) + arrow(354, 281, 456, 300) +
 text(32, 408, 'The layout shares appearance. Each route supplies the content it actually needs.', 'small'));
save('collections', 'Choose how visitors explore a collection',
 box(32, 76, 430, 300, 'CardGrid · compare several items') +
 [0, 1, 2].map(i => box(53 + i * 131, 143, 116, 190, '', 'muted') + model(111 + i * 131, 209, .65) + text(68 + i * 131, 298, 'Item ' + (i + 1), 'small')).join('') +
 box(494, 76, 434, 300, 'Carousel · focus on one item') +
 model(572, 230, .55) + model(711, 203, 1.05) + model(850, 230, .55) + box(618, 280, 186, 64, 'Selected', 'accent') +
 text(32, 418, 'Both layouts use the same element data, theme, posters and detail destinations.', 'small'));
save('detail-layout', 'Detail pages adapt the composition to available space',
 box(32, 77, 266, 308, 'Narrow / regular') + model(165, 177, .8) + box(52, 245, 226, 48, 'Summary', 'accent') + box(52, 309, 226, 52, 'Sections', 'muted') +
 box(336, 77, 592, 308, 'Ultrawide · 3XL') + model(482, 236, 1.15) + box(610, 136, 296, 58, 'Summary / controls', 'accent') + box(610, 208, 296, 151, 'Reading pane', 'muted') +
 text(630, 282, 'Sections scroll here', 'small') + arrow(865, 292, 865, 335) +
 text(32, 424, 'One document scrollbar in both layouts. At the end, the footer covers the stage.', 'small'));
console.log('Generated five documentation SVG diagrams.');
