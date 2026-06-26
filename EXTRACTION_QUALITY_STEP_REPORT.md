# HIRELY P0 — Extraction Quality Before Template

**Result:** PASS
**Generated:** 2026-06-10T13:37:41.989Z

## Problem

Template selection happened while extraction was still weak — users chose a design without knowing what was detected.

## Solution

Before the template picker (steps **Relire** and **Choisir un modèle**), show an extraction quality summary:

| Signal | Label (detected) | Label (missing) |
|--------|------------------|-----------------|
| Name | Nom détecté | Nom non détecté |
| Contact | Contact détecté | Contact non détecté |
| Experience | Expérience détectée | Expérience non détectée |
| Education | Formation détectée | Formation non détectée |
| Skills | Compétences détectées | Compétences non détectées |

If **name, contact, or experience** is missing:

> Certaines informations doivent être vérifiées avant l'export.

Non-blocking — user can still choose a template and export.

## Flow

```
Import → Relire (quality panel + review) → Choisir un modèle (quality panel + templates) → Export
```

- Templates remain **hidden** on the Relire step
- Quality panel appears **above** the template grid on the Modèle step

## Files

- `src/ui/product/extraction-quality-step.js` — detection logic
- `index.html` — `#extractionQualityStep` UI + `renderExtractionQualityStep()`

## Browser verification

| Check | Result |
|-------|--------|
| Panel on edit step | PASS |
| Nom / Expérience / Compétences labels | PASS |
| Templates hidden on edit | PASS |
| Quality + templates on style | PASS |
| Quality before template picker | PASS |
| CTA not blocked | PASS |

## Acceptance

**PASS** — User understands what was extracted before choosing a template.

## Run

```bash
npm run test:extraction-quality-step
```
