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
environment promise. Attribution to the remaining source frame in
`.artifacts/staged-gpu-trace-70245-8eaf276-carousel-cold` is a **hypothesis**, not a
recorded call stack: RAF214 is registered in a post-click microtask at roughly
+20.4 ms, whereas the activation-focus RAF212 was registered inside focusin and
does only short scheduling work. The trace lacks a registration stack for
RAF214, and its CPU sampler misses that brief call. A subsequent trace is needed
to establish whether eliminating the proven duplicate removes that source frame.
