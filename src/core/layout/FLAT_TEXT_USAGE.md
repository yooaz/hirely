# Flat text usage (controlled fallback)

The parse pipeline keeps **spatial blocks** (`src/core/layout/spatial-block.js`) as the primary intermediate model. Plain text is derived only when a downstream stage still requires a string blob.

## Spatial block fields

| Field | Purpose |
|-------|---------|
| `page_number` | 1-based page |
| `block_id` | Stable id within document |
| `bbox` | `{ x, y, width, height, x2?, y2? }` |
| `source` | `layout_memory`, `geometric`, `document_reconstruction`, `paste`, … |
| `reading_order` | Global reading sequence |
| `zone_id` | `header`, `footer`, `main`, `sidebar`, `left_column`, `right_column`, `full` |
| `column_id` | `LEFT_COLUMN`, `RIGHT_COLUMN`, `FULL` |
| `text` | Raw line/block text |
| `normalized_text` | Whitespace-normalized text |

Derive plain text only via `spatialBlocksToPlainText(blocks)`.

---

## Still using flat text (and why)

### Last-resort heuristics / legacy APIs

| Location | Why flat text remains |
|----------|----------------------|
| `src/core/parsing/semantic-section-infer.js` | `inferSemanticSectionBlocks(cleanedText)` — regex/semantic line scan; accepts `layoutMemory.entries` first when present |
| `src/core/parsing/semantic-line-classifier.js` | Same pattern: prefers layout entries, falls back to split string |
| `src/core/layout/two-column-recovery.js` | Column `parserText` for per-column semantic infer when blocks lack anchors |
| `src/core/parsing/section-engine-v2.js` | OCR postprocess (`postProcessOcrText`, merged-header split) operates on string; spatial blocks updated in parallel |
| `src/core/pipeline/production-pipeline.js` | LLM reconstruction, audit, word-count, `coerceParserInputText` — external contract expects `cleanedText` string |
| `src/core/parsing/structured-resume-from-blocks.js` | Experience recovery, OCR supplements, coverage reports use `cleanedText` as safety net |
| `src/core/extraction/extracted-line.js` | `linesToPlainText()` for extraction archive / debug only |

### Extraction / archive (not parse structure)

| Location | Why |
|----------|-----|
| `src/core/extraction/enterprise-engine.js` | `rawExtraction` / `cleanedText` metadata fields for forensic audit; spatial blocks attached separately |
| `src/core/layout/document-reconstruction.js` | `hay` join for text-layer probe only (not passed to section engine) |
| `src/core/extraction/pdf-post-extract.js` | Passes positioned lines through reconstruction; no early flatten |

### Intentionally structured-first (prefer spatial blocks)

| Location | Behavior |
|----------|----------|
| `src/core/layout/layout-memory.js` | Builds `spatialBlocks`; `parserText` is derived |
| `src/core/parsing/parser-layout-input.js` | Exposes `spatialBlocks`; `text` derived from blocks |
| `src/core/parsing/section-detect-v2.js` | `spatialBlocks` → `buildDocumentBlocksFromOcrLines` before plain string |
| `src/core/parsing/block-builder-v1.js` | `normalizeOcrLineInput` accepts spatial block arrays |
| `src/core/parsing/block-reconstruction.js` | Prefers `spatialBlocks` then layout entries |

---

## Migration notes

- New parsers should accept `spatialBlocks` or `layoutMemory.spatialBlocks`.
- Do not call `.join('\n')` on entries in new code — use `spatialBlocksToPlainText()`.
- `parserText` on `LayoutMemory` remains for backward compatibility but is always derived from spatial blocks.
