# Package boundaries

## core

Owns the future framework-independent rendering, asset lifecycle, LOD, product identity, pose and
transition mechanisms. It must not depend on Svelte, SvelteKit, application routes or demo content.
Browser/GPU work must start through explicit runtime initialization, never at package import.
Three.js dependency ownership will be established during runtime extraction; it is not yet needed
by this empty scaffold.

## sveltekit

Owns Svelte components, snippets/content composition, DOM registration, lifecycle and SvelteKit
navigation/preloading/history integration. Imports core by its package name. Framework-independent
algorithms must not migrate here merely because they currently live in a SvelteKit app.
Svelte and SvelteKit are peer dependencies; development tooling is pinned in the root workspace.

## Public API

Both packages currently expose only the root entry point, with types and ESM exports. The SvelteKit
package also provides the svelte condition and preserves CSS side effects. Their entry points are
intentionally empty. Do not invent substitute components or freeze internal renderer/controller APIs
before extraction. Internal subpaths are not exported.

Package builds use tsc (core) and @sveltejs/package (sveltekit). npm workspace linking resolves the
matching 0.0.0 core dependency locally. No registry version or workspace-specific dependency protocol
is required. Consumer verification installs actual tarballs outside the workspace source graph.

The root and both packages remain private. Removing package-level private flags and selecting release
versions is a separate release step. There is no publish workflow or npm token in this repository.

References: [Svelte packaging](https://svelte.dev/docs/kit/packaging),
[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/).
