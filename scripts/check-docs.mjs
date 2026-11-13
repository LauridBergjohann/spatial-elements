import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { compile } from 'svelte/compiler';
import { examplesFrom } from './documentation-examples.mjs';
const root = resolve(import.meta.dirname, '..');
const walk = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
	);
const routes = join(root, 'apps/website/src/routes');
let count = 0;
for (const file of walk(routes).filter((file) => file.endsWith('+page.svelte'))) {
	const source = readFileSync(file, 'utf8');
	for (const example of examplesFrom(source, file)) {
		if (example.language === 'svelte') compile(example.code, { generate: false, filename: file });
		count++;
	}
}
const build = join(root, 'apps/website/build');
if (existsSync(build)) {
	let links = 0;
	for (const file of walk(build).filter(
		(file) => file.endsWith('.html') && !file.endsWith('404.html')
	)) {
		const html = readFileSync(file, 'utf8');
		for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
			const href = match[1].replaceAll('&amp;', '&');
			if (/^(https?:|mailto:|tel:)/.test(href)) continue;
			const url = new URL(
				href,
				'https://docs.test/' +
					file
						.slice(build.length + 1)
						.replaceAll('\\', '/')
						.replace(/index\.html$/, '')
			);
			let target = join(build, decodeURIComponent(url.pathname));
			if (url.pathname.endsWith('/')) target = join(target, 'index.html');
			else if (!existsSync(target)) target = join(target, 'index.html');
			if (!existsSync(target)) throw Error(`Broken link ${href} in ${file}`);
			links++;
		}
	}
	console.log(`Checked ${links} built internal links.`);
}
console.log(`Checked ${count} documentation examples; Svelte snippets compile.`);
