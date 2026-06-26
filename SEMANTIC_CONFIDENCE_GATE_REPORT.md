# Semantic Classification Confidence Gate Report (H14)

**Verdict:** PASS

## Goal

Before `finalResumeData`, uncertain classified text must not auto-place in the CV preview.
Items below **80% confidence** (or ambiguous) are stripped from product sections and sent to **À valider** review cards.

## Gate module

- `src/core/validation/semantic-confidence-gate.js`
  - `SEMANTIC_CONFIDENCE_GATE_MIN = 80`
  - `applySemanticConfidenceGate(resumeData)` — strips low-confidence placements, returns `reviewItems`
  - `assessSemanticPlacement(text, section)` — per-line gate decision
  - `auditSemanticConfidenceGate(finalResumeData, reviewItems)` — post-build audit

## Pipeline insertion

`buildFinalResumeData()` in `final-resume-contract.js`:

```
resumeData → sanitizeResumeForDisplay → applySemanticConfidenceGate → ensurePartialExportProfile → finalResumeData
```

Review items are merged into `state.reviewQueue` on commit (wired to existing accept/move/edit/ignore UI).

## Review card fields

Each gated item includes:

| Field | Description |
|-------|-------------|
| `detectedType` | Suggested section type |
| `confidence` | Classification score (0–100) |
| `sourceText` | Original extracted line |
| `reason` | Why auto-place was blocked |

## Regression cases

| Case | Expected |
|------|----------|
| visual communication | Review queue — not in skills/education |
| JB Impressions | Review queue — not in name/clients/experience |
| URL/domain lines | Review queue — not in experience/education/skills |
| High-confidence lines | Remain in CV sections |

## Test results

| Suite | Result |
|-------|--------|
| qa-semantic-confidence-gate | PASS |
| qa-recruiter-review-mode | PASS |
| qa:p7-stress-test | PASS |

### H14 gate output

```
PASS semantic-confidence-gate
{
  "engine": "SEMANTIC_CONFIDENCE_GATE_V1",
  "threshold": 80,
  "generatedAt": "2026-06-08T23:42:34.981Z",
  "cases": [
    {
      "id": "visual_communication",
      "pass": true,
      "item": {
        "id": "rq-1780962154423-1",
        "field": "skills",
        "detectedType": "unknown",
        "detected": "visual communication",
        "sourceText": "visual communication",
        "sourceLines": [
          "visual communication"
        ],
        "confidence": 55,
        "reason": "Ambiguous placement — SKILL 55% · EDUCATION 42%",
        "suggestion": "Choose the correct section before adding to your CV",
        "action": "recruiter_ambiguous",
        "status": "pending",
        "possibleCategories": [
          {
            "id": "skill",
            "label": "Skill",
            "score": 55,
            "confidence": 55
          },
          {
            "id": "education",
            "label": "Education",
            "score": 42,
            "confidence": 42
          }
        ],
        "requiresUserChoice": true
      }
    },
    {
      "id": "jb_impressions",
      "pass": true,
      "sem": {
        "semanticType": "UNKNOWN",
        "type": "UNKNOWN",
        "bucket": "unsorted",
        "confidence": 58,
        "rawType": "CLIENT",
        "rawConfidence": 58,
        "needsReview": true,
        "requiresRecruiterReview": true,
        "alternatives": [
          {
            "type": "CLIENT",
            "confidence": 58,
            "reason": "v2_ambiguous_client"
          },
          {
            "type": "EXPERIENCE",
            "confidence": 52,
            "reason": "v2_ambiguous_internship"
          }
        ],
        "reason": "v2_ambiguous_client",
        "engine": "SEMANTIC_CLASSIFIER_V2",
        "signals": [
          "semantic_v2",
          "v2_ambiguous_client"
        ],
        "parserDebug": {
          "classificationReason": "v2_ambiguous_client",
          "engine": "SEMANTIC_CLASSIFIER_V2",
          "confidenceScore": 58,
          "rawType": "CLIENT",
          "autoPlace": false,
          "alternatives": [
            {
              "type": "CLIENT",
              "confidence": 58,
              "reason": "v2_ambiguous_client"
            },
            {
              "type": "EXPERIENCE",
              "confidence": 52,
              "reason": "v2_ambiguous_internship"
            }
          ]
        }
      },
      "item": {
        "id": "rq-1780962154426-2",
        "field": "identity",
        "detectedType": "unknown",
        "detected": "JB Impressions",
        "sourceText": "JB Impressions",
        "sourceLines": [
          "JB Impressions"
        ],
        "confidence": 58,
        "reason": "Ambiguous placement — CLIENT 58% · EXPERIENCE 52%",
        "suggestion": "Choose the correct section before adding to your CV",
        "action": "recruiter_ambiguous",
        "status": "pending",
        "possibleCategories": [
          {
            "id": "client",
            "label": "Client",
            "score": 58,
            "confidence": 58
          },
          {
            "id": "experience",
            "label": "Experience",
            "score": 52,
            "confidence": 52
          }
        ],
        "requiresUserChoice": true
      }
    },
    {
      "id": "url_domain",
      "pass": true
    },
    {
      "id": "high_confidence_kept",
      "pass": true,
      "gated": 3
    }
  ],
  "pass": true
}
(node:54032) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/validation/semantic-confidence-gate.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

### Recruiter review output

```
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 1,
  education: 2,
  skills: 10,
  tools: 3,
  languages: 2,
  clients: 8,
  projects: 0,
  unsorted: 0
}
NODE_RESUMEDATA_COUNTS {
```

### P7 stress (tail)

```
P7 stress: 20/20 full pass (100% success, 0% failure)
(node:55663) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:55663) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
```

## Acceptance checklist

- [x] Uncertain items appear in À valider (review queue)
- [x] CV preview stays clean (no gated text in sections)
- [x] No garbage in header/education/experience from low-confidence lines
- [x] User can accept/move/edit/ignore via existing review cards
- [x] H12 recruiter review regressions still pass
- [x] P7 stress suite still passes

---

*Generated 2026-06-08T23:44:55.920Z*
