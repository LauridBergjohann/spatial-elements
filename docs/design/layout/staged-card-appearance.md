# Retained List card appearance

The source box freeze alone does not freeze descendant CSS transitions. A card's
title/eyebrow depth and text shadow, surface border and `::after` glow, poster,
and keyboard outline can otherwise change when moving the card causes pointer
leave or when inertness removes focus.

The staged adapter snapshots the currently interpolated values of these known
paint owners before any appearance write or source inertness change. It pins
those values and disables their transitions. It does not preserve a synthetic
hover/focus state, clone DOM, or take over the root actor's motion transform.
Dock child actors can subsequently own their transforms; cleanup releases
moving/held motion first and then restores the original appearance properties
and priorities. All other inline properties remain owned by their existing
controllers. The pseudo-element uses a local frozen-opacity variable and marker.

`tooling/card-appearance-freeze.spec.ts` checks batched reads, interpolated values,
exact/idempotent restoration (including Dock transition longhands), optional
nodes and failure cleanup. `tests/card-appearance-freeze.e2e.ts` covers actual
mid-hover and keyboard-focus CSS transitions for Hero and Dock navigation,
followed by focus/pointer loss and cancellation of a held request.

Validation on production build 95956: all seven focused units passed. The first
four-case browser run passed both Dock cases; both Hero cases reached the stable
appearance assertions but used the client-only demo loader, so their supposed
blocked request had already committed before Escape. The corrected server-backed
Hero fixture passed both targeted retests without runtime or tolerance changes.
The four accepted cases recorded 16–19 moving frames and 7–39 held frames, with
pre-activation title depths between 27.313px and 63.684px (the endpoint is 64px).
Results are stored as `appearance-frames.json` under
`.artifacts/card-appearance-freeze/` (Dock) and
`.artifacts/card-appearance-freeze-hero-retest/` (Hero). The initial failed Hero
traces remain in the first directory. This was a two-pass initial result plus two
targeted retests, not a second complete suite.

This closes an appearance-consistency gap. It does **not** establish that these
transitions caused the earlier browser raster/Skia compilation stalls, nor claim
a measured frame-time improvement. The original diagnostic trace is unchanged.
