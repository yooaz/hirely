# Parser dictionaries

Canonical lists for **`src/core/parsing`** and **`src/core/extraction`** only.

## JSON entity dictionaries (entity engine)

| File | Entity type | Boost | Bucket |
|------|-------------|-------|--------|
| `schools.json` | school | **+40** | education |
| `degrees.json` | degree | **+30** | education |
| `clients.json` | client | **+30** | clients |
| `software.json` | software | **+30** | tools |
| `languages.json` | language | +20 | languages |
| `socials.json` | social | +18 | contact |

Each file has an `entities[]` array: `{ id, name, aliases[], type }`. Matching uses `entity-recognizer.js` (longest match + word boundaries), then **`src/core/parsing/entity-engine.js`** scores hits (`40 + boost + context`) and picks the best entity **before** section classification in `block-line-classifier.js`.

Examples:

- Nike, Adobe, Marvel → **client**
- Illustrator, Photoshop → **software** (tools)
- LISAA, Créapole → **school** (education; beats degree on the same line)
- LinkedIn, Instagram → **social** (contact)

Used by `entity-catalog.js`, `entity-engine.js`, `entity-dictionaries.js`. Legacy `creative_clients.json` terms are merged into `clients.json` entities.

```bash
npm run qa:entity-engine
npm run qa:entity-recognition
```

Do not duplicate these arrays in `index.html` or templates.

| Module | Purpose |
|--------|---------|
| `creative/` | Creative software, agencies, luxury brands, studios, schools |
| `tools.js` | Software tools (includes `creative/creativeSoftware.js`) |
| `skills.js` | Skill terms + hint regex |
| `languages.js` | Language labels + aliases |
| `educationKeywords.js` | Education headers / cues + creative schools |
| `roleKeywords.js` | Job titles |
| `clientCompanyKeywords.js` | Brand / client names (luxury + agencies + studios) |
| `garbagePatterns.js` | OCR noise, placeholders (uses creative entities) |

## Creative dictionaries

- `creative/creativeSoftware.js` — Adobe, Illustrator, Photoshop, InDesign, Affinity Designer, Behance, Pantone, …
- `creative/creativeAgencies.js` — McCann, Ogilvy, TBWA, …
- `creative/luxuryBrands.js` — Nike, Louis Vuitton, Marvel, Converse, PlayStation, Cadillac, …
- `creative/studios.js` — Pentagram, Framestore, Pixar, …
- `creative/creativeSchools.js` — LISAA, Créapole, ENSAD, Gobelins, …
- `creative/index.js` — merge, entity detection, **coverage report**

OCR (`ocr-postprocess.js`) masks dictionary entities before char fixes. Only whitelist hints may normalize OCR typos to canonical forms (e.g. `Photosh0p` → `Photoshop`). Canonical spellings are never altered.

Coverage report:

```bash
npm run qa:creative-dictionaries
```

Or from code:

```js
import { generateCreativeDictionaryCoverageReport, printCreativeDictionaryCoverageReport } from './src/data/dictionaries/creative/index.js';
const report = generateCreativeDictionaryCoverageReport(cvText);
printCreativeDictionaryCoverageReport(report);
```

Pipeline attaches `audit.creativeDictionary` after each import.
