# Experience block parser — assumptions

Module: `src/core/parsing/cv-experience-block-parser.js`  
Engine: `EXPERIENCE_BLOCK_PARSER_V2`

## Purpose

Convert **experience section blocks** (from layout-aware segmentation or plain lines) into structured experience items. This parser is dedicated to the experience section — it does not scan the full CV.

**Strict emission:** items with `confidence < 0.55` or missing required fields are **rejected** (returned in `rejected[]`, not in `items[]`).

## Anchoring strategy

1. **Date ranges** (`2011 - 2023`, `2011`, date-only lines) are the primary entry boundaries.
2. **Lead lines** immediately before a date anchor (role/company title) are merged into the same entry.
3. **Internship labels** (`Company (Internship)` + optional year on next line) form their own entry.
4. **Compact one-liners** (`Role — Company — 2011-2014`) are parsed via dash-separated heuristics.

## Role types

| `entry_type` | Detection |
|--------------|-----------|
| `freelance` | `freelance` in title, or freelance career line parser match |
| `internship` | `(Internship)` / `intern` / `stage` label, or internship line parser |
| `employer` | Default when company + dates without freelance/internship signals |
| `unknown` | Fallback when fields are sparse |

## Clients vs skills

- Lines matching `Clients include …` or client-list heuristics (`lineIsClientList`) populate **`clients[]`** only (`client[]` kept as alias).
- Client brand names are **never** copied into **`skills[]`** (blocklist derived from parsed clients).
- Software tool names (Photoshop, Illustrator, …) are filtered out of client lists.
- Skills array is reserved for explicit skill tokens in descriptions (currently conservative / often empty).

## Field mapping

| Output field | Source |
|--------------|--------|
| `job_title` | Role line, freelance parser, or `Internship` default |
| `company` | Employer name; freelance → `Independent / Freelance` |
| `clients` | Client list lines (alias: `client`) |
| `location` | Location regex in entry lines |
| `start_date` / `end_date` | `extractExperienceDateRange` |
| `is_current` | `end_date` matches Present/current |
| `description` | Bullets + non-anchor prose lines |
| `source_block_ids` | Input block ids |
| `confidence` | Weighted score (see below) |

## Confidence scoring (0–1)

- Base: 0.42
- +0.22 `start_date` present
- +0.08 `end_date` or `is_current`
- +0.14 `job_title` (≥3 chars)
- +0.12 `company` (≥2 chars)
- +0.06 clients parsed
- +0.04 description lines
- +0.06 internship/freelance pattern bonus
- −0.20 missing dates
- −0.25 missing both title and company

Scores below **0.55** are **rejected**. Items between **0.55–0.72** emit with `review_flags` and `buildExperienceReviewHints()`.

## API

```javascript
const { items, rejected, review_hints, stats } = parseExperienceFromSegments(segments);
```

## Non-goals (conservative)

- Does not invent employers or dates not present in source text.
- Does not split merged OCR blobs beyond date anchors.
- Does not classify education/skills lines — caller must pass experience section blocks only.

## Integration

```javascript
import { parseExperienceFromSegments } from './cv-experience-block-parser.js';
import { segmentCvLines } from './section-segmenter.js';

const { segments } = segmentCvLines(lines);
const { items, rejected, review_hints } = parseExperienceFromSegments(segments);
```

Or plain lines:

```javascript
import { parseExperienceLines } from './cv-experience-block-parser.js';
const { items, rejected, review_hints } = parseExperienceLines(experienceLines);
```
