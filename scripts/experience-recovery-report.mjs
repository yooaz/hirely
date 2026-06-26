#!/usr/bin/env node
/**
 * EXPERIENCE RECOVERY REPORT — trace source line → block → structuredResume → resumeData → cvData.
 * node scripts/experience-recovery-report.mjs
 * Output: EXPERIENCE_RECOVERY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
} from '../src/core/parsing/classification-fixes.js';
import {
  parseStrictExperiencesFromLines,
  scoreStrictExperienceEntry,
  qualifiesStrictExperience,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from '../src/core/parsing/experience-parser.js';
import { recoverSafeParsedExperiences } from '../src/core/parsing/experience-recovery.js';
import {
  CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
  CREATIVE_ANCHOR_CLIENTS,
  runCreativeExperienceRecovery,
  auditCreativeExperienceRecovery,
} from '../src/core/parsing/creative-experience-recovery-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const FIXTURE_PATH = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
const CREATIVE_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-experience-rich.txt');
const OUT_PATH = path.join(ROOT, 'EXPERIENCE_RECOVERY_REPORT.md');
const QA_CREATIVE_JSON = path.join(ROOT, 'tests/output/creative-experience-recovery/report.json');

const ROLE_MARKERS = [
  { id: 'freelancer', re: /\bfreelanc/i, label: 'Freelancer' },
  { id: 'graphic_designer', re: /\bgraphic\s+designer\b/i, label: 'Graphic Designer' },
  { id: 'illustrator', re: /\billustrator\b/i, label: 'Illustrator' },
  { id: 'art_director', re: /\bart\s+director\b/i, label: 'Art Director' },
  { id: 'motion_designer', re: /\bmotion\s+designer\b/i, label: 'Motion Designer' },
  { id: 'internship', re: /\b(internship|intern)\b/i, label: 'Internship' },
  { id: 'mccann', re: /\bmccann\b/i, label: 'McCann' },
];

function mdEsc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function normKey(exp) {
  return [
    String(exp?.role || '').toLowerCase().trim(),
    String(exp?.company || '').toLowerCase().trim(),
    String(exp?.startDate || exp?.dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function expMatchesKey(exp, key) {
  if (!key || key === '||') return false;
  return normKey(exp) === key;
}

function findInList(exps, key) {
  return (exps || []).find((e) => expMatchesKey(e, key)) || null;
}

function findBlockForLine(blocks, line) {
  const needle = String(line || '').trim().toLowerCase().slice(0, 40);
  if (!needle) return null;
  for (const block of blocks || []) {
    const texts = [];
    if (block.lines?.length) {
      for (const l of block.lines) texts.push(String(l.cleanedText ?? l.text ?? '').trim());
    } else if (block.text) {
      texts.push(...String(block.text).split('\n').map((t) => t.trim()));
    }
    if (texts.some((t) => t.toLowerCase().includes(needle) || needle.includes(t.toLowerCase().slice(0, 24)))) {
      return {
        id: block.id || block.blockId || '—',
        type: block.type || block.section || block.label || '—',
        text: texts.join(' · ').slice(0, 120),
      };
    }
  }
  return null;
}

function parseCandidate(line, allLines) {
  const freelance = parseFreelanceCareerLine(line);
  const internship = parseInternshipLine(line, { nearbyLines: allLines });
  const hits = [];
  if (freelance) {
    hits.push({
      parser: 'parseFreelanceCareerLine',
      entry: freelance,
      confidence: scoreStrictExperienceEntry(freelance, line),
      safe: qualifiesStrictExperience(freelance, line) && scoreStrictExperienceEntry(freelance, line) >= EXPERIENCE_PARSER_CONFIDENCE_MIN,
    });
  }
  if (internship) {
    hits.push({
      parser: 'parseInternshipLine',
      entry: internship,
      confidence: internship.confidence ?? scoreStrictExperienceEntry(internship, line),
      safe: qualifiesStrictExperience(internship, line) && (internship.confidence ?? scoreStrictExperienceEntry(internship, line)) >= EXPERIENCE_PARSER_CONFIDENCE_MIN,
    });
  }
  if (!hits.length) return null;
  return hits.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
}

function lossReason(trace) {
  const reasons = [];
  if (!trace.parsed) reasons.push('not_parsed_as_experience');
  else if (!trace.parsed.safe) reasons.push(`below_safe_threshold_${EXPERIENCE_PARSER_CONFIDENCE_MIN}`);
  if (trace.parsed?.safe && !trace.inBlock) reasons.push('no_matching_document_block');
  if (trace.parsed?.safe && !trace.inStructured) {
    if (trace.blockGate) reasons.push(trace.blockGate);
    else reasons.push('dropped_before_structuredResume');
  }
  if (trace.inStructured && !trace.inResumeData) reasons.push('dropped_structured_to_resumeData');
  if (trace.inResumeData && !trace.inCvData) reasons.push('dropped_resumeData_to_cvData');
  if (!reasons.length && trace.inCvData) return 'retained_end_to_end';
  return reasons.join('; ') || 'unknown';
}

function collectCandidates(ocrLines) {
  const rows = [];
  const seen = new Set();

  for (const line of ocrLines) {
    const markers = ROLE_MARKERS.filter((m) => m.re.test(line));
    const hasDate = /\b(19|20)\d{2}\b/.test(line);
    if (!markers.length && !hasDate) continue;
    if (seen.has(line)) continue;
    seen.add(line);

    const parsed = parseCandidate(line, ocrLines);
    rows.push({
      sourceLine: line,
      markers: markers.map((m) => m.label),
      parsed,
      key: parsed?.entry ? normKey(parsed.entry) : `line:${line.slice(0, 32).toLowerCase()}`,
    });
  }

  const strict = parseStrictExperiencesFromLines(ocrLines, { experienceSectionLines: ocrLines });
  for (const exp of strict.experiences) {
    const src =
      ocrLines.find((l) => {
        const p = parseCandidate(l, ocrLines);
        return p?.entry && normKey(p.entry) === normKey(exp);
      }) || '—';
    const key = normKey(exp);
    if (rows.some((r) => r.key === key)) continue;
    rows.push({
      sourceLine: src === '—' ? `${exp.role} @ ${exp.company}` : src,
      markers: ['strict_parser'],
      parsed: {
        parser: 'parseStrictExperiencesFromLines',
        entry: exp,
        confidence: scoreStrictExperienceEntry(exp, src === '—' ? '' : src),
        safe: true,
      },
      key,
    });
  }

  return rows;
}

async function auditSource(label, ocrText) {
  const enterprise = extractPlainTextEnterprise(ocrText, label === 'Yoaz OCR' ? 'ocr' : 'text');
  const pipe = await runProductionExtractionPipeline(ocrText, {
    rawText: ocrText,
    extractionMethod: label === 'Yoaz OCR' ? 'ocr' : 'text',
    enterpriseExtraction: enterprise,
    canonicalImport: true,
  });

  const imp = productionToHirelyImportResult(pipe, { name: label === 'Yoaz OCR' ? 'yoaz.pdf' : 'fixture.txt' });

  const resumeData = buildResumeData({
    importResult: imp,
    structured: pipe.structuredResume,
    rawText: ocrText,
    cleanedText: pipe.cleanedText || ocrText,
    file: { name: label === 'Yoaz OCR' ? 'yoaz.pdf' : 'fixture.txt' },
    extractionMethod: label === 'Yoaz OCR' ? 'ocr' : 'text',
    warnings: imp.warnings || [],
    errors: imp.errors || [],
  });

  const cvData = resumeDataToCvData(resumeData);
  const ocrLines = ocrText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 1);
  const blocks = pipe.structuredResume?.documentBlocks || [];
  const structuredExps = pipe.structuredResume?.experiences || [];
  const resumeExps = resumeData.experiences || [];
  const cvExps = cvData.experience || [];

  const candidates = collectCandidates(ocrLines);
  const traces = candidates.map((c) => {
    const key = c.parsed?.entry ? normKey(c.parsed.entry) : null;
    const block = findBlockForLine(blocks, c.sourceLine);
    const inStructured = key ? !!findInList(structuredExps, key) : false;
    const inResumeData = key ? !!findInList(resumeExps, key) : false;
    const inCvData =
      key &&
      (cvExps.some((line) => {
        const e = c.parsed?.entry;
        if (!e) return false;
        const role = String(e.role || '').toLowerCase();
        const company = String(e.company || '').toLowerCase();
        const blob = String(line).toLowerCase();
        return (role && blob.includes(role.slice(0, 12))) || (company && blob.includes(company.slice(0, 8)));
      }) ||
        !!findInList(
          resumeExps.map((e) => ({
            role: e.role,
            company: e.company,
            startDate: e.startDate,
            dates: e.dates,
          })),
          key
        ));

    let blockGate = '';
    if (c.parsed?.safe && !inStructured && structuredExps.length > 0) {
      blockGate = 'strict_parser_skipped_when_experiences_nonempty';
    }
    if (c.parsed?.safe && !inStructured && /\bmccann\b/i.test(c.sourceLine)) {
      blockGate = 'internship_not_merged_before_structured_finalize';
    }
    if (inStructured && !inResumeData && /\bmccann\b/i.test(c.sourceLine)) {
      blockGate = 'polish_demoted_mccann_to_clients';
    }

    return {
      ...c,
      block,
      inBlock: !!block,
      inStructured,
      inResumeData,
      inCvData: !!inCvData,
      blockGate,
      loss: lossReason({
        parsed: c.parsed,
        inBlock: !!block,
        inStructured,
        inResumeData,
        inCvData: !!inCvData,
        blockGate,
      }),
    };
  });

  const safeRecovery = recoverSafeParsedExperiences(
    {
      experiences: [...resumeExps],
      unsorted: [...(resumeData.unsorted || [])],
      clients: [...(resumeData.clients || [])],
    },
    { lines: ocrLines, nearbyLines: ocrLines }
  );

  return {
    label,
    ocrLines: ocrLines.length,
    blocks: blocks.length,
    structuredCount: structuredExps.length,
    resumeCount: resumeExps.length,
    cvCount: cvExps.length,
    structuredExps,
    resumeExps,
    cvExps,
    traces,
    safeRecovery,
  };
}

function renderSection(audit) {
  const lines = [];
  lines.push(`## ${audit.label}`);
  lines.push('');
  lines.push('| Stage | Count |');
  lines.push('|-------|------:|');
  lines.push(`| OCR lines | ${audit.ocrLines} |`);
  lines.push(`| Document blocks | ${audit.blocks} |`);
  lines.push(`| structuredResume.experiences | ${audit.structuredCount} |`);
  lines.push(`| resumeData.experiences | ${audit.resumeCount} |`);
  lines.push(`| cvData.experience | ${audit.cvCount} |`);
  lines.push(`| Safe recovery candidates (dry-run) | ${audit.safeRecovery.count} |`);
  lines.push('');

  lines.push('### Experience trace');
  lines.push('');
  lines.push(
    '| # | Markers | Source line | Block | structured | resumeData | cvData | Loss point |'
  );
  lines.push('|--:|---------|-------------|:-----:|:----------:|:----------:|:------:|------------|');

  audit.traces.forEach((t, i) => {
    const src = t.sourceLine.length > 56 ? `${t.sourceLine.slice(0, 56)}…` : t.sourceLine;
    const block = t.block ? `${t.block.type}` : '—';
    lines.push(
      `| ${i + 1} | ${mdEsc(t.markers.join(', '))} | ${mdEsc(src)} | ${mdEsc(block)} | ${t.inStructured ? '✓' : '✗'} | ${t.inResumeData ? '✓' : '✗'} | ${t.inCvData ? '✓' : '✗'} | ${mdEsc(t.loss)} |`
    );
  });
  lines.push('');

  lines.push('### Trace detail');
  lines.push('');
  audit.traces.forEach((t, i) => {
    lines.push(`#### ${i + 1}. ${t.markers.join(' · ') || 'candidate'}`);
    lines.push('');
    lines.push('**Source line**');
    lines.push('```');
    lines.push(t.sourceLine);
    lines.push('```');
    lines.push('');
    if (t.block) {
      lines.push(`**Block:** \`${t.block.type}\` (${t.block.id}) — ${t.block.text}`);
      lines.push('');
    }
    if (t.parsed?.entry) {
      lines.push('| Parsed | Value |');
      lines.push('|--------|-------|');
      lines.push(`| Parser | ${t.parsed.parser} |`);
      lines.push(`| Role | ${t.parsed.entry.role || '—'} |`);
      lines.push(`| Company | ${t.parsed.entry.company || '—'} |`);
      lines.push(`| Dates | ${t.parsed.entry.dates || '—'} |`);
      lines.push(`| Confidence | ${t.parsed.confidence} |`);
      lines.push(`| Safe recover | ${t.parsed.safe ? 'yes' : 'no'} |`);
      lines.push('');
    }
    lines.push('**Pipeline presence**');
    lines.push('');
    lines.push(`| structuredResume | ${t.inStructured ? 'present' : '**LOST**'} |`);
    lines.push(`| resumeData | ${t.inResumeData ? 'present' : '**LOST**'} |`);
    lines.push(`| cvData | ${t.inCvData ? 'present' : '**LOST**'} |`);
    lines.push('');
    lines.push(`**Loss reason:** ${t.loss}`);
    lines.push('');
  });

  if (audit.safeRecovery.items.length) {
    lines.push('### Safe recovery (applied in pipeline)');
    lines.push('');
    for (const item of audit.safeRecovery.items) {
      lines.push(`- **${item.role}** @ ${item.company} (${item.dates}) — conf ${item.confidence} — \`${item.parser}\``);
    }
    lines.push('');
  }

  lines.push('### Final experiences in resumeData');
  lines.push('');
  if (!audit.resumeExps.length) {
    lines.push('_None._');
  } else {
    audit.resumeExps.forEach((e, i) => {
      lines.push(`${i + 1}. **${e.role || '—'}** @ ${e.company || '—'} (${e.dates || '—'})`);
      if (e.sourceLines?.[0]) lines.push(`   - source: \`${e.sourceLines[0].slice(0, 100)}\``);
      if (e.recoverySource) lines.push(`   - recovery: \`${e.recoverySource}\``);
    });
  }
  lines.push('');

  return lines;
}

function runCreativeQa() {
  const res = spawnSync('node', ['src/tests/qa-creative-experience-recovery.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return { pass: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

async function main() {
  console.log('Running creative experience recovery QA…');
  const creativeQa = runCreativeQa();
  console.log(creativeQa.pass ? '  PASS qa-creative-experience-recovery' : '  FAIL qa-creative-experience-recovery');

  let ocrText = '';
  if (fs.existsSync(TRACE_PATH)) {
    const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
    ocrText = trace.checkpoints?.OCR_OUTPUT?.object?.text || '';
  }
  if (!ocrText && fs.existsSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'))) {
    const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8'));
    ocrText = rep.ocrText || '';
  }

  const fixtureText = fs.existsSync(FIXTURE_PATH)
    ? fs.readFileSync(FIXTURE_PATH, 'utf8')
    : '';
  const creativeText = fs.existsSync(CREATIVE_FIXTURE)
    ? fs.readFileSync(CREATIVE_FIXTURE, 'utf8')
    : '';

  const audits = [];
  if (ocrText) audits.push(await auditSource('Yoaz OCR', ocrText));
  if (fixtureText) audits.push(await auditSource('Yoaz fixture (clean)', fixtureText));

  const md = [];
  md.push('# EXPERIENCE RECOVERY REPORT');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('');
  md.push('## Goal');
  md.push('');
  md.push('Creative CVs were losing **70%+ of experience** when client brands and stacked roles collapsed into a single freelance line.');
  md.push('');
  md.push('Target engagements: **Freelance**, **Agency**, **Illustration**, **Design**, **Creative Director**, **Art Director**.');
  md.push('');
  md.push('Anchor clients: **Nike**, **Adobe**, **PlayStation**, **Marvel**, **Converse**, **Cadillac**, **Fortune**, **Visa**, **Arte**.');
  md.push('');
  md.push('Each entry keeps separate fields: `company` · `client` · `project` · `role` · `date` — **never collapsed**.');
  md.push('');
  md.push('## CREATIVE_EXPERIENCE_RECOVERY_ENGINE');
  md.push('');
  md.push(`Engine: \`${CREATIVE_EXPERIENCE_RECOVERY_ENGINE}\` · wired in \`section-engine-v2.js\` when creative mode is active.`);
  md.push('');
  md.push('- Segments merged OCR/freelance blobs via `EXPERIENCE_SEGMENTATION_ENGINE`');
  md.push('- Expands multi-brand freelance bullets into distinct client engagements');
  md.push('- Enriches `engagementType`: freelance | agency | illustration | design | creative_director | art_director');
  md.push('');

  if (creativeText) {
    const creativeAudit = auditCreativeExperienceRecovery(creativeText);
    const pipe = await runProductionExtractionPipeline(creativeText, { trusted: true, canonicalImport: true });
    const imp = productionToHirelyImportResult(pipe);
    const creativeRecovery = runCreativeExperienceRecovery(
      { ...imp.resumeData, experiences: imp.resumeData?.experiences || [] },
      creativeText,
      { forceCreative: true }
    );
    md.push('### Creative fixture audit');
    md.push('');
    md.push(`| Metric | Value |`);
    md.push(`|--------|------:|`);
    md.push(`| Source career lines | ${creativeAudit.sourceLineCount} |`);
    md.push(`| Recovered experiences | ${creativeAudit.experienceCount} |`);
    md.push(`| Anchor recall | ${creativeAudit.recallPct}% |`);
    md.push(`| Pipeline experiences | ${creativeRecovery.experiences.length} |`);
    md.push(`| Expanded client engagements | ${creativeRecovery.stats?.expanded || 0} |`);
    md.push('');
    md.push('**Anchor brands found:** ' + (creativeAudit.anchorFound.join(', ') || '—'));
    md.push('');
    md.push('| Role | Company | Client | Project | Dates | Type |');
    md.push('|------|---------|--------|---------|-------|------|');
    for (const row of creativeAudit.rows.slice(0, 24)) {
      md.push(
        `| ${mdEsc(row.role)} | ${mdEsc(row.company)} | ${mdEsc(row.client)} | ${mdEsc(row.project)} | ${mdEsc(row.startDate)}–${mdEsc(row.endDate)} | ${row.engagementType} |`
      );
    }
    md.push('');
  }

  let creativeQaData = null;
  if (fs.existsSync(QA_CREATIVE_JSON)) {
    try {
      creativeQaData = JSON.parse(fs.readFileSync(QA_CREATIVE_JSON, 'utf8'));
    } catch {
      creativeQaData = null;
    }
  }
  md.push('### Creative QA');
  md.push('');
  md.push(creativeQa.pass && creativeQaData?.pass ? '**PASS**' : '**FAIL**');
  if (creativeQaData?.pipelineCount != null) {
    md.push(` · Pipeline experiences: ${creativeQaData.pipelineCount} · Segmented: ${creativeQaData.segmentedCount}`);
  }
  md.push('');

  md.push('## Recovery policy (legacy safe parsers)');
  md.push('');
  md.push(`- **Safe recover only:** strict parsers with confidence ≥ ${EXPERIENCE_PARSER_CONFIDENCE_MIN}`);
  md.push('- Sources: `parseFreelanceCareerLine`, `parseInternshipLine`, merged `parseStrictExperiencesFromLines`');
  md.push('- Fixes: merge strict experiences even when freelance exists; recover before polish client-drain; `recoverSafeParsedExperiences` in structured + polish + auto-accept');
  md.push('');

  md.push('## Summary');
  md.push('');
  md.push('| Source | structured | resumeData | cvData | Lost at stage |');
  md.push('|--------|----------:|-----------:|-------:|---------------|');
  for (const a of audits) {
    const lost = a.traces.filter((t) => !t.inCvData && t.parsed?.safe).length;
    md.push(
      `| ${a.label} | ${a.structuredCount} | ${a.resumeCount} | ${a.cvCount} | ${lost} safe candidates not in cvData |`
    );
  }
  md.push('');

  for (const audit of audits) {
    md.push(...renderSection(audit));
  }

  md.push('## Known OCR limits (Yoaz PDF)');
  md.push('');
  md.push('- OCR text collapses multiple jobs into one freelance line (`2011-2022 : Freelancer Illustrator, Graphic designer`).');
  md.push('- McCann internship line (`20N : McCann G. Agency (Internship)`) is recoverable via `parseInternshipLine` (date repaired → 2010).');
  md.push('- Art Director / Motion Designer rows exist only in clean fixture — not in OCR output.');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('EXPERIENCE_RECOVERY_REPORT.md written:', OUT_PATH);
  for (const a of audits) {
    console.log(a.label, {
      structured: a.structuredCount,
      resume: a.resumeCount,
      cv: a.cvCount,
    });
  }
  process.exit(creativeQa.pass ? 0 : 1);
}

main().catch((err) => {
  console.error('experience recovery report failed:', err);
  process.exit(1);
});
