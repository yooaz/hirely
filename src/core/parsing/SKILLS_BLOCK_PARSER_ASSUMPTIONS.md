# Skills block parser — assumptions

Module: `src/core/parsing/cv-skills-block-parser.js`  
Parser id: **`SKILLS_BLOCK_PARSER_V2`**  
Pollution filter: `src/core/parsing/skills-section-pollution-filter.js` (`SKILLS_POLLUTION_FILTER_V2`)

## Purpose

Parse **skills section blocks** into categorized skill items **only when source context strongly supports emission**. Rejects clients, employers, schools, portfolio captions, education bleed, and OCR junk.

## Section gate (default)

- **Primary source**: blocks tagged `CV_SECTION.SKILLS` only.
- **Cross-section** (opt-in `allowCrossSection: true`): only **dictionary-backed tool** tokens with confidence ≥ **0.88**, still passing pollution filter.
- Never harvests from experience client lists, education lines, or interests by default.

## Section purity (`assessSkillsSectionPurity`)

Before trusting output, measures skills-tagged blocks:

| Metric | Meaning |
|--------|---------|
| `purity_ratio` | Share of tokens that are not pollution |
| `dictionary_support_ratio` | Share backed by allowlist / entity catalog |
| `strict_pass` | `purity_ratio ≥ 0.55` and dictionary support adequate |

Issues: `high_pollution_ratio`, `low_dictionary_support`, `no_skill_candidates`.

## Categories

| `category` | Examples | Detection |
|------------|----------|-----------|
| `tools` | Photoshop, Illustrator, InDesign, Affinity Designer, Procreate, After Effects | `SOFTWARE_RECOGNIZER`, `TOOL_TERMS`, OCR aliases |
| `technical` | Illustration, Typography | `SKILLS` dictionary, `CREATIVE_SKILL_RE` only — **no generic free-text fallback** |
| `languages` | French, English | `LANGUAGE_RECOGNIZER` |
| `soft` | Leadership, Communication, Teamwork | `SOFT_SKILL_TERMS` |

Software names normalize to entity canonical labels (e.g. `Indesign` → `InDesign`, `After effect` → `After Effects`).

## Strict emit policy

- `MIN_SKILLS_EMIT_CONFIDENCE` = **0.55** — weaker items are dropped.
- Tokens must classify via allowlist/dictionary/alias — unknown strings are **not** emitted as technical skills.
- OCR fragments (`isOcrSkillFragment`) rejected unless dictionary-backed.

## Pollution denylist

Rejected tokens/lines (`pollutionReason` / `isSkillsSectionPollution`):

| Pattern | Examples blocked |
|---------|------------------|
| Client brands | Nike, Converse, Pantone, standalone `Adobe`, Arte, PlayStation, adidas |
| Client list lines | `Clients include Nike, Converse, …` |
| Companies / agencies | McCann, Havas, Publicis, BETC, … |
| Portfolio captions | `Personal Project …`, `T-shirt design for adidas`, page 2 portfolio labels |
| Education bleed | LISAA, Créapôle, degree programs, year ranges |
| Experience bleed | Freelancer lines, internship labels, dated role lines |
| Job title bleed | `Graphic Designer & Illustrator` (whole line) |
| Interests / hobbies | Photography, Snowboard, Soccer (standalone) |
| OCR junk / fragments | Broken tokens, digit-heavy garbage, section header labels |

## Adobe disambiguation

- `Adobe` alone → **rejected** (`standalone_adobe_client`).
- `Adobe Illustrator`, `Photoshop`, etc. in skills section → **tools** via software entity catalog.

## Illustrator disambiguation

- Standalone `Illustrator` in skills section → **tool** (software entity).
- `Graphic Designer & Illustrator` job title line → **rejected** via job-title bleed rule.

## Confidence scoring (0–1)

- Base: 0.45
- +0.28 skills-section source
- +0.18 tools / +0.12 technical / +0.15 languages / +0.10 soft
- +0.12 dictionary hit
- −0.15 technical without dictionary (skills section)
- −0.35 non-skills-section (cross-section path)
- −0.50 client-list source line

Cross-section tools require **≥ 0.88** after scoring and dictionary backing.

## Debug mode

Pass `{ debug: true }` or set `globalThis.HIRELY_DEBUG`. Returns:

| Field | Description |
|-------|-------------|
| `reject_trace[]` | Per-token rejections with `reason`, `token`, `source_block_id` |
| `parse_debug` | `buildSkillsParseDebug()` — strategy, section purity, stats, events |
| `section_purity` | `assessSkillsSectionPurity()` snapshot |

## Integration

```javascript
import { parseSkillsFromSegments, parseSkillsLines } from './cv-skills-block-parser.js';

const { items, byCategory, reject_trace, parse_debug } = parseSkillsLines([
  'Photoshop',
  'Illustrator',
  'Indesign',
  'Affinity designer',
  'Procreate',
  'After effect',
]);
// byCategory.tools → ['Photoshop', 'Illustrator', 'InDesign', ...]
```
