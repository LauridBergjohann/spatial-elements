# Final-frame paint opportunity

Completing a Promise inside the last reveal RAF schedules its continuations as
microtasks before paint. Previously the same frame therefore also restored DOM
styles, released retained roots and GPU captures, rebuilt interaction outlines,
and rendered the settled stage again.

The transition now waits for a following RAF after final reveal **and** any final
summary commit, before calling `complete()`. This gives the final visible state a
paint opportunity before the heavier cleanup. It is not a guarantee of a physical
display presentation. The summary commit stays before the barrier: the persistent
source instance and its edited state already belong to the destination when that
final state can paint. No placeholder instance is substituted during the wait.

The phase remains `committing`, with ownership retained. Cancellation, history,
supersession and destruction cancel the scheduled RAF and resolve the wait through
the existing stopped signal. A generation check prevents stale completion and
duplicate release. Reduced Motion uses the same paint ordering without adding an
animation-duration delay.

The final `reveal(1)` submission and `revealEnded` marker are unchanged. Only
completion and cleanup move later. No performance gate or raw measurement is
changed. Work performed by the final render or the summary commit itself remains
before this barrier; moving cleanup does not make that earlier work cheaper.

Controller units cover normal and Reduced Motion completion, asynchronous final
commit, cancellation/history/supersession in the new interval, stale callbacks and
exactly-once ownership release. The separate `staged-cleanup-paint` browser proof
checks the actual edited Svelte textarea's identity at the committed endpoint and
after cleanup for Hero and Dock. It records observations without changing the
timing markers.

Validation on production build 70245 / runtime `8eaf276`: both real summary
browser cases passed (runner 89439, exit 0). Each sampled the committed endpoint
before completion with exactly one textarea, the same connected destination
node, and its edited value intact. Both retained that same instance and value
after cleanup. The two `final-paint-summary.json` files are stored under
`.artifacts/staged-cleanup-paint-70245-8eaf276/`. These are functional identity
checks, not performance measurements.

A separate profiled cold Carousel run on the same build also recorded actual
renderer paint events between the endpoint and cleanup. Times below are relative
to the unchanged `revealEnded` marker:

| Trace event | Start | Duration | GPU submits |
| --- | ---: | ---: | ---: |
| Final reveal RAF | -32.046 ms | 32.910 ms | 29 |
| Renderer paint lifecycle | +8.430 ms | 1.553 ms | 0 |
| Cleanup RAF | +15.863 ms | 93.840 ms | 35 |

The paint lifecycle contains `Paint` events at +8.564, +8.661 and +8.893 ms,
before the cleanup RAF begins. Evidence is preserved in
`.artifacts/staged-gpu-trace-70245-8eaf276-carousel-cold/final-paint-analysis.json`.
This establishes a renderer paint opportunity before cleanup in the observed
trace. It does not establish physical display timing, an absolute speedup, or a
passing performance gate; the recorded run includes profiling overhead.
