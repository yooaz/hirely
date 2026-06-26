/**
 * Yohann Azancot PDF — regression evaluators (target + hard failures + purity).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CV_SECTION } from '../../src/core/parsing/section-heading-dictionary.js';
import { SPATIAL_ZONE_ID } from '../../src/core/layout/spatial-block.js';
import { lineReadingZone } from '../../src/core/layout/page-layout.js';
import { findDuplicateEducation, parseBenchmarkFixture } from './yoaz-pdf-benchmark-gate.mjs';
import { runSpatialPipelineFixture } from './cv-parse-benchmark-runner.mjs';

const DEFAULT_TARGET = 'tests/golden/yoaz-pdf-target.expected.json';

/** @param {string} s */
export function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} hay @param {string} needle */
export function contains(hay, needle) {
  return norm(hay).includes(norm(needle));
}

/**
 * @param {string} rootDir
 */
export function loadYoazTargetManifest(rootDir, rel = DEFAULT_TARGET) {
  return JSON.parse(readFileSync(join(rootDir, rel), 'utf8'));
}

/**
 * @param {string} rootDir
 */
export function loadYoazLines(rootDir) {
  const manifest = loadYoazTargetManifest(rootDir);
  const all = [];
  for (const rel of manifest.linesJson || []) {
    const raw = JSON.parse(readFileSync(join(rootDir, rel), 'utf8'));
    for (const l of raw.lines || []) {
      all.push({
        ...l,
        cleanedText: l.text,
        rawExtraction: l.text,
        confidence: l.confidence ?? 90,
        source: l.source || 'native',
      });
    }
  }
  return { lines: all, manifest };
}

/**
 * @param {object} detected — detectSectionBlocks output
 */
export function normalizeSpatialParse(detected) {
  const contact = detected.parseConfidence?.contact || {};
  const segments = detected.sectionSegmentation?.segments || detected.resumeSegments || [];

  const langSegs = segments.filter((s) => s.section === CV_SECTION.LANGUAGES && !s.is_heading);
  const interestSegs = segments.filter((s) => s.section === CV_SECTION.INTERESTS && !s.is_heading);
  const summarySegs = segments.filter((s) => s.section === CV_SECTION.SUMMARY && !s.is_heading);

  const languages = langSegs.map((s) => s.text.trim()).filter(Boolean);
  const interests = [];
  for (const seg of interestSegs) {
    interests.push(
      ...seg.text
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean)
    );
  }

  const summary = summarySegs.map((s) => s.text).join(' ').trim();

  return {
    schema: 'hirely.yoaz_normalized.v1',
    path: 'spatial',
    contact: {
      full_name: contact.name || '',
      title: '',
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.location || '',
    },
    summary,
    languages,
    experiences: (detected.experienceItems || []).map((e) => ({
      role: e.job_title || '',
      company: e.company || '',
      start_date: e.start_date || '',
      end_date: e.end_date || '',
      clients: [...(e.client || [])],
    })),
    education: (detected.educationItems || []).map((e) => ({
      school: e.school || '',
      degree: e.degree || '',
      start_date: e.start_date || '',
      end_date: e.end_date || '',
    })),
    skills: (detected.skillItems || []).map((s) => s.name || '').filter(Boolean),
    interests,
    portfolio_items: (detected.portfolio_items || []).map((p) => ({
      title: p.title || '',
      page_number: p.page_number,
    })),
    page_classification: {
      resume_core_pages: detected.pageDocumentClassification?.resume_core_pages || [],
      portfolio_pages: detected.pageDocumentClassification?.portfolio_pages || [],
    },
    _raw: {
      segment_count: segments.length,
      review_hint_count: detected.reviewHints?.hints?.length ?? 0,
      parse_confidence_global: detected.parseConfidence?.global ?? null,
    },
  };
}

/**
 * @param {object} snapshot — from snapshotBenchmarkResume
 */
export function normalizeProductionParse(snapshot, parseResponse = null) {
  const id = snapshot.identity || {};
  const interests = [
    ...(snapshot.interests || []),
    ...(snapshot.unsorted || []),
    ...(parseResponse?.interests || []),
  ];
  return {
    schema: 'hirely.yoaz_normalized.v1',
    path: 'production_flat',
    contact: {
      full_name: id.name || '',
      title: id.title || '',
      phone: id.phone || '',
      email: id.email || '',
      address: id.location || '',
    },
    summary: snapshot.summary || '',
    languages: [...(snapshot.languages || [])],
    experiences: (snapshot.experiences || []).map((e) => ({
      role: e.role || '',
      company: e.company || '',
      start_date: '',
      end_date: '',
      dates: e.dates || '',
      clients: [...(e.clients || [])],
    })),
    education: (snapshot.education || []).map((line) => ({
      school: line,
      degree: '',
      start_date: '',
      end_date: '',
      _line: line,
    })),
    skills: [...(snapshot.skills || []), ...(snapshot.tools || [])],
    interests: [...new Set(interests.map((x) => String(x || '').trim()).filter(Boolean))],
    portfolio_items: [],
    page_classification: {
      resume_core_pages: [],
      portfolio_pages: [],
    },
    _raw: {
      clients_top_level: [...(snapshot.clients || [])],
      unsorted_sample: (snapshot.unsorted || []).slice(0, 5),
    },
  };
}

/**
 * @param {string} rootDir
 */
export async function runYoazSpatialRegression(rootDir) {
  const { lines, manifest } = loadYoazLines(rootDir);
  const detected = runSpatialPipelineFixture(rootDir, {
    id: manifest.id,
    linesJson: manifest.linesJson,
    textFixture: manifest.fixtureText,
  });
  return {
    manifest,
    lines,
    detected,
    normalized: normalizeSpatialParse(detected),
  };
}

/**
 * @param {string} rootDir
 */
export async function runYoazProductionRegression(rootDir) {
  const manifest = loadYoazTargetManifest(rootDir);
  const parsed = await parseBenchmarkFixture(rootDir, {
    manifestPath: join(rootDir, 'tests/golden/yoaz-pdf-benchmark.expected.json'),
  });
  return {
    manifest,
    parsed,
    normalized: normalizeProductionParse(parsed.snapshot, parsed.importResult?.parseResponse),
    cleanedText: parsed.cleanedText,
    rawText: parsed.rawText,
  };
}

/**
 * @param {object} normalized
 * @param {object} target
 */
export function validateTargetBehavior(normalized, target) {
  const failures = [];
  const c = normalized.contact || {};

  if (!contains(c.full_name, target.contact.full_name)) {
    failures.push(`contact.full_name: expected "${target.contact.full_name}", got "${c.full_name}"`);
  }
  if (target.contact.title && c.title && !contains(c.title, target.contact.title)) {
    failures.push(`contact.title: expected "${target.contact.title}", got "${c.title}"`);
  }
  if (target.contact.email && norm(c.email) !== norm(target.contact.email)) {
    failures.push(`contact.email: expected "${target.contact.email}", got "${c.email}"`);
  }
  if (target.contact.phone) {
    const digits = (s) => String(s || '').replace(/\D/g, '');
    if (digits(c.phone) !== digits(target.contact.phone)) {
      failures.push(`contact.phone: expected "${target.contact.phone}", got "${c.phone}"`);
    }
  }
  if (target.contact.address_contains && !contains(c.address, target.contact.address_contains)) {
    failures.push(`contact.address must contain "${target.contact.address_contains}" (got "${c.address}")`);
  }

  for (const frag of target.summary_contains || []) {
    if (!contains(normalized.summary, frag)) {
      failures.push(`summary must contain "${frag}"`);
    }
  }

  for (const lang of target.languages || []) {
    const hit = (normalized.languages || []).some(
      (l) =>
        contains(l, lang.label_contains) &&
        (!lang.level_contains || contains(l, lang.level_contains))
    );
    if (!hit) {
      failures.push(`languages: missing "${lang.label_contains}" / "${lang.level_contains || ''}"`);
    }
  }

  const exps = normalized.experiences || [];
  const expHay = (e) =>
    [e.role, e.company, e.start_date, e.end_date, e.dates, ...(e.clients || [])].join(' ');

  if (exps.length < (target.counts?.experiences_min ?? 3)) {
    failures.push(`experiences: expected >= ${target.counts.experiences_min}, got ${exps.length}`);
  }
  if (target.counts?.experiences_max != null && exps.length > target.counts.experiences_max) {
    failures.push(`experiences: expected <= ${target.counts.experiences_max}, got ${exps.length}`);
  }

  for (const rule of target.experiences || []) {
    const match = exps.find((e) => {
      if (rule.role_contains?.length && !rule.role_contains.every((r) => contains(expHay(e), r))) {
        return false;
      }
      if (rule.company_contains && !contains(e.company || expHay(e), rule.company_contains)) {
        return false;
      }
      const dates = expHay(e);
      if (rule.start_date && !contains(dates, rule.start_date)) return false;
      if (rule.end_date && !contains(dates, rule.end_date)) return false;
      if (rule.internship && !/intern/i.test(expHay(e))) return false;
      return true;
    });
    if (!match) {
      failures.push(`experience target missing: ${rule.id || JSON.stringify(rule)}`);
      continue;
    }
    for (const brand of rule.clients_include || []) {
      const clientHay = [...(match.clients || []), expHay(match)].join(' ');
      if (!contains(clientHay, brand)) {
        failures.push(`experience ${rule.id}: client "${brand}" missing`);
      }
    }
  }

  const edu = normalized.education || [];
  if (edu.length < (target.counts?.education_min ?? 4)) {
    failures.push(`education: expected >= ${target.counts.education_min}, got ${edu.length}`);
  }
  if (target.counts?.education_max != null && edu.length > target.counts.education_max) {
    failures.push(`education: expected <= ${target.counts.education_max}, got ${edu.length}`);
  }

  for (const rule of target.education || []) {
    const hit = edu.some((e) => {
      const blob = [e.school, e.degree, e._line, e.start_date, e.end_date].join(' ');
      if (rule.school_contains && !contains(blob, rule.school_contains)) return false;
      if (rule.field_contains && !contains(blob, rule.field_contains)) return false;
      if (rule.start_date && !contains(blob, rule.start_date)) return false;
      if (rule.end_date && !contains(blob, rule.end_date)) return false;
      return true;
    });
    if (!hit) {
      failures.push(`education target missing: ${rule.id || JSON.stringify(rule)}`);
    }
  }

  for (const skill of target.skills || []) {
    if (!(normalized.skills || []).some((s) => contains(s, skill))) {
      failures.push(`skills must include "${skill}"`);
    }
  }
  if ((normalized.skills || []).length < (target.counts?.skills_min ?? 6)) {
    failures.push(`skills count >= ${target.counts.skills_min} (got ${(normalized.skills || []).length})`);
  }

  const interestHay = [...(normalized.interests || []), normalized.summary].join(' ');
  for (const interest of target.interests || []) {
    if (!contains(interestHay, interest)) {
      failures.push(`interests must include "${interest}"`);
    }
  }
  if ((normalized.interests || []).length < (target.counts?.interests_min ?? 9)) {
    failures.push(
      `interests count >= ${target.counts.interests_min} (got ${(normalized.interests || []).length})`
    );
  }

  return failures;
}

/**
 * @param {object} normalized
 * @param {object} target
 * @param {object} [ctx]
 */
export function validateHardFailures(normalized, target, ctx = {}) {
  const failures = [];
  const markers = target.portfolioMarkers || [];

  const eduLines = (normalized.education || []).map((e) =>
    [e.school, e.degree, e._line, e.start_date, e.end_date].filter(Boolean).join(' ')
  );
  const eduDups = findDuplicateEducation(eduLines);
  for (const dup of eduDups) {
    failures.push(`HARD_FAIL duplicate education (${dup.key}): "${dup.a}" / "${dup.b}"`);
  }

  const eduKeys = new Set();
  for (const e of normalized.education || []) {
    const key = `${norm(e.school)}|${norm(e.degree)}|${e.start_date}|${e.end_date}`;
    if (eduKeys.has(key) && key.replace(/\|/g, '')) {
      failures.push(`HARD_FAIL duplicate education key: ${key}`);
    }
    eduKeys.add(key);
  }

  for (const brand of target.clientBrands || []) {
    if ((normalized.skills || []).some((s) => norm(s) === norm(brand))) {
      failures.push(`HARD_FAIL client "${brand}" inside skills`);
    }
  }

  const expBlob = (normalized.experiences || [])
    .map((e) => [e.role, e.company, ...(e.clients || [])].join(' '))
    .join(' ');
  const eduBlob = eduLines.join(' ');
  for (const marker of markers) {
    if (contains(expBlob, marker)) {
      failures.push(`HARD_FAIL portfolio "${marker}" inside experiences`);
    }
    if (contains(eduBlob, marker)) {
      failures.push(`HARD_FAIL portfolio "${marker}" inside education`);
    }
    if ((normalized.skills || []).some((s) => contains(s, marker))) {
      failures.push(`HARD_FAIL portfolio "${marker}" inside skills`);
    }
    if (contains(normalized.contact?.full_name, marker)) {
      failures.push(`HARD_FAIL portfolio "${marker}" polluted contact name`);
    }
  }

  if (/art snowboard|personal project|sunglass|god of war/i.test(normalized.contact?.full_name || '')) {
    failures.push(`HARD_FAIL identity name column pollution: "${normalized.contact.full_name}"`);
  }

  const cleanText = ctx.cleanedText || '';
  if (cleanText && !ctx.skipFlatColumnMerge) {
    const lines = cleanText.split(/\r?\n/);
    for (const rule of target.columnMergeForbiddenPatterns || []) {
      const re = new RegExp(rule.pattern, rule.flags || 'i');
      const hit = lines.find((line) => re.test(line));
      if (hit) {
        failures.push(`HARD_FAIL COLUMN_MERGE ${rule.id}: ${rule.reason}`);
      }
    }
  }

  for (const seg of ctx.segments || []) {
    const t = seg.text || '';
    if (/yoaz@hotmail\.fr/i.test(t) && /lisaa/i.test(t)) {
      failures.push('HARD_FAIL COLUMN_MERGE email+LISAA in same segment');
    }
    if (/french native/i.test(t) && /freelancer/i.test(t)) {
      failures.push('HARD_FAIL COLUMN_MERGE languages+experience in same segment');
    }
  }

  return failures;
}

/**
 * @param {object} classification — pageDocumentClassification
 * @param {object} target
 */
export function validatePageClassification(classification, target) {
  const failures = [];
  const expect = target.pageClassification || {};

  const p1 = classification?.pages?.find((p) => p.page === 1);
  const p2 = classification?.pages?.find((p) => p.page === 2);

  if (expect.page1 && p1?.page_class !== expect.page1) {
    failures.push(`page 1 class: expected ${expect.page1}, got ${p1?.page_class}`);
  }
  if (expect.page2 && p2?.page_class !== expect.page2) {
    failures.push(`page 2 class: expected ${expect.page2}, got ${p2?.page_class}`);
  }
  for (const p of expect.resume_core_pages || []) {
    if (!classification?.resume_core_pages?.includes(p)) {
      failures.push(`resume_core_pages must include ${p}`);
    }
  }
  for (const p of expect.portfolio_pages || []) {
    if (!classification?.portfolio_pages?.includes(p)) {
      failures.push(`portfolio_pages must include ${p}`);
    }
  }
  return failures;
}

/**
 * @param {object[]} segments
 * @param {object[]} lines — extraction lines with x,y
 * @param {object} target
 * @param {object} [opts]
 */
export function validateSectionPurity(segments, lines, target, opts = {}) {
  const failures = [];
  const rules = target.sectionPurity || {};
  const sidebarX = rules.sidebar_x_max ?? 280;
  const mainX = rules.main_x_min ?? 300;
  const pageLayouts = opts.pageLayouts || [];

  const lineIndex = new Map();
  for (const l of lines || []) {
    const key = `${l.page || 1}:${norm(l.text)}`;
    if (!lineIndex.has(key)) lineIndex.set(key, l);
  }

  function layoutForPage(page) {
    return pageLayouts.find((p) => p.page === page) || null;
  }

  function zoneOf(seg) {
    const page = seg.page_number || 1;
    const line = lineIndex.get(`${page}:${norm(seg.text)}`);
    const layout = layoutForPage(page);

    if (line && layout && Number.isFinite(line.x)) {
      const zone = lineReadingZoneFromLayout(layout, line);
      if (zone === 'sidebar') return 'sidebar';
      if (zone === 'main') return 'main';
      if (zone === 'left_column' && layout?.layout_type === 'sidebar_left') return 'sidebar';
      if (zone === 'right_column' && layout?.layout_type === 'sidebar_left') return 'main';
    }

    if (seg.zone_id === SPATIAL_ZONE_ID.SIDEBAR || seg.zone_id === 'sidebar') return 'sidebar';
    if (seg.zone_id === SPATIAL_ZONE_ID.MAIN || seg.zone_id === 'main') return 'main';
    if (seg.zone_id === SPATIAL_ZONE_ID.LEFT_COLUMN) return 'sidebar';
    if (seg.zone_id === SPATIAL_ZONE_ID.RIGHT_COLUMN) return 'main';

    const x = line?.x ?? seg.bbox?.x ?? seg.x;
    if (Number.isFinite(x)) {
      if (x <= sidebarX) return 'sidebar';
      if (x >= mainX) return 'main';
    }
    return 'unknown';
  }

  const sidebarText = segments
    .filter((s) => zoneOf(s) === 'sidebar' && !s.is_heading)
    .map((s) => s.text)
    .join('\n');
  const mainText = segments
    .filter((s) => zoneOf(s) === 'main' && !s.is_heading)
    .map((s) => s.text)
    .join('\n');

  for (const need of rules.sidebar_must_include_text || []) {
    if (!contains(sidebarText, need)) {
      failures.push(`SECTION_PURITY sidebar missing "${need}"`);
    }
  }
  for (const forbid of rules.sidebar_must_not_include_text || []) {
    if (contains(sidebarText, forbid)) {
      failures.push(`SECTION_PURITY sidebar must not include "${forbid}"`);
    }
  }
  for (const need of rules.main_must_include_text || []) {
    if (!contains(mainText, need)) {
      failures.push(`SECTION_PURITY main column missing "${need}"`);
    }
  }
  for (const forbid of rules.main_must_not_include_text || []) {
    if (contains(mainText, forbid)) {
      failures.push(`SECTION_PURITY main column must not include "${forbid}"`);
    }
  }

  const sidebarExp = segments.filter(
    (s) => s.section === CV_SECTION.EXPERIENCE && zoneOf(s) === 'sidebar' && !s.is_heading
  );
  if (sidebarExp.length > 0) {
    failures.push(`SECTION_PURITY experience content in sidebar (${sidebarExp.length} segments)`);
  }

  const mainContact = segments.filter(
    (s) =>
      s.section === CV_SECTION.CONTACT &&
      zoneOf(s) === 'main' &&
      !s.is_heading &&
      /@|\+?\d{8,}/.test(s.text)
  );
  if (mainContact.length > 0) {
    failures.push(`SECTION_PURITY contact signals in main column (${mainContact.length} segments)`);
  }

  return failures;
}

/**
 * @param {object} normalized
 * @param {object} targetSnapshot
 */
export function diffNormalizedSnapshots(normalized, targetSnapshot) {
  const gaps = [];
  if (norm(normalized.contact?.full_name) !== norm(targetSnapshot.contact?.full_name)) {
    gaps.push('contact.full_name');
  }
  if ((normalized.experiences || []).length !== (targetSnapshot.experiences || []).length) {
    gaps.push(
      `experiences.count ${(normalized.experiences || []).length} vs ${(targetSnapshot.experiences || []).length}`
    );
  }
  if ((normalized.education || []).length !== (targetSnapshot.education || []).length) {
    gaps.push(
      `education.count ${(normalized.education || []).length} vs ${(targetSnapshot.education || []).length}`
    );
  }
  if ((normalized.skills || []).length !== (targetSnapshot.skills || []).length) {
    gaps.push(
      `skills.count ${(normalized.skills || []).length} vs ${(targetSnapshot.skills || []).length}`
    );
  }
  return gaps;
}

function lineReadingZoneFromLayout(pageLayout, line) {
  try {
    return lineReadingZone(pageLayout, line);
  } catch {
    return 'main';
  }
}
