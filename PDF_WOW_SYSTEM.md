# Hirely Premium PDF — Wow System Spec

**Version:** `PDF_WOW_SYSTEM_V1`  
**Status:** Spec (extends `PDF_EXPORT_V2` + `pdf-export-v2.css`)  
**Goal:** The exported PDF should feel **expensive** — board-room document, not a screenshot stack. Premium typography, deliberate spacing, editorial cover, and audit pages that read like a McKinsey one-pager.

---

## 1. Problem

`PDF_EXPORT_V2` fixed the technical failures (page clipping, WYSIWYG clone, per-page rasterize). The **audit packet** still feels utilitarian:

| Page | Today | Why it feels cheap |
|------|-------|-------------------|
| Cover | Inter 36px name + big score number | Generic SaaS export cover |
| Summary | 3-stat grid + plain body | No editorial hierarchy |
| Audit | 3 boxed scores + 4px bars | Dashboard widget, not report |
| Recruiter notes | Twin-column bullet lists | Checklist dump |
| Recommendations | Numbered list + italic disclaimer | Afterthought |
| CV sheets | Template-dependent | Good — but no packet cohesion |
| **Missing** | Section dividers between packet pages | Pages feel unrelated |
| **Missing** | Dedicated ATS report page | ATS buried in audit score block |
| **Missing** | Executive summary as hero prose | Reuses generic review copy |

**Wow System** upgrades the **audit packet layer** while preserving the proven CV clone path.

---

## 2. North star references

| Reference | Borrow | Apply to |
|-----------|--------|----------|
| **Apple** Keynote export | Restraint, one focal element per page, SF-grade spacing | Cover, executive summary |
| **McKinsey / BCG** one-pagers | Section rules, kicker + headline + body rhythm | Recruiter notes, ATS report |
| **Financial Times** | Serif display for names, wide kickers | Cover name, section dividers |
| **Stripe** reports | Tabular nums, micro-labels, hairline rules | Score blocks, ATS dimensions |
| **Luxury print** | Warm paper, generous margins, no heavy borders | Cover gradient, sheet padding |

**Not:** colorful infographics, stock icons, gradient score gauges, fake “certified” badges.

---

## 3. Packet architecture (V2 → Wow)

### 3.1 Current packet (PDF_EXPORT_V2)

```
1. Cover
2. Candidate summary
3. Audit score (combined)
4. Recruiter notes
5. Recommendations
6+. CV pages (cloned)
```

### 3.2 Wow packet (PDF_WOW_SYSTEM_V1)

```
1. Cover page                    ← editorial redesign
2. Executive summary             ← NEW dedicated page (was merged in summary/audit)
   ─── section divider ───
3. Candidate overview            ← slim contact + stats (renamed summary)
   ─── section divider ───
4. ATS compatibility report      ← NEW dedicated page (ATS_ENGINE_PRO)
   ─── section divider ───
5. Recruiter notes               ← redesigned layout
   ─── section divider ───
6. Recommendations               ← action cards, not bullets
7+. CV pages                     ← unchanged clone path + optional divider before CV
```

**Toggle:** `packet.wowMode: true` (default Pro export). `includeAuditPacket: false` still exports CV only.

**Page budget:** Max 6 audit pages before CV — overflow splits ATS risks to appendix (Phase 2).

---

## 4. Global design system (audit packet)

New file: `src/ui/export/pdf-wow-system.css` — extends `pdf-export-v2.css`.

### 4.1 Paper & margins

| Token | Value | Notes |
|-------|-------|-------|
| `--pdf-wow-paper` | `#fafaf8` | Warm white (cover only) |
| `--pdf-wow-sheet` | `#ffffff` | Inner pages |
| `--pdf-wow-ink` | `#111110` | Primary text |
| `--pdf-wow-ink-secondary` | `#3a3a38` | Subheads |
| `--pdf-wow-ink-tertiary` | `#6e6e73` | Labels (Apple gray) |
| `--pdf-wow-rule` | `#e6e6e3` | Hairline dividers |
| `--pdf-wow-margin-x` | `64px` | Was 52–56px |
| `--pdf-wow-margin-y` | `56px` | Top/bottom |
| `--pdf-wow-gutter` | `24px` | Between blocks |

### 4.2 Typography scale

| Role | Font | Size | Weight | Tracking |
|------|------|------|--------|----------|
| Cover name | `Source Serif 4`, Georgia | 42px | 600 | −0.04em |
| Cover title | Inter | 17px | 500 | −0.02em |
| Page headline (H1) | Inter | 24px | 650 | −0.03em |
| Section kicker | Inter | 10px | 700 | 0.12em uppercase |
| Section title (H2) | Inter | 11px | 700 | 0.08em uppercase |
| Executive body | `Source Serif 4` | 14px | 400 | 0 — 1.62 leading |
| UI body | Inter | 12.5px | 400 | 1.58 leading |
| Micro label | Inter | 9px | 600 | 0.1em uppercase |
| Tabular scores | Inter | varies | 700 | `font-variant-numeric: tabular-nums` |

**Rule:** Serif only on cover name + executive summary prose — everything else sans.

### 4.3 Spacing rhythm

8px base grid. Vertical stack:

```
kicker          margin-bottom: 8px
headline        margin-bottom: 12px
subhead         margin-bottom: 16px
content block   margin-bottom: 24px
section gap     margin-bottom: 32px
page footer     margin-top: auto (flex sheet)
```

**Min touch:** No two headings without 8px+ breathing room. No block closer than 16px to page edge (inside margin).

---

## 5. Section dividers

Dividers signal **document parts** — not decorative noise.

### 5.1 Full-page divider (between packet sections)

Inserted as **footer zone** on each audit page (except cover):

```
────────────────────────────────────────────  ← 1px rule, 48% width, centered
Hirely · Executive Summary · 2 of 6
```

| Element | Spec |
|---------|------|
| Rule | 1px `#e6e6e3`, max-width 240px, centered |
| Meta | 9px uppercase, tertiary color, letter-spacing 0.14em |
| Page index | `current / total` audit pages only |

### 5.2 In-page section divider

Between major blocks on same page:

```html
<div class="pdfWowDivider" role="separator">
  <span class="pdfWowDivider__label">ATS dimensions</span>
</div>
```

- 1px full-width rule with **left-aligned** 10px uppercase label sitting on rule (FT style)
- 32px margin above/below

### 5.3 CV boundary divider

Optional page before CV sheets (Pro default on):

**“Curriculum Vitae”** — centered serif, single line, rest blank. Separates audit packet from CV proper — like a book part page.

---

## 6. Page specs

### 6.1 Cover page

**Goal:** Feel like a **private banker’s document folder** — not a dashboard export.

**Layout:**

```
┌────────────────────────────────────────────┐
│  HIRELY                          (micro)   │
│                                            │
│                                            │
│         Yohann Azancot                     │  ← Source Serif 4, 42px
│         Senior Graphic Designer            │  ← Inter 17px
│                                            │
│         ─────────────                      │  ← 48px hairline
│                                            │
│         Strong · 78                        │  ← band label first (SCORING_V2)
│         Recruiter readiness                │  ← micro kicker
│                                            │
│                                            │
│  Template    Swiss Editorial               │
│  Generated   14 June 2026                  │
│  Packet      Audit + CV · 8 pages          │
└────────────────────────────────────────────┘
```

**Changes from V2:**

| Remove | Add |
|--------|-----|
| 48px raw score dominant | Band label primary (`Strong`), score secondary (24px) |
| Generic “Professional CV Export” | “Confidential career document” or omit kicker |
| Flat gradient | Subtle warm paper + **bottom-weighted** whitespace |
| Hirely brand top-left only | Micro brand + optional thin left rail (2px ink @ 4% opacity) |

**Data:** `packet.cover` + `SCORING_SYSTEM_V2` band mapping.

---

### 6.2 Executive summary (new dedicated page)

**Goal:** Board-room **narrative** — not checklist summary.

**Source priority:**

1. `CAREER_STORY_ENGINE` → `executiveSummary` (when available)
2. `RECRUITER_COMMAND_CENTER` → `executiveSummary.summary`
3. `TRUSTED_CV_REVIEW` → headline + summary
4. Fallback: candidate `summary` field

**Layout:**

```
EXECUTIVE SUMMARY                    ← kicker

Needs attention → Strong           ← headline (band-aware)

Yohann Azancot is a senior graphic designer with eight years of
brand and campaign experience across Paris-based agencies and
luxury clients. He has progressed from designer to art director
roles, delivering identity systems for Sephora, L'Oréal, and Nike.
                                   ← Source Serif 4, 14px, 1.62 leading

Who · Expertise · Trajectory · Value  ← 4 micro chips (facts only)

────────────────────────────────
Hirely · Executive Summary · 2 of 6
```

**Four-question chips** (from `CAREER_STORY_ENGINE`):

| Chip | Example |
|------|---------|
| Who | Senior Graphic Designer · Paris |
| Expertise | Brand, packaging, campaigns |
| Trajectory | Designer → Art Director · 8 yrs |
| Value | Sephora, L'Oréal, Nike |

**Rule:** Chips only contain facts from CV — never invented clients.

---

### 6.3 Candidate overview (slim summary page)

Renamed from “Candidate summary”. **Contact + stats only** — executive prose moved to §6.2.

```
CANDIDATE OVERVIEW

Yohann Azancot
Senior Graphic Designer
Paris · email · phone · LinkedIn

┌─────────┬─────────┬─────────┐
│    4    │    12   │    2    │
│Experience│ Skills  │Education│
└─────────┴─────────┴─────────┘

Professional summary (if no exec page — shortened)
```

**Spacing:** Stats row uses **hairline box** not heavy border — padding 20px, no fill.

---

### 6.4 ATS compatibility report (new dedicated page)

**Goal:** Standalone **ATS Engine Pro** report — the product’s technical credibility page.

**Source:** `analyzeAtsPro()` → `audit.atsPro` / `recruiterAudit.atsPro`

**Layout:**

```
ATS COMPATIBILITY REPORT

Strong · 76                           ← band + score
Benchmarked for Greenhouse, Lever, Workday, SmartRecruiters

┌─────────────────────────────────────┐
│ Keywords        ████████░░  82%     │  ← 6px bars, rounded
│ Format          ██████░░░░  68%     │
│ Sections        █████████░  88%     │
│ Readability     ███████░░░  74%     │
│ Contact         ██████████  95%     │
│ Experience      ███████░░░  71%     │
│ Skills          ████████░░  80%     │
└─────────────────────────────────────┘

Highlights                          ← max 3, green dot prefix
• Experience blocks parseable
• Contact fields complete

Gaps                                ← max 3, amber dot prefix
• Non-standard section label: "Profile"
• Missing metric density in experience

Platform readiness                  ← 2×2 micro grid
Greenhouse 76 · Lever 74 · Workday 71 · SmartRecruiters 78
```

**Visual rules:**

- Band label before percentage (SCORING_SYSTEM_V2)
- Bars: 6px height, ink fill on `#ececea` track — not 4px dashboard widgets
- No pie charts
- Risks + recommendations: max 2 each, footnote size

**Overflow:** If job description provided, add “Keyword match” sub-block (matched vs missing, 2 columns).

---

### 6.5 Recruiter notes

**Goal:** Read like **partner comments** — structured, scannable, not twin bullet dumps.

**Layout:**

```
RECRUITER NOTES

Confidence: High · 82

STRENGTHS                         WEAKNESSES
────────────────                  ────────────────
✓ Name and title clear            ! No measurable results
✓ 11 years experience             ! Summary missing
✓ Dates included                  ! LinkedIn not listed
✓ Education listed

MISSING INFORMATION
Email · —  |  Phone · ✓  |  LinkedIn · ✗  |  Summary · ✗
                    ← status strip, not bullet list

INTERVIEW RISK AREAS
▸ Summary missing — high
▸ Impact thin — high
▸ Dates unclear — medium
```

**Changes:**

| Remove | Add |
|--------|-----|
| Raw `<ul>` twins | Rule-separated columns with ✓ / ! prefixes |
| Interview risks as bullets | Severity tags (`high` / `medium`) + left border accent |
| Missing as list | Horizontal **status strip** with ✓/✗ |

**Source:** `recruiterNotes` + `RECRUITER_BRAIN_V1` top insights (Phase 2) — quadrant labels (`Will like`, `May question`) instead of flat strengths.

**Max items:** 6 strengths, 5 weaknesses, 4 missing, 5 risks — truncate with “+N more in app”.

---

### 6.6 Recommendations

**Goal:** **Action cards** — one clear fix per card.

```
RECOMMENDATIONS

Next steps before sending

┌──────────────────────────────────────────┐
│ 1  Add a professional summary          │
│    Recruiters decide in 6 seconds — lead │
│    with role + value.                    │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ 2  Add measurable results to experience    │
│    Include %, $, or scale where truthful.  │
└──────────────────────────────────────────┘

This audit is generated from your imported CV. Verify all facts
before sharing with employers.
```

**Card spec:** 1px rule border, 16px padding, number in 28px tabular circle — no fill cards (avoid SaaS “feature tile” look).

**Source:** `packet.recommendations` + `atsPro.recommendations` merged, deduped, prioritized by severity.

---

### 6.7 CV pages (unchanged path, polish)

Clone path stays: `.cvA4Stack .cvA4Sheet` → `pdfV2Page--cv`.

**Wow additions:**

| Enhancement | Spec |
|-------------|------|
| Pre-CV divider | Optional “Curriculum Vitae” part page |
| Export shadow strip | Remove all preview shadows (existing) |
| Font wait | `document.fonts.ready` + 200ms (existing) |
| Template fidelity | `cv-pdf-export.css` + template family CSS |

**Non-goal:** Re-design CV templates in this spec — template polish is separate.

---

## 7. Data model extensions

```ts
type PdfWowPacket = PdfExportV2Packet & {
  version: 'PDF_WOW_SYSTEM_V1';
  wowMode: true;
  cover: {
    name: string;
    title: string;
    score: number;
    band: string;              // Strong, Fair, etc.
    bandLabel: string;         // consumer-facing
    templateName: string;
    generatedAt: string;
    pageCount: number;         // total packet + CV
  };
  executiveSummary: {
    headline: string;
    band: string;
    narrative: string;         // serif body
    chips: { id: string; label: string }[];  // who/expertise/trajectory/value
    source: 'career_story' | 'rcc' | 'trusted_review' | 'cv_summary';
  };
  atsReport: {
    score: number;
    band: string;
    confidence: number;
    dimensions: { id: string; label: string; pct: number }[];
    highlights: string[];
    gaps: string[];
    risks: { level: string; label: string }[];
    benchmarks: { platform: string; score: number }[];
    keywordCoverage?: { pct: number; matched: string[]; missing: string[] };
  };
  recruiterNotes: { /* enhanced with severity */ };
  recommendations: { priority: number; title: string; detail: string }[];
};
```

**Builder:** `buildPdfWowPacket()` in `src/core/export/pdf-wow-system.js` — wraps `buildPdfExportV2Packet()`, enriches from `atsPro`, `careerStoryEngine`, `SCORING_SYSTEM_V2` bands.

---

## 8. Architecture

```
downloadPDF()
  → buildPdfWowPacket()              ← NEW
  → HirelyPdfExportWow.buildExportRoot()  ← NEW DOM builders
  → HirelyPdfExport.exportPacketV2()      ← unchanged rasterize
```

### 8.1 File map

| File | Role |
|------|------|
| `src/core/export/pdf-wow-system.js` | Packet builder + band mapping |
| `src/ui/export/pdf-wow-system.js` | Page DOM builders (7 audit pages) |
| `src/ui/export/pdf-wow-system.css` | Typography, dividers, cards |
| `src/core/export/pdf-export-v2.js` | Base packet (delegate) |
| `src/ui/export/pdf-export-v2.js` | CV clone utilities (shared) |
| `src/ui/export/hirely-pdf-export.js` | jsPDF assembly |

### 8.2 Integration map

| Engine | PDF Wow use |
|--------|-------------|
| `PDF_EXPORT_V2` | Page-by-page rasterize, A4 contract |
| `SCORING_SYSTEM_V2` | Band labels on cover, ATS, exec summary |
| `ATS_ENGINE_PRO` | Dedicated ATS report page |
| `CAREER_STORY_ENGINE_V1` | Executive summary narrative |
| `RECRUITER_COMMAND_CENTER_V2` | Notes, confidence, keywords |
| `RECRUITER_BRAIN_V1` | Strategic insights in notes (Phase 2) |
| `TRUSTED_CV_REVIEW_V1` | Fallback copy |

---

## 9. Export modes

| Mode | Audit pages | Use |
|------|-------------|-----|
| **Premium** (default Pro) | Full wow packet (6) + CV | Email, print, share |
| **CV only** | 0 + CV | User toggle “CV pages only” |
| **Audit lite** | Cover + exec + CV | Mobile / small file |
| **Legacy fallback** | V2 packet or P6 stack | If wow module unavailable |

**Filename:** `{lastname}-{template}-hirely.pdf` — unchanged.

---

## 10. Motion & rasterize (export-time only)

Wow system is **print-static** — no animation in PDF. Export pipeline unchanged:

| Step | Spec |
|------|------|
| Suspend viewport scale | `HirelyA4Viewport.suspendScaleForExport()` |
| Build wow root | Off-screen `#pdfExportWowRoot` |
| Font ready | `await document.fonts.ready` |
| Settle | 200ms |
| Per page | html2canvas @ 794×1123, scale 2 |
| jsPDF | One image per A4, no clipping |

---

## 11. Implementation phases

### Phase 1 — Typography + cover + dividers

- [ ] `pdf-wow-system.css` tokens
- [ ] Redesigned cover page
- [ ] Page footer dividers with index
- [ ] CV boundary part page

### Phase 2 — Executive summary + ATS report

- [ ] Dedicated executive summary page
- [ ] `buildPdfWowPacket()` + ATS Pro wiring
- [ ] ATS dimension bars + benchmarks grid
- [ ] Slim candidate overview page

### Phase 3 — Recruiter notes + recommendations

- [ ] Notes layout redesign (columns, status strip, severity)
- [ ] Recommendation action cards
- [ ] Band labels everywhere (no raw % headlines)

### Phase 4 — QA + polish

- [ ] `qa-pdf-wow-system.mjs`
- [ ] `scripts/pdf-wow-system-report.mjs`
- [ ] Visual regression vs `PDF_EXPORT_V2_REPORT` corpus
- [ ] Print test: margins, no clip, serif embed

---

## 12. Acceptance criteria

| # | Criterion |
|---|-----------|
| 1 | Cover shows band label before raw score |
| 2 | Executive summary uses serif body on dedicated page |
| 3 | ATS report is standalone page with 7 dimensions from `ATS_ENGINE_PRO` |
| 4 | Every audit page has footer section divider + page index |
| 5 | Recruiter notes use severity on interview risks |
| 6 | Recommendations render as action cards, not plain bullets |
| 7 | Horizontal margins ≥ 64px on audit pages |
| 8 | CV clone path unchanged — WYSIWYG preserved |
| 9 | `prefers-reduced-motion` N/A (static PDF) |
| 10 | `npm run qa:pdf-wow-system` passes; `qa:pdf-export-v2` no regression |

---

## 13. QA commands

```bash
npm run qa:pdf-export-v2
npm run qa:premium-pdf-export
npm run qa:ats-engine-pro
# Future
npm run qa:pdf-wow-system
npm run pdf-wow-system-report
```

**Manual checklist:**

1. Export Pro CV → open PDF → cover feels editorial, not SaaS
2. Page through audit → dividers + index consistent
3. ATS page → 7 bars + platform benchmarks present
4. Executive summary → serif prose, 4 chips
5. CV pages → match preview pixel-for-pixel

---

## 14. Before / after

### Before (PDF_EXPORT_V2)

| Page | Feel |
|------|------|
| Cover | Big number, generic kicker |
| Summary | Stats grid + plain paragraph |
| Audit | 3 boxes + thin bars + keyword line |
| Notes | Bullet twins |
| Recs | Bullet list |

**Overall:** Functional audit export attached to CV.

### After (PDF_WOW_SYSTEM_V1)

| Page | Feel |
|------|------|
| Cover | Editorial serif name, band-first score, warm paper |
| Executive summary | Board-room narrative + fact chips |
| Overview | Clean contact + stats |
| ATS report | Full compatibility dossier |
| Recruiter notes | Partner memo layout |
| Recs | Numbered action cards |
| CV | Preceded by optional part divider |

**Overall:** **Expensive document packet** — something a candidate would pay €9 to attach to an application.

---

## 15. Summary

| Improve | Wow treatment |
|---------|---------------|
| Cover page | Serif name, band-first, warm paper, confidential tone |
| Section dividers | Footer rules + index; in-page FT labels; CV part page |
| Typography | Source Serif 4 + Inter scale; tabular nums |
| Spacing | 64px margins, 8px grid, 32px section gaps |
| Executive summary | Dedicated page; career story narrative |
| Recruiter notes | Column rules, status strip, severity risks |
| ATS report | Standalone ATS Engine Pro dossier |

The PDF should feel like it came from a **document studio**, not a screenshot tool.

---

*Spec `PDF_WOW_SYSTEM_V1` — extends `PDF_EXPORT_V2`, `SCORING_SYSTEM_V2`, `ATS_ENGINE_PRO`, and `CAREER_STORY_ENGINE_V1`.*
