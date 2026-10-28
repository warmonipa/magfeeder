# Mag Feeder

Standalone PSO Blue Burst Mag feeding simulator and reverse planner, extracted
from [Haven PSOBB](https://www.psohaven.com/).

Production: <https://magfeeder.psohaven.com/>

## Development

Use Node.js 24.15.0 or newer within Node 24 (the major version used in CI).

```sh
nvm use
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/>. Angular watches application code and templates.
After updating the canonical data snapshots, restart development to regenerate
their JSON build inputs.

## Verification

`npm test` requires the item-name authority. To reproduce CI without depending
on the state of a sibling checkout, download the pinned authority to a temporary
directory and select it explicitly:

```sh
authority_dir=$(mktemp -d)
curl -fLsS https://raw.githubusercontent.com/warmonipa/dropcharts/e3926ca4dda0033ad90a7e6cf203665436de393c/i18n_names.json \
  -o "$authority_dir/i18n_names.json"
export DROPTABLE_I18N_AUTHORITY="$authority_dir/i18n_names.json"
```

Before a release, install the locked dependencies, audit them, install the
browser, and run the same quality checks as CI:

```sh
npm ci
npm audit --audit-level=high
npx playwright install chromium
npm run sync:data -- --check
npm run release:prepare
```

`npm run release:prepare` runs `npm test`, `npm run build`, and
`npm run test:e2e` in order. Installation, audit and online upstream freshness
verification are separate steps; run all of them before pushing. Business tests
include the Angular ownership check. Browser tests cover both prerendered pages
without JavaScript, feeding and planning, session replay, route navigation,
original entry URLs, HTTP status codes, and desktop/mobile layout.

Preview and browser tests use <http://127.0.0.1:4174/> so Haven can keep
running on port 4173. Build before running `npm run preview` or browser tests:
both serve `_site`, not the source tree. Rebuild after source changes.
`npm run test:e2e` starts the preview automatically when it is not running;
locally it can reuse an existing server on that port.

## Shared Mag data

`assets/js/mag-evolution.js` and `assets/js/mag-sim-data.js` are synchronized
from the canonical generator in
[`ephinea4haven/ephinea4haven.github.io`](https://github.com/ephinea4haven/ephinea4haven.github.io).
Do not edit them directly.

```sh
npm run sync:data
npm run sync:data -- --check
```

The sync records the exact source commit and hashes in
`third_party/haven-mag-data/upstream.json`. Commit that record together with the
generated data. `--check` downloads the current upstream files and fails if the
snapshot is stale; it does not update files. The scheduled verification workflow
reports drift but does not synchronize or deploy automatically.

## Deployment

The site uses Angular 22 standalone components, zoneless change detection and
client hydration. The simulator, planner and error page are prerendered at build
time; no production application server is required. GitHub Actions verifies provenance,
business rules, the production artifact, and browser behavior before deploying
`_site` to GitHub Pages. The `CNAME` file binds the Pages site to
`magfeeder.psohaven.com`. The repository's Pages source must be set to
**GitHub Actions** so the legacy branch publisher cannot bypass this gate.
Only pushes to `main` deploy after successful verification. Pull requests,
scheduled runs and manual workflow runs perform verification only.

After pushing, wait for both the build and deploy jobs of **Verify and deploy
Pages** to succeed for that commit. Then check the public simulator, planner,
original entry URLs and a missing path. A successful local build or push alone
is not confirmation that production has updated.

## Chinese item names

Display names come from `warmonipa/dropcharts`'s `i18n_names.json`, aligned with
the finalized PSOBB localization. Without `DROPTABLE_I18N_AUTHORITY`, the scripts
read sibling `../droptable/i18n_names.json`. An independently updated sibling
checkout can make local `npm test` fail even when the CI-pinned authority passes;
use the pinned setup above to reproduce CI.

Run `npm run sync:i18n` with the selected authority after adding Mag identities
or deliberately updating the name authority. `npm run test:i18n` checks every
Mag, cell and food, including the authority file's hash. For an authority update,
update the dropcharts commit in `.github/workflows/pages.yml` and the pinned URL
above, then regenerate and commit `assets/js/items_i18n.js` together with them.

`assets/js/items_i18n.js` is generated. Names are displayed in Chinese with the
English identity retained for lookup. Evolution/feeding snapshots, simulation
keys, JSON exports and shared links retain their source identities; upstream Mag
data synchronization cannot overwrite the site's current Chinese display names.

## Shared Mag portraits

The simulator displays the same 46 default Mag portraits as Haven Wiki from
`assets/img/mag/default/`. These are transparent 900 × 900 WebP renders of the
original models and textures, with individual chart-reference cameras,
camera-relative lighting that keeps brightness close to the original textures
and no player colour modulation. Resource and image hashes, camera and lighting
parameters and the four accepted outline differences are recorded in that
directory. Keep the accepted portrait set byte-identical between the two
projects when updating it.
The data synchronization command does not update these images.

## Architecture

- Angular Router owns the simulator at `/`, planner at `/planner/`, and the error page. Each has initial content in its generated HTML.
- `src/app/simulator/` contains Angular setup, card, feeding and session controls. `SessionService` owns the shared simulation state and undo history, so navigation does not discard the Mag.
- `src/app/planner/` renders the reverse planner and imports its result through the same session service.
- `src/app/domain/` holds the DOM-free simulation engine and planner, with TypeScript contracts. Existing rule tests import these modules directly.
- `scripts/generate_data.mjs` parses the pinned upstream data assignments into ignored JSON build inputs. These snapshots are bundled as modules; no browser globals or standalone page scripts are loaded.
- `npm run build` runs Angular static prerendering, verifies meaningful HTML and hydration metadata, then publishes `_site` using a staged directory. The old artifact remains available until the replacement is ready.
- `src/index.html` is the only application HTML entry. Templates use Angular bindings and event handlers; the retired DOM-string UI and custom page-chrome runtime are removed.
- Share URLs encode the ordered session in the fragment. The simulator replays it after initial hydration. Unknown public paths return the prerendered error page with HTTP 404.

Build and browser tests use Node 24. `npm run release:prepare` validates business rules, production builds and the browser suite. No push or deployment is performed by that command.

## Public URL contract

Routes describe product functions. Direct HTTP access is a supported capability
of those routes; source filenames do not determine the route structure.

| URL | Behavior |
|---|---|
| `/` | Simulator; HTTP 200 with prerendered content |
| `/index.html` | Original simulator entry; HTTP 200, then Angular normalizes to `/` |
| `/planner/` | Planner; HTTP 200 with prerendered content |
| `/planner` | Host redirects to `/planner/`, preserving query parameters |
| `/planner/index.html` | HTTP 200, then Angular normalizes to `/planner/` |
| `/#r=…` | Original shared-session format; replayed after hydration |
| Unknown path | HTTP 404 with the prerendered error page |

Explicit index-document normalization preserves query parameters and fragments.
Each page can be opened or refreshed directly without first visiting the home
page. The preview server reproduces directory redirects and 404 responses;
GitHub Pages serves the generated directory indexes in production. There is no
SPA rewrite of unknown paths to a successful home-page response.
