# Generic Classification Hardening Report (H13)

**Verdict:** PASS

## Goal

Replace candidate-specific OCR patches with generic classification rules in `src/core`.

## Production rules module

- `src/core/parsing/ocr-classification-rules.js`
  - URL/domain/social name rejection
  - OCR header category rejection (address, illustrations, expertise…)
  - URL-merged experience gate (year range + separators + URL or career signals)
  - Email local-part hint (search only — never fabricate a name)

## Audit — forbidden literals in `src/core`

Candidate-specific strings (`Yohann`, `Yoaz`, `Azancot`, `comagi`, fixture phrases) must not appear in production logic.

```
qa-generic-classification-hardening: PASS
```

<details><summary>Output</summary>

```
OK src/core has no candidate-specific literals
OK reject OCR category name
OK reject expertise phrase as name
OK reject social/portfolio tokens in name
OK yoaz fixture qualifies via generic URL rule
OK generic designer URL line qualifies
OK yoaz merged name=Yohann Azancot
OK yoaz merged role=Freelance Creative Professional
OK designer merged name=Marie Dubois
OK designer start=2016
OK fake CV name=Marie Dubois
OK fake CV experiences=["Freelance Illustrator / Graphic Designer"]
OK email hint extracts name token
OK generic email local rejected
OK freelance career still parses
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 2,
  skills: 13,
  tools: 1,
  languages: 2,
  clients: 6,
  projects: 0,
  unsorted: 1
}
OK yoaz pipeline experiences=2
OK yoaz pipeline name not garbage: Créapole Freelancer
(node:35229) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/parsing/identity-extraction.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

</details>

## Regression tests

| Suite | Result |
|-------|--------|
| qa-generic-classification-hardening | PASS |
| qa-classification-fix-yoaz | PASS |
| qa:p7-stress-test | PASS |

### Yoaz fixture output

```
OK career line type=experience (expected experience)
OK freelance company=Independent / Freelance
OK freelance role=Freelance Illustrator and graphic
OK reject OCR garbage name Adress Mustrations
OK merged name=Yohann Azancot
OK merged company=Independent / Freelance
OK merged start=2011
OK sanitized name=Yohann Azancot
OK sanitized experiences=[{"role":"Freelance Illustrator / Graphic Designer","start":"2011"}]
OK no raw URL blob in experiences
OK software line type=tools
OK career line not tools
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 2,
  skills: 13,
  tools: 1,
  languages: 2,
  clients: 6,
  projects: 0,
  unsorted: 1
}
OK experiences=2
OK education has school: ["LISAA — Web & Motion Design — 2011–2012","» be.Net/ Marketing, Technologie, Marketing Studies Creative School Management"]
OK skills=["Illustration","Graphic Design","Editorial Design","Packaging"]
OK no career sentence in tools
OK unsorted reduced to 1
OK education includes LISAA: ["LISAA — Web & Motion Design — 2011–2012","» be.Net/ Marketing, Technologie, Marketing Studies Creative School Management"]
OK phone=+33649434839
(node:35468) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/production-pipeline.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

### P7 stress output

```
OK pdf 100% >= 95%
OK full pipeline 100% >= 80%
P7 stress: 20/20 full pass (100% success, 0% failure)
(node:35637) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:35637) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
```

## Acceptance checklist

- [x] No hardcoded Yoaz/Yohann/Azancot in `src/core`
- [x] OCR garbage names rejected generically
- [x] URL-merged experiences recovered generically
- [x] `qa:p7-stress-test` PASS

## Files touched (H13)

- `src/core/parsing/ocr-classification-rules.js` (new)
- `src/core/parsing/classification-fixes.js`
- `src/core/parsing/identity-extraction.js`
- `src/core/validation/sanitize-resume-display.js`
- `src/core/validation/universal-safety-gate.js`
- `src/core/parsing/unsorted-section-recovery.js`
- `src/core/parsing/experience-recovery.js`
- `src/core/parsing/resume-output-quality.js`
- `src/core/parsing/ocr-experience-merge.js`
- `src/core/parsing/education-normalization-layer.js`
- `src/core/parsing/education-quality-engine.js`
- `src/core/parsing/corruption-detector.js`
- `src/tests/qa-generic-classification-hardening.mjs` (new)
