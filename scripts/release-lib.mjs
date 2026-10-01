import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Explicit, reviewed exceptions apply only to the named release, never future betas.
const channels = JSON.parse(readFileSync(new URL('../release-channels.json', import.meta.url), 'utf8'));
for (const [version, tag] of Object.entries(channels)) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-beta\.(0|[1-9]\d*)$/);
  assert.equal(tag, 'latest', 'Only explicit beta promotion to latest is supported');
}

export function releaseTag(version) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-beta\.(0|[1-9]\d*))?$/, 'Expected stable or beta semver');
  return channels[version] ?? (version.includes('-beta.') ? 'beta' : 'latest');
}

export async function missingPackages(packages, fetchMetadata) {
  const missing = [];
  for (const pkg of packages) {
    const result = await fetchMetadata(pkg.name);
    if (result.status === 404) { missing.push(pkg); continue; }
    assert.equal(result.status, 200, 'Registry lookup failed for ' + pkg.name);
    assert(result.body && typeof result.body.versions === 'object', 'Invalid registry metadata');
    if (!Object.hasOwn(result.body.versions, pkg.version)) missing.push(pkg);
  }
  return missing;
}
