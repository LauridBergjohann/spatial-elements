import { rmSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
if (!['core', 'sveltekit'].includes(name)) throw new Error('Expected a known package name');
const output = fileURLToPath(new URL('../packages/' + name + '/dist', import.meta.url));
try {
  if (lstatSync(output).isSymbolicLink()) throw new Error('Refusing to clean a linked output directory');
  rmSync(output, { recursive: true, force: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
