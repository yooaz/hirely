# Skills Routing Fix Report (P0)

**Generated:** 2026-06-13T11:54:27.546Z
**Acceptance:** skills accuracy **≥ 90%**
**Suite:** 50 real-world CVs (HIRELY_REAL_WORLD_STRESS_P0)

## Result

| Metric | Before fix | After fix | Goal | Status |
| --- | --- | --- | --- | --- |
| **Skills accuracy** | 65.8% | **97.9%** | ≥ 90% | **PASS** |
| Overall extraction | 86.4% | 91.8% | — | — |
| Per-CV pass rate | 22% | 56% | — | — |

QA gate: FAIL (non-skills dimensions)

## Root cause (pre-fix)

1. **Enterprise parser threshold** — comma-split skill tokens scored ~50% each; only the first dictionary hit (e.g. "Strategy") passed the 70% gate.
2. **Either/or merge** — `parseStructuredCV` used enterprise skills when *any* were approved, discarding `detectSkills(blocks)` output.
3. **Section headers stripped** — pipeline `rawText` dropped `Skills` / `Tools` headers, so `splitBySectionHeaders` could not recover list bodies.
4. **Sanitize overwrite** — `harvestSkillsFromDescriptions` replaced section skills with experience-harvested tokens (e.g. "Leadership" only).
5. **Tools demotion** — comma-separated tool lines failed `isLikelyTool` in section sanity and landed in `unsorted`.

## Fix summary

| Layer | File | Change |
| --- | --- | --- |
| Skills routing module | `src/core/parsing/skills-routing.js` | New pass: header + orphan comma-list routing; tool token split |
| Unsorted recovery | `unsorted-section-recovery.js` | Calls `applySkillsRoutingPass` on raw text |
| Enterprise split boost | `parser-enterprise.js` | Comma lists under skills/tools inherit parent-line confidence |
| Parser merge | `rich-parser.js` | Merge `detectSkills` + enterprise skills; merge tools |
| Section sanity | `section-sanity.js` | Broader comma-list skill/tool detection |
| Polish pass | `resume-output-quality.js` | Route comma lists from unsorted before drain |
| Display sanitize | `sanitize-resume-display.js` | Preserve section-routed skills before harvest |
| Section aliases | `section-fuzzy.js` | Added `stack`; tools headers include technologies/stack |

## Routing rules (implemented)

- Section headers: Skills, Competences, Compétences, Expertise, Tools, Technologies, Stack, Software
- Comma/bullet-separated lists split via `splitListItems`
- Software tokens → `resumeData.tools`
- Professional/competency tokens → `resumeData.skills`
- Routed lines removed from `unsorted` where possible
- No duplicate across skills/tools (tool check runs first)

## Per-CV skills ≥ 90%

| ID | Role | Format | Skills accuracy |
| --- | --- | --- | --- |
| rw-01-designer-txt | designer | TXT | 100% |
| rw-02-designer-pdftext | designer | PDF-text | 100% |
| rw-03-designer-pdfscan | designer | PDF-scan | 100% |
| rw-04-designer-docx | designer | DOCX | 100% |
| rw-06-engineer-txt | engineer | TXT | 100% |
| rw-07-engineer-pdftext | engineer | PDF-text | 100% |
| rw-08-engineer-pdfscan | engineer | PDF-scan | 100% |
| rw-09-engineer-docx | engineer | DOCX | 100% |
| rw-10-engineer-jpg | engineer | JPG | 100% |
| rw-11-marketing-txt | marketing | TXT | 100% |
| rw-12-marketing-pdftext | marketing | PDF-text | 100% |
| rw-13-marketing-pdfscan | marketing | PDF-scan | 100% |
| rw-14-marketing-docx | marketing | DOCX | 100% |
| rw-15-marketing-png | marketing | PNG | 100% |
| rw-16-sales-txt | sales | TXT | 100% |
| rw-17-sales-pdftext | sales | PDF-text | 100% |
| rw-18-sales-pdfscan | sales | PDF-scan | 100% |
| rw-19-sales-docx | sales | DOCX | 100% |
| rw-20-sales-jpg | sales | JPG | 100% |
| rw-21-student-txt | student | TXT | 100% |
| rw-22-student-pdftext | student | PDF-text | 100% |
| rw-23-student-pdfscan | student | PDF-scan | 100% |
| rw-24-student-docx | student | DOCX | 100% |
| rw-25-student-png | student | PNG | 100% |
| rw-26-executive-txt | executive | TXT | 100% |
| rw-27-executive-pdftext | executive | PDF-text | 100% |
| rw-28-executive-pdfscan | executive | PDF-scan | 100% |
| rw-29-executive-docx | executive | DOCX | 100% |
| rw-30-executive-jpg | executive | JPG | 100% |
| rw-31-consultant-txt | consultant | TXT | 100% |
| rw-32-consultant-pdftext | consultant | PDF-text | 100% |
| rw-33-consultant-pdfscan | consultant | PDF-scan | 100% |
| rw-34-consultant-docx | consultant | DOCX | 100% |
| rw-35-consultant-png | consultant | PNG | 100% |
| rw-36-creative-director-txt | creative-director | TXT | 100% |
| rw-37-creative-director-pdftext | creative-director | PDF-text | 100% |
| rw-38-creative-director-pdfscan | creative-director | PDF-scan | 100% |
| rw-39-creative-director-docx | creative-director | DOCX | 100% |
| rw-40-creative-director-png | creative-director | PNG | 100% |
| rw-41-freelancer-txt | freelancer | TXT | 100% |
| rw-42-freelancer-pdftext | freelancer | PDF-text | 100% |
| rw-44-freelancer-docx | freelancer | DOCX | 100% |
| rw-46-artist-txt | artist | TXT | 100% |
| rw-47-artist-pdftext | artist | PDF-text | 100% |
| rw-49-artist-docx | artist | DOCX | 100% |

## Remaining skills failures (< 90%)

| ID | Role | Format | Skills accuracy | Missed (sample) |
| --- | --- | --- | --- | --- |
| rw-05-designer-png | designer | PNG | 75% | Art Director |
| rw-43-freelancer-pdfscan | freelancer | PDF-scan | 80% | Fluent management |
| rw-45-freelancer-jpg | freelancer | JPG | 75% | Art Director |
| rw-48-artist-pdfscan | artist | PDF-scan | 83.3% | art direction |
| rw-50-artist-png | artist | PNG | 83.3% | art direction |

## Verification

```bash
npm run qa:real-world-stress
npm run skills-routing-report
```

## Files touched

- `src/core/parsing/skills-routing.js` (new)
- `src/core/parsing/unsorted-section-recovery.js`
- `src/core/parsing/parser-enterprise.js`
- `src/core/parsing/rich-parser.js`
- `src/core/parsing/section-sanity.js`
- `src/core/parsing/section-fuzzy.js`
- `src/core/parsing/resume-output-quality.js`
- `src/core/validation/sanitize-resume-display.js`
- `scripts/skills-routing-fix-report.mjs` (new)
