import { readFileSync, writeFileSync } from 'node:fs';
import { releaseTag } from './release-lib.mjs';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const save = (p, d) => writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
const version = read('packages/core/package.json').version;
const adapter = read('packages/sveltekit/package.json');
if (adapter.version !== version) throw Error('Fixed package versions diverged');
adapter.dependencies['@spatial-elements/core'] = version;
save('packages/sveltekit/package.json', adapter);
const appPaths = ['apps/sveltekit-demo/package.json', 'apps/showcase/package.json'];
const apps = appPaths.map(read);
for (const name of ['core', 'sveltekit']) {
  const p = 'packages/' + name + '/package.json';
  const pkg = read(p);
  pkg.publishConfig.tag = releaseTag(version);
  save(p, pkg);
  for (const app of apps) app.dependencies[pkg.name] = version;
}
appPaths.forEach((path, index) => save(path, apps[index]));
