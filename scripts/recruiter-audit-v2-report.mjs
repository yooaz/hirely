#!/usr/bin/env node
/**
 * Recruiter Audit V2 report — generates RECRUITER_AUDIT_V2.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { computeProductScore } from '../src/core/validation/product-score.js';
import { buildRecruiterCommandCenterAudit, RECRUITER_COMMAND_CENTER_V2 } from '../src/core/validation/recruiter-command-center.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'RECRUITER_AUDIT_V2.md');

const FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
  { id: 'creative-cv', label: 'Creative CV' },
];

async function evaluate(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: entry.id, extractionMethod: 'paste' });
  const score = computeProductScore(imp.cvData || imp.resumeData, {
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  const audit = buildRecruiterCommandCenterAudit({
    scoreReport: score,
    cvData: imp.cvData || imp.resumeData,
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  return { ...entry, audit, scoreTotal: score?.total ?? 0 };
}

function bulletList(items, key = 'label') {
  if (!items?.length) return '- _(none)_';
  return items.map((i) => `- ${i[key] || i}`).join('\n');
}

async function main() {
  const rows = [];
  for (const entry of FIXTURES) {
    rows.push(await evaluate(entry));
  }

  const lines = [];
  lines.push('# Recruiter Audit V2');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Engine: \`${RECRUITER_COMMAND_CENTER_V2}\``);
  lines.push('');
  lines.push('## Vision');
  lines.push('');
  lines.push('Transform the analysis page into a **Recruiter Command Center** — professional audit presentation inspired by McKinsey, Bain, BCG, and LinkedIn Talent Solutions.');
  lines.push('');
  lines.push('### Visual hierarchy');
  lines.push('');
  lines.push('1. **Score at top** — recruiter score ring + confidence badge');
  lines.push('2. **Insights underneath** — executive summary, strengths, weaknesses');
  lines.push('3. **Details collapsible** — ATS, keywords, market, salary, interview risks');
  lines.push('');
  lines.push('## Audit sections');
  lines.push('');
  lines.push('| Section | Source |');
  lines.push('|---------|--------|');
  lines.push('| Executive Summary | Trusted CV review headline + summary |');
  lines.push('| Strengths | `trusted-cv-review-engine` detections |');
  lines.push('| Weaknesses | Trusted review weakness flags |');
  lines.push('| ATS Compatibility | Score breakdown dimensions |');
  lines.push('| Keyword Coverage | Title/archetype keywords vs CV blob |');
  lines.push('| Market Positioning | Archetype + years + score tier |');
  lines.push('| Salary Estimation | Seniority heuristic (indicative range) |');
  lines.push('| Interview Risk Areas | High-impact weakness/missing flags |');
  lines.push('| Recruiter Confidence Score | Score + extraction + completeness composite |');
  lines.push('');
  lines.push('## Corpus results');
  lines.push('');
  lines.push('| Fixture | Score | Confidence | ATS | Keywords | Salary | Risks |');
  lines.push('|---------|-------|------------|-----|----------|--------|-------|');
  for (const row of rows) {
    const a = row.audit;
    lines.push(
      `| ${row.label} | ${row.scoreTotal} | ${a.recruiterConfidence?.score ?? 0} | ${a.atsCompatibility?.score ?? 0} | ${a.keywordCoverage?.pct ?? 0}% | ${a.salaryEstimation?.label ?? '—'} | ${a.interviewRiskAreas?.length ?? 0} |`
    );
  }
  lines.push('');
  lines.push('## Sample audit — Developer CV');
  lines.push('');
  const dev = rows.find((r) => r.id === 'developer-cv')?.audit;
  if (dev) {
    lines.push('### Executive Summary');
    lines.push('');
    lines.push(`**${dev.executiveSummary?.headline}**`);
    lines.push('');
    lines.push(dev.executiveSummary?.summary || '');
    lines.push('');
    lines.push('### Strengths');
    lines.push('');
    lines.push(bulletList(dev.strengths));
    lines.push('');
    lines.push('### Weaknesses');
    lines.push('');
    lines.push(bulletList(dev.weaknesses));
    lines.push('');
    lines.push('### ATS Compatibility');
    lines.push('');
    lines.push(`Score: **${dev.atsCompatibility?.score}** (${dev.atsCompatibility?.tier})`);
    lines.push('');
    lines.push('### Keyword Coverage');
    lines.push('');
    lines.push(`Coverage: **${dev.keywordCoverage?.pct}%** — matched: ${(dev.keywordCoverage?.matched || []).join(', ') || '—'}`);
    lines.push('');
    lines.push('### Market Positioning');
    lines.push('');
    lines.push(dev.marketPositioning?.narrative || '');
    lines.push('');
    lines.push('### Salary Estimation');
    lines.push('');
    lines.push(`${dev.salaryEstimation?.label || '—'} — _${dev.salaryEstimation?.disclaimer || ''}_`);
    lines.push('');
    lines.push('### Interview Risk Areas');
    lines.push('');
    lines.push(bulletList(dev.interviewRiskAreas));
    lines.push('');
    lines.push('### Recruiter Confidence');
    lines.push('');
    lines.push(`**${dev.recruiterConfidence?.score}** (${dev.recruiterConfidence?.tier})`);
  }
  lines.push('');
  lines.push('## Integration');
  lines.push('');
  lines.push('- `src/core/validation/recruiter-command-center.js` — audit builder');
  lines.push('- `src/ui/studio/recruiter-command-center.js` — UI renderer');
  lines.push('- `src/ui/studio/recruiter-command-center.css` — consulting-grade layout');
  lines.push('- `index.html` — `#recruiterCommandCenter` host, wired via `renderRecruiterCommandCenter()`');
  lines.push('');
  lines.push('## Run QA');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:recruiter-command-center');
  lines.push('npm run recruiter:audit-v2-report');
  lines.push('```');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
