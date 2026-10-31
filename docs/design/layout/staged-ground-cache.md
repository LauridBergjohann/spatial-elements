# Reusing unchanged Ground silhouettes

The trusted Pointer trace of Demo53025/runtime02dc683 verified the winding-readiness
fix: no Ground pipeline or other GPU resource was created from activation through first
submission, source movement or reveal. It still showed four positive-exit-opacity moving
draws with 49 submissions and 26–37 ms callbacks. Once the rear faded completely, draws
dropped to 14 submissions and mostly 9–14 ms. These profiled timings identify work;
they are not unprofiled latency acceptance.

The optional cache below targets only the black projected Ground silhouettes. It does
not cache the selected model, colored rear models, DOM panels, or the live glass surface.
For each silhouette, `NoBlending` writes constant black and uniform alpha into the same
bounded DepthBlur scratch image. Its Gaussian uses ordinary weighted sums, without
premultiply/unpremultiply conversions. Consequently a frozen silhouette can be captured
at alpha one and its blurred result multiplied by `entry.opacity * exitOpacity` later.
HalfFloat/output rounding still requires a GPU pixel comparison; algebra alone is not
the acceptance proof.

## Separate shadows and unchanged composition

Each shadow retains its own resolved image and is composited in the original order.
Overlapping shadows cannot be combined into one globally faded image: their attenuation
is `(1-a1*p)*(1-a2*p)`, not a linear interpolation of the combined endpoint. The existing
`<= 0.001` visibility cutoff also remains. The selected geometry and glass continue to
render live, and colored rear geometry retains the existing renderer path.

At most eight resolved-only 256×256 RGBA16F targets are retained: 4 MiB of color pixels,
with no additional depth, MSAA, mipmaps, or per-shadow Gaussian scratch. The original
512² capture and two Gaussian intermediates are shared for preparation. Texture storage
overhead and uniforms are additional implementation overhead, not part of this pixel
payload figure. Additional shadows use the live path.

## Lifetime and validity

Preparation runs only through the existing idle preparation owner, when the catalog pose
has settled. It uses the current resources and publishes readiness only after the existing
GPU queue fence. Separate Canvas/offscreen composite owners preserve both pipeline
variants. Source freeze and moving draws never allocate a missing image or run cache
preparation. A cache miss is an ordinary live shadow draw.

The same signature permits reuse in normal focus/hover frames. The cache never assumes
that a pointer or sensor pose is unchanged: a changed per-shadow matrix immediately
uses the live path. This also avoids recapturing unchanged background shadows in a
focus-triggered frame before SvelteKit reaches the navigation adapter.

The cache copy owns a separate render object, so its HalfFloat target does not evict the
live resolve's output pipeline. Live and cached output composites share the same scissor
semantics. Only explicit idle preparation preserves the real Canvas's zero-area scissor;
offscreen copies remain complete. Errors restore the borrowed scissor and viewport.

Validity includes the Stage target/readiness signature (revision, viewport/drawing-buffer
dimensions, coordinate system and environment), camera matrices, projected shadow
matrices, source geometry identity and attribute/index versions, visibility, draw range,
groups, and the viewport. The clipped crop and blur radius are fixed for that state.
Skinning, morph targets, InstancedMesh and InstancedBufferGeometry use the live path. Pose or target changes invalidate
reuse immediately; they can refresh only at a later idle opportunity. Failure clears
validity and retains live fallback without an idle retry loop for the same state.

Targets are reused on a new eligible pose. Owners outside the bounded selected set are
released before replacements are allocated. Removal/replacement of the source shadow,
route teardown, and disposal release its cache together with the owned shadow material;
asset geometry remains shared and is never disposed by this cache.

## Required proof

`/proof/ground-shadow-cache` and `tests/ground-shadow-cache.e2e.ts` compare the actual live
and cached renderer for two demonstrably overlapping silhouettes, six exit opacities,
and both RGBA16F/RGBA8 destinations. The fixture also detects the wrong merged-alpha
shortcut, active caller-scissor parity and immediate live fallback after source/camera mutation. Predeclared
comparison limits are two half-float ULPs below one (`1/1024`) for the linear HalfFloat
output, or one 8-bit step for RGBA8. These storage-rounding limits are not frame-pacing
or latency concessions.

CPU tests cover owner bounds/order, target reuse/release, invalidation, no preparation
during motion, failed capture restoration and subsequent live fallback.

## Recorded pixel result, build 95956

The normal-Mesh proof passes all twelve opacity/format rows. Its two individual silhouettes
overlap in 834 pixels. Maximum linear HalfFloat error is 0.0009765625, exactly the
predeclared 1/1024 bound; RGBA8 error is one 8-bit step (plus binary-number representation
error within the declared 1e-12 epsilon). The incorrect merged-shadow shortcut differs
by 0.00732421875, so this is not a disjoint-shadow test that would miss that error.

Each unchanged nonzero-opacity row uses two cached draws and zero live draws. Moving
one source uses one cached/one live draw; moving the camera uses zero cached/two live
draws. The active caller-scissor cases satisfy the same pixel bounds and restore the
scissor flag. These results establish bounded pixel equivalence for the tested static
normal meshes, not arbitrary deformed or instanced assets.

The first run passed but its line reporter discarded the successful inline attachment.
A single unchanged-build/unchanged-threshold recording repeat also passed and wrote
`ground-cache-pixel-proof.json` under `.artifacts/ground-shadow-cache-95956-recorded/`.
The original run remains under `.artifacts/ground-shadow-cache-95956/`; neither run was
discarded or retried in response to a failed pixel assertion.

After that GPU proof, InstancedMesh/InstancedBufferGeometry were conservatively excluded
from eligibility. Fifteen focused CPU tests, including both new live-fallback cases, pass;
the earlier broader Ground/preparation suite passed 39 tests. This final exclusion does
not claim a separate GPU instancing proof. The next coherent build must include it.

**Production navigation regression and unprofiled performance effect remain unverified
for this cache. Pixel correctness does not establish a frame-time improvement.**
