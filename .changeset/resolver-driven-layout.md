---
'@spatial-elements/core': minor
'@spatial-elements/sveltekit': minor
---

Introduce a shared responsive layout contract for content grids, square S/M/L cards,
carousel summaries, detail media, docking and the document-scrolled 3XL detail pane.
The same numeric layout resolves DOM and 3D targets. Add explicit ContentGrid and
ContentBlock authoring, section background roles, separate control/panel radii, a
persistent navigation shell, media selection and persistent custom summary content.

Prepared catalog sources can begin their forward transition using numeric destination
anchors before the detail route mounts. The original model and live panel remain visible
through loading and binding; custom summary state survives the handoff. Known compact
destinations can declare `targetPresentation: 'dock'`. Unsupported or unprepared links
retain the ordinary navigation path, including native history and focus policies.
The source-first path currently requires `?stagedNavigation=1` while its production
performance acceptance is evaluated.

Layout migration is required for applications that rely on the former automatic
section headlines, default translucent section backgrounds, auto-fill card widths,
fixed summary heights or private component selectors. Supply `headline` separately
from the navigation `title`, select section backgrounds explicitly and replace
structural overrides with grid spans. Existing explicitly authored legacy section
styles and theme radii keep their documented compatibility behavior.

Detail media selection always starts with the 3D item, including an empty authored
`media` array. Selecting an image or video hides the 3D background; history return
starts with 3D again. Legacy `drawing` entries remain type-compatible but display the
documented unavailable state until replaced with a supported image or video source.
Custom exhaustive media handlers must also cover the new `video` and `youtube` variants.

See `docs/layout-migration.md` and the illustrated Markdown guides in `docs/wiki/`
for the layout rules, design reasons, accessibility behavior and migration examples.
