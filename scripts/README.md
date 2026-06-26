# Scripts (compatibility wrappers)

Canonical QA and tests live under **`src/tests/`** and **`tests/`**.

| Legacy path | Use instead |
|-------------|-------------|
| `scripts/qa-smoke.mjs` | `npm run qa:smoke` |
| `scripts/extraction-test.mjs` | `npm run qa:extraction` |
| `scripts/core-flow-test.mjs` | `npm run qa:core-flow` |
| `scripts/prelaunch-browser.mjs` | `npm run qa:browser` |
| `scripts/test-extract.mjs` | `npm run test:extract` |
| `scripts/load-hirely-parse.mjs` | `src/tests/load-hirely-parse.mjs` |

Do not add new logic here — edit `src/` and re-export if a stable path is required.
