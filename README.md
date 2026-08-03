# Mag Feeder

Standalone PSO Blue Burst Mag feeding simulator and reverse planner, extracted
from [Haven PSOBB](https://www.psohaven.com/).

Production: <https://magfeeder.psohaven.com/>

## Development

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:5173/>.

## Verification

```sh
npm test
npm run test:e2e
```

The site is dependency-free at runtime and is published from the repository
root with GitHub Pages. The `CNAME` file binds the Pages site to
`magfeeder.psohaven.com`.
