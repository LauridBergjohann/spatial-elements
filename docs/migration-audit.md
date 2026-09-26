# Remaining lab material: migration audit

Reviewed 2026-09-25 against the tracked lab tree and both extracted repositories.

| Material | Destination and disposition |
| --- | --- |
| Runtime, components, generic tests | Already extracted into public core and sveltekit packages |
| Current architecture and accepted decisions | Rewritten against current code in [architecture](architecture/README.md); arc42 structure plus C4 views |
| Original plans, six-phase closeout, device reports and profiling evidence | Byte-preserved archive with SHA-256 inventory in private examples |
| Brand comparison images and raw measurements | Preserved in that private archive; not suitable for the public demo |
| Brand routes, assets and production/diagnostic scripts | Already private; all tracked legacy scripts accounted for |
| Browser regression suites | All tracked lab browser-test files are already present privately, including brand authoring, detail page hover feedback and runtime ownership |
| Untracked local files and temporary traces | Left untouched; not verified migration inputs |
| Git history | Not imported into the clean repositories; old repository remains a historical reference |

The architecture documents describe the implementation rather than copying old target-design prose. Historical measurements remain tied to their original environment. Presence of diagnostic scripts does not mean every old profiling command was rerun or adapted; review those when reusing them.

No further runtime extraction is proposed by this documentation audit. This is not a byte-for-byte preservation claim for every old source file or obsolete experiment. Before deleting or making the old repository unavailable, separately review its untracked files, historical branches/issues and source links in archived documents. No old repository has been deleted or archived and no npm publication was performed.
