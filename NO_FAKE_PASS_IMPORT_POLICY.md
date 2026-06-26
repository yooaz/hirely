# NO FAKE PASS — Import Policy

**Version:** `NO_FAKE_PASS_IMPORT_GATE_V2`  
**Scope:** All import QA gates, agents, and manual sign-off  
**Report:** `NO_FAKE_PASS_IMPORT_GATE_REPORT.md`

## Principle

**A non-crashing UI is not a passing import.**

`PASS` means the user uploaded a CV and Hirely produced a **real, editable resume** — not that the spinner stopped or a paste panel appeared without diagnosis.

| Concept | Meaning |
|---------|---------|
| **Terminal status** | Import finished without crash/stuck (`IMPORT_READY`, `IMPORT_PARTIAL`, `IMPORT_NEEDS_PASTE`, …) |
| **Product PASS** | Terminal status **and** all five requirements below |

QA reports must separate **terminal safety** (no crash/stuck) from **product PASS** (import actually worked).

---

## Product PASS requires (all seven)

### 1. Meaningful text extracted

- `selectedTextLength >= 300` characters from the chosen source (native, OCR, or DOCX).
- Counts from `enterprise.metadata.multiFormat` + final `rawText`, not spinner state.

### 2. Identity OR experience OR education

- At least one of: valid identity signal (name/email/phone), `experienceCount > 0`, or `educationCount > 0`.
- Skills/tools alone are **not** sufficient for product PASS.

### 3. Preview shows meaningful CV content

- `finalPreviewLength >= 100` (rendered `#cvDoc` text).
- **And** identity/experience/education present (not a header stub).

### 4. No fake name

- Display name must pass `isAcceptableDisplayName()` (no company/agency/OCR garbage as identity).

### 5. No fake phone

- Display phone must pass `isAcceptableDisplayPhone()` (strict normalize, no date pollution).

### 6. No empty CV

- `IMPORT_READY` / `IMPORT_PARTIAL` with `hasResume` but zero sections and tiny preview is **always FAIL**.

### 7. No stuck loader

- `stuck`, `timedOut`, or `silentFail` → FAIL.

### Acceptable ≠ success

- `IMPORT_NEEDS_PASTE` is an **honest acceptable outcome** for unread scans — **never** product PASS.

### No known-CV-only logic

- Gates must use **diverse corpus** (see `tests/cv-corpus/`, `tests/real-world-corpus/`, `REAL_WORLD_IMPORT_TRUTH_REPORT.md`).
- Forbidden:
  - hardcoding a single fixture path (e.g. only `yoaz-cv`) as the only PASS path
  - special-case `if (fileName.includes('yoaz'))` in product import code
  - marking PASS because one celebrity CV works while scanned/DOCX/image paths fail

---

## Scanned / image CV rules

If OCR cannot read the file:

| Field | Required value |
|-------|----------------|
| **Status** | `IMPORT_NEEDS_PASTE` (or `IMPORT_FAILED` / `IMPORT_UNSUPPORTED` when appropriate) |
| **Product PASS** | **No** — unread scans are never a passing import |

Correct paste fallback with zero extracted text is **honest status**, not **product PASS**.

Categories that require readable OCR for PASS:

- `pdf_scanned`, `image_cv`, `image`, any case label containing `scanned` or `image`

---

## Status reference

| Status | Terminal safe? | Product PASS? |
|--------|----------------|---------------|
| `IMPORT_READY` | ✓ | Only if all 5 requirements met |
| `IMPORT_PARTIAL` | ✓ | Only if text + structure + preview rules met |
| `IMPORT_NEEDS_PASTE` | ✓ | **Never** (fallback is not success) |
| `IMPORT_UNSUPPORTED` | ✓ | **Never** |
| `IMPORT_FAILED` | ✓ | **Never** |
| `IMPORT_CRASH` | ✗ | **Never** |
| `IMPORT_STUCK` | ✗ | **Never** |

---

## Forbidden fake passes

| Pattern | Why it fails |
|---------|----------------|
| UI shows live preview with &lt; 20 chars selected text | Fake success |
| `IMPORT_READY` + 0 experience + tiny preview | Placeholder CV |
| Scanned PDF → paste fallback, marked PASS | Unread scan is not success |
| Only Yoaz / one fixture passes full gate | Known-CV-only |
| `busy === false` with no terminal UI state | Silent fail |
| `IMPORT_READY` without `hasResume` | No structured CV |

---

## Implementation

| Artifact | Role |
|----------|------|
| `tests/lib/no-fake-pass-import-policy.mjs` | Canonical `evaluateImportProductPass()` V2 |
| `src/tests/qa-no-fake-pass-import-gate.mjs` | Policy unit regression |
| `NO_FAKE_PASS_IMPORT_GATE_REPORT.md` | Generated gate report |
| `src/tests/qa-import-reality-check.mjs` | 6-format smoke + product PASS |
| `src/tests/qa-real-world-import-truth.mjs` | 29+ messy corpus + product PASS |
| `REAL_WORLD_IMPORT_TRUTH_REPORT.md` | Per-file metrics and FAIL reasons |

### Thresholds (code constants)

```text
MEANINGFUL_TEXT_MIN      = 300
PREVIEW_MIN_FOR_SUCCESS  = 100
PLACEHOLDER_PREVIEW_MAX  = 80
```

---

## Gate reports (import usable)

All must be **PASS** under this policy before UI work:

```bash
npm run qa:no-fake-pass-import-gate
npm run no-fake-pass-import-gate-report
npm run import-reality-check-report
npm run real-world-import-truth-report
```

---

## Verify policy in code

```bash
node -e "import { evaluateImportProductPass, NO_FAKE_PASS_VERSION } from './tests/lib/no-fake-pass-import-policy.mjs'; console.log(NO_FAKE_PASS_VERSION, evaluateImportProductPass({ category:'pdf_scanned', status:'IMPORT_NEEDS_PASTE', selectedTextLength:0 }));"
```

Expected: `{ pass: false, reasons: ['ocr_unread_not_pass', ...] }`
