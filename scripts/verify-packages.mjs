import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, '.artifacts', 'packages');
mkdirSync(directory, { recursive: true });
// npm supplies its CLI location on both Windows and Unix; no shell command interpolation.
const npmCli = process.env.npm_execpath;
assert(npmCli, 'Run this check through npm run verify:packages');
const npm = (args, cwd = root) => execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: 'utf8' });
const tarballs = [];
for (const name of ['core', 'sveltekit']) {
  const pkgDir = join(root, 'packages', name);
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  assert.equal(pkg.private, true, 'Scaffold packages must remain unpublished');
  assert.equal(pkg.license, 'MPL-2.0');
  const [packed] = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', directory], pkgDir));
  const files = packed.files.map(file => file.path);
  for (const path of files) assert(/^(dist\/|package\.json$|README\.md$|LICENSE$)/.test(path), 'Unexpected packed file: ' + path);
  for (const required of ['dist/index.js', 'dist/index.d.ts', 'LICENSE', 'README.md']) assert(files.includes(required), 'Missing ' + required);
  assert.equal(readFileSync(join(pkgDir, 'LICENSE'), 'utf8'), readFileSync(join(root, 'LICENSE'), 'utf8'));
  for (const target of Object.values(pkg.exports['.'])) assert(files.includes(target.replace(/^\.\//, '')), 'Unpacked export ' + target);
  tarballs.push(join(directory, packed.filename));
  console.log(pkg.name + ': verified ' + files.length + ' packed files');
}
// A fresh directory avoids a prior install masking packaging failures.
const consumer = join(directory, 'consumer-' + Date.now());
mkdirSync(consumer);
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'package-consumer-check', private: true, type: 'module' }));
// The empty entries do not use framework peers yet. Runtime/SSR peer installation is step 6.
npm(['install', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', ...tarballs], consumer);
for (const name of ['core', 'sveltekit']) assert(realpathSync(join(consumer, 'node_modules', '@spatial-elements', name)).startsWith(resolve(consumer)), 'Consumer unexpectedly linked workspace source');
writeFileSync(join(consumer, 'check.mjs'), "import '@spatial-elements/core';\nimport '@spatial-elements/sveltekit';\nconsole.log('Packed ESM imports passed');\n");
writeFileSync(join(consumer, 'check.ts'), "import * as core from '@spatial-elements/core';\nimport * as integration from '@spatial-elements/sveltekit';\nvoid core; void integration;\n");
console.log(execFileSync(process.execPath, ['check.mjs'], { cwd: consumer, encoding: 'utf8' }).trim());
writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { noEmit: true, strict: true, module: 'NodeNext', target: 'ES2022', types: [] }, files: ['check.ts'] }));
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: consumer, stdio: 'inherit' });
console.log('Packed TypeScript exports passed');
