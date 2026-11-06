# Migration and Reference

The shared layout replaces host-specific width and position assumptions. Migrate content intent explicitly, then verify the native and enhanced versions together.

| Previous assumption | New contract |
| --- | --- |
| Section title is always displayed | Keep `title` for navigation; add `headline` for a visible heading |
| Every section is a tinted floating panel | Author `background` deliberately; default is transparent |
| Custom section tint/blur can be discarded | Keep the explicit legacy `style` path until intentionally migrated |
| List auto-fills fixed-minimum cards | Choose section-wide S/M/L grid spans |
| All titles use the same card font | Use the selected card size's line budget and typography |
| Header is route-owned | Supply persistent menu/satellite snippets to the shell |
| Desktop viewport always means a large inner grid | Classify the actual unpadded content container |
| Summary has a universal fixed height | Resolve width/anchor; retain natural content height |
| Duplicate tabs for source and dock | Move one live navigation instance |
| Ultra-wide detail has an inner scroll panel | Keep the document as the single vertical scroll owner |
| Drawing media can omit a source | Supply an image source and meaningful alternative text |
| An empty media array removes the 3D entry | Detail presentation always starts with one 3D entry |

The layout update retains the existing package-root exports and high-level props. Its
incompatible layout changes concern rendered defaults and geometry. Application-owned exhaustive
switches over `SpatialElementMediaItem.kind` must also handle the new `video` and `youtube`
variants. Legacy section styles and the single panel radius remain supported; source-less
`drawing` is deprecated rather than removed from the type. Earlier Product-name and
SpatialStageConfig removals belong to preceding API migrations, not this layout update.

The early source-first transition is currently opt-in through `?stagedNavigation=1` on the
source page. [Transitions](Transitions.md) documents its endpoint declarations and acceptance
limits. Declaring a dock target alone does not enable the experiment.

## Radius and palette compatibility

`radii.control` applies to cards, controls, media thumbnails and submenus. `radii.panel` applies to summaries, detached section groups and the content pane. Factory defaults are 12px and 16px. An explicitly authored legacy `panelShape.radius` supplies both until new roles are provided. Invalid radii normalize to finite non-negative values.

`sectionBackgrounds.standard` and `.muted` are separate from panel material tint. Migrate dark palettes explicitly. A page's flat `background` and HDR lighting also remain distinct responsibilities.

## Viewport and fallback rules

- Breakpoints use CSS pixels: 600, 840, 1200, 1600, 1809 and 2300.
- Content grids use container widths: 600, 840 and 1200, capped at 1536.
- Stable viewport metrics avoid changing the document composition for every mobile browser-toolbar animation. Visible viewport metrics remain available for actual visible bounds.
- Scrollbars and safe areas are resolved explicitly; DPR is a rendering-quality input.
- Short 3XL windows use the 2XL detail composition below 512px usable height.
- Ordinary links, native controls and server-rendered content remain functional without WebGPU; a missing renderer is not a loading screen.

## Executable references

| Public route | Purpose |
| --- | --- |
| `/demo/layout-grid` | Container classification, spans and document order |
| `/demo/layout-cards` | S/M/L cards, small-card text reserve, long titles |
| `/demo/layout-pane` | Production 3XL document scrolling, focus, late content and resize |
| `/demo/layout-media` | Image/video/3D switching and input ownership |
| `/demo/categories/list`, `/carousel`, `/mixed` | Ordinary navigation and history |
| `/proof/persistent-summary` | Isolated persistent DOM ownership |
| `/proof/ultrawide` | Isolated document-scroll coordinate proof |

Proof routes isolate a particular invariant; they do not replace production integration tests. Geometric assertions compare native and GPU rectangles as well as screenshots. Browser suites cover JavaScript disabled, native hydration, real WebGPU, reduced motion, keyboard interaction and history. Hardware sensor/touch, cross-origin service playback and browser Find need separate review where automation has not exercised them.

## Documentation maintenance

Canonical geometry lives in `layoutTokens.json`; pure resolvers and generated CSS consume it. [The complete token reference](Layout-Tokens.md) is generated and checked by the export script. Edit the canonical token first, regenerate CSS and documentation, then rerun affected boundary/geometry tests. Do not introduce independent constants in a theme or a screenshot test merely to make an outdated expectation pass.

The wiki export contains only public demo imagery and neutral diagrams. It has no dependency on the original design files or private brand repositories and does not publish automatically.
