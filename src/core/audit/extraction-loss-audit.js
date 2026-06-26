/**
 * HIRELY P0 — Extraction loss audit.
 * Traces RAW → OCR → Normalizer → Section parser → Resume builder → finalResumeData → Renderer.
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildExtractionArchiveStage } from '../extraction/stages/extraction-archive.js';
import { extractPlainTextEnterprise } from '../extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../pipeline/hirely-import.js';
import { buildFinalResumeData } from '../validation/final-resume-contract.js';
import { normalizeResumeData, resumeDataToCvData } from '../resume-data.js';
import { cleanExtraction } from '../parsing/rich-parser.js';
import { splitLinesBySectionAnchors } from '../parsing/section-anchor-extract.js';
import {
  detectFieldsFromText,
  countFromStructured,
  countFromResumeData,
  PIPELINE_FIELDS,
} from './pipeline-data-loss.js';
import { scoreTemplateCompletenessLock } from '../../ui/templates/template-completeness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');

export const EXTRACTION_LOSS_STAGES = Object.freeze([
  'RAW',
  'OCR',
  'NORMALIZER',
  'SECTION_PARSER',
  'RESUME_BUILDER',
  'FINAL_RESUME_DATA',
  'RENDERER',
]);

const STRUCTURED_FIELDS = Object.freeze([
  'name',
  'experience',
  'education',
  'clients',
  'projects',
  'skills',
]);

function listCount(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.filter((x) => {
    if (x == null) return false;
    if (typeof x === 'string') return String(x).trim().length > 0;
    if (typeof x === 'object') {
      return !!(x.role || x.company || x.school || x.degree || x.title || (x.bullets || []).length);
    }
    return false;
  }).length;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) => k,
    cvBlock: (t, h) => h || '',
    cvSkillsHtml: (s) => `<p class="cvSkillLine">${s.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

/** @param {string} text */
export function countDetectedSections(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const sections = splitLinesBySectionAnchors(lines);
  return Object.keys(sections).filter((k) => k !== 'top' && (sections[k] || []).length > 0).length;
}

/** @param {object} counts */
export function buildStageSnapshot(counts = {}) {
  const experienceCount = counts.experience ?? counts.experienceCount ?? 0;
  const educationCount = counts.education ?? counts.educationCount ?? 0;
  const clientCount = counts.clients ?? counts.clientCount ?? 0;
  const projectCount = counts.projects ?? counts.projectCount ?? 0;
  const skillCount = counts.skills ?? counts.skillCount ?? 0;

  return {
    rawTextLength: counts.rawTextLength ?? 0,
    normalizedTextLength: counts.normalizedTextLength ?? 0,
    detectedSections: counts.detectedSections ?? 0,
    experienceCount,
    educationCount,
    clientCount,
    projectCount,
    skillCount,
    finalRenderedCount:
      counts.finalRenderedCount ??
      experienceCount +
        educationCount +
        clientCount +
        projectCount +
        skillCount +
        (counts.hasName ? 1 : 0),
    hasName: Boolean(counts.hasName || counts.name),
    tools: counts.tools ?? 0,
    languages: counts.languages ?? 0,
  };
}

/** Weighted structured content score for retention math. */
export function structuredContentScore(snapshot) {
  if (!snapshot) return 0;
  return (
    (snapshot.hasName ? 2 : 0) +
    (snapshot.experienceCount || 0) +
    (snapshot.educationCount || 0) +
    (snapshot.clientCount || 0) +
    (snapshot.projectCount || 0) +
    (snapshot.skillCount || 0) +
    Math.round((snapshot.tools || 0) * 0.5) +
    Math.round((snapshot.languages || 0) * 0.5)
  );
}

export function retentionPct(fromScore, toScore) {
  const from = Number(fromScore) || 0;
  const to = Number(toScore) || 0;
  if (from === 0 && to === 0) return 100;
  if (from === 0) return to > 0 ? 100 : 0;
  return Math.min(100, Math.round((to / from) * 100));
}

function textSnapshot(text, extra = {}) {
  const raw = String(text || '').trim();
  const detected = detectFieldsFromText(raw);
  return buildStageSnapshot({
    rawTextLength: raw.length,
    normalizedTextLength: raw.length,
    detectedSections: countDetectedSections(raw),
    experienceCount: detected.experience,
    educationCount: detected.education,
    clientCount: detected.clients,
    projectCount: detected.projects,
    skillCount: detected.skills,
    hasName: detected.name > 0,
    tools: detected.tools,
    languages: detected.languages,
    ...extra,
  });
}

function structuredSnapshot(sr, cleanedText = '') {
  const counts = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, countFromStructured(sr, f)]));
  return buildStageSnapshot({
    rawTextLength: String(cleanedText).length,
    normalizedTextLength: String(cleanedText).length,
    detectedSections: countDetectedSections(cleanedText),
    experienceCount: counts.experience,
    educationCount: counts.education,
    clientCount: counts.clients,
    projectCount: counts.projects,
    skillCount: counts.skills,
    hasName: counts.name > 0,
    tools: counts.tools,
    languages: counts.languages,
  });
}

function resumeDataSnapshot(rd, cleanedText = '') {
  const counts = Object.fromEntries(PIPELINE_FIELDS.map((f) => [f, countFromResumeData(rd, f)]));
  return buildStageSnapshot({
    rawTextLength: String(cleanedText).length,
    normalizedTextLength: String(cleanedText).length,
    detectedSections: countDetectedSections(cleanedText),
    experienceCount: counts.experience,
    educationCount: counts.education,
    clientCount: counts.clients,
    projectCount: counts.projects,
    skillCount: counts.skills,
    hasName: counts.name > 0,
    tools: counts.tools,
    languages: counts.languages,
  });
}

function rendererSnapshot(html, frd, templateLock) {
  const base = resumeDataSnapshot(frd);
  const visible = templateLock?.sections || {};
  const renderedExp = visible.experiences?.visible ?? base.experienceCount;
  const renderedEdu = visible.education?.visible ?? base.educationCount;
  const renderedClients = visible.clients?.visible ?? base.clientCount;
  const renderedProjects = visible.projects?.visible ?? base.projectCount;
  const renderedSkills = visible.skills?.visible ?? base.skillCount;

  return buildStageSnapshot({
    ...base,
    experienceCount: renderedExp,
    educationCount: renderedEdu,
    clientCount: renderedClients,
    projectCount: renderedProjects,
    skillCount: renderedSkills,
    finalRenderedCount:
      renderedExp +
      renderedEdu +
      renderedClients +
      renderedProjects +
      renderedSkills +
      (base.hasName && /cvName/.test(html) ? 1 : 0),
    htmlBytes: html.length,
  });
}

function fieldDeltas(fromSnap, toSnap) {
  const rows = [];
  const fields = [
    ['name', 'hasName', 'hasName'],
    ['experience', 'experienceCount', 'experienceCount'],
    ['education', 'educationCount', 'educationCount'],
    ['clients', 'clientCount', 'clientCount'],
    ['projects', 'projectCount', 'projectCount'],
    ['skills', 'skillCount', 'skillCount'],
  ];
  for (const [label, fromKey, toKey] of fields) {
    const input = fromSnap[fromKey] ? 1 : fromSnap[fromKey] ?? fromSnap[toKey] ?? 0;
    const fromVal = label === 'name' ? (fromSnap.hasName ? 1 : 0) : fromSnap[toKey] ?? 0;
    const toVal = label === 'name' ? (toSnap.hasName ? 1 : 0) : toSnap[toKey] ?? 0;
    const dropped = Math.max(0, fromVal - toVal);
    if (dropped > 0 || fromVal !== toVal) {
      rows.push({
        field: label,
        input: fromVal,
        output: toVal,
        dropped,
        lossPct: fromVal ? Math.round((dropped / fromVal) * 100) : 0,
      });
    }
  }
  return rows.filter((r) => r.dropped > 0).sort((a, b) => b.dropped - a.dropped);
}

function buildRetentionChain(stages) {
  const chain = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const curr = stages[i];
    const fromScore = structuredContentScore(prev.snapshot);
    const toScore = structuredContentScore(curr.snapshot);
    chain.push({
      from: prev.id,
      to: curr.id,
      label: `${prev.label} → ${curr.label}`,
      retentionPct: retentionPct(fromScore, toScore),
      textRetentionPct: retentionPct(prev.snapshot.rawTextLength, curr.snapshot.normalizedTextLength || curr.snapshot.rawTextLength),
      fromScore,
      toScore,
      fieldDrops: fieldDeltas(prev.snapshot, curr.snapshot),
    });
  }
  return chain;
}

function identifyLossHotspots(chain, parserStage, finalStage) {
  const hotspots = [];
  for (const link of chain) {
    if (link.retentionPct < 100 && link.fieldDrops.length) {
      for (const drop of link.fieldDrops) {
        hotspots.push({
          stage: link.label,
          field: drop.field,
          input: drop.input,
          output: drop.output,
          dropped: drop.dropped,
          lossPct: drop.lossPct,
        });
      }
    }
  }

  const parserScore = structuredContentScore(parserStage?.snapshot);
  const finalScore = structuredContentScore(finalStage?.snapshot);
  const upstreamRetention = retentionPct(parserScore, finalScore);

  return {
    hotspots: hotspots.slice(0, 24),
    upstreamRetentionPct: upstreamRetention,
    parserScore,
    finalScore,
  };
}

/**
 * @param {string} rawText
 * @param {{ templateId?: string, extractionMethod?: string, label?: string }} [opts]
 */
export async function auditExtractionLoss(rawText, opts = {}) {
  const templateId = opts.templateId || 'creative-portfolio';
  const extractionMethod = opts.extractionMethod || 'paste';
  const label = opts.label || 'cv';
  const raw = String(rawText || '').trim();

  const enterprise = extractPlainTextEnterprise(raw, extractionMethod);
  const archive = buildExtractionArchiveStage(enterprise, raw);
  const normalizedClean = cleanExtraction(archive.cleanedText || raw);

  const pipe = await runProductionExtractionPipeline(raw, {
    trusted: true,
    forceContinue: true,
    canonicalImport: true,
    extractionMethod,
  });
  const importResult = productionToHirelyImportResult(pipe);
  const cleanedText = String(pipe.cleanedText || importResult.cleanedText || normalizedClean).trim();

  const normalizedRd = normalizeResumeData(importResult.resumeData, { skipSanitize: true });
  const reviewQueue = [...(importResult.reviewQueue || [])];
  const built = buildFinalResumeData(importResult.resumeData, { existingReview: reviewQueue });
  const frd = built.finalResumeData;

  const cv = frd
    ? {
        ...resumeDataToCvData(frd, { skipNormalize: true }),
        _fromFinalResumeData: true,
        _pendingReview: reviewQueue,
      }
    : null;

  const T = loadTemplates();
  const html = cv ? T.render(cv, templateId) : '';
  const templateLock = scoreTemplateCompletenessLock(html, frd);

  const stageDefs = [
    {
      id: 'RAW',
      label: 'RAW',
      snapshot: textSnapshot(raw, { rawTextLength: raw.length, normalizedTextLength: raw.length }),
    },
    {
      id: 'OCR',
      label: 'OCR',
      snapshot: textSnapshot(archive.rawExtraction || raw, {
        rawTextLength: raw.length,
        normalizedTextLength: String(archive.rawExtraction || raw).length,
      }),
    },
    {
      id: 'NORMALIZER',
      label: 'Normalizer',
      snapshot: textSnapshot(cleanedText, {
        rawTextLength: raw.length,
        normalizedTextLength: cleanedText.length,
      }),
    },
    {
      id: 'SECTION_PARSER',
      label: 'Section parser',
      snapshot: structuredSnapshot(pipe.structuredResume, cleanedText),
    },
    {
      id: 'RESUME_BUILDER',
      label: 'Resume builder',
      snapshot: resumeDataSnapshot(normalizedRd, cleanedText),
    },
    {
      id: 'FINAL_RESUME_DATA',
      label: 'finalResumeData',
      snapshot: resumeDataSnapshot(frd, cleanedText),
    },
    {
      id: 'RENDERER',
      label: 'Renderer',
      snapshot: rendererSnapshot(html, frd, templateLock),
    },
  ];

  const retentionChain = buildRetentionChain(stageDefs);
  const upstreamStage =
    stageDefs.find((s) => s.id === 'RESUME_BUILDER') || stageDefs.find((s) => s.id === 'SECTION_PARSER');
  const finalStage = stageDefs.find((s) => s.id === 'FINAL_RESUME_DATA');
  const lossAnalysis = identifyLossHotspots(retentionChain, upstreamStage, finalStage);

  const uncertainCompanies = (frd?.experiences || []).filter((e) =>
    /company\s+à\s+confirmer|company\s+a\s+confirmer/i.test(String(e?.company || ''))
  ).length;

  const metadata = {
    creativeMode: pipe.structuredResume?.metadata?.creativeCvMode?.active ?? false,
    designerMode: pipe.structuredResume?.metadata?.designerCvMode?.active ?? false,
    clientDetectionSkipped: !pipe.structuredResume?.metadata?.clientDetection,
    reviewQueueSize: reviewQueue.length + (built.reviewItems || []).length,
    uncertainCompanyCount: uncertainCompanies,
    templateLockScore: templateLock.score,
  };

  const acceptance = {
    upstreamStage: upstreamStage?.id || 'RESUME_BUILDER',
    finalVsUpstreamRetentionPct: lossAnalysis.upstreamRetentionPct,
    finalVsParserRetentionPct: lossAnalysis.upstreamRetentionPct,
    pass: lossAnalysis.upstreamRetentionPct >= 90,
    threshold: 90,
  };

  return {
    label,
    templateId,
    extractionMethod,
    stages: stageDefs.map((s) => ({ id: s.id, label: s.label, metrics: s.snapshot })),
    retentionChain,
    lossAnalysis,
    metadata,
    acceptance,
    verdict: acceptance.pass ? 'PASS' : 'FAIL',
  };
}

/** @param {object[]} audits */
export function summarizeExtractionLossAudits(audits = []) {
  const failing = audits.filter((a) => !a.acceptance.pass);
  return {
    total: audits.length,
    passed: audits.length - failing.length,
    failed: failing.length,
    minRetentionPct: Math.min(...audits.map((a) => a.acceptance.finalVsUpstreamRetentionPct)),
    avgRetentionPct: Math.round(
      audits.reduce((s, a) => s + a.acceptance.finalVsUpstreamRetentionPct, 0) / Math.max(audits.length, 1)
    ),
    pass: failing.length === 0,
  };
}

function pctBar(pct) {
  const n = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = Math.round(n / 5);
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${n}%`;
}

/** @param {object} audit */
export function formatExtractionLossAuditSection(audit) {
  const lines = [];
  lines.push(`### ${audit.label}`);
  lines.push('');
  lines.push(`**Verdict:** ${audit.verdict} · finalResumeData vs ${audit.acceptance.upstreamStage} retention: **${audit.acceptance.finalVsUpstreamRetentionPct}%** (threshold ${audit.acceptance.threshold}%)`);
  lines.push('');
  lines.push('| Stage | rawText | normText | sections | exp | edu | clients | projects | skills | structured |');
  lines.push('|-------|--------:|---------:|---------:|----:|----:|--------:|---------:|-------:|-----------:|');
  for (const stage of audit.stages) {
    const m = stage.metrics;
    const score = structuredContentScore(m);
    lines.push(
      `| ${stage.label} | ${m.rawTextLength} | ${m.normalizedTextLength} | ${m.detectedSections} | ${m.experienceCount} | ${m.educationCount} | ${m.clientCount} | ${m.projectCount} | ${m.skillCount} | ${score} |`
    );
  }
  lines.push('');
  lines.push('**Retention chain (structured content)**');
  lines.push('');
  for (const link of audit.retentionChain) {
    lines.push(`- ${link.label}: ${pctBar(link.retentionPct)}`);
    if (link.fieldDrops.length) {
      for (const d of link.fieldDrops.slice(0, 4)) {
        lines.push(`  - ${d.field}: ${d.input} → ${d.output} (−${d.dropped}, ${d.lossPct}% loss)`);
      }
    }
  }
  if (audit.lossAnalysis.hotspots.length) {
    lines.push('');
    lines.push('**Primary loss hotspots**');
    for (const h of audit.lossAnalysis.hotspots.slice(0, 8)) {
      lines.push(`- ${h.stage}: **${h.field}** ${h.input} → ${h.output}`);
    }
  }
  if (audit.metadata.uncertainCompanyCount) {
    lines.push(`- Uncertain company placeholders: ${audit.metadata.uncertainCompanyCount}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** @param {object[]} audits @param {object} summary */
export function formatExtractionLossAuditMarkdown(audits, summary) {
  const lines = [
    '# HIRELY P0 — Extraction Loss Audit',
    '',
    `**Result:** ${summary.pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Problem',
    '',
    'Real CVs were losing 50–80% of structured content between PDF extraction and `finalResumeData`.',
    'Identity, clients, projects, and experience companies were dropped or downgraded across pipeline stages.',
    '',
    '## Acceptance',
    '',
    '| Gate | Threshold | Actual |',
    '|------|-----------|--------|',
    `| finalResumeData retains resumeData (upstream) content | ≥ 90% | ${summary.minRetentionPct}% min / ${summary.avgRetentionPct}% avg |`,
    `| Fixtures passing | 100% | ${summary.passed}/${summary.total} |`,
    '',
    '## Pipeline stages audited',
    '',
    '```',
    'RAW → OCR → Normalizer → Section parser → Resume builder → finalResumeData → Renderer',
    '```',
    '',
    '## Metrics per stage',
    '',
    '- `rawTextLength` / `normalizedTextLength`',
    '- `detectedSections`',
    '- `experienceCount`, `educationCount`, `clientCount`, `projectCount`, `skillCount`',
    '- `finalRenderedCount` (renderer-visible structured items)',
    '',
    '## Known loss vectors (code)',
    '',
    '| Vector | Location | Symptom |',
    '|--------|----------|---------|',
    '| Client/project engines gated on creative mode | `section-engine-v2.js` | Clients & projects missing on non-creative CVs with explicit sections |',
    '| Semantic confidence gate | `semantic-confidence-gate.js` | Clients/projects routed to review queue |',
    '| final-resume cleanup | `final-resume-data-cleanup.js` | Parser labels & garbage lines stripped |',
    '| Experience header fallback | `experience-reconstruction-engine-v2.js` | `Company à confirmer` placeholder |',
    '| Unsorted recovery | `section-engine-v2.js` | clients/projects not in `RECOVERABLE_SECTIONS` |',
    '',
    '## Fixture results',
    '',
  ];

  for (const audit of audits) {
    lines.push(formatExtractionLossAuditSection(audit));
  }

  lines.push('## Retention summary');
  lines.push('');
  lines.push('| Fixture | resumeData → finalResumeData | Verdict |');
  lines.push('|---------|------------------------------|---------|');
  for (const audit of audits) {
    lines.push(
      `| ${audit.label} | ${audit.acceptance.finalVsUpstreamRetentionPct}% | ${audit.verdict} |`
    );
  }
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run test:extraction-loss-audit');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}
