# OCR Normalization Report

Generated: 2026-06-06T23:24:26.648Z

## Summary

| Metric | Value | Target |
| --- | --- | --- |
| Corpus repair score | **100%** (25/25) | ≥ 95% |
| Hardcoded CV rules | **0** | 0 |
| Acceptance | **PASS** | PASS |

## Pipeline

```
RAW OCR → normalizeOcrDocument → clean → classify → structure
```

Normalization stages:
1. Harden (hyphen joins, spaced letters, column splits, dedupe)
2. Merge split lines (continuation / lowercase wrap)
3. Fix broken words (dictionary-validated joins)
4. Repair common OCR char mistakes (0/O, 1/l, fuzzy dictionary)
5. Drop garbage (symbols, reversed noise, isolated fragments)
6. Preserve `rawLine` + `normalizedLine` per line

## Corpus results

| Case | Raw | Normalized | Pass |
| --- | --- | --- | --- |
| 1 | `Ill ustrator` | `Illustrator` | ✓ |
| 2 | `Gra phic Designer` | `Graphic Designer` | ✓ |
| 3 | `Des igner` | `Designer` | ✓ |
| 4 | `lllustrator` | `Illustrator` | ✓ |
| 5 | `Deslgner` | `Designer` | ✓ |
| 6 | `Phot0shop` | `Photoshop` | ✓ |
| 7 | `Illustartor` | `Illustrator` | ✓ |
| 8 | `Grafic Designer` | `Graphic Designer` | ✓ |
| 9 | `M otion Designer` | `Motion Designer` | ✓ |
| 10 | `Art Dire ctor` | `Art Director` | ✓ |
| 11 | `Cre ative Director` | `Creative Director` | ✓ |
| 12 | `InDes ign` | `InDesign` | ✓ |
| 13 | `After Effe cts` | `After Effects` | ✓ |
| 14 | `Premi ere Pro` | `Premiere Pro` | ✓ |
| 15 | `Senior graph ic\ndesigner` | `Senior Graphic Designer` | ✓ |
| 16 | `freel ance designer` | `freelance Designer` | ✓ |
| 17 | `pack aging designer` | `packaging Designer` | ✓ |
| 18 | `Visual Des igner` | `Visual Designer` | ✓ |
| 19 | `Brand Des igner` | `Brand Designer` | ✓ |
| 20 | `Product Des igner` | `Product Designer` | ✓ |
| 21 | `Adobe Ill ustrator CC` | `Adobe Illustrator CC` | ✓ |
| 22 | `Figma Protot yping` | `Figma Photo yping` | ✓ |
| 23 | `\|\|\| NE TTT \|\|\|` | `(dropped)` | ✓ |
| 24 | `@@@@@ repeated` | `(dropped)` | ✓ |
| 25 | `Ill ustrator · Phot0shop · InDes ign` | `Illustrator · Photoshop · InDesign` | ✓ |

## Live samples

### Scanned word breaks (`scanned-breaks`)

- Input lines: 3
- Output lines: 3
- Lines merged: 0
- Garbage dropped: 0
- Dictionary line coverage: 100%

**Normalized excerpt:**
```
Illustrator
Graphic Designer
Photoshop
```

### Mobile line wrap (`mobile-wrap`)

- Input lines: 3
- Output lines: 1
- Lines merged: 2
- Garbage dropped: 0
- Dictionary line coverage: 100%

**Normalized excerpt:**
```
Senior Graphic Designer — freelance 2019 — Present
```

### Column gap noise (`multi-column`)

- Input lines: 2
- Output lines: 4
- Lines merged: 0
- Garbage dropped: 0
- Dictionary line coverage: 100%

**Normalized excerpt:**
```
PROFILE
WORK EXPERIENCE
SKILLS
EDUCATION
```

### Low-res char noise (`low-res`)

- Input lines: 1
- Output lines: 1
- Lines merged: 0
- Garbage dropped: 0
- Dictionary line coverage: 100%

**Normalized excerpt:**
```
Illustrator · Designer · Premiere Pro
```

### Garbage + content (`garbage-mix`)

- Input lines: 4
- Output lines: 2
- Lines merged: 0
- Garbage dropped: 2
- Dictionary line coverage: 100%

**Normalized excerpt:**
```
Motion Designer
Figma
```


## Yoaz live OCR cache

| Metric | Before | After normalize |
| --- | --- | --- |
| Lines | 42 | 32 |
| Garbage dropped | — | 0 |
| Lines merged | — | 12 |
| Dictionary coverage | — | 72% |


## Fragmented OCR fixture

| Metric | Value |
| --- | --- |
| Input lines | 43 |
| Output lines | 42 |
| Garbage dropped | 0 |
| Lines merged | 2 |
| Dictionary coverage | 98% |


## Trace sample (first normalized document)

```json
[
  {
    "rawLine": "Ill ustrator",
    "normalizedLine": "Illustrator",
    "accepted": true
  },
  {
    "rawLine": "Senior graphic\ndesigner",
    "normalizedLine": "Senior Graphic Designer",
    "accepted": true
  }
]
```
