# Asset and presentation contract

Sources of truth: [product assets](../../packages/core/src/catalog/productAssets.ts), [LOD pairs](../../packages/core/src/catalog/productLodPair.ts), [asset manager](../../packages/core/src/catalog/assets/ProductAssetManager.ts).

Logical product identity is independent of its URL, LOD or number of visible occurrences. An immutable resource request identifies format, URL, revision and decoder/extension requirements. Updating content at a stable URL therefore requires an appropriate revision change.

Low and High must occupy a common authored reference frame, pivot and orientation. Do not independently center/normalize them: that would produce jumps during refinement. Verified manifests use a right-handed frame with +Y up, +Z front and metres. A provisional shared frame is supported, but it does not prove physical dimensions. Physical metadata needs documented provenance.

A representation records its canonical transform, selected root, exclusions, material bindings and estimated costs. Posters provide the non-GPU presentation. Environment and decoder resources must be explicitly deployable by the host. An enum listing a decoder requirement is not a guarantee that every consumer has configured that decoder.

Decoded source geometry/materials belong to the asset manager; live instances, local material clones and render targets belong to presentation owners. A retained capture pins its resources independently of DOM registration. CPU cache residency, live instance ownership and GPU preparation are distinct states. Disposal must respect those boundaries.

Validation should cover frame compatibility, resource URLs/requirements, bounds, material assumptions, actual visual Low/High alignment and ownership after repeated navigation. Estimated texture/geometry bytes are useful budgets, not complete driver memory measurements.

The public procedural fixtures are reproducible and redistributable. Brand production sources, optimized outputs, comparison images and their provenance remain in the private application. See [authoring](../authoring.md) for consumer configuration and [migration audit](../migration-audit.md) for preservation of historical evidence.
