import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const root = read('package.json');
const demo = read('apps/sveltekit-demo/package.json');
const core = read('packages/core/package.json');
const adapter = read('packages/sveltekit/package.json');
assert.equal(root.private, true);
assert.equal(demo.private, true);
assert.match(core.version, /^0\.1\.0-beta\.[1-9]\d*$/, 'This release process targets the 0.1.0 beta series');
assert.equal(adapter.version, core.version);
assert.equal(adapter.dependencies[core.name], core.version);
for (const pkg of [core, adapter]) {
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.publishConfig.tag, 'beta');
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/');
  assert.equal(pkg.license, 'MPL-2.0');
  assert.equal(demo.dependencies[pkg.name], core.version);
  for (const version of Object.values(pkg.dependencies ?? {}))
    assert(!/^(file:|link:|workspace:)/.test(version), 'Local dependency in published package');
}
if (process.env.RELEASE_VERSION) assert.equal(core.version, process.env.RELEASE_VERSION);
assert(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').includes('## ' + core.version));
console.log('Release metadata verified: ' + core.version + ' (beta)');
