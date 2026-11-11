# Applications

| App | Purpose | Develop | Preview |
| --- | --- | --- | --- |
| website | Public docs, interactive layouts, Wera and watch showcase | npm run dev:website (5174) | npm run preview:website (4175) |
| demo | Minimal shell, collection and detail example | npm run dev:demo (5173) | npm run preview -w @spatial-elements/demo (4173) |
| tests | Regression fixtures, proof and staged routes | npm run dev:tests (5175) | npm run preview -w @spatial-elements/tests -- --port 4174 |

Run npm ci first. npm run build:apps builds all three apps and the packages; npm run test:apps checks production previews. Development ports are separate, so all three applications can run at once.

The tests app retains /demo, /starter, /proof and /staged routes for regression tooling. They are not deployed with the public website. Public layout examples live under /docs/examples/; the collection playground lives under /docs/sections/playground/.

Demo assets are synchronized from fixtures/demo-assets. Showcase assets are owned by apps/website/static/assets and are independent of the previous brand-examples checkout. They are excluded from the runtime packages.
