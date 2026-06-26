# Education block parser — assumptions

Module: `src/core/parsing/cv-education-block-parser.js`  
Parser id: **`EDUCATION_BLOCK_PARSER_V2`**

## Purpose

Convert **education section blocks** (from layout-aware segmentation or plain lines) into structured education items with **canonical deduplication** for OCR repetition and overlapping block groups.

## Anchoring strategy

1. **School + program lines** (`LISAA, web and motion design`, `Créapôle, visual communication`) pair with a **following date line** (`2011 - 2012`).
2. **Date-first compact lines** (`2011 2012 : LISAA, web and motion design`) form a single entry.
3. **Date-only lines** without a pending school line may pair with the **next** school/program line (reverse OCR order).

## Field mapping

| Output field | Source |
|--------------|--------|
| `school` | Entity catalog (`schools.json`) → dictionary term → conservative comma-lead |
| `degree` | Text after school comma; `canonicalizeEducationProgram` when matched |
| `location` | Location regex in entry lines (rare) |
| `start_date` / `end_date` | `extractDateRangeFromText` + spaced-year fallback |
| `description` | Bullet lines in the group |
| `source_block_ids` | Input block ids (merged on dedupe) |
| `confidence` | Weighted score (see below) |
| `school_from_dictionary` | `true` when `findBestEntity(SCHOOL_RECOGNIZER)` matched |

Rejected items (not emitted) include `rejection_reasons[]` when `confidence < MIN_EDUCATION_EMIT_CONFIDENCE` (0.48), `missing_school`, or `missing_dates`.

## Accent preservation

School names resolve through `findBestEntity(SCHOOL_RECOGNIZER)` so OCR variants like `Creapole` map to canonical **`Créapôle`** from `schools.json`. On merge, `pickPreferredSchoolLabel` keeps the richer accented display form when canonical keys match.

## Conservative school behavior

- Dictionary hit → full school confidence weight.
- No dictionary hit → comma-lead only if it looks like an institution name (2–56 chars, leading letter).
- Uncertain school → lower confidence (−0.1); parser does **not** invent institution names from free prose.

## Deduplication strategy (`canonical_exact_then_near_duplicate`)

Applied after grouping via `dedupeEducationBlockItems`:

1. **Exact pass** — key = `canonicalSchoolKey(school)|start|end|normalize(degree)` via `educationDedupeExactKey`.
2. **Near-duplicate merge** when `nearDuplicateMergeReason` returns:
   - `same_school_dates_degree_variant` — same normalized school + dates, degree similar or empty
   - `same_dates_school_ocr_variant` — same dates, school similarity ≥ 0.86, degree similar or empty
   - `overlapping_years_similar_degree` — overlapping year spans + degree similarity ≥ 0.9
3. **Merge policy** — `pickPreferredSchoolLabel` (accents), longer degree, union `description[]` and `source_block_ids[]`, max confidence.
4. **Emit filter** — `collectEducationRejectionReasons` drops items below `MIN_EDUCATION_EMIT_CONFIDENCE` or missing required fields.
5. Sort output by `start_date` descending.

### Debug mode

Pass `{ debug: true }` to `parseEducationSectionBlocks` or set `globalThis.HIRELY_DEBUG`. Returns:

| Field | Description |
|-------|-------------|
| `dedupe_trace[]` | Per-event log: `merged_exact`, `merged_near`, `rejected_low_confidence` with `reason`, `primary`, `secondary`, `result` |
| `dedupe_debug` | `buildEducationDedupeDebug()` payload: strategy, stats, events, canonical keys per item |
| `rejected[]` | Items dropped at emit with `rejection_reasons` |

Merge reasons are explicit strings (e.g. `same_dates_school_ocr_variant`) so QA can assert why rows were merged or dropped.

## Confidence scoring (0–1)

- Base: 0.38
- +0.22 `start_date` present
- +0.10 `end_date` present
- +0.20 dictionary school match / +0.08 uncertain school
- +0.14 `degree` (≥4 chars)
- +0.04 description lines
- −0.28 missing school
- −0.22 missing dates
- −0.10 non-dictionary school

Scores below **0.55** should be treated as review candidates downstream. Emit threshold is **0.48** (`MIN_EDUCATION_EMIT_CONFIDENCE`).

## Non-goals

- Does not split merged OCR blobs beyond date/school anchors (e.g. two programs on one fragmented line).
- Does not classify experience/skills — caller must pass education section blocks only.

## Integration

```javascript
import { parseEducationFromSegments } from './cv-education-block-parser.js';
import { segmentCvLines } from './section-segmenter.js';

const { segments } = segmentCvLines(lines);
const { items, dedupe_trace, dedupe_debug, rejected } = parseEducationFromSegments(segments);
```

Or plain lines:

```javascript
import { parseEducationLines } from './cv-education-block-parser.js';
const { items, dedupe_trace, dedupe_debug } = parseEducationLines(educationLines);
```
