# Trust Score Report (H19)

**Verdict:** PASS

## Model

Recruiter-facing score is a **trust score** built from pipeline quality — not a single category sum.

### Weighted pillars

| Pillar | Weight | Source |
|--------|--------|--------|
| Extraction quality | 40% | Import extraction score + classification (parser) quality |
| Completeness | 25% | CV section completeness |
| Recruiter quality | 25% | Recruiter / ATS score V2 |
| Formatting | 10% | Formatting dimension from ATS score |

Within the extraction pillar: **55% extraction + 45% classification** when import quality metrics are available.

Implementation: `src/core/validation/trust-score.js` → `product-score.js`.

## Hard caps

| Issue | Max score |
|-------|-----------|
| Wrong / unconfirmed name | 30 |
| Missing email | 40 |
| Missing experience | 50 |
| Missing education | 60 |
| Unresolved **critical** review items | 70 |

Critical review items include pending identity, experience, contact, corruption/OCR, semantic-confidence gate holds, and low-confidence placements.

## Acceptance checks

| Check | Result | Detail |
|-------|--------|--------|
| extraction weight 40% | PASS | — |
| completeness weight 25% | PASS | — |
| recruiter quality weight 25% | PASS | — |
| formatting weight 10% | PASS | — |
| weights sum to 100% | PASS | — |
| trust score report returned | PASS | — |
| pillars include extraction | PASS | — |
| pillars include classification signal | PASS | — |
| pillars include completeness | PASS | — |
| pillars include recruiter quality | PASS | — |
| pillars include formatting | PASS | — |
| cap wrong name ≤ 30 | PASS | got 30 |
| cap missing email ≤ 40 | PASS | got 40 |
| cap missing experience ≤ 50 | PASS | got 50 |
| cap missing education ≤ 60 | PASS | got 60 |
| identity review item is critical | PASS | — |
| critical review count | PASS | — |
| critical review caps score ≤ 70 | PASS | got 70 |
| clean CV can exceed 70 | PASS | got 82 |

## Run

```bash
npm run qa:h19-trust-score
```

---
Generated: 2026-06-09T14:37:23.825Z
