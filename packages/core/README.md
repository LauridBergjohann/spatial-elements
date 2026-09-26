# @spatial-elements/core

Framework-independent rendering and catalog runtime for Spatial Elements.

See the [authoring guide](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/authoring.md) and [development guide](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/development.md).

Beta API; MPL-2.0; see LICENSE.

Installation:

~~~sh
npm install @spatial-elements/core@beta
~~~

Requires Node.js 22.12+ tooling.

A visible “Built with Spatial Elements” link is appreciated, but not required. This does not replace your obligations under the MPL-2.0 license.

Three.js is a required peer dependency (^0.185.1), shared with the application and other adapters.
Modern npm installs it automatically. If the application imports Three.js directly, declare it
explicitly with `npm install three@^0.185.1`. Do not bypass incompatible peer ranges with
`--legacy-peer-deps`. Other package managers may require explicit peer installation.
