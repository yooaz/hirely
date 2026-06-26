# DATA_FLOW_REPORT

Generated: 2026-06-06T07:33:09.252Z

Input: Yoaz OCR text (`tests/output/ocr-quality-yoaz/report.json`) — post-extraction, parser only.

## Funnel (example format)

```
rawText
identity: 2 | experiences: 0 | education: 4 | skills: 10 | clients: 1 | projects: 1 | unsorted: 24
  42 lines | exp anchors: 0 | exp gate: 0

↓

blocks
identity: 1 | experiences: 0 | education: 9 | skills: 8 | clients: 2 | projects: 0 | unsorted: 0
  20 renderBlocks | types: {"tools":3,"clients":2,"education":9,"contact":1,"languages":2,"skills":3}

↓

sectionEngineV2
identity: 1 | experiences: 0 | education: 4 | skills: 4 | clients: 5 | projects: 0 | unsorted: 31
  fact-pipeline inside runSectionEngineV2

↓

structuredResume
identity: 1 | experiences: 0 | education: 4 | skills: 4 | clients: 5 | projects: 0 | unsorted: 40
  buildStructuredResumeFromDocumentBlocks (production pipeline)

↓

resumeData (fromStructured)
identity: 1 | experiences: 0 | education: 4 | skills: 4 | clients: 7 | projects: 0 | unsorted: 38
  resumeDataFromStructured — no normalize yet

↓

resumeData (normalizeResumeData)
identity: 1 | experiences: 0 | education: 1 | skills: 4 | clients: 4 | projects: 0 | unsorted: 40
  reconcileTextRetention → calls normalizeResumeData first

↓

resumeData (repair)
identity: 1 | experiences: 1 | education: 1 | skills: 4 | clients: 4 | projects: 0 | unsorted: 40
  repairResumeDataFromRaw

↓

resumeData (final)
identity: 1 | experiences: 1 | education: 1 | skills: 4 | clients: 4 | projects: 0 | unsorted: 40
  buildResumeData full path

↓

cvData
identity: 1 | experiences: 1 | education: 1 | skills: 4 | clients: 4 | projects: 0 | unsorted: 0
  resumeDataToCvData template view
```

## Table

| Stage | identity | exp | edu | skills | clients | projects | unsorted |
|-------|----------|-----|-----|--------|---------|----------|----------|
| rawText | 2 | 0 | 4 | 10 | 1 | 1 | 24 |
| blocks | 1 | 0 | 9 | 8 | 2 | 0 | 0 |
| sectionEngineV2 | 1 | 0 | 4 | 4 | 5 | 0 | 31 |
| structuredResume | 1 | 0 | 4 | 4 | 5 | 0 | 40 |
| resumeData (fromStructured) | 1 | 0 | 4 | 4 | 7 | 0 | 38 |
| resumeData (normalizeResumeData) | 1 | 0 | 1 | 4 | 4 | 0 | 40 |
| resumeData (repair) | 1 | 1 | 1 | 4 | 4 | 0 | 40 |
| resumeData (final) | 1 | 1 | 1 | 4 | 4 | 0 | 40 |
| cvData | 1 | 1 | 1 | 4 | 4 | 0 | 0 |

## First stage where data disappears

- **identity**: 2 → 1 (−1) between **rawText** and **blocks**
- **education**: 9 → 4 (−5) between **blocks** and **sectionEngineV2**
- **skills**: 10 → 8 (−2) between **rawText** and **blocks**
- **clients**: 7 → 4 (−3) between **resumeData (fromStructured)** and **resumeData (normalizeResumeData)**
- **projects**: 1 → 0 (−1) between **rawText** and **blocks**

## Section-by-section diagnosis

### Experiences
- rawText: **0** experience lines (classifier + section anchors + experience gate all 0 on OCR layout)
- blocks: **0** experience blocks (OCR merges WORK EXPERIENCE into PROFILE line)
- sectionEngineV2 → structuredResume: **0** experiences
- resumeData (repair): **1** experience appears — added by `repairResumeDataFromRaw()`, not parser blocks
- **First loss point for experiences:** never extracted; only patched in at repair stage

### Education
- rawText: **4** education-classified lines
- blocks: **9** education blocks
- sectionEngineV2 / structuredResume: **4** education entries
- resumeData (normalizeResumeData): **1** — **first drop here** (4→1)
- Cause: `normalizeResumeData()` → `applyConfidenceGate()` + `sanitizeResumeForDisplay()` (`PHONE_EDU_MIX_RE`)

### Skills
- rawText: **10** skill/tool/language lines
- blocks: **8** skill/tool/language blocks
- sectionEngineV2: **4** — **first drop here** (10→4)
- Cause: `fact-pipeline` confidence threshold + dedupe in `buildCvFromFacts()`

### Clients
- blocks: **2** → sectionEngine: **5** → resumeData final: **4**
- Minor drop at `normalizeResumeData` (contract sanitize)

### Identity
- rawText: **2** identity/contact lines → resumeData: **0** valid name, title from OCR garbage

## Key finding

**Parser fact-pipeline (`sectionEngineV2`) does extract structured data** (4 education, 5 clients, 4 skills).
**`resumeData` empties sections at `normalizeResumeData()` inside `buildResumeData()`** — not at extraction, not at OCR.

Re-run: `node scripts/data-flow-report.mjs`
