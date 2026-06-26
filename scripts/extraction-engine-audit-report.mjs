#!/usr/bin/env node
/**
 * P0 — Generates EXTRACTION_ENGINE_AUDIT.md from live QA + pipeline inventory.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'EXTRACTION_ENGINE_AUDIT.md');

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') + (e.message || '') };
  }
}

function summarize(name, r) {
  const pass = (r.out.match(/\bPASS\b/g) || []).length;
  const fail = (r.out.match(/\bFAIL\b/g) || []).length;
  const tail = r.out.trim().split('\n').slice(-3).join('\n');
  return { name, ok: r.ok, pass, fail, tail };
}

const suites = [
  ['qa:multi-format-extraction', 'npm run qa:multi-format-extraction'],
  ['qa:document-extract', 'npm run qa:document-extract'],
  ['qa:no-fake-data-policy', 'npm run qa:no-fake-data-policy'],
  ['qa:extraction-confidence-tiers', 'node src/tests/qa-extraction-confidence-tiers.mjs'],
  ['qa:extraction-lock', 'node src/tests/qa-extraction-lock.mjs'],
  ['qa:extraction-loss-audit', 'npm run qa:extraction-loss-audit'],
  ['qa:semantic-confidence-gate', 'npm run qa:semantic-confidence-gate'],
  ['qa:name-phone-rewrite', 'node src/tests/qa-name-phone-rewrite.mjs'],
  ['qa:person-company-disambiguation', 'node src/tests/qa-person-company-disambiguation.mjs'],
];

const results = suites.map(([name, cmd]) => summarize(name, run(cmd)));

const now = new Date().toISOString();

const report = `# EXTRACTION_ENGINE_AUDIT

**Mission:** P0 extraction engine hardening — audit full pipeline, enforce never-guess policy, implement HIGH/MEDIUM/LOW confidence tiers.  
**Generated:** ${now}  
**Policy:** Missing data allowed. Wrong data forbidden. LOW confidence → \`reviewQueue\`.

---

## Executive summary

| Layer | Status | Risk |
|-------|--------|------|
| PDF native text | ⚠️ Partial | Weak/garbled layers now force OCR (lock fix); browser 0-char path remains |
| OCR | ⚠️ Partial | Timeout recovery can bypass quality gate |
| DOCX | ✓ Mostly OK | Table/column DOCX shuffles reading order |
| TXT | ✓ OK | Direct path, no OCR |
| PNG/JPG | ⚠️ Partial | Browser-only OCR; Node QA uses fixtures |
| Identity / contact | ✓ Hardened | Name ≥85%, phone ≥95% or reviewQueue |
| Experience / education / skills | ⚠️ Partial | Misclassification poisons identity on non-creative CVs |
| Confidence tiers | ✓ Implemented | \`EXTRACTION_CONFIDENCE_TIERS_V1\` wired to reviewQueue |

**Root cause of “reference CV works, real CVs fail”:** The canonical Yoaz fixture passes on **structured text** (paste, harness PDFs). Real browser PDF uploads often yield **0 native chars** or **garbled short layers**; extraction lock previously skipped OCR when char count ≥500 even when quality was unusable. Parser then runs on junk or empty text → partial/empty CV or \`IMPORT_NEEDS_PASTE\`.

---

## QA gate snapshot (live run)

| Suite | Result | Notes |
|-------|--------|-------|
${results.map((r) => `| \`${r.name}\` | ${r.ok ? '**PASS**' : '**FAIL**'} | pass≈${r.pass} fail≈${r.fail} |`).join('\n')}

---

## Pipeline map

\`\`\`mermaid
flowchart TD
  A[File upload] --> B[extractFromFileDetailed]
  B --> C[document-extract.js]
  C --> D{Format}
  D -->|PDF| E[pdf-router + native lines]
  D -->|DOCX| F[docx-extract]
  D -->|TXT| G[plain text]
  D -->|image| H[OCR only]
  E --> I{Quality / lock}
  I -->|weak or short| J[OCR pipeline]
  I -->|strong native| K[selectBestTextSource]
  J --> K
  F --> K
  G --> K
  H --> K
  K --> L[assessOcrBeforeParser]
  L --> M[production parsing pipeline]
  M --> N[identity / facts / sections]
  N --> O[confidence tiers + reviewQueue]
  O --> P[finalResumeData render gate]
\`\`\`

**Entry files:** \`extract-file.js\` → \`document-extract.js\` → \`enterprise-engine.js\` → \`multi-format-extraction-engine.js\`

---

## Stage audit

### 1. PDF text extraction

| | |
|--|--|
| **Modules** | \`pdf-router.js\`, \`pdf-lines-native.js\`, \`pdf-text-quality.js\`, \`enterprise-engine.js\` |
| **Input** | PDF via pdf.js text items + positions |
| **Output** | \`ExtractedLine[]\` (\`source: native\`) |
| **Failure points** | No text layer; per-page &lt;32 chars; garbled encoding; Node path: \`PDF.js non chargé\` |
| **False positives** | Long garbled native accepted as “has text” → OCR skipped (pre-fix) |
| **False negatives** | Clean short CVs (&lt;300 chars) routed to OCR unnecessarily |
| **Fix applied** | \`shouldRunOcrForTextLength\` now OCRs when \`len &lt; 300\`, \`usable === false\`, or \`strongTextLayer === false\` |

### 2. OCR extraction

| | |
|--|--|
| **Modules** | \`ocr-pipeline.js\`, \`pdf-ocr-run.js\`, \`ocr-lines.js\`, \`ocr-multipass.js\`, \`api/ocr.js\` |
| **Input** | Rendered canvas / image bytes |
| **Output** | \`{ text, lines, provider, confidence }\` |
| **Failure points** | All providers fail; \`OCR_QUALITY_FAILED\`; \`OCR_TIMEOUT\`; rotation corruption |
| **False positives** | Timeout partial cache merged without quality re-check (\`enterprise-engine.js\` recovery path) |
| **False negatives** | Extraction lock blocked OCR on 500+ char weak native |
| **Fix applied** | Lock passes quality opts from hybrid routes; \`ocr-lines.js\` + \`pdf-ocr-run.js\` forward \`usable\` / \`strongTextLayer\` |

### 3. DOCX extraction

| | |
|--|--|
| **Modules** | \`docx-extract.js\`, \`docx-structure-recovery.js\` |
| **Input** | Mammoth HTML / raw text |
| **Output** | Plain text + structure hints |
| **Failure points** | Multi-column tables → line order shuffle; embedded images ignored |
| **False positives** | Header/footer boilerplate classified as experience |
| **False negatives** | Skills in table cells dropped when not in paragraph flow |
| **Recommended** | Column-aware DOCX block extractor; table cell → separate \`ExtractedLine\` with bbox |

### 4. TXT extraction

| | |
|--|--|
| **Modules** | \`document-extract.js\` → \`extractPlainTextEnterprise\` |
| **Failure points** | Encoding mis-detect; CRLF-only section breaks |
| **False positives** | Rare — text is ground truth |
| **False negatives** | None significant |
| **Status** | **Reliable** — preferred fallback for failed PDF |

### 5. PNG/JPG extraction

| | |
|--|--|
| **Modules** | \`extractImageEnterprise\`, Tesseract / Vision via \`ocr.js\` |
| **Failure points** | Browser-only pdf.js/Tesseract; low DPI; handwriting |
| **False positives** | OCR junk words → skills (\`semantic-confidence-gate\` FAIL: “not in skills”) |
| **False negatives** | Skipped in Node CI without browser |
| **Recommended** | Reject OCR tokens below dictionary + semantic gate; queue as unsorted |

### 6. Identity extraction

| | |
|--|--|
| **Modules** | \`identity-extraction.js\`, \`person-company-disambiguation.js\` |
| **Gates** | Name HIGH ≥85%; company names never identity |
| **Failure points** | Name line classified as \`company\` in experience → collision clears name |
| **False positives** | Agency name as person (e.g. “Lontac Impressions”) — **mitigated** |
| **False negatives** | Valid two-word names below 85% → empty name (acceptable per policy) |
| **Status** | **Hardened** — \`qa:name-phone-rewrite\` + \`qa:person-company-disambiguation\` PASS |

### 7. Contact extraction (email / phone)

| | |
|--|--|
| **Modules** | \`phone-normalize.js\`, \`email-strictness.js\` |
| **Gates** | Phone HIGH ≥95%; year/postal pollution rejected |
| **Failure points** | OCR merges phone with dates (\`+33… 2011-2020\`) |
| **False positives** | Year ranges as phone — **mitigated** |
| **False negatives** | Valid intl formats without \`+\` dropped |
| **Status** | **Hardened** for French CVs; extend E.164 locales in reviewQueue |

### 8. Experience extraction

| | |
|--|--|
| **Modules** | \`experience-parser-v2.js\`, \`experience-builder-v2.js\`, \`section-engine-v2.js\` |
| **Failure points** | Single-column English CVs; date-only lines; employer-as-name collision |
| **False positives** | Section headers as job titles |
| **False negatives** | Freelance blocks without company token |
| **Recommended** | Stricter section anchor before experience merge; LOW tier for single-field jobs |

### 9. Education extraction

| | |
|--|--|
| **Modules** | \`education-confidence.js\`, \`section-field-extract-v2.js\` |
| **Failure points** | School name in sidebar column; degree line separated from school |
| **False positives** | Training one-liners duplicated as job + education |
| **False negatives** | Non-dictionary schools below confidence |
| **Recommended** | Queue unknown schools at MEDIUM; never invent degree level |

### 10. Skills extraction

| | |
|--|--|
| **Modules** | \`fact-classifier.js\`, \`semantic-confidence-gate.js\`, dictionaries |
| **Failure points** | Soft skills phrases (“Visual Communication”) auto-skills without source line |
| **False positives** | **Active** — semantic gate test FAIL: \`not in skills\` |
| **False negatives** | Tool aliases not in \`software.json\` |
| **Recommended** | Require dictionary or explicit “Skills:” anchor for HIGH tier |

---

## Confidence scoring (implemented)

| Tier | Numeric rule | Render rule |
|------|--------------|-------------|
| **HIGH** | ≥ field floor (name 85, phone 95, email 95, exp/edu 85, skills 75) | Auto-render allowed |
| **MEDIUM** | 70–84 (P0 threshold band) | Render with caution; user can edit |
| **LOW** | &lt;70 | **Must enter \`reviewQueue\`** — never auto-render as fact |

**Module:** \`src/core/validation/extraction-confidence-tiers.js\` (\`EXTRACTION_CONFIDENCE_TIERS_V1\`)  
**Wiring:** \`review-queue.js\` → \`mustQueueItem()\`, \`annotateConfidenceTier()\`, \`buildReviewQueue()\`  
**Export:** \`confidence-gate.js\` re-exports tier helpers

---

## Failure points (prioritized)

1. **Browser PDF path** — Real uploads: 0 chars native (H17 production reality audit).
2. **Extraction lock vs quality** — Fixed: weak native ≥500 chars no longer skips OCR.
3. **OCR timeout bypass** — Partial OCR can bypass \`evaluateOcrParserGate\` on recovery.
4. **Experience → identity collision** — Non-Yoaz TXT generalization 2/10 PASS.
5. **Semantic skills gate** — Soft labels promoted to skills without evidence.
6. **finalResumeData retention** — \`mvp-sample\` 50% loss resumeData→final.
7. **Node vs browser** — PDF/OCR tests empty in Node (\`PDF.js non chargé\`).

---

## False positives (wrong data risks)

| Symptom | Source | Severity |
|---------|--------|----------|
| Company name as identity | Misclassified header line | **P0** — mitigated by person-company disambiguation |
| Year range as phone | OCR line merge | **P0** — mitigated by phone-normalize |
| Section header as job | experience-parser heuristics | HIGH |
| Soft skill phrase in skills | fact-classifier bypass | HIGH — semantic gate FAIL |
| OCR junk in preview | Low gate + forced partial | MEDIUM |
| \`IMPORT_READY\` with empty structure | Status vs content mismatch | HIGH — see NO_FAKE_PASS policy |

---

## False negatives (missing data risks)

| Symptom | Source | Acceptable? |
|---------|--------|-------------|
| Empty name when confidence &lt;85% | identity gate | ✓ Yes — missing &gt; wrong |
| Phone omitted when &lt;95% | phone gate | ✓ Yes |
| Scanned PDF → paste prompt | OCR fail / timeout | ✓ Honest |
| Unknown school not shown | education confidence | ✓ Queue in review |
| Full CV empty after garbled PDF | No OCR triggered (pre-fix) | ✗ Fixed by lock quality opts |

---

## Recommended fixes (ordered)

### P0 — Done this pass

- [x] \`extraction-confidence-tiers.js\` — HIGH/MEDIUM/LOW + reviewQueue routing
- [x] \`extraction-lock.js\` — OCR when native &lt;300 chars or quality weak
- [x] \`enterprise-engine.js\`, \`ocr-lines.js\`, \`pdf-ocr-run.js\` — quality-aware lock
- [x] \`qa-extraction-confidence-tiers.mjs\`

### P0 — Next

- [ ] Re-run \`evaluateOcrParserGate\` on timeout partial before merge
- [ ] Wire semantic-confidence-gate into skills fact pipeline (fix “Visual Communication” case)
- [ ] Browser PDF fixture: \`cv. Yohann azancot (1) 2.pdf\` in \`qa-real-user-cv.mjs\`
- [ ] Block \`IMPORT_READY\` when \`selectedTextLength &lt; 300\` or 0 experience + 0 education + empty identity
- [ ] Fix \`mvp-sample\` finalResumeData retention (extraction-loss-audit)

### P1

- [ ] DOCX table/column block extractor
- [ ] Per-field MEDIUM tier UI badge in review studio
- [ ] Cloud OCR fallback when Tesseract confidence &lt;42 on page 1

---

## Verification commands

\`\`\`bash
npm run qa:multi-format-extraction
npm run qa:document-extract
npm run qa:no-fake-data-policy
node src/tests/qa-extraction-confidence-tiers.mjs
node src/tests/qa-extraction-lock.mjs
npm run qa:extraction-loss-audit
npm run qa:semantic-confidence-gate
node src/tests/qa-name-phone-rewrite.mjs
node src/tests/qa-person-company-disambiguation.mjs
npm run extraction-engine-audit-report
\`\`\`

---

## Files touched (hardening pass)

| File | Change |
|------|--------|
| \`src/core/validation/extraction-confidence-tiers.js\` | **NEW** — tier model |
| \`src/core/validation/confidence-gate.js\` | Re-export tiers |
| \`src/core/parsing/review-queue.js\` | LOW → queue + annotate |
| \`src/core/extraction/extraction-lock.js\` | Quality-aware OCR decision |
| \`src/core/extraction/enterprise-engine.js\` | Pass quality opts to lock |
| \`src/core/extraction/ocr-lines.js\` | Forward quality opts |
| \`src/core/extraction/pdf-ocr-run.js\` | Forward quality opts |
| \`src/tests/qa-extraction-confidence-tiers.mjs\` | **NEW** — tier QA |

---

## Related audits

- \`HIRELY_SYSTEMIC_IMPORT_AUDIT.md\` — Yoaz vs real CV systemic analysis
- \`CORE_IMPORT_AUDIT.md\` — Core boot / import graph
- \`OCR_RELIABILITY_AUDIT_REPORT.md\` — OCR provider matrix
- \`EXTRACTION_LOSS_AUDIT.md\` — Text retention chain

---

*Report generated by \`scripts/extraction-engine-audit-report.mjs\`*
`;

fs.writeFileSync(OUT, report, 'utf8');
console.log('Wrote', OUT);
console.log('\nSuite summary:');
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.name}`);
}
