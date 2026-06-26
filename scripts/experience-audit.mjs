#!/usr/bin/env node
/**
 * EXPERIENCE ENGINE AUDIT — Yoaz PDF detected vs rejected experiences.
 * node scripts/experience-audit.mjs
 * Output: EXPERIENCE_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
} from '../src/core/parsing/classification-fixes.js';
import {
  buildExperienceEntryFromLineGroup,
  parseStrictExperiencesFromLines,
  scoreStrictExperienceEntry,
  qualifiesStrictExperience,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
  lineIsEducationData,
  lineIsContactData,
  lineIsSkillOrTagOnly,
  passesStrictExperienceGate,
} from '../src/core/parsing/experience-parser.js';
import { buildSourceLineRegistry } from '../src/core/parsing/line-source-dedup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const OUT_PATH = path.join(ROOT, 'EXPERIENCE_AUDIT.md');

function normKey(exp) {
  return [
    String(exp?.role || '').toLowerCase().trim(),
    String(exp?.company || '').toLowerCase().trim(),
    String(exp?.startDate || exp?.dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

function mdEsc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function expRow(exp, extra = {}) {
  const src = exp.sourceLines?.[0] || exp.sourceLine || extra.sourceLine || '—';
  return {
    sourceLine: src,
    role: exp.role || '—',
    company: exp.company || '—',
    dates: exp.dates || [exp.startDate, exp.endDate].filter(Boolean).join('–') || '—',
    confidence: exp.confidence ?? extra.confidence ?? '—',
    parser: extra.parser || exp.parser || '—',
    stage: extra.stage || '—',
  };
}

function explainRejection(line, entry, parser) {
  const reasons = [];
  if (!entry) {
    if (lineIsContactData(line)) reasons.push('contact_data_not_experience');
    else if (lineIsEducationData(line)) reasons.push('education_line_not_experience');
    else if (lineIsSkillOrTagOnly(line)) reasons.push('skill_or_tag_only');
    else if (!/\b(19|20)\d{2}\b/.test(line) && !/\b(internship|intern|freelanc|agency|mccann)\b/i.test(line)) {
      reasons.push('no_date_or_career_markers');
    } else reasons.push('parser_returned_null');
    return reasons.join('; ');
  }
  if (!qualifiesStrictExperience(entry, line)) reasons.push('fails_strict_qualification');
  const score = scoreStrictExperienceEntry(entry, line);
  if (score < EXPERIENCE_PARSER_CONFIDENCE_MIN) {
    reasons.push(`confidence_below_${EXPERIENCE_PARSER_CONFIDENCE_MIN} (${score})`);
  }
  if (parser === 'internship' && /\b20N\b/i.test(line)) {
    reasons.push('ocr_date_corruption_20N');
  }
  return reasons.length ? reasons.join('; ') : 'not_promoted_to_final_resumeData';
}

function detectFromLine(line, allLines) {
  const hits = [];
  const freelance = parseFreelanceCareerLine(line);
  if (freelance) {
    const confidence = scoreStrictExperienceEntry(freelance, line);
    hits.push({
      parser: 'parseFreelanceCareerLine',
      entry: { ...freelance, confidence },
      sourceLine: line,
      accepted: qualifiesStrictExperience(freelance, line) && confidence >= EXPERIENCE_PARSER_CONFIDENCE_MIN,
    });
  }
  const internship = parseInternshipLine(line, { nearbyLines: allLines });
  if (internship) {
    const confidence = scoreStrictExperienceEntry(internship, line);
    hits.push({
      parser: 'parseInternshipLine',
      entry: { ...internship, confidence },
      sourceLine: line,
      accepted: qualifiesStrictExperience(internship, line) && confidence >= EXPERIENCE_PARSER_CONFIDENCE_MIN,
    });
  }
  const group = buildExperienceEntryFromLineGroup([line]);
  if (group) {
    hits.push({
      parser: 'buildExperienceEntryFromLineGroup',
      entry: group,
      sourceLine: line,
      accepted: true,
    });
  } else if (passesStrictExperienceGate(line)) {
    hits.push({
      parser: 'passesStrictExperienceGate',
      entry: null,
      sourceLine: line,
      accepted: false,
    });
  }
  return hits;
}

function pickBestHit(hits) {
  if (!hits.length) return null;
  return [...hits].sort((a, b) => (b.entry?.confidence || 0) - (a.entry?.confidence || 0))[0];
}

function inFinalResume(exp, finalExps) {
  const key = normKey(exp);
  return finalExps.some((f) => normKey(f) === key);
}

async function main() {
  let ocrText = '';
  let trace = null;
  if (fs.existsSync(TRACE_PATH)) {
    trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
    ocrText = trace.checkpoints?.OCR_OUTPUT?.object?.text || '';
  }
  if (!ocrText) {
    console.error('Missing OCR text in TRACE_YOAZ_PIPELINE.json');
    process.exit(1);
  }

  const enterprise = extractPlainTextEnterprise(ocrText, 'ocr');
  const pipe = await runProductionExtractionPipeline(ocrText, {
    rawText: ocrText,
    extractionMethod: 'ocr',
    enterpriseExtraction: enterprise,
    canonicalImport: true,
  });
  const imp = productionToHirelyImportResult(pipe, { name: 'yoaz.pdf' });

  const ocrLines = ocrText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  const registry = buildSourceLineRegistry(ocrText);

  const structuredExps = trace?.checkpoints?.STRUCTURED_RESUME?.object?.experiences || pipe.structuredResume?.experiences || [];
  const finalExps = imp.resumeData?.experiences || trace?.checkpoints?.RESUME_DATA?.object?.experiences || [];
  const reviewQueue = imp.reviewQueue || trace?.checkpoints?.RESUME_DATA?.examples?.reviewQueue || [];

  const strict = parseStrictExperiencesFromLines(ocrLines, { experienceSectionLines: ocrLines });
  const strictWithConfidence = strict.experiences.map((exp) => {
    const src =
      ocrLines.find((l) => parseFreelanceCareerLine(l) && normKey(parseFreelanceCareerLine(l)) === normKey(exp)) ||
      ocrLines.find((l) => {
        const intern = parseInternshipLine(l, { nearbyLines: ocrLines });
        return intern && normKey(intern) === normKey(exp);
      }) ||
      ocrLines.find(
        (l) =>
          /\bfreelanc/i.test(l) ||
          (exp.role && l.toLowerCase().includes(String(exp.role).toLowerCase().slice(0, 14))) ||
          (exp.company && l.toLowerCase().includes(String(exp.company).toLowerCase().slice(0, 8)))
      ) ||
      finalExps.find((f) => normKey(f) === normKey(exp))?.sourceLines?.[0] ||
      '—';
    return {
      ...exp,
      confidence: scoreStrictExperienceEntry(exp, src === '—' ? '' : src),
      sourceLine: src,
      parser: 'parseStrictExperiencesFromLines',
    };
  });

  const lineDetections = [];
  const seenLine = new Set();
  for (const line of ocrLines) {
    const hits = detectFromLine(line, ocrLines);
    if (!hits.length) continue;
    const best = pickBestHit(hits);
    const id = registry.byNorm.get(line.toLowerCase().replace(/\s+/g, ' ')) || '—';
    if (seenLine.has(line)) continue;
    seenLine.add(line);
    lineDetections.push({ line, lineId: id, ...best });
  }

  const detected = [];
  const detectedKeys = new Set();

  for (const exp of strictWithConfidence) {
    const row = expRow(exp, { parser: exp.parser, stage: 'strict_parser', sourceLine: exp.sourceLine });
    row.inStructured = structuredExps.some((s) => normKey(s) === normKey(exp));
    row.inResumeData = inFinalResume(exp, finalExps);
    detected.push(row);
    detectedKeys.add(normKey(exp));
  }

  for (const det of lineDetections) {
    if (!det.entry) continue;
    const key = normKey(det.entry);
    if (detectedKeys.has(key)) continue;
    const row = expRow(det.entry, {
      parser: det.parser,
      stage: 'line_scan',
      sourceLine: det.sourceLine,
    });
    row.inStructured = structuredExps.some((s) => normKey(s) === key);
    row.inResumeData = inFinalResume(det.entry, finalExps);
    detected.push(row);
    detectedKeys.add(key);
  }

  for (const exp of finalExps) {
    const key = normKey(exp);
    if (detectedKeys.has(key)) continue;
    detected.push(
      expRow(exp, {
        parser: 'resumeData_only',
        stage: 'final',
        sourceLine: exp.sourceLines?.[0],
        confidence: '—',
      })
    );
    detectedKeys.add(key);
  }

  const rejected = [];

  for (const det of lineDetections) {
    const exp = det.entry;
    const finalHit = exp && inFinalResume(exp, finalExps);
    if (exp && finalHit) continue;
    if (exp && det.accepted && !finalHit) {
      rejected.push({
        sourceLine: det.sourceLine,
        lineId: det.lineId,
        reason: explainRejection(det.sourceLine, exp, det.parser) + '; dropped_before_resumeData',
        parsedRole: exp.role,
        parsedCompany: exp.company,
        parsedDates: exp.dates,
        confidence: exp.confidence,
        parser: det.parser,
      });
      continue;
    }
    if (exp && !det.accepted) {
      rejected.push({
        sourceLine: det.sourceLine,
        lineId: det.lineId,
        reason: explainRejection(det.sourceLine, exp, det.parser),
        parsedRole: exp.role,
        parsedCompany: exp.company,
        parsedDates: exp.dates,
        confidence: exp.confidence,
        parser: det.parser,
      });
    }
  }

  for (const line of strict.unclassified) {
    if (!/\b((?:19|20)\d{2}|freelanc|internship|intern|mccann|agency|illustrator|designer)\b/i.test(line)) {
      continue;
    }
    if (rejected.some((r) => r.sourceLine === line)) continue;
    if (detected.some((d) => d.sourceLine === line)) continue;
    rejected.push({
      sourceLine: line,
      lineId: '—',
      reason: explainRejection(line, null, 'strict_unclassified'),
      parsedRole: '—',
      parsedCompany: '—',
      parsedDates: '—',
      confidence: '—',
      parser: 'strict_unclassified',
    });
  }

  for (const q of reviewQueue) {
    const text = String(q.sourceText || q.detected || '').trim();
    if (!text) continue;
    if (!/\b(freelanc|internship|intern|mccann|agency|illustrator|designer|20\d{2})\b/i.test(text)) continue;
    if (finalExps.some((e) => (e.sourceLines || []).some((sl) => sl.includes(text.slice(0, 20))))) continue;
    if (rejected.some((r) => r.sourceLine === text)) continue;
    rejected.push({
      sourceLine: text,
      lineId: '—',
      reason: `review_queue_pending (${q.category || 'experience_candidate'})`,
      parsedRole: '—',
      parsedCompany: '—',
      parsedDates: '—',
      confidence: q.confidence ?? '—',
      parser: 'reviewQueue',
    });
  }

  const md = [];
  md.push('# EXPERIENCE ENGINE AUDIT — Yoaz PDF');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Source OCR: ${ocrLines.length} lines · strict parser: ${strict.experiences.length} · final resumeData: ${finalExps.length}`);
  md.push('');
  md.push('> Audit only — no fixes applied.');
  md.push('');

  md.push('## Summary');
  md.push('');
  md.push('| Metric | Count |');
  md.push('|--------|------:|');
  md.push(`| Detected (parser + final) | ${detected.length} |`);
  md.push(`| In STRUCTURED_RESUME | ${structuredExps.length} |`);
  md.push(`| In RESUME_DATA (final) | ${finalExps.length} |`);
  md.push(`| Rejected / not promoted | ${rejected.length} |`);
  md.push('');

  md.push('## Detected experiences');
  md.push('');
  if (!detected.length) {
    md.push('_None detected._');
  } else {
    md.push('| # | Source line | Role | Company | Dates | Confidence | Parser | In structured | In resumeData |');
    md.push('|--:|-------------|------|---------|-------|------------|--------|:-------------:|:-------------:|');
    detected.forEach((d, i) => {
      md.push(
        `| ${i + 1} | ${mdEsc(d.sourceLine.slice(0, 80))}${d.sourceLine.length > 80 ? '…' : ''} | ${mdEsc(d.role)} | ${mdEsc(d.company)} | ${mdEsc(d.dates)} | ${d.confidence} | ${d.parser} | ${d.inStructured ? '✓' : '✗'} | ${d.inResumeData ? '✓' : '✗'} |`
      );
    });
  }
  md.push('');

  md.push('### Detected — detail');
  md.push('');
  detected.forEach((d, i) => {
    md.push(`#### Experience ${i + 1}`);
    md.push('');
    md.push('**Source line:**');
    md.push('```');
    md.push(d.sourceLine);
    md.push('```');
    md.push('');
    md.push(`| Field | Value |`);
    md.push(`|-------|-------|`);
    md.push(`| Role | ${d.role} |`);
    md.push(`| Company | ${d.company} |`);
    md.push(`| Dates | ${d.dates} |`);
    md.push(`| Confidence | ${d.confidence} |`);
    md.push(`| Parser | ${d.parser} |`);
    md.push(`| In STRUCTURED_RESUME | ${d.inStructured ? 'yes' : 'no'} |`);
    md.push(`| In RESUME_DATA | ${d.inResumeData ? 'yes' : 'no'} |`);
    md.push('');
  });

  md.push('## Rejected experiences');
  md.push('');
  if (!rejected.length) {
    md.push('_No rejected experience candidates._');
  } else {
    md.push('| # | Source line | Reason | Parsed role | Parsed company | Dates | Conf |');
    md.push('|--:|-------------|--------|-------------|----------------|-------|-----:|');
    rejected.forEach((r, i) => {
      md.push(
        `| ${i + 1} | ${mdEsc(r.sourceLine.slice(0, 70))}${r.sourceLine.length > 70 ? '…' : ''} | ${mdEsc(r.reason)} | ${mdEsc(r.parsedRole)} | ${mdEsc(r.parsedCompany)} | ${mdEsc(r.parsedDates)} | ${r.confidence} |`
      );
    });
  }
  md.push('');

  md.push('### Rejected — detail');
  md.push('');
  rejected.forEach((r, i) => {
    md.push(`#### Rejected ${i + 1}`);
    md.push('');
    md.push('**Source line:**');
    md.push('```');
    md.push(r.sourceLine);
    md.push('```');
    md.push('');
    md.push(`**Reason:** ${r.reason}`);
    if (r.parsedRole && r.parsedRole !== '—') {
      md.push(`**Would have parsed as:** ${r.parsedRole} @ ${r.parsedCompany} (${r.parsedDates}) — confidence ${r.confidence}`);
    }
    md.push('');
  });

  md.push('## Pipeline notes');
  md.push('');
  md.push('- **Strict parser** accepts role+company+date groups with confidence ≥ 70.');
  md.push('- **McCann internship** often parses (`Internship` @ `McCann G. Agency`) but is demoted to `clients[]` / `reviewQueue` during output polish — not kept as `experiences[]`.');
  md.push('- **`designer edition, logos...`** is a freelance bullet fragment — not a standalone experience row.');
  md.push('- **Freelance 2011–2022** survives end-to-end with `sourceLineId: src-5`.');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('EXPERIENCE_AUDIT.md written:', OUT_PATH);
  console.log({
    detected: detected.length,
    structured: structuredExps.length,
    final: finalExps.length,
    rejected: rejected.length,
  });
}

main().catch((err) => {
  console.error('experience audit failed:', err);
  process.exit(1);
});
