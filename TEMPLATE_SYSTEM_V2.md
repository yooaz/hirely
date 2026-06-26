# TEMPLATE_SYSTEM_V2

Generated: 2026-06-13T09:18:56.125Z

## P2 status

| Item | Value |
|------|-------|
| Version | `TEMPLATE_SYSTEM_V2` |
| Families | **10** distinct template architectures |
| Module | `src/ui/templates/template-families-v2.mjs` |
| Render engine | `src/ui/templates/cv-templates.js` (V2 layout stacks + `wrapV2`) |
| CSS | `cv-templates-v2-families.css` |
| QA | **PASS** |

## Design principle

> Templates must differ in **grid**, **hierarchy**, **typography**, **spacing**, and **information emphasis** — not merely fonts.

V2 families use `wrapV2()` to skip the shared `cvLayout-professional` baseline. Each family has a bespoke HTML stack and scoped CSS under `.cv.template-{id}`.

## Pipeline

```
finalResumeData → normalizeCvData → HirelyTemplates.render()
  → layoutFamilyV2(p) → wrapV2 → #cvDoc.template-{id}
```

## Family catalog

| # | Family | ID | Layout family |
|---|--------|-----|---------------|
| 1 | ATS Recruiter | `ats-recruiter` | dense-single |
| 2 | McKinsey Consulting | `mckinsey-consulting` | consulting-split |
| 3 | Apple Minimal | `apple-minimal` | timeline-minimal |
| 4 | Kinfolk Editorial | `kinfolk-editorial` | magazine-spread |
| 5 | Creative Director Portfolio | `creative-director-portfolio` | portfolio-hero |
| 6 | Luxury Executive | `luxury-executive` | executive-centered |
| 7 | Startup Founder | `startup-founder` | founder-split |
| 8 | Tech Engineer | `tech-engineer` | tech-rail |
| 9 | Art Director | `art-director` | campaign-masthead |
| 10 | Freelance Creative | `freelance-creative` | mosaic-freelance |

## Visual architecture (per family)

### ATS Recruiter (`ats-recruiter`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Single column · 72ch measure · contact utility band |
| **Hierarchy** | Experience → Education → Skills (recruiter scan order) |
| **Typography** | Inter 700 name · 8pt tracked labels · 10pt body |
| **Spacing** | Tight 10px rhythm · 4px section rules |
| **Emphasis** | Parse density · role-date-company rows · zero decoration |
| **Layout family** | `dense-single` |
| **Section order** | experience → education → skills → tools → languages → summary |

```
┌─ Identity / masthead
├─ experience (primary)
├─ education
└─ skills · tools
```

### McKinsey Consulting (`mckinsey-consulting`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | 4/8 asymmetric split · impact matrix footer band |
| **Hierarchy** | Executive summary → Case studies → Impact metrics → Credentials |
| **Typography** | Libre Baskerville display · IBM Plex Sans body · metric mono |
| **Spacing** | Generous 24px section gaps · 16px matrix cells |
| **Emphasis** | Quantified outcomes · engagement framing · board credibility |
| **Layout family** | `consulting-split` |
| **Section order** | summary → experience → education → skills → languages |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ education · skills
```

### Apple Minimal (`apple-minimal`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Single column · 56px side margins · vertical timeline spine |
| **Hierarchy** | Identity monument → Career spine → Skills whisper |
| **Typography** | SF-style Inter 300/600 · 34pt name · hairline 9pt labels |
| **Spacing** | Extreme whitespace · 48px between sections |
| **Emphasis** | Clarity · one idea per band · keynote restraint |
| **Layout family** | `timeline-minimal` |
| **Section order** | experience → education → skills → tools → languages |

```
┌─ Identity / masthead
├─ experience (primary)
├─ education
└─ skills · tools
```

### Kinfolk Editorial (`kinfolk-editorial`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | 3-column magazine spread · feature column center |
| **Hierarchy** | Cover identity → Feature narrative → Side credentials |
| **Typography** | Cormorant Garamond 54pt · Source Serif 4 body · DM Sans meta |
| **Spacing** | Editorial 32px gutters · pull-quote margins |
| **Emphasis** | Culture narrative · selected work · literary pacing |
| **Layout family** | `magazine-spread` |
| **Section order** | summary → experience → clients → projects → education → skills |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ clients · projects
```

### Creative Director Portfolio (`creative-director-portfolio`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Hero band · 3-col client grid · 2-col project cases |
| **Hierarchy** | Identity hero → Selected clients → Case studies → Career |
| **Typography** | Instrument Serif 42pt · DM Sans UI · uppercase 7pt labels |
| **Spacing** | Portfolio 40px hero · 20px grid gaps |
| **Emphasis** | Brand proof · client logos grid · case-study rhythm |
| **Layout family** | `portfolio-hero` |
| **Section order** | clients → projects → experience → skills → education |

```
┌─ Identity / masthead
├─ clients (primary)
├─ projects
└─ experience · skills
```

### Luxury Executive (`luxury-executive`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Centered masthead · full-width achievements ribbon · single narrative |
| **Hierarchy** | Leadership identity → Executive summary → Board experience |
| **Typography** | Source Serif 4 28pt · small-caps section labels |
| **Spacing** | Luxury 36px vertical · wide 44px side padding |
| **Emphasis** | C-suite presence · achievement ribbon · serif gravitas |
| **Layout family** | `executive-centered` |
| **Section order** | summary → experience → education → skills → languages |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ education · skills
```

### Startup Founder (`startup-founder`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Venture hero · traction metrics strip · 22/78 operator split |
| **Hierarchy** | Founder thesis → Traction → Roles & impact → Fundraising proof |
| **Typography** | Inter 800 name · green metric numerals · 9pt mono labels |
| **Spacing** | Operator 18px dense body · 28px hero |
| **Emphasis** | ARR · growth · team scale · venture narrative |
| **Layout family** | `founder-split` |
| **Section order** | summary → experience → clients → projects → education → skills |

```
┌─ Identity / masthead
├─ summary (primary)
├─ experience
└─ clients · projects
```

### Tech Engineer (`tech-engineer`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | 28/72 dark skills rail · mono identity header |
| **Hierarchy** | Stack rail → Systems experience → Ship log projects |
| **Typography** | JetBrains Mono title · Inter body · blue accent rules |
| **Spacing** | Engineering 14px tight · rail 12px compact |
| **Emphasis** | Languages · frameworks · systems shipped |
| **Layout family** | `tech-rail` |
| **Section order** | skills → tools → experience → projects → education |

```
┌─ Identity / masthead
├─ skills (primary)
├─ tools
└─ experience · projects
```

### Art Director (`art-director`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Full-bleed campaign masthead · 2-col press/awards · project reel |
| **Hierarchy** | Campaign identity → Awards & press → Selected campaigns → Career |
| **Typography** | Playfair Display 38pt · DM Sans credits · gold accent |
| **Spacing** | Campaign 32px masthead · 24px reel gaps |
| **Emphasis** | Luxury campaigns · platform links · press quotes |
| **Layout family** | `campaign-masthead` |
| **Section order** | clients → projects → experience → education → skills |

```
┌─ Identity / masthead
├─ clients (primary)
├─ projects
└─ experience · education
```

### Freelance Creative (`freelance-creative`)

| Dimension | Architecture |
|-----------|--------------|
| **Grid** | Availability band · irregular mosaic project tiles · compact contact |
| **Hierarchy** | Open for work → Project mosaic → Tools → Brief career |
| **Typography** | DM Sans 600 · handwritten-style Instrument Serif accent |
| **Spacing** | Irregular 8/16/24px mosaic · friendly 20px bands |
| **Emphasis** | Deliverables · project tiles · freelance availability |
| **Layout family** | `mosaic-freelance` |
| **Section order** | projects → clients → skills → tools → experience → education |

```
┌─ Identity / masthead
├─ projects (primary)
├─ clients
└─ skills · tools
```


## Legacy alias map

| V1 id | V2 canonical |
|-------|--------------|
| `ats-elite` | `ats-recruiter` |
| `agency-designer` / `swiss-editorial` | `mckinsey-consulting` |
| `visual-timeline` | `apple-minimal` |
| `editorial-magazine` | `kinfolk-editorial` |
| `creative-director` | `creative-director-portfolio` |
| `executive-luxury` / `ats-executive` | `luxury-executive` |
| `startup-builder` | `startup-founder` |
| `tech-structured` | `tech-engineer` |
| `art-director-portfolio` | `art-director` |
| `freelance` | `freelance-creative` |

## Verification

```bash
npm run qa:template-system-v2-families
npm run template-system-v2-report
```
