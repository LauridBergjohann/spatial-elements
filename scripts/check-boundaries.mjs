import {readdirSync,readFileSync} from 'node:fs';import assert from 'node:assert/strict';
for(const pkg of ['core','sveltekit'])for(const file of readdirSync(new URL('../packages/'+pkg+'/src/',import.meta.url),{recursive:true})){
 if(!/\.(ts|svelte|css)$/.test(file))continue;const text=readFileSync(new URL('../packages/'+pkg+'/src/'+file.replaceAll('\\','/'),import.meta.url),'utf8');
 assert(!/\$lib\/|\/routes\//.test(text),'Application dependency: '+file);
 if(pkg==='core')assert(!/(?:from\s*|import\s*\()['"](?:svelte|@sveltejs|\$app|\$env)/.test(text),'Framework dependency: '+file);
 assert(!/wurm|wera|rolex|asv101|hks-g4/i.test(text),'Private brand data: '+file);
}
console.log('Framework and application boundaries passed');
