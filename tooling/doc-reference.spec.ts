import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('documentation references are reproducible without package builds and with CRLF sources', () => {
	const root = resolve(import.meta.dirname, '..');
	const artifacts = join(root, '.artifacts');
	mkdirSync(artifacts, { recursive: true });
	const fixture = mkdtempSync(join(artifacts, 'doc-reference-'));
	try {
		for (const path of [
			'package.json', '.prettierrc.json', 'scripts/generate-doc-reference.mjs',
			'packages/core/package.json', 'packages/core/src',
			'packages/sveltekit/package.json', 'packages/sveltekit/src',
			'apps/website/src/lib/docs/reference.ts', 'apps/website/src/lib/docs/referenceIndex.ts'
		]) {
			mkdirSync(resolve(fixture, path, '..'), { recursive: true });
			cpSync(join(root, path), join(fixture, path), { recursive: true });
		}
		// Share installed dependencies, but deliberately do not copy workspace dist directories.
		symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
		const check = () => {
			const result = spawnSync(process.execPath, ['scripts/generate-doc-reference.mjs', '--check'], {
				cwd: fixture, encoding: 'utf8', timeout: 30000
			});
			expect(result.status, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`).toBe(0);
		};
		check();
		const useWindowsLineEndings = (directory: string) => {
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const path = join(directory, entry.name);
				if (entry.isDirectory()) useWindowsLineEndings(path);
				else if (/\.(ts|svelte)$/.test(entry.name)) {
					writeFileSync(path, readFileSync(path, 'utf8').replace(/\r?\n/g, '\r\n'));
				}
			}
		};
		useWindowsLineEndings(join(fixture, 'packages'));
		check();
	} finally {
		// This is only the unique fixture created above; rm does not follow its dependency junction.
		rmSync(fixture, { recursive: true, force: true });
	}
}, 90000);
