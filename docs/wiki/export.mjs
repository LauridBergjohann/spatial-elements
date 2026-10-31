import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, copyFile, stat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const repository = resolve(source, '../..');
const destination = resolve(repository, '.artifacts/wiki-export');
const tokens = JSON.parse(await readFile(resolve(repository, 'packages/core/src/spatial-element/layoutTokens.json'), 'utf8'));
const scalar = value => typeof value === 'object' ? JSON.stringify(value) : String(value);
function table(rows) {
  const columns = [...new Set(rows.flatMap(([, value]) => Object.keys(value)))];
  return `| Name | ${columns.join(' | ')} |\n| --- | ${columns.map(() => '---').join(' | ')} |\n` +
    rows.map(([name, value]) => `| ${name} | ${columns.map(column => value[column] === undefined ? '—' : scalar(value[column])).join(' | ')} |`).join('\n');
}
function renderTokens() {
  const sections = ['# Canonical layout tokens', '',
    'Generated from the same `layoutTokens.json` consumed by the pure resolvers and CSS generator. Values are CSS pixels unless a field explicitly describes a ratio, count, span or font weight. Regenerate with `node docs/wiki/export.mjs --write`.', ''];
  for (const [name, values] of Object.entries(tokens)) {
    sections.push(`## ${name}`, '');
    if (typeof values !== 'object') sections.push(String(values));
    else if (Object.values(values).every(value => typeof value !== 'object'))
      sections.push('| Token | Value |', '| --- | --- |', ...Object.entries(values).map(([key, value]) => `| ${key} | ${value} |`));
    else if (name === 'carousel') {
      sections.push('| Token | Value |', '| --- | --- |', ...Object.entries(values).filter(([key]) => key !== 'layouts').map(([key, value]) => `| ${key} | ${value} |`), '', table(Object.entries(values.layouts)));
    } else sections.push(table(Object.entries(values)));
    sections.push('');
  }
  return sections.join('\n');
}
const generated = renderTokens();
const reference = resolve(source, 'Layout-Tokens.md');
if (process.argv.includes('--write')) await writeFile(reference, generated);
else if (await readFile(reference, 'utf8').catch(() => '') !== generated)
  throw new Error('Layout-Tokens.md is stale; run node docs/wiki/export.mjs --write.');

const pages = (await readdir(source)).filter(name => name.endsWith('.md'));
const images = (await readdir(resolve(source, 'images'))).map(name => `images/${name}`);
const inputs = [...pages, ...images];
const manifest = [];
for (const name of pages) {
  const content = await readFile(resolve(source, name), 'utf8');
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1].split('#')[0];
    if (!link || /^[a-z]+:/i.test(link)) continue;
    const path = resolve(source, link);
    if (relative(source, path).startsWith('..')) throw new Error(`${name}: link leaves the portable wiki: ${link}`);
    if (!(await stat(path).catch(() => undefined))?.isFile()) throw new Error(`${name}: broken link ${link}`);
  }
}
if (!process.argv.includes('--check')) {
  await mkdir(resolve(destination, 'images'), { recursive: true });
  for (const name of inputs) {
    const input = resolve(source, name), output = resolve(destination, name);
    if (name.endsWith('.md')) {
      const text = await readFile(input, 'utf8');
      // GitHub Wiki page URLs have no .md suffix; image URLs remain unchanged.
      await writeFile(output, text.replace(/\]\(([^)]+)\.md(#[^)]*)?\)/g, ']($1$2)'));
    } else await copyFile(input, output);
    manifest.push({ file: name, sha256: createHash('sha256').update(await readFile(output)).digest('hex') });
  }
  await writeFile(resolve(destination, 'export-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`Validated ${pages.length} pages and ${images.length} images${process.argv.includes('--check') ? '' : `; exported to ${destination}`}. No publishing was performed.`);
