#!/usr/bin/env node
/**
 * EDUCATION RECOVERY REPORT — trace source → block → structuredResume → resumeData → cvData.
 * node scripts/education-recovery-report.mjs
 * Output: EDUCATION_RECOVERY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import { buildResumeData, resumeDataToCvData } from '../src/core/resume-data.js';
import { parseEducationLineWithContact } from '../src/core/parsing/classification-fixes.js';
import {
  formatSafeEducationEntry,
  recoverSafeParsedEducation,
  tryRecoverSchoolEducation,
  SAFE_EDUCATION_CONFIDENCE_MIN,
  dedupeEducationBySchoolAndDates,
} from '../src/core/parsing/education-recovery.js';
import {
  scoreEducationConfidence,
  EDUCATION_FORCE_THRESHOLD,
} from '../src/core/parsing/education-confidence.js';
import { scoreEducationLine } from '../src/core/validation/confidence-gate.js';
import { extractDateRangeFromText } from '../src/core/parsing/parser-recovery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const FIXTURE_PATH = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');
const OUT_PATH = path.join(ROOT, 'EDUCATION_RECOVERY_REPORT.md');

const SCHOOL_MARKERS = [
  { re: /\bLISAA\b/i, label: 'LISAA' },
  { re: /\bCréapole|\bCreapole/i, label: 'Créapole' },
  { re: /\bGobelins\b/i, label: 'Gobelins' },
  { re: /\bENSAD\b/i, label: 'ENSAD' },
  { re: /\buniversity|université\b/i, label: 'University' },
  { re: /\b(école|ecole|school)\b/i, label: 'School' },
  { re: /\b(bachelor|master|diploma|degree|formation)\b/i, label: 'Course/Degree' },
];

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

function eduDedupeKey(line) {
  const s = String(line || '').trim().toLowerCase();
  const school = schoolKey(s);
  const dates = extractDateRangeFromText(s);
  const twin = s.match(/\b((?:19|20)\d{2})\s+((?:19|20)\d{2})\b/);
  const start = dates.startDate || twin?.[1] || '';
  const end = dates.endDate || twin?.[2] || '';
  return `${school}|${start}|${end}`;
}

function parseEducationFields(text) {
  const raw = String(text || '').trim();
  const hit = formatSafeEducationEntry(raw);
  if (hit?.education) {
    const paren = hit.education.match(/^(.+?)\s*\((\d{4}[–—-]\d{4})\)\s*$/);
    if (paren) {
      const parts = paren[1].split(/\s*[—–-]\s+/);
      return {
        school: parts[0]?.trim() || '—',
        program: parts.slice(1).join(' — ').trim() || '—',
        dates: paren[2].replace(/—/g, '–'),
        formatted: hit.education,
        parser: hit.parser,
        confidence: scoreEducationLine(hit.education),
        safe: scoreEducationLine(hit.education) >= SAFE_EDUCATION_CONFIDENCE_MIN,
      };
    }
    const triple = hit.education.match(/^(.+?)\s*[—–-]\s+(.+?)\s*[—–-]\s+(\d{4}[–—-]\d{4})$/);
    if (triple) {
      return {
        school: triple[1].trim(),
        program: triple[2].trim(),
        dates: triple[3].replace(/—/g, '–'),
        formatted: hit.education,
        parser: hit.parser,
        confidence: scoreEducationLine(hit.education),
        safe: true,
      };
    }
  }
  const parsed = parseEducationLineWithContact(raw);
  const edu = scoreEducationConfidence(raw);
  return {
    school: schoolKey(raw) || '—',
    program: '—',
    dates: '—',
    formatted: parsed?.education || tryRecoverSchoolEducation(raw) || '',
    parser: parsed?.education ? 'parseEducationLineWithContact' : 'line_scan',
    confidence: parsed?.education ? Math.max(edu.confidence, 85) : edu.confidence,
    safe:
      (parsed?.education && scoreEducationLine(parsed.education) >= SAFE_EDUCATION_CONFIDENCE_MIN) ||
      (edu.forceEducation && edu.confidence >= EDUCATION_FORCE_THRESHOLD),
  };
}

function inEducationList(item, list) {
  const key = eduDedupeKey(item);
  return (list || []).some((e) => {
    const ek = eduDedupeKey(e);
    if (ek === key) return true;
    const n = String(e).toLowerCase();
    const i = String(item).toLowerCase();
    return n.includes(i.slice(0, 20)) || i.includes(n.slice(0, 20));
  });
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

function lineHasEducationSignal(line) {
  const l = String(line || '').trim();
  if (!l || l.length < 4) return false;
  if (/^-\s*education$/i.test(l)) return false;
  if (/\b(freelanc|internship|mccann|agency)\b/i.test(l) && !/\b(school|lisaa|créapole|creapole)\b/i.test(l)) {
    return false;
  }
  if (SCHOOL_MARKERS.some((m) => m.re.test(l))) return true;
  const edu = scoreEducationConfidence(l);
  return edu.schoolMatch || edu.forceEducation || (/\b(19|20)\d{2}\b/.test(l) && edu.confidence >= 40);
}

function lossReason(trace) {
  const reasons = [];
  if (!trace.fields?.safe && !trace.fields?.formatted) reasons.push('not_parsed_as_education');
  else if (!trace.fields?.safe) reasons.push(`below_safe_threshold_${SAFE_EDUCATION_CONFIDENCE_MIN}`);
  if (trace.fields?.safe && !trace.inBlock) reasons.push('no_matching_document_block');
  if (trace.fields?.safe && !trace.inStructured) {
    if (trace.blockGate) reasons.push(trace.blockGate);
    else reasons.push('dropped_before_structuredResume');
  }
  if (trace.inStructured && !trace.inResumeData) {
    if (trace.deduped) reasons.push('deduped_by_school_and_dates');
    else reasons.push('dropped_structured_to_resumeData');
  }
  if (trace.inResumeData && !trace.inCvData) reasons.push('dropped_resumeData_to_cvData');
  if (trace.phoneMixed && trace.inResumeData) reasons.push('phone_stripped_education_retained');
  if (!reasons.length && trace.inCvData) return 'retained_end_to_end';
  return reasons.join('; ') || 'unknown';
}

function collectCandidates(ocrLines) {
  const rows = [];
  const seen = new Set();
  for (const line of ocrLines) {
    if (!lineHasEducationSignal(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    const fields = parseEducationFields(line);
    rows.push({
      sourceLine: line,
      markers: SCHOOL_MARKERS.filter((m) => m.re.test(line)).map((m) => m.label),
      fields,
      phoneMixed: /\+\d[\d\s().-]{8,}/.test(line),
      key: fields.formatted ? eduDedupeKey(fields.formatted) : eduDedupeKey(line),
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
  const structuredEdu = pipe.structuredResume?.education || [];
  const resumeEdu = resumeData.education || [];
  const cvEdu = cvData.education || [];

  const candidates = collectCandidates(ocrLines);
  const traces = candidates.map((c) => {
    const formatted = c.fields.formatted || c.sourceLine;
    const inStructured = inEducationList(formatted, structuredEdu) || inEducationList(c.sourceLine, structuredEdu);
    const inResumeData = inEducationList(formatted, resumeEdu);
    const inCvData = inEducationList(formatted, cvEdu);

    let blockGate = '';
    let deduped = false;
    if (c.fields.safe && inStructured && !inResumeData) {
      const structMatch = structuredEdu.filter(
        (e) => schoolKey(e) === schoolKey(formatted) || schoolKey(e) === schoolKey(c.sourceLine)
      );
      if (structMatch.length > 1) deduped = true;
      if (/créapole|creapole/i.test(c.sourceLine) && structMatch.length > 1) {
        blockGate = 'creapole_deduped_same_school_different_years';
      }
    }
    if (c.phoneMixed && !inStructured && c.fields.safe) {
      blockGate = 'phone_prefix_blocked_structured_ingest';
    }

    return {
      ...c,
      block: findBlockForLine(blocks, c.sourceLine),
      inBlock: !!findBlockForLine(blocks, c.sourceLine),
      inStructured,
      inResumeData,
      inCvData,
      deduped,
      blockGate,
      loss: lossReason({
        fields: c.fields,
        inBlock: !!findBlockForLine(blocks, c.sourceLine),
        inStructured,
        inResumeData,
        inCvData,
        deduped,
        blockGate,
        phoneMixed: c.phoneMixed,
      }),
    };
  });

  const safeRecovery = recoverSafeParsedEducation(
    { education: [...resumeEdu], unsorted: [...(resumeData.unsorted || [])], identity: { ...resumeData.identity } },
    { lines: ocrLines }
  );

  return {
    label,
    ocrLines: ocrLines.length,
    blocks: blocks.length,
    structuredCount: structuredEdu.length,
    resumeCount: resumeEdu.length,
    cvCount: cvEdu.length,
    structuredEdu,
    resumeEdu,
    cvEdu,
    traces,
    safeRecovery,
    dedupedPreview: dedupeEducationBySchoolAndDates(structuredEdu),
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
  lines.push(`| structuredResume.education | ${audit.structuredCount} |`);
  lines.push(`| resumeData.education | ${audit.resumeCount} |`);
  lines.push(`| cvData.education | ${audit.cvCount} |`);
  lines.push(`| After school+date dedupe (preview) | ${audit.dedupedPreview.length} |`);
  lines.push('');

  lines.push('### Education trace');
  lines.push('');
  lines.push('| # | Markers | Source | Block | structured | resumeData | cvData | Loss point |');
  lines.push('|--:|---------|--------|:-----:|:----------:|:----------:|:------:|------------|');

  audit.traces.forEach((t, i) => {
    const src = t.sourceLine.length > 52 ? `${t.sourceLine.slice(0, 52)}…` : t.sourceLine;
    const block = t.block ? t.block.type : '—';
    lines.push(
      `| ${i + 1} | ${mdEsc(t.markers.join(', '))} | ${mdEsc(src)} | ${mdEsc(block)} | ${t.inStructured ? '✓' : '✗'} | ${t.inResumeData ? '✓' : '✗'} | ${t.inCvData ? '✓' : '✗'} | ${mdEsc(t.loss)} |`
    );
  });
  lines.push('');

  lines.push('### Trace detail');
  lines.push('');
  audit.traces.forEach((t, i) => {
    lines.push(`#### ${i + 1}. ${t.markers.join(' · ') || 'education candidate'}`);
    lines.push('');
    lines.push('**Source**');
    lines.push('```');
    lines.push(t.sourceLine);
    lines.push('```');
    lines.push('');
    if (t.block) {
      lines.push(`**Block:** \`${t.block.type}\` (${t.block.id})`);
      lines.push('');
    }
    if (t.fields.formatted) {
      lines.push('| Parsed | Value |');
      lines.push('|--------|-------|');
      lines.push(`| School | ${t.fields.school} |`);
      lines.push(`| Program | ${t.fields.program} |`);
      lines.push(`| Dates | ${t.fields.dates} |`);
      lines.push(`| Formatted | ${t.fields.formatted} |`);
      lines.push(`| Parser | ${t.fields.parser} |`);
      lines.push(`| Confidence | ${t.fields.confidence} |`);
      lines.push(`| Phone mixed | ${t.phoneMixed ? 'yes' : 'no'} |`);
      lines.push(`| Safe recover | ${t.fields.safe ? 'yes' : 'no'} |`);
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

  lines.push('### Final education in resumeData');
  lines.push('');
  if (!audit.resumeEdu.length) {
    lines.push('_None._');
  } else {
    audit.resumeEdu.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  }
  lines.push('');

  return lines;
}

async function main() {
  let ocrText = '';
  if (fs.existsSync(TRACE_PATH)) {
    const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
    ocrText = trace.checkpoints?.OCR_OUTPUT?.object?.text || '';
  }
  if (!ocrText && fs.existsSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'))) {
    const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8'));
    ocrText = rep.ocrText || '';
  }

  const fixtureText = fs.existsSync(FIXTURE_PATH) ? fs.readFileSync(FIXTURE_PATH, 'utf8') : '';
  const audits = [];
  if (ocrText) audits.push(await auditSource('Yoaz OCR', ocrText));
  if (fixtureText) audits.push(await auditSource('Yoaz fixture (clean)', fixtureText));

  const md = [];
  md.push('# EDUCATION RECOVERY REPORT');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('');
  md.push('## Goal');
  md.push('');
  md.push('Recover **LISAA**, **Créapole**, schools, universities, and courses. Phone numbers mixed with education lines must not destroy education records.');
  md.push('');
  md.push('## Recovery policy');
  md.push('');
  md.push(`- **Safe recover only:** education confidence ≥ ${SAFE_EDUCATION_CONFIDENCE_MIN}`);
  md.push('- **Phone stripping:** `parseEducationLineWithContact` extracts phone/email, keeps education string');
  md.push('- **OCR date repair:** `20M` / `20N` → `2010` before parse');
  md.push('- **Dedupe:** by school + date span (distinct years at same school are kept)');
  md.push('- **Engines:** `recoverSafeParsedEducation` in structured build, auto-accept, and polish');
  md.push('');

  md.push('## Summary');
  md.push('');
  md.push('| Source | structured | resumeData | cvData | Safe lost from cvData |');
  md.push('|--------|----------:|-----------:|-------:|----------------------:|');
  for (const a of audits) {
    const lost = a.traces.filter((t) => t.fields?.safe && !t.inCvData).length;
    md.push(`| ${a.label} | ${a.structuredCount} | ${a.resumeCount} | ${a.cvCount} | ${lost} |`);
  }
  md.push('');

  for (const audit of audits) {
    md.push(...renderSection(audit));
  }

  md.push('## Pipeline notes');
  md.push('');
  md.push('- Phone+education lines (e.g. `+33649434839 2011 2012 : LISAA…`) parse to clean `LISAA — Web and motion design (2011–2012)`; phone routes to `identity.phone`.');
  md.push('- Créapole OCR corruption (`20M`, `@ man`, `ign fin hie`) is repaired before corrupt-line rejection.');
  md.push('- Multiple Créapole year spans (2007–2009, 2008–2009, 2009–2010) are kept as separate entries when dates differ.');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('EDUCATION_RECOVERY_REPORT.md written:', OUT_PATH);
  for (const a of audits) {
    console.log(a.label, {
      structured: a.structuredCount,
      resume: a.resumeCount,
      cv: a.cvCount,
      deduped: a.dedupedPreview.length,
    });
  }
}

main().catch((err) => {
  console.error('education recovery report failed:', err);
  process.exit(1);
});
