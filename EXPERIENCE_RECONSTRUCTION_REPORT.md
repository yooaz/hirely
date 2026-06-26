# EXPERIENCE_RECONSTRUCTION_REPORT

Generated: 2026-06-11T11:00:54.811Z
Verdict: **PASS**
P4 checks: **21/21**

## P4 — Experience Reconstruction Engine

Raw CV contains N jobs → preview must account for all N (auto + review + unsorted).
**Never discard** career content.

### Full-document scan
- Detect **company**, **role**, **date** across entire document
- V1 inline reconstruction + V2 OCR harvest
- Candidate dedupe by employer + year

### Confidence routing

| Confidence | Action |
|------------|--------|
| **> 80%** | Auto-add to `experiences` |
| **40–80%** | Review queue |
| **< 40%** | `unsorted` (to-classify) |

### Acceptance

| Fixture | Target |
|---------|--------|
| Five-job CV | 5 experiences in preview (latest: 5) |
| Yoaz OCR fragmented | ≥ 5 auto + remainder queued/unsorted |
| Tier routing | auto / review / unsorted split |

### Modules

| File | Role |
|------|------|
| `experience-reconstruction-engine.js` | Segment parse, confidence score |
| `experience-reconstruction-engine-v2.js` | Full-document OCR harvest |
| `experience-reconstruction-confidence-router.js` | **P4** scan + tier routing |

**Hook:** `section-engine-v2.js` → `runExperienceReconstructionEngine()` after V2 + universal recon.

## P4 checks

- [x] **auto-threshold-80**
- [x] **review-threshold-40**
- [x] **tier-auto**
- [x] **tier-80-review**
- [x] **tier-40-review**
- [x] **tier-unsorted**
- [x] **route-auto-count** — 1
- [x] **route-review-count** — 1
- [x] **route-unsorted-count** — 1
- [x] **auto-tier-flag** — auto
- [x] **five-jobs-preview-count** — count=5
- [x] **five-jobs-accounted** — accounted=5
- [x] **five-jobs-auto-confidence** — 99,99,99,99,99
- [x] **five-jobs-expected-anchors** — expected=9
- [x] **scan-candidates** — 5
- [x] **candidates-have-company-or-role**
- [x] **final-resume-preserves-experiences** — final=4 engine=5
- [x] **yoaz-ocr-auto-count** — auto=9
- [x] **yoaz-never-discard** — accounted=9
- [x] **section-engine-p4-wired**
- [x] **section-engine-experiences**

## Run

```bash
npm run qa:experience-reconstruction-p4
npm run experience-reconstruction-report
npm run qa:experience-reconstruction-engine
npm run qa:experience-reconstruction-v2
```