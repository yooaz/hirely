#!/usr/bin/env node
/**
 * NOISE ENGINE AUDIT — classify every unsorted item: VALID | LOW_CONFIDENCE | GARBAGE
 * node scripts/unsorted-noise-audit.mjs
 * Output: UNSORTED_AUDIT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifySuggestionNoise } from '../src/core/parsing/suggestion-confidence-score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const OUT_PATH = path.join(ROOT, 'UNSORTED_AUDIT.md');

function classifyUnsortedNoise(line) {
  const noise = classifySuggestionNoise(line);
  const entities = noise.entities || { hits: [], byType: {}, count: 0 };
  return {
    classification: noise.classification,
    reason: noise.reason,
    score: noise.score,
    ocrConfidence: noise.ocrConfidence,
    entities,
    scored: noise,
  };
}

function auditList(label, items) {
  const rows = items.map((text, index) => ({
    index,
    text: String(text).trim(),
    ...classifyUnsortedNoise(text),
  }));
  const counts = { VALID: 0, LOW_CONFIDENCE: 0, GARBAGE: 0 };
  for (const r of rows) counts[r.classification]++;
  return { label, rows, counts, total: rows.length };
}

function mdEscape(s) {
  return String(s || '').replace(/\|/g, '\\|');
}

function main() {
  if (!fs.existsSync(TRACE_PATH)) {
    console.error('Missing TRACE_YOAZ_PIPELINE.json');
    process.exit(1);
  }

  const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
  const structured = trace.checkpoints?.STRUCTURED_RESUME?.object?.unsorted || [];
  const resumeData = trace.checkpoints?.RESUME_DATA?.object?.unsorted || [];
  const archive = trace.checkpoints?.RESUME_DATA?.object?.meta?.unsortedArchive || [];

  const audits = [
    auditList('STRUCTURED_RESUME.unsorted', structured),
    auditList('RESUME_DATA.unsorted', resumeData),
  ];
  if (archive.length) audits.push(auditList('RESUME_DATA.unsortedArchive', archive));

  const combined = auditList(
    'ALL_UNIQUE (structured + final)',
    [...new Set([...structured, ...resumeData, ...archive].map((s) => String(s).trim()).filter(Boolean))]
  );

  const md = [];
  md.push('# UNSORTED AUDIT — Yoaz PDF (Noise Engine)');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('Source: `TRACE_YOAZ_PIPELINE.json`');
  md.push('');
  md.push('> Audit only — classify unsorted lines. No fixes applied.');
  md.push('');
  md.push('## Classification rules');
  md.push('');
  md.push('| Class | Criteria |');
  md.push('|-------|----------|');
  md.push('| **VALID** | Real words + real entities (schools, clients, roles, skills, languages) or strong dictionary match |');
  md.push('| **LOW_CONFIDENCE** | Partial OCR — meaningful fragments with corruption, merged fields, or weak match |');
  md.push('| **GARBAGE** | `v38 A`, `LEA`, random fragments, symbol noise, known OCR corruption (`ee à`, `Mustrator`, `incesion`) |');
  md.push('');

  md.push('## Counts summary');
  md.push('');
  md.push('| Dataset | Total | VALID | LOW_CONFIDENCE | GARBAGE |');
  md.push('|---------|------:|------:|---------------:|--------:|');
  for (const a of [...audits, combined]) {
    md.push(
      `| ${a.label} | ${a.total} | ${a.counts.VALID} | ${a.counts.LOW_CONFIDENCE} | ${a.counts.GARBAGE} |`
    );
  }
  md.push('');

  for (const a of audits) {
    md.push(`## ${a.label} (${a.total} items)`);
    md.push('');
    md.push(
      `VALID **${a.counts.VALID}** · LOW_CONFIDENCE **${a.counts.LOW_CONFIDENCE}** · GARBAGE **${a.counts.GARBAGE}**`
    );
    md.push('');
    md.push('| # | Class | Score | Reason | Text |');
    md.push('|--:|-------|------:|--------|------|');
    for (const r of a.rows) {
      md.push(
        `| ${r.index + 1} | ${r.classification} | ${r.score} | ${mdEscape(r.reason)} | ${mdEscape(r.text.slice(0, 100))}${r.text.length > 100 ? '…' : ''} |`
      );
    }
    md.push('');
  }

  md.push('## ALL_UNIQUE — full classification');
  md.push('');
  for (const cls of ['VALID', 'LOW_CONFIDENCE', 'GARBAGE']) {
    const group = combined.rows.filter((r) => r.classification === cls);
    md.push(`### ${cls} (${group.length})`);
    md.push('');
    for (const r of group) {
      const ent = Object.entries(r.entities.byType || {})
        .map(([k, v]) => `${k}:${[...new Set(v)].slice(0, 3).join(',')}`)
        .join('; ');
      md.push(`- **${mdEscape(r.text.slice(0, 110))}${r.text.length > 110 ? '…' : ''}**`);
      md.push(`  - reason: ${r.reason}; score: ${r.score}; entities: ${ent || 'none'}`);
    }
    md.push('');
  }

  md.push('## Noise engine notes');
  md.push('');
  md.push('- **STRUCTURED_RESUME** holds pre-`normalizeResumeData` overflow (40 lines for Yoaz).');
  md.push('- **RESUME_DATA** final unsorted after dedupe/confidence gate: **2 lines** — `Drawing` (VALID), `@ man visual communication` (LOW_CONFIDENCE).');
  md.push('- **GARBAGE** cluster: header junk (`ee à`, `A A TN`, `_— pe`, `RS Phone:`), tool OCR (`Mustrator`, `incesion`), merged review blobs.');
  md.push('- **VALID** cluster: client lists, education/career lines, languages, interests, skill phrases.');
  md.push('- **LOW_CONFIDENCE** cluster: corrupted dates (`20N`, `20M`), merged contact+education, partial identity/social lines.');
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('UNSORTED_AUDIT.md written:', OUT_PATH);
  console.log(
    Object.fromEntries(
      [...audits, combined].map((a) => [
        a.label,
        a.counts,
      ])
    )
  );
}

main();
