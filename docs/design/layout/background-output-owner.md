# Background output owner and controlled scratch lease

Status: **isolated internal implementation, not connected to StageExperience or
StageRenderPipeline**. The independent [Background output proof](background-layer-output-proof.md)
validated the rendering sequence on demo `91647` / proof `b5a522a`, run `62798`.
That evidence does not yet validate this new class. Its actual implementation
must pass the same GPU pixel, retention and resource checks before integration.

`packages/core/src/stage/BackgroundLayerOutput.ts` owns one full-output-size
RGBA16F, four-sample, depth-enabled target and one public Three `RenderPipeline`.
The sampled node is `texture(target.texture, screenUV)`; the public pipeline
applies the final tone mapping and output conversion exactly once. Scene capture,
panel blur sources, the Canvas, scheduling and route ownership remain external.

## Selection and rendering

`create(renderer, canvas)` performs no draw, clear or compile. The caller must
select the path immediately after renderer initialization, before the first
Background Canvas draw/clear/compile. The class neither detects nor deletes
Three's private implicit framebuffer. Creating it after an implicit target has
already been allocated would violate the intended memory bound.

Only the proven ordinary WebGPU profile is accepted: RGBA16F output, four samples,
depth without stencil, forward/default depth, ACES/sRGB, linear-sRGB working
space, finite positive exposure, complete Canvas viewport with depth range
`0..1`, and no Canvas scissor, XR presentation, foreign OutputRenderTarget/MRT or
custom render-object hook. Exposure is fixed for the owner's lifetime.

- `compose(displayQuad, drawPanels, publish = true)` uses the existing opaque,
  depth-independent display quad. All automatic-clear flags are enabled for that
  draw, so its render pass clears the complete target. Automatic clearing is
  disabled before the unchanged regular/minimap panel draws. Only after both
  phases complete may the owner publish once.
- `clearTransparent(publish = true)` clears color, depth and stencil with zero
  color/alpha, and optionally publishes once. It does not reuse previous color.
- `publish()` returns false if no complete contents exist. It never manufactures
  missing pixels, copies an old frame back or performs hidden preparation.
- `resize()` uses the actual Canvas dimensions and existing target identity.
  The caller retains responsibility for not resizing a held outgoing Canvas.
- `selectFallback()` is terminal. A later supported configuration must not
  recreate an explicit owner in the same Stage instance. `dispose()` is
  idempotent and owns both target and final pipeline cleanup.

A normal complete composition may also be prepared with `publish = false`.
This does not touch Canvas output. Separate publication is appropriate only for
that complete composition; changing scene inputs requires another composition.
The class does not know whether external scene/blur inputs have changed.

## Controlled destructive lease

Uncontrolled borrowing of a retained output target remains forbidden. The
specific `captureScratch()` capability establishes a different ownership
contract:

1. The handle refers to the owner's **same target**, generation and owner. It
   allocates no second target and may neither resize nor dispose the borrowed one.
2. `handle.borrow(draw)` is synchronous and exclusive. Before invoking `draw`,
   the owner sets `contentsValid = false`, even if the callback will do no work
   or throw. Arbitrary destructive intermediate pixels are permitted there.
3. The owner binds the target and restores renderer/target state in `finally`.
   There is no await, deferred callback or outstanding borrowed renderer state.
   Returning a thenable is rejected; this is an internal synchronous API, not
   an executor capable of cancelling arbitrary asynchronous user code.
4. Publication, composition, clearing and another borrow are rejected while the
   lease is active. The callback must never invoke another Canvas-output path.
5. Lease end does **not** validate the pixels. `publish()` stays false after
   success or failure until a complete composition or transparent clear succeeds.
6. Canvas resize/disposal, owner fallback/disposal and external target disposal
   invalidate old handles. A handle may be checked after a GPU fence; it is an
   ownership/profile check, not proof that GPU work finished or that target pixels
   still contain the warmup result. Catalog readiness must retain its own fence.

The final output pipeline is the only rendering reader of the composed target.
Diagnostic target inventory is read-only. Glass and minimaps continue sampling
their distinct scene/blur inputs, so neither ordinary composition nor scratch
work introduces feedback from the attachment being written.

This is a candidate for a later borrowed Catalog warm context. The existing
standalone `CatalogWarmOutputContext` proof remains unchanged and independently
owns its scratch. No borrowed factory or production lifetime is activated here.

## State and failures

Every operation scopes CanvasTarget, RenderTarget with cube face/mip level,
OutputRenderTarget, MRT/render-object callback, viewport/scissor, clear values,
automatic-clear flags, tone mapping/exposure, output color space and XR enabled
state. The outer `finally` also covers a failure inside public
`RenderPipeline.render()`, whose own normal restoration is not an exception
boundary.

Viewport depth ranges are read through public `getViewport(target)` using an
owned `Vector4` subclass that preserves `minDepth/maxDepth` in `copy()`. Restoration
uses the numeric public viewport API. A foreign caller's nondefault range is
preserved. No private Three fields are read or changed.

A real Canvas resize during a callback invalidates the operation and suppresses
publication. Cleanup preserves the resized Canvas viewport instead of replacing
it with the obsolete dimensions. Draw errors propagate; state is restored and
the output stays invalid. Unsupported profiles select terminal fallback before
the next operation. The Stage must then use its unchanged Canvas path.

## Memory and remaining verification

There is one persistent output target, independent of full/scroll scene-quality
sets. Its logical storage is 56 bytes per physical pixel before optional depth
resolve and driver overhead: 8 bytes resolved RGBA16F, 32 bytes multisampled color
and 16 bytes multisampled depth. At 1440 × 1000 this is about 76.9 MiB; it must
replace the implicit Background target. `getRenderTargets()` supports the
existing inventory, and `getStats()` reports mode, generation, validity, borrow
and publication counts. Resource traces must prove the actual allocation bound.

The 35 focused CPU cases cover composition order, complete clears, no publication
inside/after destructive leases, recovery after failures in every phase,
renderer/target restoration, depth ranges, stale resize/dispose handles and
terminal fallback, and the final output's attachment identity. Core type checking
is also required. They cannot establish
GPU equivalence or visible Canvas retention.

The next proof must run this actual class against the unchanged reference:
exact linear and presented-pixel equality, retained source through destructive
borrow plus fence/two RAFs, complete repaired publication, transparent clear,
injected error recovery, resize and no first-use resource surprises. Stage-level
Cancel/Back, held outgoing backgrounds and route binding follow only after that
isolated gate. No frame-time improvement is claimed by this implementation.
