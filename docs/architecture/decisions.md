# Accepted architecture decisions

These concise records preserve the accepted decisions from the lab while describing their current scope. Original detailed records and implementation chronology are retained privately.

## ADR 0001 - Catalog foundations

Accepted 2026-09-09; route/view consequence amended by ADR 0002.

- Canonical element/category URLs belong to the host router; persistent catalog stage ownership crosses route changes.
- Shared means semantic identity and visual continuity, not identical DOM nodes. Brand/element/role identify the shared meaning; Low/High do not change it.
- Normal element links, explicit section links and history restoration have distinct scroll intent. Scroll alone does not create history entries.
- Reuse the virtual-scroll runtime through one navigation restoration adapter. Distinguish native and visual scroll.
- Low/High share one reference frame and physical metadata is verified rather than inferred from normalization.

Consequence: transition eligibility depends on measured, prepared presentations and resource ownership, not just matching URLs or downloaded files.

## ADR 0002 - Composable catalog sections

Accepted 2026-09-14.

ContentPage composes text, lists and carousels; a CarouselSection does not own a separate page or renderer. A route identifies a resource, while endpoint registrations, navigation intent and restored section selection identify a concrete presentation. Occurrence identity separates repeated element presentations from shared asset identity. This supersedes the earlier assumption that a route uniquely determines list versus carousel presentation.

Consequence: mixed pages require occurrence-aware matching and per-history-entry section state.

## ADR 0003 - Public packages and private integration examples

Accepted during repository extraction, recorded 2026-09-25.

One public monorepo contains framework-independent core, the SvelteKit adapter, a neutral demo and original procedural fixtures. A separate private application contains restricted brand assets, production pipelines and brand acceptance evidence. It consumes the same package sources through links and validates packed artifacts before release. No second runtime fork is maintained.

Consequence: future framework adapters can reuse core, but remain separate implementation work. Public packaging must exclude private assets and evidence. MPL-2.0 and optional attribution do not grant rights to third-party models. npm publication remains a separate release action.
