#!/usr/bin/env node
/**
 * Recruiter Audit System report — generates RECRUITER_AUDIT_SYSTEM.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runRecruiterExtractionPipeline } from '../src/core/extraction/recruiter-extraction-pipeline.js';
import {
  runRecruiterAuditEngine,
  RECRUITER_AUDIT_ENGINE,
  AUDIT_DIMENSIONS,
  formatRecruiterReviewText,
} from '../src/core/validation/recruiter-audit-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'RECRUITER_AUDIT_SYSTEM.md');

const FIXTURES = [
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'student-cv', label: 'Student CV' },
  { id: 'recruiter-cv', label: 'Recruiter CV' },
];

function dimTable(audit) {
  const rows = (audit.dimensions || [])
    .map((d) => `| ${d.label} | ${d.score} | ${d.weightPct}% |`)
    .join('\n');
  return `| Dimension | Score | Weight |\n|-----------|------:|-------:|\n${rows}`;
}

async function evaluate(entry) {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt'), 'utf8');
  const extracted = runRecruiterExtractionPipeline(raw, {
    source: entry.id,
    extractionMethod: 'paste',
  });
  const audit = runRecruiterAuditEngine({
    cvData: extracted.cvData,
    cvDataV2: extracted.cvDataV2,
    resumeData: extracted.resumeData,
    finalResumeData: extracted.resumeData,
  });
  return { ...entry, audit, extracted };
}

async function main() {
  const rows = [];
  for (const entry of FIXTURES) {
    rows.push(await evaluate(entry));
  }

  const pass = rows.every((r) => r.audit.ready && r.audit.overall > 0);
  const avgOverall = Math.round(rows.reduce((s, r) => s + r.audit.overall, 0) / rows.length);

  const lines = [];
  lines.push('# Recruiter Audit System');
  lines.push('');
  lines.push(`**Status:** ${pass ? 'PASS' : 'FAIL'}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Engine:** \`${RECRUITER_AUDIT_ENGINE}\``);
  lines.push(`**Corpus average overall:** ${avgOverall}/100`);
  lines.push('');
  lines.push('## Purpose');
  lines.push('');
  lines.push('After extraction, the recruiter audit engine evaluates every CV across six dimensions and produces a recruiter-style review with strengths, weaknesses, and actionable recommendations.');
  lines.push('');
  lines.push('## Pipeline');
  lines.push('');
  lines.push('```');
  lines.push('Import / paste → runRecruiterExtractionPipeline() → cvData v2');
  lines.push('                              ↓');
  lines.push('                   runRecruiterAuditEngine()');
  lines.push('                              ↓');
  lines.push('     ATS · Clarity · Experience · Structure · Keyword · Trust');
  lines.push('                              ↓');
  lines.push('              Overall /100 + recruiter review narrative');
  lines.push('```');
  lines.push('');
  lines.push('## Dimensions');
  lines.push('');
  lines.push('| ID | Label | Weight |');
  lines.push('|----|-------|-------:|');
  for (const d of Object.values(AUDIT_DIMENSIONS)) {
    lines.push(`| ${d.id} | ${d.label} | ${d.weight}% |`);
  }
  lines.push('');
  lines.push('## Integration points');
  lines.push('');
  lines.push('| Location | Function |');
  lines.push('|----------|----------|');
  lines.push('| `src/core/validation/recruiter-audit-engine.js` | `runRecruiterAuditEngine()` |');
  lines.push('| `src/core/validation/recruiter-audit.js` | `runRecruiterAudit()` wraps engine + legacy fixes |');
  lines.push('| `src/core/import/import-fallback-chain.js` | `attachRecruiterAuditToImportResult()` post-import |');
  lines.push('');
  lines.push('## Corpus results');
  lines.push('');
  lines.push('| Fixture | Overall | ATS | Clarity | Experience | Structure | Keyword | Trust | Band |');
  lines.push('|---------|--------:|----:|--------:|-----------:|----------:|--------:|------:|------|');
  for (const r of rows) {
    const s = r.audit.scores || {};
    lines.push(
      `| ${r.label} | ${r.audit.overall} | ${s.ats ?? '—'} | ${s.clarity ?? '—'} | ${s.experience ?? '—'} | ${s.structure ?? '—'} | ${s.keyword ?? '—'} | ${s.trust ?? '—'} | ${r.audit.band?.tier ?? '—'} |`
    );
  }
  lines.push('');
  lines.push('## Sample recruiter reviews');
  lines.push('');

  for (const r of rows.slice(0, 3)) {
    lines.push(`### ${r.label}`);
    lines.push('');
    lines.push(formatRecruiterReviewText({
      ...r.audit,
      name: r.extracted.cvData?.name,
      title: r.extracted.cvData?.title,
    }));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:recruiter-audit-engine');
  lines.push('npm run recruiter-audit-system-report');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`Status: ${pass ? 'PASS' : 'FAIL'} (${rows.length} fixtures, avg ${avgOverall}/100)`);
  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
