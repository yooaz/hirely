#!/usr/bin/env node
/**
 * DEDUP AUDIT — detect OCR source lines appearing in multiple resume sections.
 * node scripts/duplication-audit.mjs
 * Output: DUPLICATION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSourceLineRegistry } from '../src/core/parsing/line-source-dedup.js';
import { normalizeLineKey } from '../src/core/extraction/extracted-line.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const OUT_PATH = path.join(ROOT, 'DUPLICATION_REPORT.md');

const SECTIONS = [
  'experience',
  'education',
  'skills',
  'tools',
  'clients',
  'languages',
  'unsorted',
];

function normIncludes(a, b) {
  const x = normalizeLineKey(a);
  const y = normalizeLineKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length > y.length ? x : y;
  return short.length >= 6 && long.includes(short);
}

function tokenOverlapRatio(source, target) {
  const srcToks = normalizeLineKey(source)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (!srcToks.length) return 0;
  const hay = normalizeLineKey(target);
  const hit = srcToks.filter((t) => hay.includes(t)).length;
  return hit / srcToks.length;
}

function flattenExperience(exp) {
  const parts = [
    exp.role,
    exp.company,
    exp.dates,
    exp.location,
    ...(exp.bullets || []),
    ...(exp.sourceLines || []),
    exp.sourceText,
  ].filter(Boolean);
  return parts.map(String);
}

function sectionPayloads(rd) {
  const out = {
    experience: [],
    education: (rd.education || []).map(String),
    skills: (rd.skills || []).map(String),
    tools: (rd.tools || []).map(String),
    clients: (rd.clients || []).map(String),
    languages: (rd.languages || []).map(String),
    unsorted: (rd.unsorted || []).map((u) => (typeof u === 'string' ? u : String(u?.text || u))),
  };
  for (const exp of rd.experiences || rd.experience || []) {
    out.experience.push(...flattenExperience(exp));
  }
  return out;
}

function matchStrength(sourceLine, item) {
  if (normIncludes(sourceLine, item) || normIncludes(item, sourceLine)) return 'substring';
  const ratio = tokenOverlapRatio(sourceLine, item);
  const srcToks = normalizeLineKey(sourceLine)
    .split(' ')
    .filter((t) => t.length >= 4);
  const hay = normalizeLineKey(item);
  const strongHits = srcToks.filter((t) => hay.includes(t)).length;
  if (ratio >= 0.5 && strongHits >= 2) return 'token';
  return null;
}

function destinationsForSourceLine(sourceLine, payloads) {
  const hits = new Map();
  for (const section of SECTIONS) {
    for (const item of payloads[section] || []) {
      const strength = matchStrength(sourceLine, item);
      if (strength) {
        hits.set(section, strength);
        break;
      }
    }
  }
  return [...hits.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([section, strength]) => ({ section, strength }));
}

function findWithinSectionDupes(payloads) {
  const rows = [];
  for (const section of SECTIONS) {
    const items = payloads[section] || [];
    const seen = new Map();
    items.forEach((item, idx) => {
      const key = normalizeLineKey(item);
      if (!key || key.length < 3) return;
      if (seen.has(key)) {
        rows.push({
          section,
          text: item,
          duplicateOf: seen.get(key),
          index: idx,
        });
      } else {
        seen.set(key, item);
      }
    });
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (normIncludes(items[i], items[j]) && normalizeLineKey(items[i]) !== normalizeLineKey(items[j])) {
          rows.push({
            section,
            text: items[i],
            duplicateOf: items[j],
            index: i,
            partial: true,
          });
        }
      }
    }
  }
  return rows;
}

function findCrossSectionExactDupes(payloads) {
  const index = new Map();
  for (const section of SECTIONS) {
    for (const item of payloads[section] || []) {
      const key = normalizeLineKey(item);
      if (!key || key.length < 4) continue;
      if (!index.has(key)) index.set(key, { text: item, sections: new Set() });
      index.get(key).sections.add(section);
    }
  }
  return [...index.values()]
    .filter((e) => e.sections.size > 1)
    .map((e) => ({ text: e.text, sections: [...e.sections].sort() }));
}

function auditResume(label, ocrText, rd) {
  const registry = buildSourceLineRegistry(ocrText);
  const payloads = sectionPayloads(rd);
  const multiSection = [];

  for (const entry of registry.entries) {
    const dests = destinationsForSourceLine(entry.text, payloads);
    if (dests.length > 1) {
      multiSection.push({
        sourceLineId: entry.id,
        sourceLine: entry.text,
        destinationSections: dests.map((d) => d.section),
        destinations: dests,
      });
    }
  }

  return {
    label,
    registry,
    payloads,
    multiSection,
    withinSection: findWithinSectionDupes(payloads),
    crossSectionExact: findCrossSectionExactDupes(payloads),
  };
}

function mdEscape(s) {
  return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function main() {
  if (!fs.existsSync(TRACE_PATH)) {
    console.error('Missing TRACE_YOAZ_PIPELINE.json');
    process.exit(1);
  }

  const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
  const ocrText = trace.checkpoints?.OCR_OUTPUT?.object?.text || '';
  const resumeData = trace.checkpoints?.RESUME_DATA?.object;
  const structured = trace.checkpoints?.STRUCTURED_RESUME?.object;
  const cvData = trace.checkpoints?.CV_DATA?.object;

  if (!ocrText || !resumeData) {
    console.error('Trace missing OCR_OUTPUT or RESUME_DATA');
    process.exit(1);
  }

  const registry = buildSourceLineRegistry(ocrText);
  const audits = [auditResume('RESUME_DATA', ocrText, resumeData)];
  if (structured) audits.push(auditResume('STRUCTURED_RESUME', ocrText, structured));

  const cvPayloads = cvData
    ? sectionPayloads({
        experiences: (cvData.experience || []).map((line) => ({ role: line, bullets: [] })),
        education: cvData.education,
        skills: cvData.skills,
        tools: cvData.tools,
        clients: cvData.clients,
        languages: cvData.languages,
        unsorted: cvData.unsorted,
      })
    : null;
  const cvMulti = [];
  if (cvPayloads) {
    for (const entry of registry.entries) {
      const dests = destinationsForSourceLine(entry.text, cvPayloads);
      if (dests.length > 1) {
        cvMulti.push({
          sourceLineId: entry.id,
          sourceLine: entry.text,
          destinationSections: dests.map((d) => d.section),
          destinations: dests,
        });
      }
    }
  }

  const primary = audits[0];
  const md = [];

  md.push('# DUPLICATION REPORT — Yoaz PDF');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Source: \`TRACE_YOAZ_PIPELINE.json\``);
  md.push(`OCR source lines: ${primary.registry.entries.length}`);
  md.push('');
  md.push('> Audit only — same OCR source line mapped to multiple sections. No fixes applied.');
  md.push('');

  md.push('## Summary');
  md.push('');
  md.push('| Dataset | Multi-section source lines | Within-section dupes | Cross-section exact dupes |');
  md.push('|---------|---------------------------:|---------------------:|--------------------------:|');
  for (const a of audits) {
    md.push(
      `| ${a.label} | ${a.multiSection.length} | ${a.withinSection.length} | ${a.crossSectionExact.length} |`
    );
  }
  md.push(`| CV_DATA | ${cvMulti.length} | — | — |`);
  md.push('');

  md.push('## Multi-section source lines (RESUME_DATA)');
  md.push('');
  md.push('OCR lines whose content appears in **2+ sections** of final `RESUME_DATA`.');
  md.push('');
  if (!primary.multiSection.length) {
    md.push('_No multi-section source lines detected._');
  } else {
    md.push('| ID | Source line | Destination sections |');
    md.push('|----|-------------|----------------------|');
    for (const row of primary.multiSection) {
      md.push(
        `| ${row.sourceLineId} | ${mdEscape(row.sourceLine.slice(0, 120))}${row.sourceLine.length > 120 ? '…' : ''} | ${row.destinationSections.join(', ')} |`
      );
    }
  }
  md.push('');

  md.push('### Detail — RESUME_DATA');
  md.push('');
  for (const row of primary.multiSection) {
    md.push(`#### ${row.sourceLineId}`);
    md.push('');
    md.push('**Source line:**');
    md.push('```');
    md.push(row.sourceLine);
    md.push('```');
    md.push('');
    md.push(`**Destination sections:** ${row.destinationSections.join(', ')}`);
    md.push('');
    for (const sec of row.destinationSections) {
      const matches = (primary.payloads[sec] || []).filter(
        (item) => matchStrength(row.sourceLine, item)
      );
      if (matches.length) {
        md.push(`- \`${sec}\`: ${matches.map((m) => `\`${mdEscape(m.slice(0, 80))}\``).join(', ')}`);
      }
    }
    md.push('');
  }

  if (audits[1]) {
    const structuredAudit = audits[1];
    md.push('## Multi-section source lines (STRUCTURED_RESUME)');
    md.push('');
    md.push(`**${structuredAudit.multiSection.length}** OCR lines hit multiple sections before ` +
      '`normalizeResumeData` / confidence gate.');
    md.push('');
    md.push('| ID | Source line | Destination sections |');
    md.push('|----|-------------|----------------------|');
    for (const row of structuredAudit.multiSection.slice(0, 40)) {
      md.push(
        `| ${row.sourceLineId} | ${mdEscape(row.sourceLine.slice(0, 100))}${row.sourceLine.length > 100 ? '…' : ''} | ${row.destinationSections.join(', ')} |`
      );
    }
    if (structuredAudit.multiSection.length > 40) {
      md.push(`| … | _${structuredAudit.multiSection.length - 40} more_ | |`);
    }
    md.push('');
  }

  md.push('## Multi-section source lines (CV_DATA)');
  md.push('');
  if (!cvMulti.length) {
    md.push('_No multi-section source lines in CV_DATA layer._');
  } else {
    md.push('| ID | Source line | Destination sections |');
    md.push('|----|-------------|----------------------|');
    for (const row of cvMulti) {
      md.push(
        `| ${row.sourceLineId} | ${mdEscape(row.sourceLine.slice(0, 120))}${row.sourceLine.length > 120 ? '…' : ''} | ${row.destinationSections.join(', ')} |`
      );
    }
  }
  md.push('');

  md.push('## Within-section duplicates (RESUME_DATA)');
  md.push('');
  const withinBySection = Object.fromEntries(SECTIONS.map((s) => [s, []]));
  for (const d of primary.withinSection) withinBySection[d.section].push(d);
  for (const sec of SECTIONS) {
    const list = withinBySection[sec];
    if (!list.length) continue;
    md.push(`### ${sec} (${list.length})`);
    for (const d of list) {
      md.push(`- \`${mdEscape(d.text.slice(0, 90))}\`${d.partial ? ' ≈ ' : ' = '}\`${mdEscape(String(d.duplicateOf).slice(0, 90))}\``);
    }
    md.push('');
  }
  if (!primary.withinSection.length) md.push('_None detected._\n');

  md.push('## Cross-section exact text duplicates (RESUME_DATA)');
  md.push('');
  if (!primary.crossSectionExact.length) {
    md.push('_No identical normalized strings across sections._');
  } else {
    md.push('| Text | Sections |');
    md.push('|------|----------|');
    for (const row of primary.crossSectionExact) {
      md.push(`| ${mdEscape(row.text.slice(0, 100))} | ${row.sections.join(', ')} |`);
    }
  }
  md.push('');

  md.push('## Notable duplication patterns');
  md.push('');
  md.push('| Pattern | Example | Sections |');
  md.push('|---------|---------|----------|');
  const patterns = [
    ['Client brand in clients + tools', 'Adobe', 'clients, tools'],
    ['McCann internship line → client name', 'McCann G. Agency', 'clients (not experience)'],
    ['Title OCR garbage in tools', 'v3 2 GRADRIC designer & Illustrator', 'tools (+ identity title cleaned)'],
    ['Packaging fragments repeated', 'packaging. poster / packaging.)', 'skills (within-section)'],
    ['Créapole/LISAA lines in education + unsorted (structured stage)', 'LISAA / Créapole OCR lines', 'education, unsorted'],
    ['Freelance line in experience + unsorted (structured stage)', 'src-5 career line', 'experience, unsorted'],
  ];
  for (const [p, ex, sec] of patterns) {
    md.push(`| ${p} | ${ex} | ${sec} |`);
  }
  md.push('');

  md.push('## Section item counts (RESUME_DATA)');
  md.push('');
  md.push('| Section | Items |');
  md.push('|---------|------:|');
  for (const sec of SECTIONS) {
    md.push(`| ${sec} | ${(primary.payloads[sec] || []).length} |`);
  }
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('DUPLICATION_REPORT.md written:', OUT_PATH);
  console.log({
    resumeDataMultiSection: primary.multiSection.length,
    structuredMultiSection: audits[1]?.multiSection.length,
    cvDataMultiSection: cvMulti.length,
    withinSection: primary.withinSection.length,
    crossSectionExact: primary.crossSectionExact.length,
  });
}

main();
