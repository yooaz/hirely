# GENERALIZATION LOCK REPORT — H1

Generated: 2026-06-06  
Scope: **runtime** paths `src/`, `api/`, `lib/`  
Excluded (allowed): `src/tests/**`, `tests/**`, `src/data/samples/**`, `src/data/dictionaries/**`, `*.md` audit docs

## Verdict: **PASS**

Runtime contains **zero candidate-specific logic**. No hardcoded recovery, output, classification, or injection tied to Yohann Azancot, Yoaz, or `yoaz@hotmail.fr`.

---

## Audit method

1. Full-text search for eight terms across `src/`, `api/`, `lib/`
2. Forbidden-pattern scan (`tryRecoverCreapole`, `YOAZ_CANONICAL`, `hasMcCann`, `isLikelyYoaz`, etc.)
3. Manual review of every runtime hit outside dictionaries/samples/tests
4. Automated gate: `node tests/lib/universal-parser-gate.mjs` → `scanParserHardcodeViolations()` → **0 violations**

### Search command (reproducible)

```bash
rg -n "Yohann|Yoaz|yoaz@hotmail|LISAA|Créapole|McCann|Freelance Illustrator|Graphic Designer" \
  src/ api/ lib/ \
  --glob '!**/tests/**' \
  --glob '!**/samples/**' \
  --glob '!**/dictionaries/**' \
  --glob '!**/*.md'
```

---

## 1. Candidate-specific terms (release gate)

| Term | Runtime hits (excl. dicts/samples/tests) | Classification |
|------|------------------------------------------:|----------------|
| **Yohann** | 0 | — |
| **Yoaz** | 0 | — |
| **yoaz@hotmail.fr** | 0 | — |
| `tryRecoverCreapole` / `YOAZ_CANONICAL` / `hasMcCann` / `isLikelyYoaz` | 0 | — |

**Result:** No person-specific identity repair, no email override, no named recovery functions, no Yoaz signal detectors in production runtime.

### Allowed non-runtime matches (documented, not gated)

| Location | Content | Why allowed |
|----------|---------|-------------|
| `src/data/samples/creative-cv.txt` | Yohann Azancot, yoaz@hotmail.fr | Fixture sample |
| `src/tests/**` (80+ files) | Yoaz regression fixtures, golden gates | Test harness only |
| `src/data/dictionaries/**` | LISAA, Créapole, McCann, Freelance Illustrator | Generic entity data |

---

## 2. Entity terms in runtime (not candidate-specific)

These terms appear in production code but do **not** force a single-CV outcome. They are generic creative-industry signals, dictionary-backed OCR hints, or UI placeholders.

### LISAA (4 runtime files)

| File | Usage | Verdict |
|------|-------|---------|
| `src/core/parsing/creative-entity-guard.js` | OCR typo → canonical; gated by `ALL_CREATIVE_ENTITIES` | **ALLOWED** — dictionary-backed OCR hint |
| `src/core/parsing/section-validation.js` | Education-leak guard (`LISAA\|Créapole\|Gobelins\|ENSAD\|school…`) | **ALLOWED** — generic misclassification guard |
| `src/core/parsing/corruption-detector.js` | Acronym whitelist (with MBA, BFA, HTML…) | **ALLOWED** — OCR noise filter |
| `src/core/extraction/ocr-quality-score.js` | Acronym whitelist (with INDESIGN, PHOTOSHOP…) | **ALLOWED** — OCR quality heuristic |

**Additional inline mentions** in `src/core/parsing/*.js` (42 lines total): `lisaa` appears alongside `school`, `university`, `gobelins`, `ensad` in education-signal regexes (`classification-engine-v2.js`, `line-cleaner.js`, `field-completeness-gate.js`, etc.). These classify **any** CV with school tokens — not Yoaz-only recovery.

### Créapole (2 runtime files)

| File | Usage | Verdict |
|------|-------|---------|
| `src/core/parsing/creative-entity-guard.js` | OCR typo → canonical; dictionary-gated | **ALLOWED** |
| `src/core/parsing/section-validation.js` | Education-leak guard | **ALLOWED** |

School recovery uses `tryRecoverSchoolEducation()` + `SCHOOL_RECOGNIZER` / `schools.json` — no `tryRecoverCreapoleEducation`.

### McCann (3 runtime files)

| File | Usage | Verdict |
|------|-------|---------|
| `src/core/parsing/creative-entity-guard.js` | OCR typo → canonical; dictionary-gated | **ALLOWED** |
| `lib/cv-parser.js` | `KNOWN_CLIENTS` array entry | **ALLOWED** — generic agency/client list (legacy API parser) |
| `src/ui/editor/resume-editor.js` | Input placeholder `Ex. McCann` | **ALLOWED** — UI hint, not parser logic |

**Additional inline mentions:** `mccann` in experience-harvest regexes (`import-repair.js`, `structured-resume.js`, `experience-recovery.js`, etc.) as a **generic agency keyword** alongside `freelanc`, `internship`, `agency`. No `hasMcCann` branch or forced McCann experience injection.

### Freelance Illustrator (2 runtime files)

| File | Usage | Verdict |
|------|-------|---------|
| `src/debug/ocr-forensic.js` | Default forensic needle (overridable param) | **ALLOWED** — debug tooling |
| `src/debug/forensic-mode.js` | Debug expected token list | **ALLOWED** — debug tooling |

`parseFreelanceCareerLine()` extracts role **from line text**; no forced `Freelance Illustrator / Graphic Designer` canonical string in `src/core`.

### Graphic Designer (7 runtime files)

| File | Usage | Verdict |
|------|-------|---------|
| `src/core/parsing/section-anchor-extract.js` | Infers title when line contains designer + illustrator tokens | **ALLOWED** — generic role inference |
| `src/core/parsing/ocr-cleanup.js` | OCR typo repair (`graphi[c] designer` → `Graphic Designer`) | **ALLOWED** — generic OCR fix |
| `src/core/parsing/creative-cv-roles.js` | Role dictionary entry | **ALLOWED** — role taxonomy |
| `src/core/parsing/semantic-line-classifier.js` | JSDoc example | **ALLOWED** — comment only |
| `src/core/parsing/semantic-section-infer.js` | JSDoc example | **ALLOWED** — comment only |
| `src/core/parsing/section-engine-v2.js` | JSDoc example | **ALLOWED** — comment only |
| `src/ui/editor/resume-editor.js` | Input placeholder `Ex. Graphic Designer` | **ALLOWED** — UI hint |

---

## 3. Forbidden-pattern scan

| Pattern | `src/core` | `lib/` | `api/` |
|---------|------------|--------|--------|
| `repairIdentityFromOcrSignals` person literals | None | — | — |
| `tryRecoverCreapoleEducation` | None (replaced by `tryRecoverSchoolEducation`) | — | — |
| `YOAZ_CANONICAL` / `isLikelyYoazSignal` | None | None | None |
| `hasMcCann` agency branch | None | None | None |
| Forced `Freelance Illustrator / Graphic Designer` role | None | None | None |
| Forced `2011–2022` freelance dates | None | None | None |
| `parseMcCannBlock` / `parseFreelancerBlock` | None | None | None |

---

## 4. API / legacy parser

| Path | Status |
|------|--------|
| `api/analyze.js` | Imports `lib/cv-parser.js` for AI fallback only; **no Yoaz/Yohann literals** |
| `lib/cv-parser.js` | Generic extraction; `KNOWN_CLIENTS` includes McCann as one of 14 brands; **no person-specific paths** |

---

## 5. Automated gates

| Gate | Result |
|------|--------|
| `scanParserHardcodeViolations()` | **0 violations** |
| `FORBIDDEN_PARSER_LITERALS` scan (`src/core/parsing/*.js`) | **Clean** |
| Prior regression (`npm run test:yoaz-pdf-regression`) | **PASS** (generic rules) |
| Prior stress (`npm run stress:hirely`) | **100% import success** |

### CI lock command

```bash
node tests/lib/universal-parser-gate.mjs
node -e "
import { scanParserHardcodeViolations } from './tests/lib/universal-parser-gate.mjs';
const v = scanParserHardcodeViolations();
if (v.length) { console.error(v); process.exit(1); }
console.log('GENERALIZATION_LOCK: PASS');
"
```

---

## 6. H2 hygiene (optional, not blocking)

These are **not** candidate-specific and do not fail H1, but would further reduce inline entity literals:

1. Replace hardcoded `lisaa|créapole|mccann` regex fragments in parsing modules with terms loaded from `schools.json` / `entity-catalog.js` at module init.
2. Move `lib/cv-parser.js` `KNOWN_CLIENTS` to `clients.json` import (legacy API path).
3. Expand `universal-parser-gate.mjs` `PARSER_SCAN_SKIP` rationale into a dictionary-allowlist doc.

---

## Summary

| Criterion | Status |
|-----------|--------|
| Zero Yohann / Yoaz / yoaz@hotmail.fr in runtime logic | **PASS** |
| Zero hardcoded recovery for one CV | **PASS** |
| Zero hardcoded output / classification / injection for one CV | **PASS** |
| School recovery dictionary-driven | **PASS** |
| Role parsing from extracted line text | **PASS** |
| Tests/fixtures/docs excluded correctly | **PASS** |

**GENERALIZATION LOCK: PASS** — runtime is candidate-agnostic. Entity names (LISAA, Créapole, McCann, Graphic Designer) remain only as generic dictionary data, OCR hints, industry signal keywords, or UI placeholders.
