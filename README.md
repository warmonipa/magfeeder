# Mag Feeder

Standalone PSO Blue Burst Mag feeding simulator and reverse planner, extracted
from [Haven PSOBB](https://www.psohaven.com/).

Production: <https://magfeeder.psohaven.com/>

## Development

Use Node.js 24 (the version used in CI).

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/>.

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

Install the browser once, then run the checks:

```sh
npx playwright install chromium
npm run sync:data -- --check
npm test
npm run build
npm run test:e2e
```

`npm run release:prepare` runs the last three commands in order. The online
upstream freshness check is separate; CI runs it before the business tests.

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

The site is dependency-free at runtime. GitHub Actions verifies provenance,
business rules, the production artifact, and browser behavior before deploying
`_site` to GitHub Pages. The `CNAME` file binds the Pages site to
`magfeeder.psohaven.com`. The repository's Pages source must be set to
**GitHub Actions** so the legacy branch publisher cannot bypass this gate.
Only pushes to `main` deploy after successful verification. Pull requests,
scheduled runs and manual workflow runs perform verification only.

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
