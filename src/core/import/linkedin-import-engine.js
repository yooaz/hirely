/**
 * LinkedIn Import Engine — multi-source merge with duplicate detection.
 * Sources: LinkedIn PDF, LinkedIn profile export, Resume PDF/DOCX.
 */

import { emptyResumeData } from '../resume-data.js';
import { dedupeFinalResumeData, auditFinalResumeDuplicates } from '../validation/dedupe-final-resume.js';
import {
  dedupeExperienceEntries,
  dedupeStringList,
  pickRicherStringLabel,
  dedupeBySimilarity,
  semanticSimilarityForDedup,
} from '../parsing/dedupe-engine.js';
import { detectLinkedInSource, sourceFieldWeight, LINKEDIN_SOURCE_TYPES } from './linkedin-source-detect.js';
import {
  parseLinkedInExportText,
  resumeDataFromLinkedInExport,
} from './linkedin-export-parser.js';

export const LINKEDIN_IMPORT_ENGINE = 'LINKEDIN_IMPORT_V1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function expLabel(e) {
  if (!e || typeof e !== 'object') return clean(e);
  return [e.role, e.company, e.dates].filter(Boolean).join(' — ');
}

function scalarQuality(value, field) {
  const v = clean(value);
  if (!v) return 0;
  let q = Math.min(100, 40 + v.length);
  if (field === 'email' && EMAIL_RE.test(v)) q += 35;
  if (field === 'phone' && v.replace(/\D/g, '').length >= 8) q += 30;
  if (field === 'linkedin' && /linkedin\.com/i.test(v)) q += 40;
  if (field === 'summary' && v.length >= 60) q += 20;
  if (field === 'name' && v.split(/\s+/).length >= 2) q += 15;
  if (field === 'title' && v.length >= 8) q += 10;
  return Math.min(100, q);
}

function experienceQuality(exp) {
  if (!exp || typeof exp !== 'object') return 0;
  let q = 20;
  if (clean(exp.role)) q += 20;
  if (clean(exp.company)) q += 20;
  if (clean(exp.dates) || exp.startDate) q += 25;
  const bullets = (exp.bullets || []).filter(Boolean);
  if (bullets.length) q += Math.min(25, bullets.length * 6);
  const desc = clean(exp.description || exp.rewrittenDescription);
  if (desc.length > 40) q += 10;
  return Math.min(100, q);
}

/**
 * @param {object} resumeData
 * @param {{ sourceType?: string, fileName?: string, extractionScore?: number }} meta
 */
export function scoreResumeDataSource(resumeData, meta = {}) {
  const rd = resumeData || emptyResumeData();
  const id = rd.identity || {};
  const sourceType = meta.sourceType || LINKEDIN_SOURCE_TYPES.unknown;
  const extraction = meta.extractionScore ?? 70;

  const fields = {
    name: scalarQuality(id.name, 'name') * sourceFieldWeight(sourceType, 'identity'),
    title: scalarQuality(id.title, 'title') * sourceFieldWeight(sourceType, 'identity'),
    email: scalarQuality(id.email, 'email') * sourceFieldWeight(sourceType, 'identity'),
    phone: scalarQuality(id.phone, 'phone') * sourceFieldWeight(sourceType, 'identity'),
    linkedin: scalarQuality(id.linkedin, 'linkedin') * sourceFieldWeight(sourceType, 'linkedin'),
    location: scalarQuality(id.location, 'location') * sourceFieldWeight(sourceType, 'identity'),
    summary: scalarQuality(rd.summary, 'summary') * sourceFieldWeight(sourceType, 'summary'),
  };

  const expScores = (rd.experiences || []).map((e) => experienceQuality(e) * sourceFieldWeight(sourceType, 'experiences'));
  const avgExp = expScores.length ? expScores.reduce((a, b) => a + b, 0) / expScores.length : 0;

  const listScores = {
    skills: (rd.skills || []).length * 8 * sourceFieldWeight(sourceType, 'skills'),
    tools: (rd.tools || []).length * 8 * sourceFieldWeight(sourceType, 'tools'),
    education: (rd.education || []).length * 12 * sourceFieldWeight(sourceType, 'education'),
    languages: (rd.languages || []).length * 10 * sourceFieldWeight(sourceType, 'languages'),
  };

  const composite = clamp(
    Object.values(fields).reduce((s, v) => s + v, 0) / 7 * 0.35 +
      avgExp * 0.35 +
      Object.values(listScores).reduce((s, v) => s + Math.min(v, 40), 0) / 4 * 0.2 +
      extraction * 0.1
  );

  return {
    sourceType,
    fileName: meta.fileName || '',
    composite: clamp(composite),
    fields,
    experienceAvg: clamp(avgExp),
    counts: {
      experiences: (rd.experiences || []).length,
      skills: (rd.skills || []).length,
      education: (rd.education || []).length,
    },
  };
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Pick best scalar from source candidates.
 * @param {Array<{ value: string, score: number, source: string }>} candidates
 */
function pickBestScalar(candidates) {
  const valid = candidates.filter((c) => clean(c.value));
  if (!valid.length) return { value: '', winner: null };
  valid.sort((a, b) => b.score - a.score);
  return { value: valid[0].value, winner: valid[0].source };
}

/**
 * @param {Array<{ resumeData: object, sourceType: string, fileName?: string, quality?: object }>} sources
 */
export function mergeLinkedInSources(sources = []) {
  const report = {
    version: LINKEDIN_IMPORT_ENGINE,
    sourceCount: sources.length,
    sources: [],
    duplicates: [],
    merges: [],
    winners: {},
  };

  if (!sources.length) {
    return { resumeData: emptyResumeData(), report, confidence: 0 };
  }

  if (sources.length === 1) {
    const only = sources[0];
    const rd = dedupeFinalResumeData(only.resumeData || emptyResumeData());
    report.sources.push({
      fileName: only.fileName,
      sourceType: only.sourceType,
      quality: only.quality?.composite ?? 0,
    });
    return {
      resumeData: rd,
      report,
      confidence: only.quality?.composite ?? 50,
    };
  }

  const merged = emptyResumeData();
  const identityFields = ['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website'];

  for (const field of identityFields) {
    const candidates = sources.map((s) => {
      const id = s.resumeData?.identity || {};
      const raw = field === 'name' || field === 'title' || field === 'email' || field === 'phone' || field === 'location' || field === 'linkedin' || field === 'website'
        ? id[field]
        : '';
      const q = s.quality?.fields?.[field === 'name' || field === 'title' ? field : field] ?? scalarQuality(raw, field);
      const weight = sourceFieldWeight(s.sourceType, field === 'linkedin' ? 'linkedin' : 'identity');
      return {
        value: clean(raw),
        score: (typeof q === 'number' ? q : scalarQuality(raw, field)) * weight,
        source: s.fileName || s.sourceType,
      };
    });
    const pick = pickBestScalar(candidates);
    if (pick.value) {
      merged.identity[field] = pick.value;
      if (pick.winner) report.winners[field] = pick.winner;
    }
  }

  const summaryCandidates = sources
    .map((s) => ({
      value: clean(s.resumeData?.summary),
      score: (s.quality?.fields?.summary ?? scalarQuality(s.resumeData?.summary, 'summary')) *
        sourceFieldWeight(s.sourceType, 'summary'),
      source: s.fileName || s.sourceType,
    }))
    .filter((c) => c.value);
  summaryCandidates.sort((a, b) => b.score - a.score);
  if (summaryCandidates[0]) {
    merged.summary = summaryCandidates[0].value;
    report.winners.summary = summaryCandidates[0].source;
  }

  const allExperiences = [];
  for (const s of sources) {
    for (const exp of s.resumeData?.experiences || []) {
      allExperiences.push({ ...exp, _source: s.fileName || s.sourceType });
    }
  }

  const dedupedExp = dedupeExperienceEntries(allExperiences);
  const expDupes = [];
  for (const exp of allExperiences) {
    const label = expLabel(exp);
    for (const kept of dedupedExp) {
      if (kept === exp) continue;
      const sim = semanticSimilarityForDedup(expLabel(kept), label);
      if (sim >= 0.88) {
        expDupes.push({
          field: 'experiences',
          kept: expLabel(kept),
          dropped: label,
          similarity: Math.round(sim * 100),
          winner: expLabel(kept).length >= label.length ? expLabel(kept) : label,
        });
        break;
      }
    }
  }
  merged.experiences = dedupedExp.map(({ _source, ...e }) => e);
  report.duplicates.push(...expDupes.slice(0, 12));

  const mergeLists = (key, weightKey) => {
    const pool = [];
    for (const s of sources) {
      const w = sourceFieldWeight(s.sourceType, weightKey);
      for (const item of s.resumeData?.[key] || []) {
        pool.push({ item: clean(item), weight: w, source: s.fileName || s.sourceType });
      }
    }
    pool.sort((a, b) => b.weight - a.weight || b.item.length - a.item.length);
    const labels = pool.map((p) => p.item).filter(Boolean);
    const before = labels.length;
    const after = dedupeStringList(labels);
    if (before > after.length) {
      report.merges.push({
        field: key,
        before,
        after: after.length,
        removed: before - after.length,
      });
    }
    return after;
  };

  merged.skills = mergeLists('skills', 'skills');
  merged.tools = mergeLists('tools', 'tools');
  merged.education = mergeLists('education', 'education');
  merged.languages = mergeLists('languages', 'languages');
  merged.clients = dedupeStringList(sources.flatMap((s) => s.resumeData?.clients || []).map(clean));
  merged.projects = dedupeStringList(sources.flatMap((s) => s.resumeData?.projects || []).map(clean));

  const unsorted = sources.flatMap((s) => s.resumeData?.unsorted || []);
  merged.unsorted = dedupeBySimilarity(unsorted.map(clean)).slice(0, 48);

  merged.meta = {
    ...(merged.meta || {}),
    linkedInImport: true,
    mergedSources: sources.map((s) => ({
      fileName: s.fileName,
      sourceType: s.sourceType,
      quality: s.quality?.composite ?? 0,
    })),
  };

  const final = dedupeFinalResumeData(merged);
  const dupeAudit = auditFinalResumeDuplicates(final);
  if (!dupeAudit.ok) {
    report.duplicates.push(
      ...dupeAudit.duplicates.slice(0, 6).map((d) => ({
        field: d.field,
        kept: d.a,
        dropped: d.b,
        similarity: 90,
      }))
    );
  }

  for (const s of sources) {
    report.sources.push({
      fileName: s.fileName,
      sourceType: s.sourceType,
      quality: s.quality?.composite ?? 0,
      counts: s.quality?.counts,
    });
  }

  const confidence = clamp(
    sources.reduce((sum, s) => sum + (s.quality?.composite ?? 0), 0) / sources.length
  );

  return { resumeData: final, report, confidence };
}

/**
 * Merge export parse into existing resumeData (keep richer lists).
 * @param {object} fromExport
 * @param {object} existing
 */
function mergeExportIntoResumeData(fromExport, existing) {
  const base = existing && typeof existing === 'object' ? existing : emptyResumeData();
  const out = {
    ...base,
    identity: { ...(base.identity || {}), ...(fromExport.identity || {}) },
    summary: clean(base.summary) || clean(fromExport.summary) || '',
    experiences: (base.experiences || []).length ? base.experiences : fromExport.experiences || [],
    education: (base.education || []).length ? base.education : fromExport.education || [],
    skills: (base.skills || []).length ? base.skills : fromExport.skills || [],
    tools: (base.tools || []).length ? base.tools : fromExport.tools || [],
    languages: (base.languages || []).length ? base.languages : fromExport.languages || [],
  };
  for (const key of ['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website']) {
    const a = clean(out.identity[key]);
    const b = clean(fromExport.identity?.[key]);
    if (!a && b) out.identity[key] = b;
    else if (a && b && b.length > a.length) out.identity[key] = b;
  }
  return out;
}

/**
 * Build import source from file + pipeline result or LinkedIn export parse.
 * @param {object} input
 */
export function normalizeLinkedInImportSource(input) {
  const fileName = input.fileName || input.file?.name || '';
  const text = input.rawText || input.cleanedText || input.text || '';
  const detection = detectLinkedInSource({
    fileName,
    mimeType: input.mimeType || input.file?.type,
    text,
  });

  let resumeData = input.resumeData || null;

  if (detection.type === LINKEDIN_SOURCE_TYPES.linkedin_export && text) {
    const parsed = parseLinkedInExportText(text, fileName);
    if (parsed) {
      const fromExport = resumeDataFromLinkedInExport(parsed);
      resumeData = resumeData
        ? mergeExportIntoResumeData(fromExport, resumeData)
        : fromExport;
    }
  }

  if (!resumeData) resumeData = emptyResumeData();

  const quality = scoreResumeDataSource(resumeData, {
    sourceType: detection.type,
    fileName,
    extractionScore: input.extractionScore ?? (text.length > 200 ? 75 : 50),
  });

  return {
    fileName,
    sourceType: detection.type,
    detection,
    resumeData,
    quality,
    rawText: text,
  };
}

/**
 * @param {Array<{ fileName?: string, resumeData?: object, rawText?: string, mimeType?: string }>} items
 */
export function runLinkedInImportMerge(items) {
  const sources = (items || []).map((item) => normalizeLinkedInImportSource(item));
  const { resumeData, report, confidence } = mergeLinkedInSources(sources);
  return {
    version: LINKEDIN_IMPORT_ENGINE,
    ready: sources.length > 0,
    resumeData,
    report,
    confidence,
    sources,
  };
}

/**
 * @param {ReturnType<typeof runLinkedInImportMerge>} result
 */
export function buildLinkedInImportReportSummary(result) {
  const r = result?.report || {};
  return {
    version: LINKEDIN_IMPORT_ENGINE,
    sourceCount: r.sourceCount ?? 0,
    confidence: result?.confidence ?? 0,
    duplicates: (r.duplicates || []).length,
    merges: r.merges || [],
    winners: r.winners || {},
    sources: r.sources || [],
  };
}

/**
 * @param {Array<File|{ name: string, type?: string, text?: () => Promise<string> }>} files
 * @param {{ importFile?: (file: File) => Promise<object> }} [opts]
 */
export async function runLinkedInMultiImport(files, opts = {}) {
  const importFile = opts.importFile;
  if (!importFile || !files?.length) {
    return { ready: false, version: LINKEDIN_IMPORT_ENGINE, errors: ['NO_IMPORT_FN'] };
  }

  const items = [];
  const errors = [];

  for (const file of files) {
    try {
      const result = await importFile(file);
      items.push({
        fileName: file.name,
        mimeType: file.type,
        resumeData: result?.resumeData || null,
        rawText: result?.rawText || result?.cleanedText || '',
        cleanedText: result?.cleanedText || '',
        extractionScore: result?.rawText?.length > 400 ? 82 : 60,
      });
    } catch (err) {
      errors.push({ fileName: file.name, error: String(err?.message || err) });
    }
  }

  const merged = runLinkedInImportMerge(items);
  return { ...merged, errors };
}
