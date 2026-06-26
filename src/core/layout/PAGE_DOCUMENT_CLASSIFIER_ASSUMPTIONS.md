# Page document classifier — assumptions

Module: `src/core/layout/page-document-classifier.js`  
Classifier id: **`PAGE_DOCUMENT_CLASSIFIER_V2`**

## Purpose

Classify each page of a multi-page CV PDF as **resume core** or **portfolio/gallery** before section parsing, so portfolio captions do not pollute contact, experience, education, or skills extraction.

## Page classes

| `page_class` | Meaning |
|--------------|---------|
| `resume_core` | Standard CV page — headings, contact, dated roles |
| `portfolio_page` | Gallery / case-study page — artwork captions, sparse CV structure |
| `mixed` | Both resume and portfolio signals (kept in resume parsing path) |
| `unknown` | Insufficient signals — conservative, not excluded |

## Signals

| Signal | Resume ↑ | Portfolio ↑ |
|--------|----------|-------------|
| CV section headings (PROFILE, EXPERIENCE, SKILLS, …) | ✓ | |
| Contact (email, phone) | ✓ | |
| Experience date/role structure | ✓ | |
| Education keywords / EDUCATION heading | ✓ | |
| Work role keywords / EXPERIENCE heading | ✓ | |
| Sidebar layout | ✓ | |
| High line count (≥14) | ✓ | |
| Portfolio marker (`PAGE 2 PORTFOLIO`, gallery) | | ✓ |
| Artwork captions (Personal Project, Fortune 500 Cover, …) | | ✓ |
| No CV headings | | ✓ |
| Lack of contact/work/education signals | | ✓ |
| Low line count (≤8) | | ✓ |
| Image density (metadata or sparse-text proxy) | | ✓ |
| Card/grid layout (x variance + caption-length lines) | | ✓ |

## Decision debug

Each page includes:

- `signals[]` — short machine tags
- `decision_reasons[]` — human-readable why (`buildPageDecisionReasons`)
- `parsing_gate` — `{ excluded_from, included }` per page

Document-level:

- `excluded_pages_trace[]` — per-page gate (`buildExcludedPagesTrace`)
- `excluded_pages` — page numbers excluded from resume parsers (portfolio only)
- `parsing_gates` — `contact`, `experience`, `education`, `skills`, `section_segmentation`

## Parsing gate

`portfolio_page` lines/blocks are **excluded** from:

- Section segmentation input (`filterSpatialBlocksForResumeParsing`)
- Experience / education / skills block parsers (`filterSegmentsForResumeParsing`)
- Contact / experience / education / skills field extraction

`mixed` and `unknown` pages are **not** excluded (conservative).

## Portfolio output

`extractPortfolioItems` returns `portfolio_items[]` from portfolio-classified pages:

```javascript
{ title, page_number, source_text, confidence }
```

## Integration

```javascript
import {
  classifyDocumentPages,
  filterSpatialBlocksForResumeParsing,
  buildPageDocumentClassificationDebug,
} from '../layout/page-document-classifier.js';

const pageDoc = classifyDocumentPages(extractionLines, { pageLayouts });
const resumeBlocks = filterSpatialBlocksForResumeParsing(spatialBlocks, pageDoc);
// pageDoc.excluded_pages_trace — why pages were gated
// pageDoc.portfolio_items — optional gallery captions
```

Wired in `section-detect-v2.js` → `pageDocumentClassification`, `portfolio_items`, `excluded_pages_trace`, `pageClassificationDebug`.

## Yohann benchmark

| Page | Expected class |
|------|----------------|
| 1 | `resume_core` |
| 2 | `portfolio_page` |
