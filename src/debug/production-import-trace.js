/**
 * H17 — Production reality import trace.
 * Captures the real browser import path: upload → OCR → extraction → classification → preview.
 */

export const PRODUCTION_IMPORT_TRACE_V1 = 'PRODUCTION_IMPORT_TRACE_V1';

const PLACEHOLDER_RE =
  /^(nom à confirmer|nom à compléter|poste à compléter|candidate name|your name|full name|—|-{2,}|n\/a|tbd)$/i;

const SAMPLE_LEAK_RE =
  /\b(alex martin|senior graphic designer|alex@email\.com|studio nova)\b/i;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fold(s) {
  return norm(s).replace(/[^a-z0-9@.+]/g, '');
}

function inRaw(value, rawCorpus) {
  const v = fold(value);
  if (!v || v.length < 2) return false;
  const corpus = fold(rawCorpus);
  if (corpus.includes(v)) return true;
  if (v.length >= 6) {
    for (let i = 0; i <= v.length - 6; i += 1) {
      const chunk = v.slice(i, i + Math.min(12, v.length - i));
      if (chunk.length >= 6 && corpus.includes(chunk)) return true;
    }
  }
  return false;
}

function arr(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

function lineText(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x.trim();
  if (typeof x === 'object') {
    return String(
      x.text || x.line || x.role || x.company || x.school || x.degree || x.label || ''
    ).trim();
  }
  return String(x).trim();
}

function slimBlock(b) {
  if (!b) return null;
  return {
    type: b.type || b.section || b.kind || 'unknown',
    text: lineText(b.text || b.lines?.[0] || b.content),
    confidence: b.confidence ?? b.score ?? null,
    sourceLine: b.sourceLine || b.sourceText || null,
  };
}

function experienceCandidate(e) {
  if (typeof e === 'string') return { text: e, role: null, company: null, confidence: null };
  return {
    text: [e.role, e.company, e.dates, ...(e.bullets || [])].filter(Boolean).join(' · '),
    role: e.role || e.title || null,
    company: e.company || e.employer || null,
    dates: e.dates || null,
    confidence: e.confidence ?? null,
    sourceText: e.sourceText || e.sourceLine || null,
  };
}

function educationCandidate(e) {
  if (typeof e === 'string') return { text: e, school: null, degree: null };
  return {
    text: [e.degree, e.school, e.dates || e.year].filter(Boolean).join(' · '),
    school: e.school || e.institution || null,
    degree: e.degree || e.program || null,
    confidence: e.confidence ?? null,
  };
}

/**
 * @param {object} ctx browser import context
 */
export function buildProductionImportTrace(ctx = {}) {
  const raw = String(ctx.rawText || '').trim();
  const clean = String(ctx.cleanedText || ctx.cleanText || raw).trim();
  const rawCorpus = `${raw}\n${clean}`;
  const structured = ctx.structuredResume || {};
  const resumeData = ctx.resumeData || {};
  const cvData = ctx.cvData || {};
  const blocks = arr(ctx.blocks);
  const identity = resumeData.identity || structured.identity || {
    name: cvData.name,
    title: cvData.title,
    email: cvData.email,
    phone: cvData.phone,
    location: cvData.location,
    linkedin: cvData.linkedin,
    website: cvData.website || cvData.portfolio,
  };

  const nameCandidates = [
    ...arr(structured.nameCandidates),
    ...arr(structured.identity?.nameCandidates),
    ...(blocks
      .filter((b) => /identity|header|name/i.test(String(b.type || '')))
      .map((b) => lineText(b.text || b.lines?.[0]))
      .filter(Boolean)),
  ];
  const titleCandidates = [
    ...arr(structured.titleCandidates),
    ...arr(structured.identity?.titleCandidates),
  ];

  const expFromStructured = arr(structured.experiences);
  const expFromResume = arr(resumeData.experiences);
  const expFromCv = arr(cvData.experience);
  const experienceCandidates = [
    ...expFromStructured.map(experienceCandidate),
    ...expFromResume.map(experienceCandidate),
    ...blocks
      .filter((b) => String(b.type || '').toLowerCase() === 'experience')
      .map((b) => experienceCandidate({ text: lineText(b.text || b.lines?.join(' ')), confidence: b.confidence })),
    ...arr(structured.unsorted)
      .filter((line) => /\b(19|20)\d{2}\b/.test(line) || /—|–|-/.test(line))
      .map((line) => experienceCandidate({ text: line })),
  ];

  const eduFromStructured = arr(structured.education);
  const eduFromResume = arr(resumeData.education);
  const eduFromCv = arr(cvData.education);
  const educationCandidates = [
    ...eduFromStructured.map(educationCandidate),
    ...eduFromResume.map(educationCandidate),
    ...eduFromCv.map(educationCandidate),
    ...blocks
      .filter((b) => String(b.type || '').toLowerCase() === 'education')
      .map((b) => educationCandidate({ text: lineText(b.text || b.lines?.join(' ')) })),
  ];

  const skillCandidates = [
    ...arr(structured.skills),
    ...arr(resumeData.skills),
    ...arr(cvData.skills),
    ...arr(structured.tools),
    ...arr(resumeData.tools),
    ...arr(cvData.tools),
    ...blocks
      .filter((b) => /skill|tool/i.test(String(b.type || '')))
      .flatMap((b) => arr(b.items || b.lines || [b.text])),
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);

  const reviewQueue = arr(ctx.reviewQueue);
  const previewEl = ctx.previewElement || null;
  const previewText = String(ctx.previewText || '').trim();
  const previewHtml = String(ctx.previewHtml || '').trim();

  const finalResumeData = {
    identity: {
      name: identity.name || cvData.name || '',
      title: identity.title || cvData.title || '',
      email: identity.email || cvData.email || '',
      phone: identity.phone || cvData.phone || '',
      location: identity.location || cvData.location || '',
      linkedin: identity.linkedin || cvData.linkedin || '',
      website: identity.website || cvData.portfolio || cvData.website || '',
    },
    summary: resumeData.summary || structured.summary || cvData.summary || '',
    experiences: expFromResume.length
      ? expFromResume
      : expFromCv.length
        ? expFromCv
        : expFromStructured,
    education: eduFromResume.length ? eduFromResume : eduFromCv.length ? eduFromCv : eduFromStructured,
    skills: arr(resumeData.skills).length ? resumeData.skills : arr(cvData.skills),
    tools: arr(resumeData.tools).length ? resumeData.tools : arr(cvData.tools),
    languages: arr(resumeData.languages).length ? resumeData.languages : arr(cvData.languages),
    unsorted: arr(resumeData.unsorted).length ? resumeData.unsorted : arr(structured.unsorted),
    contract: ctx.finalResumeContract || null,
  };

  const trace = {
    version: PRODUCTION_IMPORT_TRACE_V1,
    capturedAt: new Date().toISOString(),
    path: 'browser-production',
    meta: {
      fileName: ctx.fileName || null,
      extractionMethod: ctx.extractionMethod || null,
      importStatus: ctx.importStatus || null,
      importFailed: !!ctx.importFailed,
      failureReason: ctx.failureReason || null,
      templateId: ctx.templateId || null,
      rawChars: raw.length,
      cleanChars: clean.length,
    },
    RAW_TEXT_CAPTURE: {
      rawText: raw,
      cleanedText: clean,
      lineCount: clean.split(/\r?\n/).filter((l) => l.trim()).length,
      preview: raw.slice(0, 2400),
    },
    IDENTITY_CANDIDATES: {
      selected: {
        name: finalResumeData.identity.name,
        title: finalResumeData.identity.title,
      },
      nameCandidates: [...new Set(nameCandidates.map(norm).filter(Boolean))].slice(0, 12),
      titleCandidates: [...new Set(titleCandidates.map(norm).filter(Boolean))].slice(0, 12),
      detection: ctx.parserDetection || null,
    },
    EXPERIENCE_CANDIDATES: dedupeCandidates(experienceCandidates).slice(0, 40),
    EDUCATION_CANDIDATES: dedupeCandidates(educationCandidates).slice(0, 24),
    SKILL_CANDIDATES: [...new Set(skillCandidates)].slice(0, 80),
    CLASSIFIED_BLOCKS: blocks.map(slimBlock).filter(Boolean).slice(0, 120),
    FINAL_RESUME_DATA: finalResumeData,
    REVIEW_QUEUE: reviewQueue.map((item) => ({
      id: item.id || null,
      field: item.field || item.type || null,
      detectedType: item.detectedType || item.category || null,
      sourceText: item.sourceText || item.text || item.detected || null,
      status: item.status || 'pending',
      confidence: item.confidence ?? null,
      reason: item.reason || null,
      origin: item.origin || item.source || null,
    })),
    FINAL_PREVIEW: {
      plainText: previewText,
      htmlChars: previewHtml.length,
      fields: extractPreviewFields(previewText, finalResumeData),
    },
  };

  trace.informationLoss = detectInformationLoss(trace);
  trace.traceability = auditPreviewTraceability(trace);
  return trace;
}

function dedupeCandidates(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = norm(item.text || JSON.stringify(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractPreviewFields(previewText, resume) {
  const id = resume.identity || {};
  const fields = [];
  const push = (section, value, path) => {
    const v = String(value || '').trim();
    if (!v) return;
    fields.push({ section, path, value: v });
  };
  push('identity', id.name, 'identity.name');
  push('identity', id.title, 'identity.title');
  push('identity', id.email, 'identity.email');
  push('identity', id.phone, 'identity.phone');
  push('identity', id.location, 'identity.location');
  push('summary', resume.summary, 'summary');
  for (const [i, e] of arr(resume.experiences).entries()) {
    push('experience', lineText(e), `experiences[${i}]`);
  }
  for (const [i, e] of arr(resume.education).entries()) {
    push('education', lineText(e), `education[${i}]`);
  }
  for (const [i, s] of arr(resume.skills).entries()) {
    push('skills', lineText(s), `skills[${i}]`);
  }
  if (!fields.length && previewText) {
    push('preview', previewText.slice(0, 500), 'preview.plainText');
  }
  return fields;
}

/**
 * @param {ReturnType<typeof buildProductionImportTrace>} trace
 */
export function detectInformationLoss(trace) {
  const losses = [];
  const raw = `${trace.RAW_TEXT_CAPTURE?.rawText || ''}\n${trace.RAW_TEXT_CAPTURE?.cleanedText || ''}`;

  if (trace.meta?.importFailed || trace.meta?.rawChars === 0) {
    losses.push({
      stage: 'upload → OCR/extraction',
      field: 'raw_text',
      detail: trace.meta?.failureReason || 'Import failed before text capture',
    });
  }

  const expCand = trace.EXPERIENCE_CANDIDATES?.length || 0;
  const expFinal = arr(trace.FINAL_RESUME_DATA?.experiences).length;
  if (expCand > 0 && expFinal === 0) {
    losses.push({
      stage: 'classification → final_resume',
      field: 'experience',
      detail: `${expCand} candidate(s) but 0 in FINAL_RESUME_DATA`,
    });
  }

  const eduCand = trace.EDUCATION_CANDIDATES?.length || 0;
  const eduFinal = arr(trace.FINAL_RESUME_DATA?.education).length;
  if (eduCand > 0 && eduFinal === 0) {
    losses.push({
      stage: 'classification → final_resume',
      field: 'education',
      detail: `${eduCand} candidate(s) but 0 in FINAL_RESUME_DATA`,
    });
  }

  const skillCand = trace.SKILL_CANDIDATES?.length || 0;
  const skillFinal = arr(trace.FINAL_RESUME_DATA?.skills).length;
  if (skillCand >= 3 && skillFinal === 0) {
    losses.push({
      stage: 'classification → final_resume',
      field: 'skills',
      detail: `${skillCand} candidate(s) but 0 in FINAL_RESUME_DATA`,
    });
  }

  const name = trace.FINAL_RESUME_DATA?.identity?.name || '';
  if (name && !inRaw(name, raw) && trace.IDENTITY_CANDIDATES?.nameCandidates?.length) {
    const matchedCandidate = trace.IDENTITY_CANDIDATES.nameCandidates.some((c) => fold(c) === fold(name));
    if (!matchedCandidate) {
      losses.push({
        stage: 'identity selection',
        field: 'name',
        detail: `Selected name not found in RAW_TEXT or name candidates`,
        value: name,
      });
    }
  }

  const reviewN = trace.REVIEW_QUEUE?.length || 0;
  const unsortedN = arr(trace.FINAL_RESUME_DATA?.unsorted).length;
  if (reviewN > 0 || unsortedN > 0) {
    losses.push({
      stage: 'review gate',
      field: 'pending_review',
      detail: `${reviewN} review item(s), ${unsortedN} unsorted line(s)`,
    });
  }

  return losses;
}

/**
 * @param {ReturnType<typeof buildProductionImportTrace>} trace
 */
export function auditPreviewTraceability(trace) {
  const raw = `${trace.RAW_TEXT_CAPTURE?.rawText || ''}\n${trace.RAW_TEXT_CAPTURE?.cleanedText || ''}`;
  const userActions = new Set(
    arr(trace.REVIEW_QUEUE)
      .filter((r) => r.status === 'accepted' || r.origin === 'user' || r.origin === 'USER_ACTION')
      .flatMap((r) => [r.sourceText, r.field])
      .filter(Boolean)
      .map(fold)
  );

  const violations = [];
  const traced = [];

  for (const field of trace.FINAL_PREVIEW?.fields || []) {
    const value = field.value;
    if (!value || value.length < 2) continue;

    if (PLACEHOLDER_RE.test(value)) {
      violations.push({
        path: field.path,
        value,
        reason: 'placeholder_label',
        source: 'GENERATED',
      });
      continue;
    }

    if (SAMPLE_LEAK_RE.test(value)) {
      violations.push({
        path: field.path,
        value,
        reason: 'sample_or_demo_leak',
        source: 'GENERATED',
      });
      continue;
    }

    const fromRaw = inRaw(value, raw);
    const fromUser = [...userActions].some((u) => u && (fold(value).includes(u) || u.includes(fold(value))));
    if (fromRaw) {
      traced.push({ path: field.path, value, source: 'RAW_TEXT' });
    } else if (fromUser) {
      traced.push({ path: field.path, value, source: 'USER_ACTION' });
    } else {
      violations.push({
        path: field.path,
        value: value.slice(0, 160),
        reason: 'not_in_raw_text',
        source: 'UNTRACEABLE',
      });
    }
  }

  for (const item of trace.REVIEW_QUEUE || []) {
    const value = String(item.sourceText || '').trim();
    if (!value || value.length < 3) continue;
    if (!inRaw(value, raw) && !userActions.has(fold(value))) {
      violations.push({
        path: `reviewQueue.${item.field || item.id}`,
        value: value.slice(0, 160),
        reason: 'review_item_not_in_raw_text',
        source: 'GENERATED_OR_PHANTOM',
      });
    }
  }

  if (trace.meta?.rawChars === 0) {
    const id = trace.FINAL_RESUME_DATA?.identity || {};
    for (const [k, v] of Object.entries(id)) {
      const s = String(v || '').trim();
      if (s && !PLACEHOLDER_RE.test(s)) {
        violations.push({
          path: `identity.${k}`,
          value: s,
          reason: 'identity_without_raw_text',
          source: 'GENERATED',
        });
      }
    }
  }

  return {
    pass: violations.length === 0,
    tracedCount: traced.length,
    violationCount: violations.length,
    traced,
    violations,
  };
}

/**
 * @param {ReturnType<typeof buildProductionImportTrace>} trace
 */
export function summarizeProductionTrace(trace) {
  const t = trace.traceability || auditPreviewTraceability(trace);
  return {
    fileName: trace.meta?.fileName,
    extractionMethod: trace.meta?.extractionMethod,
    rawChars: trace.meta?.rawChars,
    previewFields: trace.FINAL_PREVIEW?.fields?.length || 0,
    reviewQueue: trace.REVIEW_QUEUE?.length || 0,
    informationLoss: trace.informationLoss?.length || 0,
    traceabilityPass: t.pass,
    untraceable: t.violations?.length || 0,
    identity: trace.FINAL_RESUME_DATA?.identity || {},
  };
}
