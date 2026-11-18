import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingPackages, releaseTag } from './release-lib.mjs';
import { waitForRegistryVersion } from './registry-visibility.mjs';
const packages = [{ name: '@spatial-elements/core', version: '0.1.0-beta.2' }, { name: '@spatial-elements/sveltekit', version: '0.1.0-beta.2' }];

function registryClock(fetchVersion) {
  let time = 0;
  const messages = [];
  return { fetchVersion: (...args) => fetchVersion(time, ...args), now: () => time,
    sleep: async ms => { time += ms; }, log: message => messages.push(message), messages };
}

test('registry verification tolerates visibility delayed beyond five minutes', async () => {
  const clock = registryClock(async (time, url) => {
    assert.equal(url, 'https://registry.npmjs.org/%40spatial-elements%2Fcore/0.1.0-beta.2');
    return time < 375000 ? { status: 404 } : { ok: true, json: async () => ({ version: packages[0].version }) };
  });
  await waitForRegistryVersion(packages[0], clock);
  assert.equal(clock.now(), 375000);
  assert.match(clock.messages[0], /Waiting for registry/);
  assert.match(clock.messages.at(-1), /Registry available/);
});

test('registry verification stops after fifteen minutes with retry guidance', async () => {
  const clock = registryClock(async () => ({ status: 404 }));
  await assert.rejects(waitForRegistryVersion(packages[0], clock), /timed out after 900s.*rerun Release/);
  assert.equal(clock.now(), 900000);
});

test('temporary registry and network failures retry without hiding invalid metadata or authorization errors', async () => {
  const results = [new TypeError('offline'), new DOMException('timeout', 'TimeoutError'),
    ...[429, 500, 502, 503, 504].map(status => ({ status })),
    { ok: true, json: async () => ({ version: packages[0].version }) }];
  await waitForRegistryVersion(packages[0], registryClock(async () => {
    const result = results.shift();
    if (result instanceof Error) throw result;
    return result;
  }));
  for (const status of [400, 401, 403]) {
    const clock = registryClock(async () => ({ status }));
    await assert.rejects(waitForRegistryVersion(packages[0], clock), /Registry verification failed/);
    assert.equal(clock.now(), 0);
  }
  await assert.rejects(waitForRegistryVersion(packages[0], registryClock(async () =>
    ({ ok: true, json: async () => ({ version: 'wrong' }) }))), /Unexpected registry version/);
});
test('beta defaults to beta; stable versions target latest', () => {
  assert.equal(releaseTag('0.1.0-beta.0'), 'beta');
  assert.equal(releaseTag('1.2.3'), 'latest');
  for (const v of ['1.0.0-rc.1', '01.0.0', '1.0.0;exit', 'beta']) assert.throws(() => releaseTag(v));
});

test('reviewed beta promotion targets latest without affecting subsequent betas', () => {
  assert.equal(releaseTag('1.0.0-beta.3'), 'latest');
  assert.equal(releaseTag('1.0.0-beta.4'), 'latest');
  assert.equal(releaseTag('1.0.0-beta.5'), 'latest');
  assert.equal(releaseTag('1.0.0-beta.6'), 'latest');
  assert.equal(releaseTag('1.0.0-beta.7'), 'latest');
  assert.equal(releaseTag('1.0.0-beta.8'), 'latest');
  assert.equal(releaseTag('1.0.0-beta.9'), 'beta');
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
