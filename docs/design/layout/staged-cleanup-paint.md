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
before this barrier; frame-time improvement requires a subsequent browser trace.

Controller units cover normal and Reduced Motion completion, asynchronous final
commit, cancellation/history/supersession in the new interval, stale callbacks and
exactly-once ownership release. The separate `staged-cleanup-paint` browser proof
checks the actual edited Svelte textarea's identity at the committed endpoint and
after cleanup for Hero and Dock. It records observations without changing the
timing markers; a browser trace is still needed to inspect actual paint ordering.
