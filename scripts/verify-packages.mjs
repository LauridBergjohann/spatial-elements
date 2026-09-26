import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, realpathSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, '.artifacts', 'packages');mkdirSync(directory, {recursive:true});
const npmCli = process.env.npm_execpath;assert(npmCli, 'Use npm run verify:packages');
const npm = (args, cwd=root) => execFileSync(process.execPath,[npmCli,...args],{cwd,encoding:'utf8',maxBuffer:20*1024*1024});
const tarballs = {};
for(const name of ['core','sveltekit']) {
 const pkgDir=join(root,'packages',name),pkg=JSON.parse(readFileSync(join(pkgDir,'package.json'),'utf8'));
 assert.equal(pkg.private,true,'Release requires a separate decision');assert.equal(pkg.license,'MPL-2.0');
 const [packed]=JSON.parse(npm(['pack','--ignore-scripts','--json','--pack-destination',directory],pkgDir));
 const files=packed.files.map(file=>file.path);
 for(const file of files) {
  assert(!/Product[A-Z]|product[A-Z]|product-detail/.test(file),'Outdated artifact name: '+file);
  assert(/^(dist\/|package\.json$|README\.md$|LICENSE$)/.test(file),'Unexpected packed file: '+file);
  assert(!/\.(spec|test|e2e)\.|generated\/|\.(glb|hdr|png)$/.test(file),'Fixture in runtime package: '+file);
 }
 for(const required of ['dist/index.js','dist/index.d.ts','LICENSE','README.md'])assert(files.includes(required),'Missing '+required);
 assert.equal(readFileSync(join(pkgDir,'LICENSE'),'utf8'),readFileSync(join(root,'LICENSE'),'utf8'));
 for(const value of Object.values(pkg.exports['.']))assert(files.includes(value.slice(2)),'Missing exported file '+value);
 tarballs[pkg.name]='file:'+join(directory,packed.filename).replaceAll('\\','/');console.log(pkg.name+': '+files.length+' allowlisted files');
}
// Outside the repository: no parent node_modules or workspace aliases can mask a missing dependency.
const consumer=mkdtempSync(join(tmpdir(),'spatial-elements-consumer-'));
cpSync(join(root,'apps/sveltekit-demo/src'),join(consumer,'src'),{recursive:true});
cpSync(join(root,'fixtures/demo-assets'),join(consumer,'static/assets/demo'),{recursive:true});
for(const file of ['svelte.config.js','vite.config.ts','tsconfig.json'])cpSync(join(root,'apps/sveltekit-demo',file),join(consumer,file));
const workspace=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const dependencies={...tarballs};
for(const name of ['@sveltejs/kit','@sveltejs/package','@sveltejs/vite-plugin-svelte','@sveltejs/adapter-auto','svelte','svelte-check','vite','typescript','three','@types/three','@types/node'])dependencies[name]=workspace.devDependencies[name];
writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'spatial-elements-consumer-check',private:true,type:'module',scripts:{check:'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',build:'vite build'},dependencies},null,2));
console.log('Installing independent consumer: '+consumer);
console.log(npm(['install','--no-audit','--no-fund'],consumer));
for(const name of ['core','sveltekit'])assert(realpathSync(join(consumer,'node_modules/@spatial-elements',name)).startsWith(resolve(consumer)),'Workspace link escaped isolation');
writeFileSync(join(consumer,'check.mjs'),"import { StageExperience, SpatialElementAssetManager } from '@spatial-elements/core';\nif(typeof StageExperience !== 'function' || typeof SpatialElementAssetManager !== 'function') throw Error('Missing runtime exports');\nconsole.log('Core imports without a DOM/GPU');\n");
console.log(execFileSync(process.execPath,['check.mjs'],{cwd:consumer,encoding:'utf8'}));
for(const script of ['check','build']) {
 try {const output=npm(['run',script],consumer);writeFileSync(join(directory,'consumer-'+script+'.log'),output);console.log('Packed consumer '+script+' passed');}
 catch(error){console.error(error.stdout?.toString());throw error;}
}
writeFileSync(join(directory,'consumer.json'),JSON.stringify({path:consumer,verifiedAt:new Date().toISOString()},null,2));
console.log('Verified tarball installation, declarations, Svelte SSR and production build');
