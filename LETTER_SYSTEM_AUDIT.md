# Letter System Audit

**Date:** 2026-06-03  
**Status:** Recovered — cover letter generation restored with live preview

## Symptom

Cover letter generation disappeared from the product UI. The legacy letter tab existed but was hidden in normal mode and only populated in developer mode.

## Pipeline map

```
cvData + target role + lang + style
    ↓
┌──────────────────────────────────────────────────────────────┐
│  cover-letter-engine.js   buildCoverLetterDraft()            │
│       ↑                                                      │
│  cover-letter-renderer.js renderCoverLetter()                │
│       ↑                                                      │
│  letter-ai-generation.js  generateCoverLetter() (API opt.)   │
│       ↑                                                      │
│  letter-exporter.js       downloadLetterTxt / clipboard      │
└──────────────────────────────────────────────────────────────┘
    ↓
index.html
  #openLetterBtn / #generateLetterBtn
  #coverLetterPreview (live preview, editable)
  #letterText (debug tab legacy)
```

## Root causes

### 1. No cover-letter-engine module

Letter text was assembled inline in `renderOutputs()` with a 4-line template. No dedicated engine, no style variants, no experience/skills weighting.

### 2. Developer-mode gate

```javascript
function renderOutputs() {
  ...
  if (!DEVELOPER_MODE) return;  // ← letter never generated in product mode
}
```

### 3. UI hidden in normal mode

CSS rules hide `#letterPanel` and the Letter tab outside debug mode:

```css
html:not(.debug-mode) #letterPanel { display: none }
html:not(.debug-mode) .tab[data-tab="letter"] { display: none }
```

### 4. No Generate button in export flow

Export bar had PDF / email / TXT only — no entry point for cover letters.

## Fix

### New modules

| File | Role |
|------|------|
| `src/core/export/cover-letter-engine.js` | Data-driven draft from CV identity, experience, skills, target role |
| `src/core/export/cover-letter-renderer.js` | Professional / Creative / ATS-friendly templates |
| `src/core/export/letter-ai-generation.js` | Optional `/api/analyze` with local fallback |
| `src/core/export/letter-exporter.js` | TXT download + clipboard |

### Letter inputs (data-driven)

| Signal | Usage |
|--------|-------|
| CV identity | name, title in opening and signature |
| Experience | top lines (metrics/action verbs prioritized) |
| Skills | skills + tools list |
| Target job title | `#letterTargetRole` or `#roleInput` or CV title |

### Styles

| Style | Output |
|-------|--------|
| Professional | Formal greeting, structured paragraphs |
| Creative | Warmer tone, client/brand mentions when present |
| ATS-friendly | Plain text, keyword-dense, pipe-separated experience |

### Languages

French and English — driven by `#cvLang` (fr/en) with UI lang fallback.

### UI restored

- **Generate Cover Letter** — `#openLetterBtn` in export bar, `#generateLetterBtn` in letter workspace
- **Live preview** — `#coverLetterPreview` (contenteditable, updates on role/style/lang change)
- **Copy / Download TXT** — Pro actions on generated letter
- Product path no longer gated by `DEVELOPER_MODE`

## Verification

```bash
npm run qa:letter-pipeline
```

### Manual check

1. Import a CV and unlock Pro (`?pro=1` or unlock button)
2. Click **Generate Cover Letter** in the export bar
3. Confirm preview shows name, target role, experience, skills
4. Switch style (Professional / Creative / ATS-friendly) — preview updates
5. Switch CV language FR/EN — letter language changes
6. Copy and Download TXT work on generated content

## Files changed

- `src/core/export/cover-letter-engine.js` (new)
- `src/core/export/cover-letter-renderer.js` (new)
- `src/core/export/letter-ai-generation.js` (new)
- `src/core/export/letter-exporter.js` (new)
- `src/core/export/index.js` — exports
- `index.html` — letter workspace, buttons, live preview, `renderOutputs` wiring
- `src/tests/qa-letter-pipeline.mjs` (new)
