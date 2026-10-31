# Background preparation notifications

`CatalogPreparation.prepare()` exposes an already cached environment as `ready`
synchronously. Its environment promise still completes through the normal
microtask/gate path. Reassigning `ready` to the same ready entry must not emit
another `changed()` notification: Stage maps that notification to a complete
render request even when no visible state changed.

Notifications now require a real background-state change on the current,
non-aborted preparation owner. Actual `loading → ready` and `loading → failed`
changes still notify. Successful loading retains the existing preparation gate;
the change neither delays resource loading nor changes High preparation. Retired
and aborted entries cannot emit late background notifications or mutate their
previous state.

The code-level duplicate is independently reproducible with a resolved cached
environment promise. Its connection to the remaining source frame was initially
a hypothesis: the first trace lacked a registration stack for that request and
its 1 ms CPU sampler missed the brief call. The subsequent isolated runtime fix
provides before/after evidence for that connection; it does not retroactively
add a call stack to the older trace.

## Trace comparison

The preserved cold Carousel traces use Chrome `156.0.8078.79` and identical
instrumentation options (including CPU sampling and asynchronous diagnostic GPU
fences):

- Before: build `70245`, runtime `8eaf276`,
  `.artifacts/staged-gpu-trace-70245-8eaf276-carousel-cold`.
- After: build `36109`, runtime `be72259`,
  `.artifacts/staged-gpu-trace-36109-be72259-carousel-cold`.

Both start with an idle Stage, no pending Stage RAF, and no speculative
preparation entry. Times in the following table are milliseconds from the
trace's click-dispatch start. RAF identifiers belong only to their own run.

| Observation | Before | After |
| --- | --- | --- |
| Activation-focus RAF registered inside focusin | RAF212 at +10.749 | RAF150 at +3.935 |
| Activation-focus callback | +39.513, 0.185 ms | +18.465, 0.142 ms |
| Extra Stage RAF registered in the post-click microtask | RAF214 at +20.392 | Absent |
| Source frame before the adapter | RAF214 at +39.888, 60.331 ms, 39 submits | Absent; zero submits |
| Stage request queued by the deferred focus callback | Existing RAF214 already pending | RAF154 at +18.571 |
| Deferred focus request consumed by transition takeover | Too late to prevent RAF214 | RAF154 cancelled at +34.198, never fired |
| GPU resource creations before the adapter | Zero | Zero |

The focus callback remains present and short in both runs. After removing the
unchanged readiness notification, there is no intervening source draw: Kit's RAF
queues its timer, the timer reaches the adapter, and the existing transition
takes ownership before the deferred focus frame executes. This observed change,
together with the isolated code change and readiness-notification units, supports
attributing the redundant source frame to the cached-environment notification.
It is an intervention-based attribution, not a captured registration stack.

The new run's application timing markers report adapter entry at +24.5 ms,
first motion at +46.7 ms and first submission at +70.1 ms. Those markers use the
original event timestamp, slightly different from the trace-dispatch origin used
in the table. These are single profiled diagnostic observations, **not latency or
frame-smoothness acceptance**. No historical data, performance threshold or
measurement protocol was changed; repeated unprofiled cohorts remain separate.
