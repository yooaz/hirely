# Import Flow V2

Generated: 2026-06-14
Engine: `IMPORT_FLOW_V2`

## Problem

The previous import experience felt **too technical** — pipeline jargon, opaque stages, and little emotional reassurance during extraction.

## Solution — reassuring 4-step journey

| Step | User sees | When |
|------|-----------|------|
| 1 | **Drop CV** | Initial upload |
| 2 | **Reading your CV** | During import |
| 3 | **Review detected info** | Edit / verify doc step |
| 4 | **Premium CV** | Style / export doc step |

## Extraction progress (Step 2)

While the file is processing, users see an **animated extraction panel** with five reassuring beats:

- Reading file… (10%)
- Analyzing structure… (28%)
- Detecting experience… (48%)
- Building CV… (72%)
- Generating recruiter report… (92%)

Reassurance line: *"Your information stays on your device. We are organizing it carefully."*

## UX principles

- **Plain language** — no "parser", "pipeline", or "OCR" in user-facing copy
- **Visible journey** — macro stepper always shows where you are
- **Forward-only progress** — steps never jump backward during load
- **Patience cues** — "A few seconds depending on file size — that is normal"
- **Paste escape hatch** — after 8s, hint to paste CV text

## Production path

```
User drops file
  → startImportLoadingUx()
  → HirelyImportFlowV2.onImportStart()  // macro: extract
  → setImportLoadingUx(file|extract|sections|recruiter|prepare)
  → HirelyImportFlowV2.setMicroStep()   // 5 progress beats
Import completes
  → endImportLoadingUx()
  → HirelyImportFlowV2.onImportEnd()    // macro: review
  → setDocStep("edit")
User picks template / exports
  → HirelyImportFlowV2.syncDocStep("style"|"export")  // macro: generate
```

## Files

| File | Role |
|------|------|
| `src/ui/product/import-flow-v2.js` | Macro + micro step orchestration |
| `src/ui/product/import-flow-v2.css` | Stepper, orb animation, micro list |
| `index.html` | Host markup, i18n, loading UX wiring |

## Copy reference (EN / FR)

### Macro steps

| # | EN | FR |
|---|----|----|
| 1 | Drop CV | Déposer le CV |
| 2 | Reading your CV | Lecture en cours |
| 3 | Review detected info | Vérifier les infos |
| 4 | Premium CV | CV premium |

### Micro progress

| EN | FR |
|----|-----|
| Reading file… | Lecture du fichier… |
| Analyzing structure… | Analyse de la structure… |
| Detecting experience… | Détection de l'expérience… |
| Building CV… | Construction du CV… |
| Generating recruiter report… | Rapport recruteur… |

## QA

```bash
npm run qa:import-flow-v2
npm run import-flow-v2-report
```
