import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The container ships browser binaries for exactly one Playwright version.
// Fail before building if a dependency update has left either workflow behind.
const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const version = pkg.devDependencies['@playwright/test'];
assert.match(
	version,
	/^\d+\.\d+\.\d+$/,
	'Pin @playwright/test to an exact version matching the CI image.'
);
assert.equal(
	lock.packages[''].devDependencies['@playwright/test'],
	version,
	'Update the lockfile Playwright constraint.'
);
for (const dependency of ['@playwright/test', 'playwright', 'playwright-core']) {
	assert.equal(
		lock.packages[`node_modules/${dependency}`]?.version,
		version,
		`${dependency} must match the CI image version.`
	);
}
for (const workflow of ['verify', 'release']) {
	const source = read(`.github/workflows/${workflow}.yml`);
	const image = source.match(/^\s+image:\s*(\S+)\s*$/m)?.[1];
	assert.equal(
		image,
		`mcr.microsoft.com/playwright:v${version}-noble`,
		`Update ${workflow}.yml to the container for Playwright ${version}.`
	);
}
console.log(`CI images and locked Playwright dependencies agree on ${version}.`);
