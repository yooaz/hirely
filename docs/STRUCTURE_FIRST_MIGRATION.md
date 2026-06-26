# Structure-first parser migration

## Goal

Preserve document structure (page, bbox, column, zone, reading order) through the CV parse pipeline. Plain text is a **derived audit artifact**, not the primary parse input.

## Block model stages

```
Extraction          Layout                 Parse                    Product
─────────          ──────                 ─────                    ───────
RawPage            SpatialBlock    →      NormalizedBlock    →     CVCanonical
RawBlock           (existing)             LogicalBlock
                                          SectionBlock
```

### Required fields (all block stages)

| Field | Purpose |
|-------|---------|
| `block_id` | Stable provenance for review hints / trace |
| `page_number` | Page classification (resume vs portfolio) |
| `bbox` | Column/zone inference, purity checks |
| `source` | native_text / ocr / docx / plain_text |
| `text` | Raw line text |
| `normalized_text` | OCR-safe, whitespace-normalized |
| `column_id` | Sidebar vs main column routing |
| `zone_id` | header / sidebar / main / footer |
| `reading_order` | Ordered traversal without string join |
| `style` | Optional font_size, is_bold, is_uppercase |

## New modules

| Path | Role |
|------|------|
| `src/core/blocks/block-contract.js` | JS typedefs + `blockHasStructure()` |
| `src/core/blocks/block-adapters.js` | Raw → Normalized → Logical → Section |
| `src/core/blocks/block-pipeline.js` | `buildStructureFirstDocument`, `runStructureFirstParse` |
| `src/core/blocks/flat-text-guard.js` | Detect forbidden early flatten sites |
| `src/core/blocks/index.js` | Public exports |
| `src/types/blocks.types.ts` | TypeScript contracts |

## Pipeline changes (this PR)

### Wired

1. **`parser-layout-input.js`** — exposes `primaryInput`: `spatial_blocks` | `extraction_lines` | `plain_text_fallback`
2. **`semantic-line-classifier.js`** — accepts `opts.lines` / `opts.spatialBlocks` without `join('\n')`
3. **`semantic-section-infer.js`** — structure-first line resolution; records flatten on paste fallback
4. **`section-detect-v2.js`** — semantic infer from spatial line texts; block builder prefers `spatialBlocksToOcrLineInput`
5. **`section-engine-v2.js`** — flat-text guard, `structureDoc` on output, OCR sync via block map not string split when possible
6. **`production-pipeline.js`** — `attachStructureFirstToEnterprise()` after extraction archive

### Plain-text fallback (last resort only)

Allowed flatten sites (`flat-text-guard.js`):

- `audit` / `forensic` / `export`
- `llm_fallback` (OCR reconstruction side channel)
- `derived_snapshot` (post-detection audit string)
- `legacy_consumer` (explicit `structureFirst: false`)
- Paste path with no coordinates → `plain_text_fallback`

Forbidden before section detection:

- `semantic_infer`, `section_detect`, `block_builder`
- `experience_parser`, `education_parser`, `skills_parser`
- `column_recovery`

## Remaining flatten sites (future work)

| File | Issue |
|------|-------|
| `enterprise-engine.js` | `allNativeText` routing before layout memory |
| `two-column-recovery.js` | per-column `parserText` |
| `structured-resume-from-blocks.js` | `cleaned.split('\n')` identity scans |
| `rich-parser.js` | legacy `cleanedText.split` helpers |
| Experience reconstruction engines | string blob inputs |

Phase 2: wire `detection.experienceItems` into `extractFieldsFromSectionBlocks` / `resumeData`.

## Tests

```bash
npm run qa:structure-first-pipeline   # no early flatten on Yoaz spatial fixture
npm run qa:yoaz-pdf-regression        # full target regression (still expected to fail on field quality)
```

### What `qa:structure-first-pipeline` asserts

- `primaryInput === 'spatial_blocks'` for Yoaz coordinate fixture
- `structure_preserved === true`
- ≥50% of normalized blocks retain bbox/zone/column
- `flatTextGuard.ok === true` through `runSectionEngineV2`
- Spatial block count unchanged end-to-end

## Consumer migration

### Before (plain-text-first)

```js
const result = runSectionEngineV2(enterprise.cleanedText, { rawText });
```

### After (structure-first)

```js
const result = runSectionEngineV2(enterprise.cleanedText, {
  extractionLines: enterprise.lines,
  spatialBlocks: enterprise.metadata.spatialBlocks,
  layoutMemory: enterprise.layoutMemory,
  structureFirst: true,
});

const doc = result.structureDoc; // RawPage → SectionBlock stages
const guard = result.structureFirst.flatTextGuard;
```

### Production pipeline

`enterprise.metadata.structureFirst` is populated automatically. Check:

```js
enterprise.metadata.primaryParseInput // 'spatial_blocks' | 'extraction_lines' | 'plain_text_fallback'
enterprise.metadata.structurePreserved
```

## TypeScript

Import unified types from `src/types/blocks.types.ts`. `cv.types.ts` `RawBlock` now includes `zone_id`, `normalized_text`, `style`.

`CVCanonical` remains the editor/template contract; populate `source_block_ids` as block parsers gain provenance wiring.
