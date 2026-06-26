#!/usr/bin/env node
/**
 * EDUCATION ENGINE AUDIT — Yoaz PDF detected vs rejected education items.
 * node scripts/education-audit.mjs
 * Output: EDUCATION_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import { parseEducationLineWithContact } from '../src/core/parsing/classification-fixes.js';
import {
  scoreEducationConfidence,
  isCorruptEducationLine,
  EDUCATION_FORCE_THRESHOLD,
} from '../src/core/parsing/education-confidence.js';
import { harvestEducation, extractDateRangeFromText } from '../src/core/parsing/parser-recovery.js';
import { isValidEducationItem } from '../src/core/parsing/field-sanitize.js';
import { tryRecoverSchoolEducation } from '../src/core/parsing/resume-output-quality.js';
import { buildSourceLineRegistry } from '../src/core/parsing/line-source-dedup.js';
import { lineHasJunk, isSectionHeaderLine } from '../src/core/parsing/rich-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const OUT_PATH = path.join(ROOT, 'EDUCATION_AUDIT.md');

function mdEsc(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function schoolKey(line) {
  return String(line || '')
    .trim()
    .split(/[—–-]/)[0]
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 24);
}

function normEduKey({ school, program, dates }) {
  return [
    String(school || '').toLowerCase().trim(),
    String(program || '').toLowerCase().trim().slice(0, 40),
    String(dates || '').replace(/\D/g, '').slice(0, 8),
  ].join('|');
}

/**
 * Extract school / program / dates from raw OCR line or formatted education string.
 */
function parseEducationFields(text) {
  const raw = String(text || '').trim();
  if (!raw) return { school: '—', program: '—', dates: '—', sourceLine: raw };

  if (
    /\b(LISAA|Créapole|Creapole)\b/i.test(raw) &&
    (/\(\d{4}[–—-]\d{4}\)/.test(raw) || /\d{4}[–—-]\d{4}\s*$/.test(raw))
  ) {
    return parseFormattedEducation(raw, raw);
  }

  const recovered = tryRecoverSchoolEducation(raw);
  if (recovered) return parseFormattedEducation(recovered, raw);

  const parsed = parseEducationLineWithContact(raw);
  if (parsed?.education) {
    return parseFormattedEducation(parsed.education, raw);
  }

  const paren = raw.match(/^(.+?)\s*\((\d{4}[–—-]\d{4})\)\s*$/);
  if (paren) {
    const body = paren[1].trim();
    const parts = body.split(/\s*[—–-]\s+/);
    return {
      school: parts[0] || '—',
      program: parts.slice(1).join(' — ') || '—',
      dates: paren[2].replace(/—/g, '–'),
      sourceLine: raw,
    };
  }

  const triple = raw.match(/^(.+?)\s*[—–-]\s+(.+?)\s*[—–-]\s+(\d{4}[–—-]\d{4})$/);
  if (triple) {
    return {
      school: triple[1].trim(),
      program: triple[2].trim(),
      dates: triple[3].replace(/—/g, '–'),
      sourceLine: raw,
    };
  }

  const schoolMatch = raw.match(/\b(LISAA|Créapole|Creapole)\b/i);
  const school = schoolMatch ? schoolMatch[1] : '';
  const dates = extractDateRangeFromText(raw);
  const twin = raw.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  const dateLabel =
    dates.startDate && dates.endDate
      ? `${dates.startDate}–${dates.endDate}`
      : twin
        ? `${twin[1]}–${twin[2]}`
        : dates.startDate || '—';

  let program = raw
    .replace(/\+\d[\d\s().-]{8,}/g, ' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(LISAA|Créapole|Creapole)\b/gi, ' ')
    .replace(/^[\s:,\-–—]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (program.startsWith(',')) program = program.slice(1).trim();
  if (program.length < 4) program = '—';

  return {
    school: school || (raw.split(/[—–-]/)[0] || '—').trim().slice(0, 60) || '—',
    program: program.charAt(0).toUpperCase() + program.slice(1),
    dates: dateLabel,
    sourceLine: raw,
  };
}

function parseFormattedEducation(formatted, sourceLine) {
  const s = String(formatted || '').trim();
  const paren = s.match(/^(.+?)\s*\((\d{4}[–—-]\d{4})\)\s*$/);
  if (paren) {
    const parts = paren[1].split(/\s*[—–-]\s+/);
    return {
      school: parts[0]?.trim() || '—',
      program: parts.slice(1).join(' — ').trim() || '—',
      dates: paren[2].replace(/—/g, '–'),
      sourceLine: sourceLine || s,
    };
  }
  const triple = s.match(/^(.+?)\s*[—–-]\s+(.+?)\s*[—–-]\s+(\d{4}[–—-]\d{4})$/);
  if (triple) {
    return {
      school: triple[1].trim(),
      program: triple[2].trim(),
      dates: triple[3].replace(/—/g, '–'),
      sourceLine: sourceLine || s,
    };
  }
  const parts = s.split(/\s*[—–-]\s+/);
  const dates = extractDateRangeFromText(s);
  return {
    school: parts[0] || '—',
    program: parts.slice(1).join(' — ') || '—',
    dates: dates.startDate && dates.endDate ? `${dates.startDate}–${dates.endDate}` : '—',
    sourceLine: sourceLine || s,
  };
}

function eduRow(fields, extra = {}) {
  return {
    sourceLine: fields.sourceLine || extra.sourceLine || '—',
    school: fields.school || '—',
    program: fields.program || '—',
    dates: fields.dates || '—',
    confidence: extra.confidence ?? '—',
    parser: extra.parser || '—',
    inStructured: extra.inStructured ?? false,
    inResumeData: extra.inResumeData ?? false,
  };
}

function lineHasEducationSignal(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 3) return false;
  if (/^-\s*education$/i.test(l)) return false;
  if (/^(education|formation|studies)\s*$/i.test(l)) return false;
  if (/\b(freelanc|internship|mccann|agency|illustrator.*graphic.*designer)\b/i.test(l)) return false;
  const edu = scoreEducationConfidence(l);
  if (edu.signals?.includes('ocr_corrupt') && edu.score < 40) return false;
  if (edu.score > 0) return true;
  if (/\b(lisaa|créapole|creapole|école|ecole|school|university|bachelor|master|diploma|formation)\b/i.test(l)) {
    return true;
  }
  if (/\b(19|20)\d{2}\b/.test(l) && /\b(school|design|management|communication)\b/i.test(l)) return true;
  return false;
}

function explainRejection(line, parsed, extra = {}) {
  const reasons = [];
  const l = String(line || '').trim();

  if (isSectionHeaderLine(l) && l.length < 24) reasons.push('section_header');
  if (lineHasJunk(l)) reasons.push('line_has_junk');
  if (isCorruptEducationLine(l)) reasons.push('ocr_corrupt');
  if (!parsed?.education && !tryRecoverSchoolEducation(l)) {
    const edu = scoreEducationConfidence(l);
    if (!edu.schoolMatch && !edu.degreeMatch) reasons.push('no_school_or_degree_match');
    if (edu.confidence < EDUCATION_FORCE_THRESHOLD && !edu.forceEducation) {
      reasons.push(`confidence_below_${EDUCATION_FORCE_THRESHOLD} (${edu.confidence})`);
    }
    if (!/\b(lisaa|créapole|creapole|school|university|école|ecole)\b/i.test(l)) {
      reasons.push('no_school_markers');
    }
  }
  if (parsed?.education && !isValidEducationItem(parsed.education)) {
    reasons.push('fails_isValidEducationItem');
  }
  if (extra.deduped) reasons.push('deduped_by_school');
  if (extra.demotedToUnsorted) reasons.push('demoted_to_unsorted');
  if (extra.reviewQueue) reasons.push(`review_queue_pending (${extra.reviewQueue})`);
  if (extra.notPromoted) reasons.push('not_promoted_to_final_resumeData');

  return reasons.length ? reasons.join('; ') : 'parser_returned_null';
}

function normLine(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function inFinalEducation(item, finalEdu) {
  const fields = parseEducationFields(item);
  const key = normEduKey(fields);
  return finalEdu.some((f) => {
    const fk = normEduKey(parseEducationFields(f));
    if (fk === key) return true;
    const sk = schoolKey(f);
    const itemSk = schoolKey(fields.school || item);
    if (sk && itemSk && sk === itemSk) {
      const fd = extractDateRangeFromText(f);
      const id = extractDateRangeFromText(item);
      if (fd.startDate && id.startDate && fd.startDate === id.startDate) return true;
      if (/\b(lisaa|créapole|creapole)\b/i.test(f) && /\b(lisaa|créapole|creapole)\b/i.test(item)) return true;
    }
    return normLine(f).includes(normLine(fields.school)) && normLine(f).includes(normLine(fields.program).slice(0, 12));
  });
}

function inStructuredEducation(item, structuredEdu) {
  const n = normLine(item);
  return structuredEdu.some((s) => normLine(s) === n || normLine(s).includes(n.slice(0, 24)) || n.includes(normLine(s).slice(0, 24)));
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

  const structuredEdu =
    trace?.checkpoints?.STRUCTURED_RESUME?.object?.education ||
    pipe.structuredResume?.education ||
    [];
  const finalEdu =
    imp.resumeData?.education || trace?.checkpoints?.RESUME_DATA?.object?.education || [];
  const reviewQueue =
    imp.reviewQueue || trace?.checkpoints?.RESUME_DATA?.examples?.reviewQueue || [];

  const harvested = harvestEducation(ocrLines, ocrLines, { lineHasJunk, isSectionHeaderLine });

  const detected = [];
  const detectedKeys = new Set();

  const addDetected = (fields, extra) => {
    const key = normEduKey(fields);
    if (detectedKeys.has(key)) return;
    const row = eduRow(fields, {
      ...extra,
      inStructured: inStructuredEducation(extra.sourceLine || fields.sourceLine, structuredEdu),
      inResumeData: inFinalEducation(fields.sourceLine || fields.school, finalEdu),
    });
    detected.push(row);
    detectedKeys.add(key);
  };

  for (const line of ocrLines) {
    if (!lineHasEducationSignal(line)) continue;
    const parsed = parseEducationLineWithContact(line);
    const edu = scoreEducationConfidence(line);
    const fields = parsed?.education
      ? parseFormattedEducation(parsed.education, line)
      : parseEducationFields(line);

    if (parsed?.education || edu.forceEducation || edu.score >= 40) {
      addDetected(fields, {
        confidence: parsed?.education ? Math.max(edu.confidence, 85) : edu.confidence,
        parser: parsed?.education ? 'parseEducationLineWithContact' : 'scoreEducationConfidence',
        sourceLine: line,
      });
    }
  }

  for (const item of harvested) {
    const edu = scoreEducationConfidence(item);
    if (edu.confidence < 40 && !edu.schoolMatch) continue;
    const fields = parseEducationFields(item);
    addDetected(
      { ...fields, sourceLine: item },
      { confidence: edu.confidence, parser: 'harvestEducation' }
    );
  }

  for (const item of structuredEdu) {
    const fields = parseEducationFields(item);
    addDetected(
      { ...fields, sourceLine: fields.sourceLine || item },
      { confidence: scoreEducationConfidence(item).confidence, parser: 'structured_resume' }
    );
  }

  for (const item of finalEdu) {
    const fields = parseEducationFields(item);
    const key = normEduKey(fields);
    if (detectedKeys.has(key)) continue;
    addDetected(
      { ...fields, sourceLine: item },
      { confidence: '—', parser: 'resumeData_only', inResumeData: true }
    );
    detectedKeys.add(key);
  }

  const rejected = [];

  for (const line of ocrLines) {
    if (!lineHasEducationSignal(line)) continue;
    const parsed = parseEducationLineWithContact(line);
    const fields = parsed?.education
      ? parseFormattedEducation(parsed.education, line)
      : parseEducationFields(line);
    const finalHit = inFinalEducation(line, finalEdu) || (parsed?.education && inFinalEducation(parsed.education, finalEdu));

    if (finalHit) continue;
    if (parsed?.education && inFinalEducation(parsed.education, finalEdu)) continue;

    const lineId = registry.byNorm.get(line.toLowerCase().replace(/\s+/g, ' ')) || '—';
    if (rejected.some((r) => r.sourceLine === line)) continue;

    const dedupedToFinal =
      parsed?.education &&
      finalEdu.some((f) => schoolKey(f) === schoolKey(parsed.education));

    if (detected.some((d) => d.sourceLine === line && dedupedToFinal)) continue;

    rejected.push({
      sourceLine: line,
      lineId,
      reason: explainRejection(line, parsed, {
        deduped: dedupedToFinal,
        notPromoted: !!parsed?.education && !dedupedToFinal,
      }),
      school: fields.school,
      program: fields.program,
      dates: fields.dates,
      confidence: scoreEducationConfidence(line).confidence,
      parser: parsed?.education ? 'parseEducationLineWithContact' : 'line_scan',
    });
  }

  for (const item of structuredEdu) {
    if (inFinalEducation(item, finalEdu)) continue;
    const fields = parseEducationFields(item);
    if (rejected.some((r) => r.sourceLine === item || normEduKey(parseEducationFields(r.sourceLine)) === normEduKey(fields))) {
      continue;
    }
    const sameSchool = finalEdu.some((f) => schoolKey(f) === schoolKey(item));
    rejected.push({
      sourceLine: item,
      lineId: '—',
      reason: explainRejection(item, { education: item }, {
        deduped: sameSchool,
        notPromoted: true,
      }),
      school: fields.school,
      program: fields.program,
      dates: fields.dates,
      confidence: scoreEducationConfidence(item).confidence,
      parser: 'structured_resume',
    });
  }

  for (const q of reviewQueue) {
    const text = String(q.sourceText || q.detected || '').trim();
    if (!text) continue;
    if (!/\b(lisaa|créapole|creapole|school|university|école|ecole|education|20\d{2})\b/i.test(text)) continue;
    if (inFinalEducation(text, finalEdu)) continue;
    if (rejected.some((r) => r.sourceLine === text)) continue;
    const fields = parseEducationFields(text);
    rejected.push({
      sourceLine: text,
      lineId: '—',
      reason: explainRejection(text, null, { reviewQueue: q.category || 'education_candidate' }),
      school: fields.school,
      program: fields.program,
      dates: fields.dates,
      confidence: q.confidence ?? scoreEducationConfidence(text).confidence,
      parser: 'reviewQueue',
    });
  }

  const corruptFragments = ['ign fin hie. je', '@ man visual communication'];
  for (const frag of corruptFragments) {
    const hit = ocrLines.find((l) => l.includes(frag) || l === frag);
    if (!hit || rejected.some((r) => r.sourceLine === hit)) continue;
    rejected.push({
      sourceLine: hit,
      lineId: '—',
      reason: explainRejection(hit, null),
      school: '—',
      program: '—',
      dates: '—',
      confidence: scoreEducationConfidence(hit).confidence,
      parser: 'ocr_fragment',
    });
  }

  const md = [];
  md.push('# EDUCATION ENGINE AUDIT — Yoaz PDF');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(
    `Source OCR: ${ocrLines.length} lines · harvested: ${harvested.length} · structured: ${structuredEdu.length} · final resumeData: ${finalEdu.length}`
  );
  md.push('');
  md.push('> Audit only — no fixes applied.');
  md.push('');

  md.push('## Summary');
  md.push('');
  md.push('| Metric | Count |');
  md.push('|--------|------:|');
  md.push(`| Detected (parser + final) | ${detected.length} |`);
  md.push(`| In STRUCTURED_RESUME | ${structuredEdu.length} |`);
  md.push(`| In RESUME_DATA (final) | ${finalEdu.length} |`);
  md.push(`| Rejected / not promoted | ${rejected.length} |`);
  md.push('');

  md.push('## Detected education');
  md.push('');
  if (!detected.length) {
    md.push('_None detected._');
  } else {
    md.push('| # | Source line | School | Program | Dates | Confidence | Parser | In structured | In resumeData |');
    md.push('|--:|-------------|--------|---------|-------|------------|--------|:-------------:|:-------------:|');
    detected.forEach((d, i) => {
      md.push(
        `| ${i + 1} | ${mdEsc(d.sourceLine.slice(0, 72))}${d.sourceLine.length > 72 ? '…' : ''} | ${mdEsc(d.school)} | ${mdEsc(d.program)} | ${mdEsc(d.dates)} | ${d.confidence} | ${d.parser} | ${d.inStructured ? '✓' : '✗'} | ${d.inResumeData ? '✓' : '✗'} |`
      );
    });
  }
  md.push('');

  md.push('### Detected — detail');
  md.push('');
  detected.forEach((d, i) => {
    md.push(`#### Education ${i + 1}`);
    md.push('');
    md.push('**Source line:**');
    md.push('```');
    md.push(d.sourceLine);
    md.push('```');
    md.push('');
    md.push('| Field | Value |');
    md.push('|-------|-------|');
    md.push(`| School | ${d.school} |`);
    md.push(`| Program | ${d.program} |`);
    md.push(`| Dates | ${d.dates} |`);
    md.push(`| Confidence | ${d.confidence} |`);
    md.push(`| Parser | ${d.parser} |`);
    md.push(`| In STRUCTURED_RESUME | ${d.inStructured ? 'yes' : 'no'} |`);
    md.push(`| In RESUME_DATA | ${d.inResumeData ? 'yes' : 'no'} |`);
    md.push('');
  });

  md.push('## Rejected education');
  md.push('');
  if (!rejected.length) {
    md.push('_No rejected education candidates._');
  } else {
    md.push('| # | Source line | Reason | School | Program | Dates | Conf |');
    md.push('|--:|-------------|--------|--------|---------|-------|-----:|');
    rejected.forEach((r, i) => {
      md.push(
        `| ${i + 1} | ${mdEsc(r.sourceLine.slice(0, 68))}${r.sourceLine.length > 68 ? '…' : ''} | ${mdEsc(r.reason)} | ${mdEsc(r.school)} | ${mdEsc(r.program)} | ${mdEsc(r.dates)} | ${r.confidence} |`
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
    if (r.school && r.school !== '—') {
      md.push(`**Would have parsed as:** ${r.school} — ${r.program} (${r.dates}) — confidence ${r.confidence}`);
    }
    md.push('');
  });

  md.push('## Pipeline notes');
  md.push('');
  md.push('- **parseEducationLineWithContact** requires school markers (`LISAA`, `Créapole`, `school`, `university`, etc.).');
  md.push('- **Phone+education merge** on LISAA line (`+33649434839 2011 2012 : LISAA…`) parses correctly but raw OCR also lands in structured before polish.');
  md.push('- **Créapole OCR corruption** (`20M`, `@ man`, `ign fin hie`) triggers `isCorruptEducationLine` — demoted to unsorted or recovered via `tryRecoverSchoolEducation`.');
  md.push('- **dedupeEducationEntries** keeps one row per school key — 7 structured entries collapse to 2 final (`LISAA`, `Créapole`).');
  md.push('- **2008–2009 Créapole** row is lost in dedup because **2007–2009** entry wins the earlier start year for the same school key.');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('EDUCATION_AUDIT.md written:', OUT_PATH);
  console.log({
    detected: detected.length,
    structured: structuredEdu.length,
    final: finalEdu.length,
    rejected: rejected.length,
  });
}

main().catch((err) => {
  console.error('education audit failed:', err);
  process.exit(1);
});
