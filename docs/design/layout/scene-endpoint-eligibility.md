# Scene endpoint cache eligibility

The optional cache assumes a static standard-material scene with nonnegative,
finite radiometric inputs. Static values alone are insufficient: negative RGB or
light contributions can cross the renderer's outgoing-light clamp during a
background reveal, invalidating interpolation between the captured endpoints.

The guard checks every recorded `Color` channel, light intensity, scene
background/environment intensity, and material emissive/environment-map/light-map
intensity. HDR colors and intensities above one remain supported. Opacity, AO
intensity and the standard physical mixing/roughness parameters must remain in
their ordinary `[0, 1]` ranges. These restrictions do not apply to model poses,
camera positions, rotations or scales.

Arbitrary signed/float/half-float material maps and enabled vertex colors use the
live renderer. The guard does not scan large texture or vertex arrays during
Hold. Runtime-prepared environment/background resources have a separate
nonnegative HDR radiance contract; their ownership, references, versions and
scene intensity are still guarded. This exemption does not make arbitrary
render-target material maps cacheable.

These are conservative cache-eligibility boundaries, not new restrictions on
authored rendering. Unsupported inputs retain the existing live path. Capture
ownership, target-write epochs, size and generation checks remain independent.
