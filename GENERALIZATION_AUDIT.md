# GENERALIZATION AUDIT

Generated: 2026-06-06  
Re-verified: 2026-06-06 (post P0 cleanup)  
Scope: full codebase search for **Yohann**, **Yoaz**, **LISAA**, **McCann**, **Freelance Illustrator**, **Graphic Designer**, **Créapole**

## Post-cleanup status — **P0 CLEARED**

| Check | Result |
|-------|--------|
| `Yohann\|Yoaz\|yoaz@hotmail\|tryRecoverCreapole\|hasMcCann\|YOAZ_CANONICAL` in `src/core/**` + `lib/cv-parser.js` | **0 matches** |
| `node tests/lib/universal-parser-gate.mjs` | **PASS** |
| `npm run test:yoaz-pdf-regression` | **PASS** (structured sections via generic rules) |
| `npm run stress:hirely` | **100% import success** (9 PASS, 3 PARTIAL, 0 FAIL) |

**Remaining matches** for LISAA/McCann/Créapole/Graphic Designer in `src/core/**` are limited to:

- **Entity dictionaries** (`creative-entity-guard.js` OCR hints gated by `ALL_CREATIVE_ENTITIES`)
- **Generic role detection** (`section-anchor-extract.js`, `creative-cv-roles.js`)
- **OCR typo repair** (`ocr-cleanup.js` — `graphi[c] designer` → `Graphic Designer`)
- **Education leak guard** (`section-validation.js` — rejects school lines misclassified as experience)

None of these force a specific candidate’s name, email, school program, employer, or role string in control flow.

### Files refactored (P0)

| File | Change |
|------|--------|
| `identity-extraction.js` | Generic OCR email repair + name-line recovery (no person literals) |
| `education-recovery.js` | `tryRecoverSchoolEducation` via `SCHOOL_TERMS` / recognizer |
| `classification-fixes.js` | Dictionary-driven school/internship parse; role from line text |
| `resume-output-quality.js` | Client brands via recognizer; generic school recovery |
| `experience-parser.js` | Role from extracted tokens, not forced canonical string |
| `confidence-gate.js` | School boost via `edu.schoolMatch` |
| `sanitize-resume-display.js` | Generic school recovery; `meta.rawText` in identity repair blob |
| `parser-recovery.js` | School terms from dictionary |
| `lib/cv-parser.js` | Removed `YOAZ_CANONICAL` / Yoaz signal fallbacks |

---

## Executive summary (pre-cleanup baseline)

| Category | Files | Severity |
|----------|------:|----------|
| **P0 — Production parser hardcoding** | 8 | ~~Must remove~~ **DONE** |
| **P1 — Legacy parser still wired** | 3 | `api/analyze.js` still imports `lib/cv-parser.js` (Yoaz paths removed) |
| **P2 — School-specific recovery (named functions)** | 4 | Refactored to generic |
| **P3 — Creative-role canonical defaults** | 4 | Refactored to generic extraction |
| **P4 — Entity dictionaries (data)** | 6 | Acceptable (not CV-specific logic) |
| **P5 — Tests, fixtures, QA scripts** | 60+ | Keep as fixtures; gate must not leak |
| **P6 — Reports, samples, UI demo text** | 25+ | Non-parser; replace over time |

**Verdict (updated):** Production import pipeline (`src/core/**`) no longer contains candidate-specific identity repair, school-named recovery functions, or forced creative-role canonical strings. Parser uses **generic patterns** (dictionaries, section headers, date ranges, entity recognizers).

---

## P0 — Production parser logic (MUST REMOVE)

These rules influence parsing or output for any CV, not only test fixtures.

### `identity-extraction.js` — person-specific identity repair

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/identity-extraction.js` | `repairIdentityFromOcrSignals` | 327–328 | `yoaz@hotmail` | Hardcoded email for one person |
| `src/core/parsing/identity-extraction.js` | `repairIdentityFromOcrSignals` | 332–333 | `Yohann Azancot` | Hardcoded name from OCR regex |
| `src/core/parsing/identity-extraction.js` | `repairIdentityFromOcrSignals` | 334–335 | `yoaz@hotmail` + `yoaz` → `Yohann Azancot` | Email-derived name override |

**Action:** Delete person literals. Use generic `extractEmailFromBlob`, name-candidate scoring, and `formatNameCandidateDisplay` only.

---

### `education-recovery.js` — school-named recovery + program defaults

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/education-recovery.js` | `tryRecoverCreapoleEducation` | 25–38 | `Créapole`, `creapole` | Function named and scoped to one school |
| `src/core/parsing/education-recovery.js` | `normalizeSchoolLabel` | 43–44 | `Créapole`, `LISAA` | Hardcoded school label map |
| `src/core/parsing/education-recovery.js` | `parseEducationParts` | 69–72 | `lisaa` → `Web and Motion Design`; `créapole` → `Visual Communication` | Yoaz-specific program defaults |
| `src/core/parsing/education-recovery.js` | `formatSafeEducationEntry` | 93 | `LISAA\|Créapole\|Creapole\|Gobelins\|ENSAD` | School whitelist in control flow |
| `src/core/parsing/education-recovery.js` | `formatSafeEducationEntry` | 113–115 | `tryRecoverCreapoleEducation` | School-specific recovery path |
| `src/core/parsing/education-recovery.js` | `formatSafeEducationEntry` | 129, 136 | `LISAA\|Créapole\|Creapole\|…` | Regex school extraction |
| `src/core/parsing/education-recovery.js` | `dedupeEducationBySchoolAndDates` | 190–194 | `créapole` / `lisaa` program forcing; `2007`→`2009` end clamp | CV-specific date/program repair |

**Action:** Rename `tryRecoverCreapoleEducation` → `tryRecoverSchoolEducation(line, schoolTerms)`. Load schools from `schools.json` / `SCHOOL_TERMS`. Never hardcode program names per school in code.

---

### `classification-fixes.js` — role and education literals

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/classification-fixes.js` | `parseFreelanceCareerLine` | 158 | `Freelance Illustrator / Graphic Designer` | Default role string (creative CV) |
| `src/core/parsing/classification-fixes.js` | `parseFreelanceCareerLine` | 170, 185, 198, 200 | same | Repeated canonical role override |
| `src/core/parsing/classification-fixes.js` | `parseFreelanceCareerLine` | 174 | `Graphic Designer` | Title-case replacement |
| `src/core/parsing/classification-fixes.js` | `parseEducationLineWithContact` | 237, 245 | `LISAA\|Créapole\|Creapole` | School regex (use dictionary) |
| `src/core/parsing/classification-fixes.js` | `parseInternshipLine` | 281–283 | `mccann`, `hasMcCann` | Agency-specific guard |
| `src/core/parsing/classification-fixes.js` | `parseInternshipLine` | 298 | `McCann` | Company normalization literal |

**Action:** Default role = extracted tokens or `ROLE_UNCERTAIN_LABEL`. Schools via `findLongestDictionaryTerm`. Internship parser: generic `company` from line, no McCann branch.

---

### `resume-output-quality.js` — output polish hardcoding

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/resume-output-quality.js` | `BRAND_PATTERNS` | 105 | `McCann` | Client brand list (OK if dictionary-driven) |
| `src/core/parsing/resume-output-quality.js` | `normalizeFreelanceExperienceRole` | 121, 124, 127 | `Freelance Illustrator / Graphic Designer` | Forces one creative role |
| `src/core/parsing/resume-output-quality.js` | `recoverMisclassifiedFromTools` | 254 | `Freelance Illustrator / Graphic Designer` | Synthetic experience injection |
| `src/core/parsing/resume-output-quality.js` | `polishResumeOutput` | 309–312 | `2011` / `2022` dates | Yoaz freelance date normalization |
| `src/core/parsing/resume-output-quality.js` | `polishResumeOutput` | 324, 332, 364 | `tryRecoverCreapoleEducation` | School-specific recovery |
| `src/core/parsing/resume-output-quality.js` | `polishResumeOutput` | 341 | `créapole\|creapole` confidence gate | School-named branch |

**Action:** Move brand patterns to `entity-catalog` / `clients.json`. Role normalization from `creative_roles.json`. Date ranges from parsed line only. Generic school recovery.

---

### `experience-parser.js` — role canonicalization

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/experience-parser.js` | `normalizeExperienceRole` (inner) | 199, 202 | `Freelance Illustrator / Graphic Designer` | Creative CV default |
| `src/core/parsing/experience-parser.js` | same | 205–207 | `Freelance Graphic Designer`, `Illustrator / Graphic Designer` | Role family defaults |

**Action:** Resolve roles via `creative_roles.json` aliases or preserve extracted text when confidence ≥ threshold.

---

### `confidence-gate.js` — education score boost

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/validation/confidence-gate.js` | `scoreEducationLine` | 118 | `LISAA\|Créapole\|Creapole\|Gobelins\|ENSAD` | School whitelist boosts confidence |

**Action:** Use `scoreEducationConfidence` + dictionary `schoolMatch` only.

---

### `parser-recovery.js` — institution short list

| File | Constant | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/parser-recovery.js` | `INSTITUTION_SHORT_RE` | 46 | `Créapole\|LISAA\|Sorbonne\|HEC\|…` | Mixed generic + Yoaz schools in one regex |

**Action:** Build from `schools.json` at module init; no inline school names.

---

### `sanitize-resume-display.js` — display-layer school recovery

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/validation/sanitize-resume-display.js` | (import) | 22 | `tryRecoverCreapoleEducation` | School-named API in display path |
| `src/core/validation/sanitize-resume-display.js` | `sanitizeEducationList` area | 248, 313 | `tryRecoverCreapoleEducation` | Same |

**Action:** Call generic `recoverSchoolEducationLine(line)` backed by dictionary.

---

### `section-anchor-extract.js` — title inference (borderline)

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/section-anchor-extract.js` | `resolveCreativeProfessionalTitle` | 140–141 | `Graphic Designer & Illustrator`, `Graphic Designer` | Pattern-based (generic-ish) but creative-domain only |

**Action:** Keep pattern logic; remove “creative” naming — use `resolveProfessionalTitleFromKeywords`.

---

### `ocr-cleanup.js` — OCR typo repair (acceptable pattern)

| File | Constant | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/ocr-cleanup.js` | `OCR_TYPO_REPAIRS` | 16–17 | `Graphic Designer` | Generic OCR fix for common title corruption |

**Status:** Acceptable — repairs corrupted tokens, not person-specific.

---

### `creative-entity-guard.js` — entity normalization (dictionary-style)

| File | Constant | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `src/core/parsing/creative-entity-guard.js` | repair map | 35–38 | `LISAA`, `Créapole`, `McCann` | Entity spelling normalization |

**Status:** Acceptable if sourced from dictionaries; prefer loading from `schools.json` / `creativeAgencies.js`.

---

## P1 — Legacy parser still wired (MUST REMOVE)

| File | Function / export | Line | Match | Issue |
|------|-------------------|-----:|-------|-------|
| `lib/cv-parser.js` | `isLikelyYoazSignal` | 131–132 | `yohann azancot`, `yoaz@` | Detects one CV and changes behavior |
| `lib/cv-parser.js` | `inferName` | 302 | `yohann azancot`, `yoaz@` → `Yohann Azancot` | Hardcoded name |
| `lib/cv-parser.js` | `inferTitle` | 325 | `Graphic Designer & Illustrator` | Default title for Yoaz signal |
| `lib/cv-parser.js` | `YOAZ_CANONICAL` | 465–497 | All search terms | Full canonical CV fallback object |
| `lib/cv-parser.js` | `getCleanSampleCv` | 568–572 | uses `YOAZ_CANONICAL` | Returns person CV on weak extraction |
| `lib/cv-parser.js` | `normalizeExtraction` | 579–591 | `isYoaz`, `getCleanSampleCv` | Yoaz → inject canonical CV |
| `lib/cv-parser.js` | `parseCvTextCore` | 606–607 | `YOAZ_CANONICAL.name/title` | Name/title fallback |
| `api/analyze.js` | (import) | 5 | imports `lib/cv-parser.js` | Legacy path still reachable |
| `archive/legacy-public/lib/hirely-cv-parser.js` | same pattern | 111, 304, 467, 581, 608 | duplicates | Archive copy |
| `archive/legacy-public/lib/hirely-cv-parser.mjs` | same pattern | 125, 258, 304 | duplicates | Archive copy |

**Action:** Remove `YOAZ_CANONICAL`, `isLikelyYoazSignal`, and Yoaz fallbacks. Wire `api/analyze.js` to `src/core/pipeline/hirely-import.js` or delete endpoint.

---

## P2 — Test gates that must not leak into parser

| File | Function | Line | Match | Issue |
|------|----------|-----:|-------|-------|
| `tests/lib/universal-parser-gate.mjs` | `FORBIDDEN_EXPORTS` | 21–23 | `Yohann Azancot`, `yoaz@hotmail`, `parseMcCannBlock` | Correct guard — keep |
| `tests/lib/universal-parser-gate.mjs` | scan loop | 133 | `Yohann\|Yoaz` in exports | Fails if parser exports person logic |
| `tests/lib/parser-validation-gate.mjs` | expectations | 22–24 | `yohann`, `graphic designer`, `yoaz@hotmail`, `lisaa\|créapole` | Fixture-specific gate (OK in tests) |
| `tests/lib/extraction-release-criteria.mjs` | `evaluateDesignerCv` | 149–150 | `Yohann Azancot` | Person-specific pass criteria |
| `tests/lib/quality-gate.mjs` | `evaluateYoazFixture` | 182–183 | deprecated alias | Already delegates to universal — OK |

**Action:** Replace `evaluateDesignerCv` name checks with structural checks. Keep `universal-parser-gate` as CI enforcement.

---

## P3 — UI & demo sample (non-parser but person-specific)

| File | Context | Line | Match | Issue |
|------|---------|-----:|-------|-------|
| `index.html` | `roleInput` default | 1026 | `Senior Graphic Designer` | UI placeholder (low risk) |
| `index.html` | `letterTargetRole` placeholder | 1308 | `Senior Graphic Designer` | UI placeholder |
| `index.html` | `const sample=` | 3333–3349 | Yohann, Graphic Designer, Freelance Illustrator, McCann, LISAA, Créapole | Demo paste sample in production HTML |

**Action:** Replace `sample` with generic designer fixture or `tests/fixtures/creative-cv/fixture.txt` loaded at dev time only.

---

## P4 — Entity dictionaries (ACCEPTABLE — data, not control flow)

These files **mention** LISAA/McCann/Graphic Designer as catalog entries. They are not CV-specific logic if consumed generically.

| File | Line | Terms |
|------|-----:|-------|
| `src/data/dictionaries/schools.json` | 7–8, 39–41 | LISAA, Créapole |
| `src/data/dictionaries/creative/creativeAgencies.js` | 3 | McCann |
| `src/data/dictionaries/creative/creativeSchools.js` | (catalog) | LISAA, Créapole |
| `src/data/dictionaries/creative_roles.json` | 7–8, 21 | Graphic Designer, Freelance Illustrator |
| `src/data/dictionaries/roleKeywords.js` | (aliases) | Graphic Designer |
| `src/data/samples/creative-cv.txt` | 1–14 | Full Yoaz sample file |

**Status:** Keep. Ensure parser reads dictionaries; never duplicate same literals in `if` branches.

---

## P5 — Test fixtures & QA scripts (expected references)

Over **60** test/QA files embed Yoaz fixture text for regression. These are **not parser rules** but create pressure to keep person-specific behavior.

Representative files:

| File | Function / note | Terms |
|------|-----------------|-------|
| `tests/fixtures/yoaz-cv/fixture.txt` | fixture | All search terms |
| `tests/golden/yoaz-cv-classification.json` | golden ref | LISAA, Créapole, Yohann |
| `tests/golden/cv-expectations.json` | `YOAZ_CV_DESIGNER` | Yohann Azancot |
| `tests/lib/section-ground-truth.mjs` | `GROUND_TRUTH_OVERRIDES` | McCann, LISAA, Freelance Illustrator, Studio Yoaz |
| `scripts/final-acceptance-test.mjs` | E2E | Yoaz PDF |
| `scripts/test-yoaz-pdf-regression.mjs` | regression | McCann, LISAA lines |
| `src/tests/qa-*.mjs` | 40+ files | fixture strings |

**Action:** Retain fixtures; rename `yoaz-cv` → `designer-cv-golden` in docs only. Do not import fixture strings into `src/core` conditionals.

---

## P6 — Generated reports & audit artifacts (informational)

Reports document Yoaz PDF runs; they do not affect parser runtime:

- `EDUCATION_AUDIT.md`, `EDUCATION_RECOVERY_REPORT.md`, `EXPERIENCE_AUDIT.md`
- `HIRELY_STRESS_REPORT.md`, `SECTION_ACCURACY_REPORT.md`, `FINAL_ACCEPTANCE_REPORT.md`
- `PDF_EXPORT_AUDIT.md`, `TEMPLATE_SYNC_REPORT.md`, `DATA_LOSS_REPORT` (via `scripts/data-loss-audit.mjs`)
- `tests/output/ocr-quality-yoaz/report.json`, `TRACE_YOAZ_PIPELINE.json`

**Action:** No code removal required; regenerate with multi-fixture language over time.

---

## Search-term index (production `src/core` only)

### Yohann

| File | Function | Line |
|------|----------|-----:|
| `src/core/parsing/identity-extraction.js` | `repairIdentityFromOcrSignals` | 332–335 |

### Yoaz

| File | Function | Line |
|------|----------|-----:|
| `src/core/parsing/identity-extraction.js` | `repairIdentityFromOcrSignals` | 327–328, 334–335 |

### LISAA

| File | Function | Line |
|------|----------|-----:|
| `src/core/parsing/education-recovery.js` | `normalizeSchoolLabel`, `parseEducationParts`, `formatSafeEducationEntry`, `dedupeEducationBySchoolAndDates` | 44, 69, 93, 129, 136, 194 |
| `src/core/parsing/classification-fixes.js` | `parseEducationLineWithContact` | 237, 245 |
| `src/core/validation/confidence-gate.js` | `scoreEducationLine` | 118 |
| `src/core/parsing/parser-recovery.js` | `INSTITUTION_SHORT_RE` | 46 |
| `src/core/parsing/creative-entity-guard.js` | OCR repair map | 35 |

### Créapole / Creapole

| File | Function | Line |
|------|----------|-----:|
| `src/core/parsing/education-recovery.js` | `tryRecoverCreapoleEducation` + callers | 25–38, 50, 113, 190–192 |
| `src/core/parsing/classification-fixes.js` | `parseEducationLineWithContact` | 237, 245 |
| `src/core/parsing/resume-output-quality.js` | `polishResumeOutput` | 324, 332, 341, 364 |
| `src/core/validation/sanitize-resume-display.js` | education sanitize | 248, 313 |
| `src/core/validation/confidence-gate.js` | `scoreEducationLine` | 118 |
| `src/core/parsing/parser-recovery.js` | `INSTITUTION_SHORT_RE` | 46 |
| `src/core/parsing/creative-entity-guard.js` | OCR repair map | 36–37 |

### McCann

| File | Function | Line |
|------|----------|-----:|
| `src/core/parsing/classification-fixes.js` | `parseInternshipLine` | 281–283, 298 |
| `src/core/parsing/resume-output-quality.js` | `BRAND_PATTERNS` | 105 |
| `src/core/parsing/creative-entity-guard.js` | OCR repair map | 38 |

### Freelance Illustrator

| File | Function | Line |
|------|----------|-----:|
| `src/core/parsing/classification-fixes.js` | `parseFreelanceCareerLine` | 158, 170, 185, 198, 200 |
| `src/core/parsing/resume-output-quality.js` | `normalizeFreelanceExperienceRole`, `recoverMisclassifiedFromTools` | 121, 124, 127, 254 |
| `src/core/parsing/experience-parser.js` | role normalization | 199, 202 |

### Graphic Designer

| File | Function | Line |
|------|----------|-----:|
| `src/core/parsing/section-anchor-extract.js` | `resolveCreativeProfessionalTitle` | 140–141 |
| `src/core/parsing/classification-fixes.js` | `parseFreelanceCareerLine` | 174, 185, 198, 200 |
| `src/core/parsing/experience-parser.js` | role normalization | 199, 202, 205–207 |
| `src/core/parsing/ocr-cleanup.js` | `OCR_TYPO_REPAIRS` | 16–17 |

---

## Recommended removal order

1. **`repairIdentityFromOcrSignals`** — remove `Yohann` / `yoaz@hotmail` literals (highest risk).
2. **`lib/cv-parser.js`** — delete `YOAZ_CANONICAL` + `isLikelyYoazSignal`; fix `api/analyze.js`.
3. **`tryRecoverCreapoleEducation`** — generalize to dictionary-driven school recovery; rename function.
4. **`parseFreelanceCareerLine` / `normalizeFreelanceExperienceRole`** — stop forcing `Freelance Illustrator / Graphic Designer`.
5. **`polishResumeOutput`** — remove `2011–2022` freelance date constants and Creapole-only branches.
6. **`parseInternshipLine`** — remove McCann-specific branches; keep generic internship + agency parse.
7. **`scoreEducationLine`** — remove inline school whitelist; use dictionary match score.
8. **`index.html` `sample`** — swap for generic fixture.

---

## CI guard (already present)

```bash
# Fails if production exports contain Yohann/Yoaz/parseMcCannBlock
node tests/lib/universal-parser-gate.mjs
```

Add to pre-commit / CI after P0 removals to prevent regression.

---

## Run audit again

```bash
rg -n "Yohann|Yoaz|LISAA|McCann|Freelance Illustrator|Graphic Designer|Créapole|Creapole" \
  --glob "*.{js,mjs,ts,html}" \
  --glob "!**/node_modules/**" \
  --glob "!**/tests/output/**" \
  --glob "!**/*.md"
```

Target after cleanup: matches only in `tests/**`, `src/data/dictionaries/**`, `src/data/samples/**`, and `index.html` demo (until replaced).
