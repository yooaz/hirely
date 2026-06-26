# REWRITE VALIDATION REPORT

Generated: 2026-06-07T00:26:46.037Z
Engine: `SAFE_REWRITE_VALIDATION_V1` + `CV_EXPERIENCE_REWRITE`
Gate status: **PASS**
Confidence threshold: **75%** (below → Suggestions, no auto rewrite)

## Mission

Rewriting may improve grammar and clarity, but must never invent facts. Every rewritten sentence stores:

- `originalText`
- `rewrittenText`
- `sourceSection`
- `sourceConfidence`
- `factsUsed`

## Rules

| Allowed | Forbidden |
|---------|-----------|
| Improve grammar / clarity | Invent company |
| Merge repeated lines | Invent dates |
| Professionalize wording | Invent job title |
| | Invent metrics |
| | Invent achievements |

## Fixture results

| Fixture | Experiences | Rewrite records | Auto-applied | Suggestions | Traceable |
|---------|-------------|-----------------|--------------|-------------|-----------|
| Developer CV | 2 | 3 | 3 | 0 | 3/3 |
| Creative CV | 1 | 2 | 2 | 0 | 2/2 |
| Marketing CV | 2 | 3 | 3 | 0 | 3/3 |
| Consultant CV | 2 | 3 | 3 | 0 | 3/3 |

**Aggregate traceability:** 11/11 records traceable to original text

## Allowed rewrite example

```json
{
  "original": "Graphic designer. Posters. Packaging.",
  "rewritten": "Created posters and packaging and related visual deliverables.",
  "confidence": 75,
  "autoApplied": true,
  "records": [
    {
      "originalText": "Graphic designer. Posters. Packaging",
      "rewrittenText": "Created posters and packaging and related visual deliverables.",
      "sourceSection": "experience",
      "sourceConfidence": 92,
      "factsUsed": [
        "Posters",
        "Packaging",
        "graphic",
        "designer",
        "freelance",
        "independent",
        "Freelance Graphic Designer"
      ],
      "rewriteConfidence": 75,
      "autoApplied": true
    }
  ]
}
```

## Blocked rewrite example (invented facts)

```json
{
  "originalText": "Designed posters for local clients.",
  "rewrittenText": "Increased revenue by 40% as Senior VP at Acme Corp while leading 200 engineers (2010–2015).",
  "violations": [
    "INVENT_DATE:2010",
    "INVENT_DATE:2015",
    "INVENT_METRIC:40%",
    "INVENT_COMPANY:Acme Corp while leading 200 engineers",
    "INVENT_ACHIEVEMENT:increased,revenue,senior"
  ],
  "rewriteConfidence": 0,
  "autoApplied": false,
  "blockedReason": "INVENT_DATE:2010"
}
```

## Acceptance

**PASS** — Every rewritten line can be traced back to original extracted text.

## Files

- `src/core/parsing/safe-rewrite-validation.js` — validation engine
- `src/core/parsing/cv-experience-rewrite.js` — gated experience rewrite
- `src/tests/qa-safe-rewrite-validation.mjs` — automated gate
- `tests/output/safe-rewrite-validation/report.json` — machine-readable output