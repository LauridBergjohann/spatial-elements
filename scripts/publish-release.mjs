import './check-release.mjs';
import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { missingPackages, releaseTag } from './release-lib.mjs';

const packages = ['core', 'sveltekit'].map(name => JSON.parse(readFileSync('packages/' + name + '/package.json', 'utf8')));
const missing = await missingPackages(packages, async name => {
  const response = await fetch('https://registry.npmjs.org/' + encodeURIComponent(name), { signal: AbortSignal.timeout(30000) });
  return { status: response.status, body: response.ok ? await response.json() : undefined };
});
console.log(missing.length ? 'Unpublished: ' + missing.map(p => p.name + '@' + p.version).join(', ') : 'All versions are already published; no upload.');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'pending=' + (missing.length > 0) + '\n');
if (process.argv.includes('--publish')) {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Publishing requires main');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Publishing requires GitHub Actions');
  assert(process.env.npm_execpath, 'Run through npm');
  // Retry safely after partial publication: only upload missing versions, always core first.
  for (const pkg of missing) {
    const tarball = '.artifacts/packages/' + pkg.name.slice(1).replace('/', '-') + '-' + pkg.version + '.tgz';
    execFileSync(process.execPath, [process.env.npm_execpath, 'publish', tarball, '--access', 'public', '--tag', releaseTag(pkg.version), '--ignore-scripts', '--registry=https://registry.npmjs.org/'], { stdio: 'inherit' });
  }
}
