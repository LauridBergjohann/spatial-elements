# Development across repositories

Clone spatial-elements and the private spatial-elements-brand-examples as sibling directories.
The public repository never imports or needs the private one. The private app uses npm file:
dependencies pointing to the two built package directories, with ordinary package-name imports.

1. Public repo: npm ci, npm run assets:demo, npm run build.
2. Public repo, persistent terminal: npm run dev (watches both package outputs).
3. Private repo: npm ci, then npm run dev in another terminal.
4. To use the public demo instead: npm run demo in the public repo.

Vite resolves workspace/file links to the built files and deduplicates svelte and three. It allows
the sibling checkout for development. No source copy, source alias or global npm link is required.
After dependency changes run npm install in the affected repository. The lockfiles are committed.
Changes to package exports/configuration may require a dev-server restart.

## Test the delivered artifacts

Public: npm run verify:packages builds an independent consumer from existing package builds. Run
npm run verify for the full build-first pipeline. Its metadata and logs live in .artifacts/packages.
The installed consumer remains in the OS temporary directory for investigation.

Private: npm run packages:packed builds/packs both sibling packages and installs the tarballs with
--no-save and --package-lock=false. It verifies that installed directories are real copies. Run the
private check/build/browser tests in this mode. npm run packages:link restores the file-linked
installation from the committed lockfile. Stop dev servers before switching modes. Packed mode is
for release checks, not live editing. Tarballs remain in ignored .local-packages; source manifests
and lockfiles do not change.
