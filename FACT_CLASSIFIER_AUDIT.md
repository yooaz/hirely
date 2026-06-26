# P2 — Fact Classifier Audit

## Problem

Misrouting in CV build:

- Skills → Clients
- Languages → Tools
- Education → Experience
- Random / prose text → Skills

Root causes:

1. Section block hints overrode line classification and block confidence boosted weak lines above 80%.
2. Language lines were split on em-dash (`English — fluent` → `English` + `fluent`).
3. No strict validation layer between extraction and `buildCvFromFacts`.

## Solution — Fact layer first

**Stage:** `FACT_EXTRACTION_V2` → `fact-classifier-v1` → `CV_FROM_FACTS_V1`

Each fact:

```json
{ "type", "value", "confidence", "sourceLine" }
```

### Allowed types

`identity`, `contact`, `summary`, `experience`, `education`, `skill`, `tool`, `language`, `client`, `project`, `interest`, `unknown`

### Strict rules

| Type | Rule |
|------|------|
| language | English, French, Spanish, etc. + optional proficiency |
| tool | Software only (Photoshop, Illustrator, Figma, …) |
| education | School / university / degree names |
| client | Company / brand names |
| skill | Professional capabilities (packaging, branding, illustration, typography, design) |

### Confidence gate

- `FACT_CONFIDENCE_THRESHOLD = 0.8` (80%)
- Below threshold → **Suggestions / review queue**, not CV sections
- Wrong category → contract failure → reclassify or `unknown` + review
- `unknown` is acceptable

## Files

| File | Role |
|------|------|
| `src/core/parsing/fact-classifier.js` | Strict classify + contract validation |
| `src/core/parsing/fact-extraction.js` | Extract facts; line beats hint; no block boost |
| `src/core/parsing/cv-from-facts.js` | Partition accepted / pending |
| `src/core/parsing/cv-section-contract.js` | Per-section validators |
| `src/core/parsing/classification-engine-v2.js` | Line specialty scorer |

## Priority order

1. Prose summary detection
2. `classifySpecialtyLineV2` (line-level, ≥ 80%)
3. Section contract validation
4. Section hint (only when line uncertain; capped &lt; 80%)
5. `unknown` → review queue

## Verify

```bash
npm run qa:fact-classifier
npm run qa:fact-extraction
```
