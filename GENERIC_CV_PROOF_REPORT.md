# Generic CV Proof Report (P0)

**Verdict:** PASS

**Engine:** `GENERIC_CV_PROOF_V1`

**Generated:** 2026-06-12T18:45:02.576Z

**Score:** 20/20 (100%)

## Mission

Prove Hirely generalizes across 20 non-Yoaz professional profiles:

`developer`, `teacher`, `nurse`, `sales`, `marketing`, `student`, `executive`, `consultant`, `designer`, `engineer`, `restaurant-manager`, `retail`, `finance`, `hr`, `project-manager`, `data-analyst`, `architect`, `photographer`, `lawyer`, `customer-support`

Each corpus CV has a unique name, email, phone, companies, schools, and skills.

Pipeline per profile: **import → parse → preview**

## Pass criteria

- Correct name extracted
- Correct email extracted
- Correct phone or absent / confirm label if unreadable
- No Yoaz demo data leak
- No fake data (no-fake policy audit)
- Preview render non-empty with candidate name

## Results by profile

| Profile | Expected name | Parsed name | Email | Phone | Exp | Preview chars | Result | Failures |
|---------|---------------|-------------|-------|-------|-----|---------------|--------|----------|
| developer | Alex Chen | Alex Chen | alex.chen@email.com | Téléphone à confirmer | 2 | 1686 | PASS | — |
| teacher | Maria Santos | Maria Santos | maria.santos@school.edu | Téléphone à confirmer | 2 | 1928 | PASS | — |
| nurse | Rachel Nguyen | Rachel Nguyen | rachel.nguyen@health.org | Téléphone à confirmer | 1 | 1573 | PASS | — |
| sales | Marcus Webb | Marcus Webb | marcus.webb@salespro.io | Téléphone à confirmer | 3 | 1911 | PASS | — |
| marketing | Laura Bennett | Laura Bennett | laura.bennett@agency.com | Téléphone à confirmer | 3 | 2341 | PASS | — |
| student | Emma Johnson | Emma Johnson | emma.johnson@university.edu | Téléphone à confirmer | 3 | 2079 | PASS | — |
| executive | James Whitfield | James Whitfield | j.whitfield@corp.com | Téléphone à confirmer | 4 | 2034 | PASS | — |
| consultant | Sophie Laurent | Sophie Laurent | sophie.laurent@consult.fr | Téléphone à confirmer | 1 | 1915 | PASS | — |
| designer | Jordan Garcia | Jordan Garcia | jordan.garcia@studio.com | Téléphone à confirmer | 2 | 2057 | PASS | — |
| engineer | David Okonkwo | David Okonkwo | david.okonkwo@engineer.ng | Téléphone à confirmer | 3 | 1720 | PASS | — |
| restaurant-manager | Elena Popov | Elena Popov | elena.popov@hospitality.fr | Téléphone à confirmer | 2 | 2048 | PASS | — |
| retail | Sofia Andersson | Sofia Andersson | sofia.andersson@retail.se | Téléphone à confirmer | 3 | 2125 | PASS | — |
| finance | James Okonkwo | James Okonkwo | james.okonkwo@finance.co.uk | Téléphone à confirmer | 3 | 1832 | PASS | — |
| hr | Priya Sharma | Priya Sharma | priya.sharma@peopleops.in | Téléphone à confirmer | 3 | 2164 | PASS | — |
| project-manager | Daniel Fischer | Daniel Fischer | daniel.fischer@pmworks.de | Téléphone à confirmer | 2 | 1982 | PASS | — |
| data-analyst | Nina Kowalski | Nina Kowalski | nina.kowalski@analytics.pl | Téléphone à confirmer | 1 | 1822 | PASS | — |
| architect | Thomas Berg | Thomas Berg | thomas.berg@studio-arch.dk | Téléphone à confirmer | 1 | 1851 | PASS | — |
| photographer | Camille Dubois | Camille Dubois | camille.dubois@lensstudio.fr | Téléphone à confirmer | 4 | 2374 | PASS | — |
| lawyer | Rebecca Stone | Rebecca Stone | rebecca.stone@legalfirm.com | Téléphone à confirmer | 1 | 1750 | PASS | — |
| customer-support | Omar Hassan | Omar Hassan | omar.hassan@supportdesk.ae | Téléphone à confirmer | 4 | 2418 | PASS | — |

## Corpus location

`tests/cv-corpus/<profile>.txt`

## Run

```bash
npm run qa:generic-cv-proof
npm run generic-cv-proof-report
```

## Bench output

```
CV_TEMPLATE_BOOT_OK
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 1,
  education: 1,
  skills: 5,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS developer — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 2,
  education: 2,
  skills: 0,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 1
}
PASS teacher — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 2,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS nurse — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS sales — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 2,
  skills: 4,
  tools: 0,
  languages: 2,
  clients: 3,
  projects: 1,
  unsorted: 0
}
PASS marketing — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS student — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 5,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS executive — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 2,
  skills: 1,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS consultant — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 5,
  education: 1,
  skills: 4,
  tools: 5,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS designer — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS engineer — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 1,
  skills: 1,
  tools: 0,
  languages: 2,
  clients: 2,
  projects: 0,
  unsorted: 0
}
PASS restaurant-manager — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 1,
  projects: 0,
  unsorted: 0
}
PASS retail — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 5,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS finance — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 5,
  education: 2,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 2
}
PASS hr — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 2,
  tools: 0,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS project-manager — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 1,
  skills: 2,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 2
}
PASS data-analyst — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 0,
  projects: 0,
  unsorted: 1
}
PASS architect — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 5,
  education: 1,
  skills: 1,
  tools: 1,
  languages: 2,
  clients: 0,
  projects: 0,
  unsorted: 0
}
PASS photographer — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 3,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 1,
  clients: 2,
  projects: 0,
  unsorted: 0
}
PASS lawyer — ok
NODE_RESUMEDATA_COUNTS {
  path: 'buildResumeData:importResult',
  experiences: 4,
  education: 1,
  skills: 0,
  tools: 0,
  languages: 2,
  clients: 1,
  projects: 0,
  unsorted: 0
}
PASS customer-support — ok

═══ Generic CV Proof: 20/20 (100%) PASS ═══
(node:46710) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/src/core/pipeline/hirely-import.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/yohannazancot/YOAZ_STUDIO_OS/hirely_FINAL_CURSOR_STABLE_UI/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```
