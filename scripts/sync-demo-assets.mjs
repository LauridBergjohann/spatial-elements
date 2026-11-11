import { cpSync, mkdirSync } from 'node:fs';
for (const app of ['demo', 'tests', 'website']) {
 const destination = new URL('../apps/' + app + '/static/assets/demo/', import.meta.url);
 mkdirSync(destination, { recursive: true });
 cpSync(new URL('../fixtures/demo-assets/', import.meta.url), destination, { recursive: true });
}
