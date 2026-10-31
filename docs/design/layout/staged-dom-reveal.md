# Local DOM opacity during a staged reveal

The ordinary catalog transition retains its inherited enter/shared channels. The staged
forward path instead writes `--catalog-reveal-opacity` only on existing opacity paint owners:
incoming DOM blocks, panel content, and CSS panel surfaces. The panel's `::before` and `::after`
explicitly inherit that local value; arbitrary content descendants do not. Panel frame wrappers
keep their original opacity, preserving their existing backdrop-filter and 3D behavior.

The property is registered with `syntax: '*'`, `inherits: false` and no `initial-value`.
Its absent value is therefore guaranteed-invalid, allowing `var(local, existing-factor)` to
retain ordinary navigation and zoom behavior. The registration follows the
[CSS Properties and Values API initial-value rules](https://drafts.css-houdini.org/css-properties-values-api/#initial-value-descriptor).
The local channel is used directly inside the existing opacity formulas, never assigned to
another inherited custom property. Theme opacity, focus opacity, surface alpha and specular
alpha remain separate factors.

Nested incoming blocks and nested panel content retain their existing multiplicative roles.
The controller does not collapse them into one ancestor fade. Continuous navigation-shell
branches are excluded. A marker/child-list observer adds new paint owners with the current
progress and releases detached or reclassified ones before the next paint. It observes no
style attributes and performs no computed-style or geometry reads on animation frames.
Completion, cancellation and destruction restore saved inline values and priorities and
disconnect the observer. The held source and GPU presentation keep their own existing clocks.

`tooling/staged-dom-reveal.spec.ts` covers paint-owner selection, new receivers, inherited
group membership, continuous shells and cleanup. `playwright.staged-dom-reveal.config.ts`
checks the actual shipped CSS, including pseudo-element inheritance, ordinary fallback,
theme/focus multiplication and nested factors without WebGPU. Production navigation and
performance still require their separate coordinated runs; these focused checks alone do not
establish a frame-time improvement.
