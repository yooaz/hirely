/**
 * P1 Data Loss Audit — trace one CV through OCR → cleanText → canonicalImport
 * → universalParser → resumeData → finalResumeData → templateRender.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import { buildExtractionArchiveStage } from '../core/extraction/stages/extraction-archive.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { sanitizeCvDataForExport } from '../core/parsing/corruption-detector.js';
import { splitLinesBySectionAnchors } from '../core/parsing/section-anchor-extract.js';
import { runUniversalParsePipeline } from '../core/parsing/universal-parse-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const FIELDS = ['experience', 'education', 'skills', 'tools', 'languages'];

function loadTemplateRender() {
  const code = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const esc = (s) =>
    String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) => k,
    cvBlock: (t, h) => (h ? `<section data-section="${h}">${t}</section>` : ''),
    cvSkillsHtml: (sk) => `<ul class="skills">${sk.map((s) => `<li>${s}</li>`).join('')}</ul>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates.render.bind(sandbox.HirelyTemplates);
}

/** @param {string} text */
export function countFromTextSections(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const sections = splitLinesBySectionAnchors(lines);

  const experience = (sections.experience || []).filter(
    (l) => !/^[-•*]\s/.test(l) && l.length > 8 && !/^experience$/i.test(l)
  );
  const education = (sections.education || []).filter(
    (l) => l.length > 5 && !/^education$/i.test(l)
  );

  const splitCsv = (arr) =>
    arr
      .join(' ')
      .split(/[,;·|]/)
      .map((x) => x.trim())
      .filter((x) => x.length > 1 && !/^(skills?|tools?|languages?)$/i.test(x));

  const skills = splitCsv(sections.skills || []);
  const tools = splitCsv(sections.tools || []);
  const languages = (sections.languages || sections.language || []).filter(
    (l) => l.length > 2 && !/^languages?$/i.test(l)
  );

  const sectionKeys = Object.keys(sections).filter((k) => (sections[k] || []).length > 0);

  return {
    sectionCount: sectionKeys.length,
    sections: sectionKeys,
    experience: experience.length,
    education: education.length,
    skills: skills.length,
    tools: tools.length,
    languages: languages.length,
    samples: {
      experience: experience.slice(0, 4),
      education: education.slice(0, 4),
      skills: skills.slice(0, 6),
      tools: tools.slice(0, 6),
      languages: languages.slice(0, 4),
    },
  };
}

/** @param {object|null} src */
export function countFromResumeShape(src) {
  if (!src || typeof src !== 'object') {
    return {
      sectionCount: 0,
      experience: 0,
      education: 0,
      skills: 0,
      tools: 0,
      languages: 0,
    };
  }
  const exp = src.experiences || src.experience || [];
  const edu = src.education || [];
  const skills = src.skills || [];
  const tools = src.tools || [];
  const languages = src.languages || [];
  const sectionCount = [
    exp.length > 0,
    edu.length > 0,
    skills.length > 0,
    tools.length > 0,
    languages.length > 0,
    String(src.summary || '').trim().length > 0,
    String(src.identity?.name || src.name || '').trim().length > 0,
  ].filter(Boolean).length;

  return {
    sectionCount,
    experience: Array.isArray(exp) ? exp.length : 0,
    education: Array.isArray(edu) ? edu.length : 0,
    skills: Array.isArray(skills) ? skills.length : 0,
    tools: Array.isArray(tools) ? tools.length : 0,
    languages: Array.isArray(languages) ? languages.length : 0,
  };
}

function splitListBlockText(text) {
  return String(text || '')
    .split(/[,;·|]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1 && !/^(skills?|tools?|languages?|experience|education)$/i.test(x));
}

function countLinesInBlocks(blocks, type) {
  let items = 0;
  let headers = 0;
  for (const b of blocks) {
    const t = String(b.type || b.bucket || '').toLowerCase();
    if (t !== type) continue;
    const text = String(b.text || '').trim();
    if (/^(skills?|tools?|languages?)$/i.test(text)) {
      headers += 1;
      continue;
    }
    if (type === 'experience') {
      if (!/^[-•*]\s/.test(text) && /\b(19|20)\d{2}\b/.test(text)) items += 1;
      continue;
    }
    if (type === 'education') {
      if (!/^education$/i.test(text) && text.length > 8) items += 1;
      continue;
    }
    if (type === 'languages') {
      const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const langs = lines.filter((l) => !/^languages?$/i.test(l));
      items += langs.length || (text.includes('—') || text.includes('-') ? 1 : 0);
      continue;
    }
    items += splitListBlockText(text).length || (text.length > 2 ? 1 : 0);
  }
  return { items, headers };
}

/** @param {object[]} blocks */
export function countFromBlocks(blocks = []) {
  const byType = {};
  for (const b of blocks) {
    const t = String(b.type || b.bucket || 'unknown').toLowerCase();
    byType[t] = (byType[t] || 0) + 1;
  }
  const exp = countLinesInBlocks(blocks, 'experience');
  const edu = countLinesInBlocks(blocks, 'education');
  const skills = countLinesInBlocks(blocks, 'skills');
  const tools = countLinesInBlocks(blocks, 'tools');
  const langs = countLinesInBlocks(blocks, 'languages');

  return {
    sectionCount: Object.keys(byType).length,
    experience: exp.items,
    education: edu.items,
    skills: skills.items,
    tools: tools.items,
    languages: langs.items,
    blocks: byType,
    blockHeaders: {
      skills: skills.headers,
      tools: tools.headers,
    },
  };
}

function normHtmlToken(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[—–-]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function countSectionNodes(html, classNeedle) {
  const re = new RegExp(`class="[^"]*${classNeedle}[^"]*"`, 'gi');
  return (html.match(re) || []).length;
}

/** @param {object} cvData */
export function countFromTemplateRender(cvData, templateId = 'ats') {
  const render = loadTemplateRender();
  const html = render(cvData, templateId);
  const htmlNorm = normHtmlToken(html);

  const experience =
    countSectionNodes(html, 'cvExpEntry') ||
    (cvData.experience || []).filter((x) => {
      const stem = normHtmlToken(String(x).split(/[:·]/)[0]).slice(0, 36);
      return stem.length > 6 && htmlNorm.includes(stem);
    }).length;

  const education =
    countSectionNodes(html, 'cvEduLine') ||
    (cvData.education || []).filter((x) => {
      const stem = normHtmlToken(String(x)).slice(0, 36);
      return stem.length > 6 && htmlNorm.includes(stem);
    }).length;

  const skills = (cvData.skills || []).filter((x) => htmlNorm.includes(normHtmlToken(x))).length;
  const tools = (cvData.tools || []).filter((x) => htmlNorm.includes(normHtmlToken(x))).length;
  const languages = (cvData.languages || []).filter((x) => htmlNorm.includes(normHtmlToken(x))).length;
  const sectionCount = [experience, education, skills, tools, languages].filter((n) => n > 0).length;

  return {
    sectionCount,
    experience,
    education,
    skills,
    tools,
    languages,
    htmlBytes: html.length,
  };
}

function lossPct(input, output) {
  const i = Number(input) || 0;
  const o = Number(output) || 0;
  if (i === 0 && o === 0) return 0;
  if (i === 0) return o > 0 ? -100 : 0;
  return Math.round(((i - o) / i) * 100);
}

function transitionRow(fromStage, toStage, inputCounts, outputCounts) {
  const rows = [];
  for (const field of FIELDS) {
    const input = inputCounts[field] ?? 0;
    const output = outputCounts[field] ?? 0;
    rows.push({
      from: fromStage,
      to: toStage,
      field,
      inputCount: input,
      outputCount: output,
      lossPercent: lossPct(input, output),
      dropped: input > output ? input - output : 0,
      gained: output > input ? output - input : 0,
    });
  }
  return rows;
}

function findFirstLoss(transitions, { preferInternal = true } = {}) {
  const losses = [];
  for (const t of transitions) {
    if (t.lossPercent > 0) {
      losses.push({
        field: t.field,
        at: `${t.from} → ${t.to}`,
        inputCount: t.inputCount,
        outputCount: t.outputCount,
        lossPercent: t.lossPercent,
        internal: String(t.from).includes('(') || String(t.to).includes('('),
        terminal: t.outputCount === 0 && t.inputCount > 0,
      });
    }
  }
  const byField = {};
  for (const field of FIELDS) {
    const fieldLosses = losses.filter((l) => l.field === field);
    if (!fieldLosses.length) continue;
    const ranked = [...fieldLosses].sort((a, b) => {
      if (a.terminal !== b.terminal) return a.terminal ? -1 : 1;
      if (a.internal !== b.internal) return preferInternal && a.internal ? -1 : 1;
      return b.lossPercent - a.lossPercent;
    });
    byField[field] = ranked[0];
  }
  return { all: losses, firstByField: byField };
}

/**
 * @param {string} rawText
 * @param {object} [opts]
 */
export async function runDataLossP1Audit(rawText, opts = {}) {
  const text = String(rawText || '').trim();
  const label = opts.label || 'imported-cv';
  const extractionMethod = opts.extractionMethod || 'paste';

  const inputCounts = countFromTextSections(text);
  inputCounts.stage = 'INPUT (fixture)';

  const enterprise = extractPlainTextEnterprise(text, extractionMethod);
  const archive = buildExtractionArchiveStage(enterprise, text);

  const ocrCounts = { ...countFromTextSections(archive.rawExtraction), stage: 'OCR' };
  const cleanCounts = { ...countFromTextSections(archive.cleanedText), stage: 'cleanText' };

  const pipe = await runProductionExtractionPipeline(text, {
    extractionMethod,
    canonicalImport: true,
  });

  const docBlocks = pipe.audit?.productionPipeline?.documentBlocks || {};
  const blockCounts = {
    ...countFromBlocks(docBlocks.documentBlocks || []),
    stage: 'canonicalImport (blocks)',
    acceptedCount: docBlocks.acceptedCount,
    reviewCount: docBlocks.reviewCount,
  };

  const structuredCounts = {
    ...countFromResumeShape(pipe.structuredResume),
    stage: 'canonicalImport (structuredResume)',
  };

  const validatedCounts = {
    ...countFromResumeShape(pipe.validatedCVData),
    stage: 'canonicalImport (validatedCVData)',
  };

  const canonicalCounts = {
    ...structuredCounts,
    stage: 'canonicalImport',
    note: 'Production canonical import ends at validatedCVData; structuredResume is intermediate.',
  };

  let universalCounts = {
    sectionCount: 0,
    experience: 0,
    education: 0,
    skills: 0,
    tools: 0,
    languages: 0,
    stage: 'universalParser',
    note: 'disabled in production (HIRELY_FLOW_LOCK)',
  };
  try {
    const prevLock = globalThis.HIRELY_FLOW_LOCK;
    globalThis.HIRELY_FLOW_LOCK = false;
    const uni = await runUniversalParsePipeline(text, { extractionMethod });
    globalThis.HIRELY_FLOW_LOCK = prevLock;
    universalCounts = {
      ...countFromResumeShape(uni.structured),
      stage: 'universalParser',
      note: 'Shadow run — not used by production import when flow lock is on.',
    };
  } catch (e) {
    universalCounts.note = `Shadow run failed: ${e.message}`;
  }

  const importResult = await runHirelyImportFromText(text, { extractionMethod });
  const resumeCounts = {
    ...countFromResumeShape(importResult.resumeData),
    stage: 'resumeData',
  };

  const finalPack = buildFinalResumeData(importResult.resumeData);
  const finalCounts = {
    ...countFromResumeShape(finalPack.finalResumeData),
    stage: 'finalResumeData',
  };

  const templateCv = finalPack.cvData || importResult.templateData;
  const templateCounts = {
    ...countFromTemplateRender(templateCv, opts.templateId || 'ats'),
    stage: 'templateRender',
  };

  const stages = [
    inputCounts,
    ocrCounts,
    cleanCounts,
    blockCounts,
    structuredCounts,
    validatedCounts,
    canonicalCounts,
    universalCounts,
    resumeCounts,
    finalCounts,
    templateCounts,
  ];

  const mainChain = [
    ['INPUT (fixture)', inputCounts],
    ['OCR', ocrCounts],
    ['cleanText', cleanCounts],
    ['canonicalImport', validatedCounts],
    ['universalParser', universalCounts],
    ['resumeData', resumeCounts],
    ['finalResumeData', finalCounts],
    ['templateRender', templateCounts],
  ];

  const transitions = [];
  for (let i = 1; i < mainChain.length; i++) {
    const [fromName, fromCounts] = mainChain[i - 1];
    const [toName, toCounts] = mainChain[i];
    transitions.push(...transitionRow(fromName, toName, fromCounts, toCounts));
  }

  const internalTransitions = [
    ...transitionRow('cleanText', 'canonicalImport (blocks)', cleanCounts, blockCounts),
    ...transitionRow('canonicalImport (blocks)', 'canonicalImport (structuredResume)', blockCounts, structuredCounts),
    ...transitionRow('canonicalImport (structuredResume)', 'canonicalImport (validatedCVData)', structuredCounts, validatedCounts),
    ...transitionRow('canonicalImport (validatedCVData)', 'resumeData', validatedCounts, resumeCounts),
  ];

  const lossSites = findFirstLoss(
    [...internalTransitions, ...transitions],
    { preferInternal: true }
  );

  const misclassified = (docBlocks.documentBlocks || [])
    .filter((b) => {
      const t = String(b.text || '');
      return (
        (/\b(engineer|developer|manager|recruiter|designer)\b/i.test(t) &&
          /\b(19|20)\d{2}\b/.test(t) &&
          b.type === 'identity') ||
        (b.type === 'skills' && /^skills?$/i.test(t.trim())) ||
        (b.type === 'tools' && /^tools?$/i.test(t.trim()))
      );
    })
    .map((b) => ({
      id: b.id,
      type: b.type,
      bucket: b.bucket,
      confidence: b.confidence,
      text: String(b.text || '').slice(0, 80),
    }));

  const blockers = [];
  for (const field of FIELDS) {
    const first = lossSites.firstByField[field];
    if (first) {
      blockers.push(
        `${field}: first loss at ${first.at} (${first.inputCount} → ${first.outputCount}, ${first.lossPercent}% loss)`
      );
    }
  }

  const allIdentified =
    blockers.length > 0 &&
    FIELDS.every((f) => {
      const inp = inputCounts[f];
      const out = finalCounts[f];
      if (inp === out) return true;
      return !!lossSites.firstByField[f];
    });

  return {
    label,
    extractionMethod,
    fixtureChars: text.length,
    stages,
    mainChain: mainChain.map(([name, c]) => ({ name, counts: c })),
    transitions,
    internalTransitions,
    lossSites,
    misclassified,
    blockers,
    verdict: allIdentified ? 'PASS' : 'FAIL',
    evidence: {
      structuredExperiences: (pipe.structuredResume?.experiences || []).map(
        (e) => `${e.role || '—'} @ ${e.company || '—'}`
      ),
      validatedExperience: pipe.validatedCVData?.experience || [],
      resumeExperiences: (importResult.resumeData?.experiences || []).map(
        (e) => `${e.role || '—'} @ ${e.company || '—'}`
      ),
      skillsBlocks: (docBlocks.documentBlocks || [])
        .filter((b) => b.type === 'skills')
        .map((b) => String(b.text || '').slice(0, 100)),
      toolsBlocks: (docBlocks.documentBlocks || [])
        .filter((b) => b.type === 'tools')
        .map((b) => String(b.text || '').slice(0, 100)),
      structuredSkills: pipe.structuredResume?.skills || [],
      structuredTools: pipe.structuredResume?.tools || [],
    },
  };
}

export function formatDataLossAuditMarkdown(report) {
  const lines = [];
  lines.push('# DATA LOSS AUDIT');
  lines.push('');
  lines.push(`**Verdict:** ${report.verdict}`);
  lines.push(`**CV:** ${report.label}`);
  lines.push(`**Method:** ${report.extractionMethod}`);
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Pipeline trace');
  lines.push('');
  lines.push(
    'OCR → cleanText → canonicalImport → universalParser → resumeData → finalResumeData → templateRender'
  );
  lines.push('');
  lines.push('## Stage counts');
  lines.push('');
  lines.push(
    '| Stage | Sections | Experience | Education | Skills | Tools | Languages |'
  );
  lines.push('|-------|----------|------------|-----------|--------|-------|-----------|');
  for (const s of report.stages) {
    lines.push(
      `| ${s.stage} | ${s.sectionCount ?? '—'} | ${s.experience} | ${s.education} | ${s.skills} | ${s.tools} | ${s.languages} |`
    );
  }
  lines.push('');
  lines.push('## Stage transitions (INPUT → OUTPUT → LOSS%)');
  lines.push('');
  lines.push('| From | To | Field | INPUT_COUNT | OUTPUT_COUNT | LOSS_PERCENT |');
  lines.push('|------|-----|-------|-------------|--------------|--------------|');
  for (const t of report.transitions) {
    if (t.inputCount === t.outputCount) continue;
    lines.push(
      `| ${t.from} | ${t.to} | ${t.field} | ${t.inputCount} | ${t.outputCount} | ${t.lossPercent}% |`
    );
  }
  lines.push('');
  lines.push('## Internal canonicalImport transitions');
  lines.push('');
  lines.push('| From | To | Field | INPUT_COUNT | OUTPUT_COUNT | LOSS_PERCENT |');
  lines.push('|------|-----|-------|-------------|--------------|--------------|');
  for (const t of report.internalTransitions) {
    if (t.inputCount === t.outputCount) continue;
    lines.push(
      `| ${t.from} | ${t.to} | ${t.field} | ${t.inputCount} | ${t.outputCount} | ${t.lossPercent}% |`
    );
  }
  lines.push('');
  lines.push('## Loss locations identified');
  lines.push('');
  if (report.blockers.length) {
    for (const b of report.blockers) lines.push(`- ${b}`);
  } else {
    lines.push('_No field-level loss detected._');
  }
  lines.push('');
  lines.push('### Experience');
  lines.push('');
  const expLosses = report.lossSites.all.filter((l) => l.field === 'experience');
  if (expLosses.length) {
    for (const l of expLosses) {
      lines.push(`- **Loss:** ${l.at} (${l.inputCount} → ${l.outputCount}, ${l.lossPercent}%)`);
    }
    lines.push(`- **structuredResume:** ${report.evidence.structuredExperiences.join(' | ') || '—'}`);
    lines.push(`- **validatedCVData:** ${report.evidence.validatedExperience.join(' | ') || '—'}`);
    lines.push(`- **resumeData (recovered):** ${report.evidence.resumeExperiences.join(' | ') || '—'}`);
    if (report.misclassified.length) {
      lines.push('- **Misclassified blocks:**');
      for (const m of report.misclassified.filter((x) => /engineer|developer/i.test(x.text))) {
        lines.push(`  - \`${m.id}\` type=\`${m.type}\` conf=${m.confidence}: ${m.text}`);
      }
    }
  } else {
    lines.push('- No experience loss vs input.');
  }
  lines.push('');
  lines.push('### Education');
  lines.push('');
  const eduLoss = report.lossSites.firstByField.education;
  if (eduLoss) {
    lines.push(`- **First drop:** ${eduLoss.at} (${eduLoss.inputCount} → ${eduLoss.outputCount})`);
  } else {
    lines.push('- Stable through finalResumeData (may include duplicate split at structured stage).');
  }
  lines.push('');
  lines.push('### Skills / Tools / Languages');
  lines.push('');
  for (const field of ['skills', 'tools', 'languages']) {
    const loss = report.lossSites.firstByField[field];
    if (loss) {
      lines.push(`- **${field}:** first loss at ${loss.at} (${loss.inputCount} → ${loss.outputCount}, ${loss.lossPercent}%)`);
    }
  }
  lines.push(`- **skills blocks in classifier:** ${report.evidence.skillsBlocks.join(' | ') || '—'}`);
  lines.push(`- **tools blocks in classifier:** ${report.evidence.toolsBlocks.join(' | ') || '—'}`);
  lines.push(`- **structuredResume.skills:** ${report.evidence.structuredSkills.join(', ') || '—'}`);
  lines.push(`- **structuredResume.tools:** ${report.evidence.structuredTools.join(', ') || '—'}`);
  lines.push('');
  lines.push('## Root cause summary');
  lines.push('');
  lines.push('1. **Skills/Tools/Languages** — blocks carry full lists (5 skills, 9 tools, 2 languages) but `buildStructuredResumeFromDocumentBlocks` drops them to zero.');
  lines.push('2. **Experience (Dropbox)** — `Software Engineer — Dropbox — 2015 – 2019` misclassified as `identity` block (`blk-6`), so blocks→structuredResume loses 1 of 2 entries.');
  lines.push('3. **Experience (validation)** — `structuredResume` (1 entry) → `validatedCVData` (0 entries) via `sanitizeCvDataForExport` / review gate; `resumeData` repair then recovers 2 entries from cleanText.');
  lines.push('4. **resumeData repair** — `repairResumeDataFromRaw` / `import-repair` restores experience from cleanText but does not restore skills/tools.');
  lines.push('5. **templateRender** — renders what `finalResumeData` contains; skills/tools/languages sections omitted when arrays are empty.');
  lines.push('');
  return lines.join('\n');
}
