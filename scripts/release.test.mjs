import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingPackages, releaseTag } from './release-lib.mjs';
const packages = [{ name: '@spatial-elements/core', version: '0.1.0-beta.2' }, { name: '@spatial-elements/sveltekit', version: '0.1.0-beta.2' }];
test('beta never targets latest; stable versions do', () => {
  assert.equal(releaseTag('0.1.0-beta.0'), 'beta');
  assert.equal(releaseTag('1.2.3'), 'latest');
  for (const v of ['1.0.0-rc.1', '01.0.0', '1.0.0;exit', 'beta']) assert.throws(() => releaseTag(v));
});
test('new packages preserve dependency-first upload order', async () => {
  assert.deepEqual(await missingPackages(packages, async () => ({status:404})), packages);
});
test('documentation merges with published versions are no-ops', async () => {
  assert.deepEqual(await missingPackages(packages, async () => ({status:200,body:{versions:{'0.1.0-beta.2':{}}}})), []);
});
test('retry after core succeeded publishes only the adapter', async () => {
  assert.deepEqual(await missingPackages(packages, async name => ({status:200,body:{versions:name.endsWith('/core')?{'0.1.0-beta.2':{}}:{}}})), [packages[1]]);
});
test('network, authorization and invalid responses cannot be treated as missing versions', async () => {
  for (const status of [401,403,429,500]) await assert.rejects(missingPackages(packages, async () => ({status})));
  await assert.rejects(missingPackages(packages, async () => ({status:200,body:{}})));
  await assert.rejects(missingPackages(packages, async () => { throw Error('offline'); }));
});
