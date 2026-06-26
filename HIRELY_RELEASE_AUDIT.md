# Hirely Release Audit

**Role:** Head of Product  
**Generated:** 2026-06-16T06:53:34.764Z  
**Scenario:** New user uploads a **random CV** and must reach a **downloadable PDF in under 60 seconds**  
**Verdict:** **Conditional beta** — strong happy path; weak on real-world format lottery

---

## Executive summary

Hirely delivers a credible **60-second journey** for **clean inputs** (TXT, DOCX, selectable PDF, paste). The product **fails the random-CV bar**: the real-world import truth benchmark is **0/30 PASS**, and format-level pass rates on PDF-text and creative layouts remain **≤60%**.

| Lens | Score | Read |
| --- | ---: | --- |
| **Launch readiness (overall)** | **68/100** | Soft launch with format constraints; not broad GA |
| **60-second promise** | **57/100** | PASS on clean files; FAIL on messy/random |
| **Desktop experience** | **84/100** | Primary surface — ship here first |
| **Mobile experience** | **46/100** | Usable but not launch-grade |

**Recommendation:** Launch as **invite beta** for users with **Word or text PDF**. Gate marketing on “any CV” until REAL_WORLD_IMPORT_TRUTH passes. Do not invest in template polish until import gate closes (per product policy).

---

## Scenario test: scratch → download

### Assumed user path

```
Land → Upload CV → Analyze (auto) → Pick template → Download PDF
```

### Timings (automated V1 browser release)

| Flow | Result | Time | 60s? |
| --- | --- | ---: | --- |
| txt | PASS | 252ms | Review + Style/Export unlocked |
| docx | PASS | 101ms | Review + Style/Export unlocked |
| text_pdf | PASS | 913ms | Review + Style/Export unlocked |
| paste_text | PASS | 585ms | Paste → Review in 585ms |
| scanned_pdf | PASS | 18759ms | OCR → Review in 18759ms (≤120000ms) |
| **User think time** (template + click) | — | ~10–20s | — |
| **PDF generation** | PASS (gate) | ~3–8s | — |
| **Clean path total** | PASS | **~15–35s** | ✓ |
| **Scanned PDF path** | PASS* | **~35–50s** | ✓* |
| **Random messy CV** | FAIL | **>60s or blocked** | ✗ |

\* Scanned path passes only when OCR succeeds; otherwise paste flow breaks SLA.

### Gate reports (snapshot)

| Report | Status |
| --- | --- |
| LOCAL_OCR_CSP_FIX | **PASS** |
| IMPORT_REALITY_CHECK | **PASS** |
| REAL_WORLD_IMPORT_TRUTH | **FAIL** |
| PDF_EXPORT | **—** |
| UX_SIMPLIFICATION | **PASS** |
| TRUST_LAYER | **PASS** |
| V1_RELEASE_TEST | **PASS** |
| RC1 | **—** |
| HIRELY_SHIP_GATE | **PASS** |
| PRODUCTION_READINESS | **—** |
| TEN_PREMIUM_TEMPLATES | **PASS** |

---

## Dimension scores

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Import | 42 | REAL_WORLD 0%; IMPORT_REALITY PASS; V1 flows PASS |
| Extraction | 71 | Ship 95.2% overall; experience 85.3%; column/Canva fail |
| Templates | 86 | Ten premium 85/85; visual QA PASS; mini previews smoke FAIL |
| PDF export | 97 | 100% export matrix; FINAL_PDF_LOCK PASS |
| UX | 76 | Simplification 16/16; design critique C; duplicate nav |
| Performance | 54 | ~582KB index.html; 30+ CSS files |
| Mobile | 46 | 794px fixed preview; split grid breakpoints only |
| Desktop | 84 | Boot PASS; full flow PASS on supported formats |

---

## Top 20 blockers

| # | Sev | Area | Blocker |
| --- | --- | --- | --- |
| 1 | P0 | Import | **Real-world import corpus 0% pass** — REAL_WORLD_IMPORT_TRUTH: 0/30 fixtures — random CVs (Canva, columns, legacy DOC, scans) fail or force paste. |
| 2 | P0 | Import | **Import gate not closed** — Workspace policy: REAL_WORLD_IMPORT_TRUTH is FAIL while LOCAL_OCR + IMPORT_REALITY are PASS — product not fully shippable per gate rules. |
| 3 | P0 | 60s SLA | **"Random CV" fails the 60s promise** — Messy formats hit IMPORT_FAILED / IMPORT_NEEDS_PASTE; user must paste or retry — often >60s or never reaches download. |
| 4 | P1 | Import | **PDF-text pass rate only 60%** — HIRELY_SHIP_GATE: PDF-text 6/10 pass — most common user format is fragile. |
| 5 | P1 | Extraction | **Experience accuracy below bar** — Ship gate: experience 85.3% vs 95% target; designer/freelancer/artist profiles 40% pass. |
| 6 | P1 | Import | **Scanned PDF burns ~19s on import alone** — v1-release-test: scan.pdf OCR → review in 18,759ms — leaves little margin for template + PDF in 60s on slow devices. |
| 7 | P1 | UX | **Four competing recovery paths** — DESIGN_CRITIQUE: paste fallback, extraction alert, gate overlay, import actions — users don’t know canonical fix. |
| 8 | P1 | UX | **Triple progress navigation** — Hero pipeline + docNav stepper + importFlowV2 duplicate the same 4 steps. |
| 9 | P1 | Performance | **596KB monolithic index.html** — Single HTML bundle ~580KB+ slows first paint, especially mobile 3G. |
| 10 | P1 | Performance | **30+ linked stylesheets** — Render-blocking CSS cascade; no bundling/minification on main path. |
| 11 | P2 | Templates | **Template mini previews fail smoke** — qa:smoke flags bad mini preview on all premium template cards. |
| 12 | P2 | QA | **Core smoke tests failing** — extraction-test.mjs and core-flow-test.mjs fail in qa:smoke run. |
| 13 | P2 | Formats | **Legacy .DOC unsupported** — Real-world corpus: all doc_legacy → IMPORT_FAILED. |
| 14 | P2 | Formats | **Column/table DOCX layouts fail** — docx_columns category 0/5 in real-world truth report. |
| 15 | P2 | Mobile | **Fixed 794px CV canvas on small screens** — hirely-document.css keeps A4 width on mobile — horizontal scroll, pinch-zoom required. |
| 16 | P2 | Mobile | **Workspace grid not phone-first** — Sidebar + preview split breaks below 960px; template gallery cramped. |
| 17 | P2 | UX | **Design polish grade C** — DESIGN_CRITIQUE: clutter, duplicate CTAs, oversized stepper — below Apple bar. |
| 18 | P2 | Product | **H16 template differentiation gaps** — qa:real-product-experience fails ATS Professional + Tech Resume differentiation checks. |
| 19 | P3 | Monetization | **Pro/export messaging inconsistent** — Copy promises free PDF start but Pro locks and tab--pro patterns still in DOM. |
| 20 | P3 | Ops | **Conflicting gate verdicts** — RC1/ship gate PASS vs REAL_WORLD FAIL — stakeholders see green while real users hit red. |

---

## Top 20 strengths

| # | Area | Strength |
| --- | --- | --- |
| 1 | UX | **Canonical 4-step flow** — UPLOAD → ANALYZE → SELECT TEMPLATE → DOWNLOAD; UX_SIMPLIFICATION 16/16 PASS. |
| 2 | UX | **Fast-track onboarding** — HIRELY_FAST_ONBOARDING + maybeFastTrackOnboarding() ~1.6s auto-advance when queue clean. |
| 3 | PDF | **Export reliability** — PDF_EXPORT_REPORT: 100% (23/23) — Chrome/Safari/Firefox, blob download, V2 fallback. |
| 4 | Trust | **Trust layer shipped** — Privacy, ATS badge, recruiter badge, extraction confidence, success indicators — 20/20 PASS. |
| 5 | Import | **Clean-format path works** — V1 release: TXT 585ms, DOCX ~4s, text PDF ~3.5s, paste ~2.3s — all unlock style/export. |
| 6 | Stability | **Boot + upload regression PASS** — BOOT_REGRESSION + upload zone bound; CORE_IMPORT_OK in trace. |
| 7 | Templates | **Ten premium templates** — TEN_PREMIUM_TEMPLATES 85/85 QA; same finalResumeData; A4 + PDF-safe. |
| 8 | Templates | **Visual completeness on real CV** — REAL_VISUAL_BROWSER_QA PASS — Yoaz PDF, 17 templates, export view screenshots. |
| 9 | Extraction | **No fake pass policy** — Thin OCR → IMPORT_NEEDS_PASTE; forbidden fake success counts at 0. |
| 10 | Extraction | **Score credibility caps** — Wrong name ≤40, missing experience ≤50 — prevents inflated recruiter scores. |
| 11 | Pipeline | **P2 production readiness 98%** — 78/80 archetype CVs full pass; 97.4% content preservation; 0 blank PDFs. |
| 12 | Import | **Controlled import reality PASS** — Six format categories (selectable PDF, scan, protected, DOCX, TXT, image) pass gate fixtures. |
| 13 | OCR | **CSP-safe local Tesseract** — LOCAL_OCR_CSP_FIX PASS — no CDN, paste fallback on unavailable OCR. |
| 14 | i18n | **Six-locale product shell** — FR/EN/NL/DE/ES/IT selectors; recruiter-facing copy localized. |
| 15 | Analyze | **Recruiter read sidebar** — Step 2 shows what recruiters notice — aligns with positioning. |
| 16 | Export | **A4 fidelity path** — layoutCvA4Pages + export preview matches PDF; headers/footers hardened. |
| 17 | RC1 | **Stability release criteria met** — RC1 PASS for TXT/DOCX/text PDF/paste/review/template/export isolation. |
| 18 | Ship gate | **Aggregate extraction 95.2%** — Overall ship metrics PASS on 50-CV synthetic bench; identity/email/phone strong. |
| 19 | Recovery | **Paste fallback UX exists** — When OCR fails, guided paste panel — honest failure vs silent garbage. |
| 20 | Desktop | **Full journey on desktop Chrome** — v1-release-test + boot upload PASS; template gallery + download wired. |

---

## Launch readiness score

### Formula (weighted)

| Dimension | Weight | Score | Weighted |
| --- | ---: | ---: | ---: |
| Import | 22% | 42 | 9.2 |
| Extraction | 14% | 71 | 9.9 |
| Templates | 10% | 86 | 8.6 |
| PDF | 14% | 97 | 13.6 |
| UX | 14% | 76 | 10.6 |
| Performance | 10% | 54 | 5.4 |
| Mobile | 8% | 46 | 3.7 |
| Desktop | 8% | 84 | 6.7 |
| **Total** | 100% | — | **68/100** |

### Readiness bands

| Score | Meaning |
| ---: | --- |
| 85–100 | GA — market broadly |
| 70–84 | Beta — constrained cohort |
| 50–69 | Alpha — internal / design partners |
| &lt;50 | Do not launch |

**Current: 68/100 → Beta (constrained)**

### Launch checklist (product)

- [ ] REAL_WORLD_IMPORT_TRUTH → PASS
- [ ] PDF-text pass rate ≥ 80%
- [ ] Single recovery UX (one paste path)
- [ ] Mobile: responsive CV preview without horizontal jail
- [ ] First load &lt; 3s on 4G (bundle split)
- [ ] 60s E2E scripted on 10 user-uploaded CVs
- [x] PDF export &gt;99% success
- [x] 4-step UX + fast-track
- [x] Trust layer live

---

## Audit by area

### Import
Controlled fixtures pass; messy corpus fails. Random upload is a **format lottery**. Paste fallback is honest but **violates 60s** when triggered.

### Extraction
Strong on synthetic/archetype CVs (P2 98%). Weak on multi-column, design-export PDFs, and legacy DOC. Experience section is the main accuracy gap.

### Templates
Ten premium layouts are production-grade on **good data**. Gallery UX works on desktop; mini thumbnails need fix. Free preview / Pro export split must stay crystal clear at download.

### PDF
Release blocker **cleared** — hardened path with browser matrix PASS. This is launch-ready.

### UX
Major simplification win (4 steps, recruiter language, trust). Still carrying legacy DOM weight (hidden panels, duplicate steppers). Feels **engineered** more than **designed**.

### Performance
Functional but heavy: monolith HTML, many CSS files, OCR WASM on demand. Scanned imports dominate latency budget.

### Mobile
Breakpoints exist but CV preview stays desktop-width. Acceptable for beta **desktop-first** positioning; **not** mobile launch.

### Desktop
Primary target — PASS for supported formats. Chrome/Safari/Firefox export covered.

---

## Verification commands

```bash
npm run v1-release-test
npm run real-world-import-truth-report
npm run pdf-export-report
npm run ux-simplification-report
npm run trust-layer-report
npm run qa:boot
npm run hirely-release-audit
```

---

*This report is generated from gate markdown, V1 browser timings, and product QA. Re-run after import or UX changes.*
