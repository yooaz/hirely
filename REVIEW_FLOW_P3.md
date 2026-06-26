# P3 — Review Flow That Works

## Product journey

1. **Importer** — upload or paste CV
2. **Relire** — validate suggestions, see recruiter analysis
3. **Style** — choose template
4. **Télécharger** — export PDF (gated)

No debug UI in normal mode (`?debug=true` for technical tools).

## Relire screen (3 columns)

| Column | Content |
|--------|---------|
| Left | A4 CV preview (validated content only) |
| Center | **Suggestions détectées** (max 5) |
| Right | Recruiter analysis + ATS score + export gates |

## Suggestions

Each card shows:

- Detected text
- **Category suggestion** (e.g. Compétences, Langues, Clients)
- Category picker when ambiguous
- **Ajouter** — accept into CV
- **Modifier** — edit then accept
- **Ignorer** — reject / skip

Additional items: `+ N autre(s) suggestion(s)`.

## OCR / validation rule

Pending review-queue items and corrupted lines are **stripped from the preview** via `applyReviewQueueToCvData` until the user clicks **Ajouter** or **Modifier**.

## Files

| File | Role |
|------|------|
| `index.html` | `renderSuggestionsPanel`, progress nav, product chrome |
| `src/ui/studio/review-studio-v2.css` | 3-column layout + suggestion cards |
| `src/ui/studio/studio-layout.css` | Grid: preview \| center \| analysis |
| `src/core/validation/review-readiness.js` | Export gates + ATS panel data |
| `src/core/parsing/review-queue.js` | OCR gate on cvData |

## Verify

```bash
npm run qa:review-flow
npm run qa:review-studio-v2
npm run qa:fact-classifier
```
