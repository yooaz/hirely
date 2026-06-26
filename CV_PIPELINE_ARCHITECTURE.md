# CV Pipeline — Architecture d’implémentation (Node.js / TypeScript)

**Version:** `CV_PIPELINE_V1`  
**Date:** 2026-06-16  
**Statut:** Spécification exécutable — types + orchestrateur ; adapters JS à brancher.

---

## TL;DR

Pipeline **layout-aware**, **déterministe**, **scorée**, avec **fallback LLM contrôlé** — jamais du texte linéaire seul.

Types TypeScript : `src/cv-pipeline/types/`  
Orchestrateur : `src/cv-pipeline/pipeline/parse-cv.ts`  
Vérification types : `npx tsc -p tsconfig.cv-pipeline.json` (nécessite `typescript` en devDependency).

---

## 1. Structure de dossiers cible

```
src/cv-pipeline/
├── index.ts                      # barrel
├── types/
│   ├── index.ts
│   ├── document.ts               # DocumentInput, RawBlock, RawPage, DocumentProfile
│   ├── blocks.ts                 # Layout, NormalizedBlock, LogicalBlock, SectionBlocks
│   ├── canonical.ts              # CVCanonical, ExperienceItem, EducationItem, …
│   ├── confidence.ts             # ConfidenceReport, RELIABILITY_TARGETS_V1
│   ├── review.ts                 # ReviewHint, ValidationReport, corrections
│   ├── trace.ts                  # ParsingTrace, StageTrace, perf targets
│   └── api.ts                    # REST job contracts
├── pipeline/
│   ├── stages.ts                 # interfaces de services (frontières logiques)
│   └── parse-cv.ts               # orchestrateur §19.1
├── services/                     # implémentations TS (Phase 1+)
│   ├── classifier/
│   ├── extractor/
│   ├── layout/
│   ├── normalizer/
│   ├── block-builder/
│   ├── segmenter/
│   ├── parsers/
│   │   ├── contact-parser.ts
│   │   ├── summary-parser.ts
│   │   ├── experience-parser.ts   # P0
│   │   ├── education-parser.ts
│   │   ├── skills-parser.ts
│   │   └── …
│   ├── canonical-builder.ts
│   ├── confidence-scorer.ts
│   ├── validator.ts
│   ├── review-hints.ts
│   └── llm-repair.ts
├── adapters/                     # pont vers code JS existant (V1)
│   ├── hirely-classifier.adapter.mjs
│   ├── hirely-extractor.adapter.mjs
│   ├── hirely-layout.adapter.mjs
│   ├── hirely-p0-pipeline.adapter.mjs
│   └── resume-data-bridge.mjs      # CVCanonical → resumeData
└── api/                          # optionnel — service HTTP
    ├── server.ts
    ├── routes/
    │   ├── parse.ts                # POST /api/v1/cv/parse
    │   └── corrections.ts          # POST …/corrections
    └── jobs/
        └── in-memory-queue.ts
```

**Principe monolithe :** un seul process Node, frontières logiques strictes via `CvPipelineServices` — extraction vers microservices plus tard sans changer les types.

---

## 2. Cartographie spec → étapes → code Hirely actuel

| Étape spec | Service TS | Module Hirely existant | Écart |
|------------|------------|------------------------|-------|
| Document classification | `DocumentClassifier` | `document-detection.js`, `canonical-import.js` | OK partiel |
| Extraction native / OCR | `PrimaryExtractor` | `enterprise-engine.js`, `document-extract.js`, `ocr-auto-import.js` | OK |
| Layout analysis | `LayoutAnalyzer` | `layout/detect-layout.js`, `detect-columns.js`, `reading-order.js` | **Non branché sur tous les imports** |
| Text normalizer | `TextNormalizer` | `ocr-cleanup-pipeline.js`, `rich-parser.js` cleanExtraction | Fusionné avec parse |
| Block builder | `BlockBuilder` | `block-extractor.js`, `block-detector.js` | Exige lignes x/y |
| Section segmenter | `SectionSegmenter` | `section-classify-v2.js`, `section-classifier-v1.js` | Compète avec `rich-parser` |
| Entity extraction | `EntityExtractor` | `entity-engine`, regex contact | Dispersé |
| Contact parser | `ContactParser` | `identity-extraction.js`, `rich-parser.js` | OK partiel |
| Experience parser | `ExperienceParser` | `experience-reconstructor.js`, `harvestExperienceFromLines` | **Pas de contrat ExperienceItem** |
| Education parser | `EducationParser` | `education-confidence.js`, `harvestEducation` | OK partiel |
| Skills parser | `SkillsParser` | `rich-parser.js` detectSkills | Mélange langues/outils |
| Canonical builder | `CanonicalBuilder` | `structured-resume-from-blocks.js`, `resume-data.js` | Schéma différent |
| Confidence scorer | `ConfidenceScorer` | `confidence-scoring.js`, `import-quality-score.js` | OK partiel |
| Validation | `ValidationLayer` | `extraction-reliability.js`, `export-lock.js` | Trop tard dans le flux |
| Review hints | `ReviewHintsGenerator` | `extraction-honest-mode.js`, `raw-text-review-mode.js` | UI partielle |
| LLM repair | `LlmRepairService` | `ai-reconstruction-engine.js` | À encadrer (blocs only) |

**Bypass à éliminer :** `text-first-engine.js` / `createResumeFromText` pour PDF sans coordonnées — doit router vers P0 ou mode dégradé explicite.

---

## 3. Flux de données (contrat)

```
DocumentPayload
  → DocumentProfile
  → RawPage[] + RawBlock[]     // toujours bbox + reading_order si possible
  → LayoutAnalysis
  → NormalizedBlock[]
  → LogicalBlock[]
  → SectionBlocks
  → parsers par section
  → CVCanonical
  → ConfidenceReport
  → ValidationReport
  → [LlmRepair?]
  → ReviewHint[]
  → ParsingTrace
```

**Règle d’or (§2.2) :** aucune étape aval ne reçoit uniquement `string` — toujours blocs + layout + trace.

---

## 4. Types TypeScript — référence rapide

| Type | Fichier | Rôle |
|------|---------|------|
| `DocumentInput` | `document.ts` | Métadonnées upload |
| `RawBlock` | `document.ts` | Bloc géométrique brut |
| `NormalizedBlock` | `blocks.ts` | Texte nettoyé + signaux |
| `LogicalBlock` | `blocks.ts` | Groupe sémantique |
| `SectionBlocks` | `blocks.ts` | Segmentation |
| `CVCanonical` | `canonical.ts` | **Sortie produit** |
| `ExperienceItem` | `canonical.ts` | Contrat expérience P0 |
| `ConfidenceReport` | `confidence.ts` | Scores globaux + sections |
| `ReviewHint` | `review.ts` | Correction UI assistée |
| `ParsingTrace` | `trace.ts` | Observabilité |
| `ParsePipelineResult` | `api.ts` | Réponse API |

Import :

```typescript
import type { CVCanonical, ExperienceItem, ReviewHint } from './src/cv-pipeline/types/index.js';
```

---

## 5. Orchestrateur

```typescript
import { createCvPipeline } from './src/cv-pipeline/pipeline/parse-cv.js';
import { hirelyPipelineServices } from './src/cv-pipeline/adapters/hirely-pipeline-services.mjs';

const pipeline = createCvPipeline(hirelyPipelineServices);
const result = await pipeline.parse({ input: documentInput, buffer });
// result.cv, result.confidence, result.review_hints, result.trace
```

Étapes séquentielles obligatoires : **classify → extract → layout → normalize → blocks → segments → parsers → canonical → score → validate → [llm] → hints**.

---

## 6. API HTTP recommandée (§18)

### POST `/api/v1/cv/parse`

- `Content-Type: multipart/form-data`
- Champs : `file`, `language_hint?`, `enable_llm_fallback?`
- Réponse immédiate : `{ job_id, status: "processing" }`

### GET `/api/v1/cv/parse/:job_id`

```json
{
  "status": "done",
  "result": {
    "cv": { },
    "confidence": { "confidence_global": 0.84, "sections": { } },
    "review_hints": [],
    "trace": { }
  }
}
```

### POST `/api/v1/cv/parse/:job_id/corrections`

```json
{
  "field_updates": [
    { "path": "experiences[0].company", "value": "Capgemini" }
  ]
}
```

**V1 jobs :** queue in-memory ou Redis ; worker appelle `createCvPipeline().parse()`.

---

## 7. Pont vers l’éditeur Hirely (`resumeData`)

`CVCanonical` est la **source de vérité parsing**. Adapter unique :

```
CVCanonical
  → mapToResumeData(cv)     // adapters/resume-data-bridge.mjs
  → resumeData (existant)
  → finalResumeData / cvData / templates
```

Ne pas parser deux fois. `buildResumeData()` consomme le pont, ne relance pas `rich-parser` sur texte brut.

Champs clés :

| CVCanonical | resumeData |
|-------------|------------|
| `contact.full_name` | `identity.name` |
| `experiences[]` | `experiences[]` (objets) |
| `skills.technical` | `skills[]` |
| `review_hints` | `meta.verifyContent` + `rawTextReview` |

---

## 8. Experience parser — contrat d’acceptation (P0)

Fichier cible : `services/parsers/experience-parser.ts`

Algorithme : §19.2 + spec §13.4

**Valide** si ≥ 2 parmi : `job_title`, `company`, `date_range`, `description`.

**Interdit :** expérience complète dans `custom_sections` / `other` sans `ReviewHint`.

Tests : `src/tests/qa-experience-parser-v1.mjs` sur Yoaz PDF + 20 CV corpus.

---

## 9. Observabilité (§23)

Chaque stage pousse un `StageTrace` :

```typescript
{
  stage: 'experience_parsing_done',
  status: 'ok',
  duration_ms: 42,
  metrics: { items: 5, anchors: 5 }
}
```

Événements produit (logs structurés) :

`document_classified`, `ocr_done`, `layout_analysis_done`, `experience_parsing_done`, `llm_fallback_triggered`, `review_hints_generated`.

Dashboard : taux `other`, temps par étape, % fallback LLM, KPI §3.2.

---

## 10. Objectifs non fonctionnels

| Métrique | Cible V1 | Constante |
|----------|----------|-----------|
| PDF natif | < 2 s | `PIPELINE_PERF_TARGETS_V1.pdf_native` |
| PDF scan 1p | < 4 s | `pdf_scanned_1p` |
| PDF scan 2p | < 7 s | `pdf_scanned_2p` |
| DOCX | < 2 s | `docx` |
| Email détecté | > 98% | `RELIABILITY_TARGETS_V1` |
| Expériences découpées | > 85% | idem |

Gate produit : `REAL_WORLD_IMPORT_TRUTH_REPORT` = PASS avant polish templates.

---

## 11. Roadmap d’implémentation

### Phase 1 — Base fiable (4–6 semaines)

1. Adapters JS → `CvPipelineServices` (sans réécrire OCR)
2. **Forcer layout** avant segmentation pour PDF/DOCX avec coords
3. `experience-parser.ts` + tests
4. `resume-data-bridge.mjs`
5. Remplacer bypass `createResumeFromText` pour PDF
6. QA : Yoaz + `real-world-corpus`

### Phase 2 — Robustesse

- Multi-colonnes sidebar (règle : ne jamais fusionner skills + experience)
- Review hints complets
- Validation dates ISO partiel
- Client vs employeur (freelance)

### Phase 3 — Intelligence

- Classifieur blocs ML léger
- LLM repair sur blocs normalisés uniquement
- Apprentissage depuis corrections POST `/corrections`

---

## 12. Critères d’acceptation V1 (§25)

- [ ] PDF natif standard → `CVCanonical` exploitable sans correction lourde
- [ ] Sections principales détectées (contact, exp, edu, skills)
- [ ] < 10% contenu en `other` sur corpus V1
- [ ] Contact quasi toujours correct (email > 98%)
- [ ] Erreurs visibles via `review_hints` — correction < 60 s
- [ ] `REAL_WORLD_IMPORT_TRUTH` PASS

---

## 13. Décision clé (§27)

**Parser déterministe + layout-aware + scoring + fallback intelligent** — pas OCR brut, pas LLM magique.

Les types et l’orchestrateur dans `src/cv-pipeline/` formalisent ce contrat. La prochaine tâche dev concrète : **`adapters/hirely-pipeline-services.mjs`** + **`experience-parser`**.

---

## Fichiers créés dans ce repo

| Fichier | Description |
|---------|-------------|
| `src/cv-pipeline/types/*.ts` | Types complets spec §4–§18 |
| `src/cv-pipeline/pipeline/stages.ts` | Interfaces services |
| `src/cv-pipeline/pipeline/parse-cv.ts` | Orchestrateur |
| `src/cv-pipeline/index.ts` | Export public |
| `tsconfig.cv-pipeline.json` | Typecheck isolé |
| `CV_PIPELINE_ARCHITECTURE.md` | Ce document |
