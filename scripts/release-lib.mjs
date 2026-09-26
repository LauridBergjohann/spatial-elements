import assert from 'node:assert/strict';

export function releaseTag(version) {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-beta\.(0|[1-9]\d*))?$/, 'Expected stable or beta semver');
  return version.includes('-beta.') ? 'beta' : 'latest';
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
