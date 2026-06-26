# Hirely Wow Factor Pass

Premium first-10-seconds experience — Apple Document Studio · Linear · Pitch · Figma direction.

## Goal

Make Hirely feel like a document studio, not generic SaaS: tight panels, live preview, cinematic import, animated scores.

## What changed

### New files

| File | Role |
|------|------|
| `src/ui/hirely-wow-factor.css` | Motion, skeletons, score/confidence viz, export focus |
| `src/ui/hirely-wow-factor.js` | Hooks: step transitions, import progress, score count-up |

### Wired into `index.html`

- `setDocStep` → step enter animation
- `startImportLoadingUx` / `endImportLoadingUx` → import moment + skeletons
- `setImportLoadingUx` / `setProgress` → unified progress rail
- `ensureImportReviewVisible` → hero → workspace reveal
- `setCvLoading` → analysis skeleton during CV load
- `renderScorePanel` → ATS score count-up + metric stagger
- `renderExtractionQualityStep` → confidence ring + per-field bars

## By screen

### Dashboard (hero)

- Staggered badge / headline entrance
- Pipeline cards lift on hover (Pitch-style)
- Workspace reveal fades hero, animates product in

### Import

- Drop zone pulse during processing
- Unified progress bar with shine sweep
- 4-stage timeline in compact rail (Linear-style)
- Live status copy emphasized

### Analysis (Review Studio)

- Skeleton loader on analysis column during import
- ATS score ring count-up (0 → score)
- Metric bars stagger in with ease
- Confidence header on extraction quality step

### Templates

- Gallery cards snap-scroll + hover lift
- Template bar enters on style step
- Existing Keynote CV switch preserved

### Export

- Focus mode: deeper CV shadow, preview scale-in
- Export bar slides up (Apple Preview sheet)

## Avoided

- Generic oversized cards
- Empty placeholder panels (tighter padding, compact empty states)
- Logic / pipeline changes (visual-only pass)

## Run locally

```bash
npm run dev
# Open http://localhost:3001 — import a CV to see full flow
```

## QA checklist

1. Import PDF → progress rail + stages animate
2. Post-import → workspace reveal, CV skeleton → live preview
3. Edit step → score ring counts up, metrics stagger
4. Style step → template gallery hover/snap
5. Export step → focus mode + export bar animation
6. `prefers-reduced-motion` → animations disabled
