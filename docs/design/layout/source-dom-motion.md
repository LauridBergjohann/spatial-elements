# Moving the mounted source in its existing CSS3D parent

The first navigation phase moves the actual source node. It does not clone, append, remove, or reparent DOM, and it does not prepare destination renderer resources. The source's border box and container-query width remain fixed while its visible projection changes. Destination wrapping and additional intrinsic height belong to the later content phase.

## Correcting the local plane instead of guessing its ancestors

A card, a carousel summary, and a spatial panel can sit below different perspective and transform ancestors. Applying a viewport translation directly as the child's CSS transform would apply those ancestor projections a second time.

The captured clockwise quad defines a planar homography `H0` from the source's local border box to viewport pixels. At each frame, interpolation defines the desired viewport quad and its homography `H(t)`. If `M0` is the source's original local transform, including its transform origin, the replacement is:

```text
M(t) = M0 × inverse(H0) × H(t)
```

The correction is multiplied on the right, in the source's local plane. Existing perspective ancestors therefore remain part of the actual browser projection. No reconstruction of their complete CSS3D matrix chain is necessary. At progress zero the correction is the identity. This guarantee concerns the captured border-box plane; the geometry's own three-dimensional presentation remains controlled by its renderer.

`sourceDomProjectiveMatrix(quad, width, height)` exports the same column-major 4×4 homography for renderer surfaces. `createSourceDomMotion(...).update(progress)` returns the current viewport quad after applying it to the original node, allowing DOM and retained glass geometry to be updated and flushed in one frame.

## Box and lifetime ownership

The helper fixes the captured local width and height, not `getBoundingClientRect()`'s perspective-distorted dimensions. It preserves every inline declaration that it owns, including declaration priority. CSS transitions and animations on the source transform are disabled for the motion so they cannot lag behind frame updates. `restore()` is idempotent and restores the source declarations; `hide()` is available for the later handoff.

The target's default height preserves the source aspect ratio at the requested target width. An explicitly supplied height supports a known compact dock surface. Neither option reflows the source content. Independent authored CSS `translate`, `rotate`, or `scale` properties currently cause the helper to decline; their additional transform order must be captured explicitly before supporting them.

The caller freezes competing mouse/sensor/renderer transform writers. It also owns inherited presentation values, renderer leases, source interactivity and clipping ancestors. A transformed node cannot escape an ancestor clip without changing that ancestor or its placement. The enhanced carousel uses visible overflow; the native horizontal rail remains on the ordinary navigation path. When the content phase finally reparents a retained node, its projection must be rebased into the new host's coordinate system in that same handoff task.

## Verification

```sh
npx vitest run packages/core/src/catalog/SourceDomMotion.spec.ts
npx playwright test --config playwright.source-dom-motion.config.ts
```

The numerical tests combine a perspective parent, rotations around multiple axes, a nonzero local transform origin and multiple interpolation positions. They also check degenerate capture rejection and an explicit dock endpoint.

The independent browser fixture uses actual CSS perspective and nested rotations. At progress 0, 0.2, 0.5, 0.8 and 1, all four measured corner markers matched their requested quad within 0.05 CSS pixels. The source stayed in the same parent with the same focused edited input, its local box stayed 280×180 pixels, its container-query typography did not change, and a child-list observer recorded zero DOM mutations. Cancellation restored the original projected corners and inline declarations. The browser case passed; its endpoint screenshot is written to `.artifacts/source-dom-motion`.

## Staged lifetime controller

`StagedCatalogTransition` sequences these operations without depending on SvelteKit. Its `start()` synchronously applies the initial source pose and returns the early-navigation handle. The moving phase uses the existing `MOTION_DURATION` and ease-out curve, fades only explicitly supplied outgoing branches, and submits the matching DOM quads and geometry progress through one frame hook. An outgoing branch containing a retained actor is never faded as a whole. Source actors are inert while owned by the transition.

The last moving frame is submitted before a later animation frame invokes `hold`. This gives the browser a paint opportunity before any permitted handoff work. `hold` receives final quads, an AbortSignal, and `releaseDomStyles()`. The handoff calls that release immediately before moving the real retained node and applying the new host's viewport homography in the same task. Later cleanup consequently cannot overwrite its new placement. Only a successful hold resolves the navigation handle as true.

After routing and restoration, `reveal(incoming, prepare)` hides supplied incoming branches before invoking the preparation callback. Adoption, unfreezing and destination reflow belong to that callback, followed by the 300ms content reveal. Reduced Motion retains the phase boundaries with no artificial duration. Cancellation restores source styles and interactivity, stops frame scheduling, aborts asynchronous hooks, and releases waiting promises exactly once. A failed start rolls back before interception; a failed hold rejects the handle so the adapter can use ordinary routing.

Unit tests exercise each cancellation phase, stalled asynchronous hooks, exact cleanup ownership, failure rollback, reveal ordering and Reduced Motion. Browser tests extend the same real CSS3D fixture to check motion timestamps, absence of child-list mutations during movement, subpixel handoff continuity, deferred content construction, cancellation and Reduced Motion.
