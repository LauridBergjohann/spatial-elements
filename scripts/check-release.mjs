import assert from 'node:assert/strict';
import { releaseTag } from './release-lib.mjs';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const root = read('package.json');
const apps = ['apps/demo/package.json', 'apps/tests/package.json', 'apps/website/package.json'].map(read);
const core = read('packages/core/package.json');
const adapter = read('packages/sveltekit/package.json');
const pre = existsSync(new URL('../.changeset/pre.json', import.meta.url)) ? read('.changeset/pre.json') : undefined;
const pending = readdirSync(new URL('../.changeset/', import.meta.url)).filter(file => file.endsWith('.md') && file !== 'README.md' && !pre?.changesets?.includes(file.slice(0,-3)));
assert.equal(pending.length, 0, `Run npm run release:version and commit the result in this PR: ${pending.join(', ')}`);
const lock = read('package-lock.json');
for (const [directory, pkg] of [['core',core],['sveltekit',adapter]]) assert.equal(lock.packages['packages/'+directory]?.version,pkg.version,'Stale package-lock version');
assert.equal(lock.packages['packages/sveltekit'].dependencies[core.name],core.version,'Stale core dependency in lockfile');
assert.equal(root.private, true);
for (const app of apps) assert.equal(app.private, true);
const tag = releaseTag(core.version);
assert.equal(adapter.version, core.version);
assert.equal(adapter.dependencies[core.name], core.version);
for (const pkg of [core, adapter]) {
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.publishConfig.tag, tag);
  assert(readFileSync(new URL('../' + pkg.repository.directory + '/CHANGELOG.md', import.meta.url), 'utf8').includes('## ' + pkg.version));
  assert.equal(pkg.publishConfig.registry, 'https://registry.npmjs.org/');
  assert.equal(pkg.license, 'MPL-2.0');
  for (const app of apps) assert.equal(app.dependencies[pkg.name], core.version);
  for (const version of Object.values(pkg.dependencies ?? {}))
    assert(!/^(file:|link:|workspace:)/.test(version), 'Local dependency in published package');
}
if (process.env.RELEASE_VERSION) assert.equal(core.version, process.env.RELEASE_VERSION);

console.log('Release metadata verified: ' + core.version + ' (' + tag + ')');
