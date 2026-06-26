# Recruiter Scan Test Report

**Generated:** 2026-06-14
**Engine:** `RECRUITER_SCAN_TEST_V1`
**QA gate:** PASS

## Simulation

Recruiters typically spend **6–10 seconds** on the first CV scan.
This test measures what is visible in the **top 427px** (~38% of A4 page 1) without scrolling.

### Measured fields

| Field | Weight | Recruiter priority |
|-------|--------|------------------|
| name | 25% | Critical |
| title | 20% | High |
| experience | 25% | Critical |
| skills | 10% | Secondary |
| education | 5% | Secondary |
| contact | 15% | High |

## Template ranking (best → worst)

| Rank | Template | ID | Scan score | Fields in zone |
|------|----------|-----|------------|----------------|
| 1 | Consulting Elite | `consulting-elite` | **0.96** | name, title, experience, skills, education, contact |
| 2 | Apple Style | `apple-style` | **0.86** | name, title, experience, contact |
| 3 | Google Style | `google-style` | **0.82** | name, title, experience, skills, education |
| 4 | Academic | `academic` | **0.82** | name, title, experience, skills, education |
| 5 | Luxury Editorial | `luxury-editorial` | **0.82** | name, title, experience, skills, education |
| 6 | Startup Founder | `startup-founder` | **0.8** | name, title, experience, skills |
| 7 | Minimal ATS | `minimal-ats` | **0.73** | name, title, skills, education, contact |
| 8 | Creative Director | `creative-director` | **0.73** | name, title, experience |
| 9 | Executive Board | `executive-board` | **0.72** | name, title, experience |
| 10 | Senior Engineer | `senior-engineer` | **0.59** | name, title, skills, education |

## Per-template audit

### 1. Consulting Elite (`consulting-elite`)

**Scan score:** 0.96 · **Fields in zone:** 6/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 26 | Prominent in scan zone |
| title | ✓ | 1 | 69 | Prominent in scan zone |
| experience | ✓ | 0.92 | 264 | Visible in scan zone |
| skills | ✓ | 0.92 | 250 | Visible in scan zone |
| education | ✓ | 0.92 | 171 | Visible in scan zone |
| contact | ✓ | 0.92 | 95 | Visible in scan zone |

### 2. Apple Style (`apple-style`)

**Scan score:** 0.86 · **Fields in zone:** 4/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 32 | Prominent in scan zone |
| title | ✓ | 1 | 92 | Prominent in scan zone |
| experience | ✓ | 0.92 | 286 | Visible in scan zone |
| skills | — | 0.25 | 691 | Below scan zone — requires scroll |
| education | — | 0.25 | 608 | Below scan zone — requires scroll |
| contact | ✓ | 0.92 | 193 | Visible in scan zone |

### 3. Google Style (`google-style`)

**Scan score:** 0.82 · **Fields in zone:** 5/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 22 | Prominent in scan zone |
| title | ✓ | 1 | 56 | Prominent in scan zone |
| experience | ✓ | 0.92 | 140 | Visible in scan zone |
| skills | ✓ | 0.92 | 109 | Visible in scan zone |
| education | ✓ | 0.92 | 284 | Visible in scan zone |
| contact | — | 0 | — | Not found or text missing |

### 4. Academic (`academic`)

**Scan score:** 0.82 · **Fields in zone:** 5/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 22 | Prominent in scan zone |
| title | ✓ | 1 | 69 | Prominent in scan zone |
| experience | ✓ | 0.92 | 288 | Visible in scan zone |
| skills | ✓ | 0.92 | 270 | Visible in scan zone |
| education | ✓ | 0.92 | 186 | Visible in scan zone |
| contact | — | 0 | — | Not found or text missing |

### 5. Luxury Editorial (`luxury-editorial`)

**Scan score:** 0.82 · **Fields in zone:** 5/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 24 | Prominent in scan zone |
| title | ✓ | 1 | 83 | Prominent in scan zone |
| experience | ✓ | 0.92 | 215 | Visible in scan zone |
| skills | ✓ | 0.92 | 261 | Visible in scan zone |
| education | ✓ | 0.92 | 185 | Visible in scan zone |
| contact | — | 0 | — | Not found or text missing |

### 6. Startup Founder (`startup-founder`)

**Scan score:** 0.8 · **Fields in zone:** 4/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 28 | Prominent in scan zone |
| title | ✓ | 1 | 74 | Prominent in scan zone |
| experience | ✓ | 0.92 | 227 | Visible in scan zone |
| skills | ✓ | 0.92 | 174 | Visible in scan zone |
| education | — | 0.55 | 486 | Partially visible — starts in zone, extends below |
| contact | — | 0 | — | Not found or text missing |

### 7. Minimal ATS (`minimal-ats`)

**Scan score:** 0.73 · **Fields in zone:** 5/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 12 | Prominent in scan zone |
| title | ✓ | 1 | 42 | Prominent in scan zone |
| experience | — | 0 | 166 | Not found or text missing |
| skills | ✓ | 0.92 | 363 | Visible in scan zone |
| education | ✓ | 0.92 | 290 | Visible in scan zone |
| contact | ✓ | 0.92 | 63 | Visible in scan zone |

### 8. Creative Director (`creative-director`)

**Scan score:** 0.73 · **Fields in zone:** 3/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 36 | Prominent in scan zone |
| title | ✓ | 1 | 102 | Prominent in scan zone |
| experience | ✓ | 0.92 | 307 | Visible in scan zone |
| skills | — | 0.25 | 537 | Below scan zone — requires scroll |
| education | — | 0.55 | 449 | Partially visible — starts in zone, extends below |
| contact | — | 0 | — | Not found or text missing |

### 9. Executive Board (`executive-board`)

**Scan score:** 0.72 · **Fields in zone:** 3/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 60 | Prominent in scan zone |
| title | ✓ | 1 | 124 | Prominent in scan zone |
| experience | ✓ | 0.92 | 402 | Visible in scan zone |
| skills | — | 0.25 | 806 | Below scan zone — requires scroll |
| education | — | 0.25 | 698 | Below scan zone — requires scroll |
| contact | — | 0 | — | Not found or text missing |

### 10. Senior Engineer (`senior-engineer`)

**Scan score:** 0.59 · **Fields in zone:** 4/6

| Field | In scan zone | Score | Top (px) | Note |
|-------|--------------|-------|----------|------|
| name | ✓ | 1 | 16 | Prominent in scan zone |
| title | ✓ | 1 | 44 | Prominent in scan zone |
| experience | — | 0 | 144 | Not found or text missing |
| skills | ✓ | 0.92 | 138 | Visible in scan zone |
| education | ✓ | 0.92 | 395 | Visible in scan zone |
| contact | — | 0 | — | Not found or text missing |

## Methodology

1. Render each V3 template with a realistic recruiter fixture CV.
2. Load full V2 + V3 CSS in an A4-width Playwright page.
3. Measure DOM anchor positions for name, title, experience, skills, education, contact.
4. Score visibility within the 6–10s scan zone; weight by recruiter priority.
5. Rank templates by composite scan score.

## Verification

```bash
npm run qa:recruiter-scan-test
npm run recruiter-scan-test-report
```
