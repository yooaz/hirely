/**
 * Yoaz PDF benchmark gate — permanent parsing regression for cv. Yohann azancot.pdf.
 *
 * Validates normalized resumeData against tests/golden/yoaz-pdf-benchmark.expected.json:
 * - section detection (contact, experience, education, skills, interests, languages)
 * - experience segmentation (freelance + 2 internships)
 * - education deduplication (4 distinct Créapôle/LISAA entries)
 * - portfolio page isolation (page-2 captions must not pollute CV sections)
 * - column-merge detection on cleaned extraction text
 * - client brands must not appear in skills
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanExtraction } from '../../src/core/parsing/rich-parser.js';
import { runProductionExtractionPipeline } from '../../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../../src/core/pipeline/hirely-import.js';
import { repairResumeDataFromRaw } from '../../src/core/parsing/import-repair.js';
import { normalizeResumeData } from '../../src/core/resume-data.js';
import { buildLayoutMemory } from '../../src/core/layout/layout-memory.js';
import { spatialBlocksFromLayoutMemory } from '../../src/core/layout/spatial-block.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_MANIFEST = join(root, 'tests/golden/yoaz-pdf-benchmark.expected.json');

/** @param {string} s */
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} hay @param {string} needle */
function contains(hay, needle) {
  return norm(hay).includes(norm(needle));
}

/** @param {object} rd */
export function snapshotBenchmarkResume(rd) {
  const identity = rd?.identity || {};
  const interests = [
    ...(Array.isArray(rd?.interests) ? rd.interests : []),
    ...(rd?.unsorted || []),
  ];
  return {
    identity: {
      name: identity.name || '',
      title: identity.title || '',
      email: identity.email || '',
      phone: identity.phone || '',
      location: identity.location || '',
    },
    summary: String(rd?.summary || ''),
    experiences: (rd?.experiences || []).map((e) => ({
      role: e.role || '',
      company: e.company || '',
      dates: e.dates || '',
      bullets: (e.bullets || []).slice(0, 6),
      clients: (e.clients || []).slice(0, 12),
    })),
    education: [...(rd?.education || [])],
    skills: [...(rd?.skills || [])],
    tools: [...(rd?.tools || [])],
    clients: [...(rd?.clients || [])],
    languages: [...(rd?.languages || [])],
    interests: [...new Set(interests.map((x) => String(x || '').trim()).filter(Boolean))],
    unsorted: (rd?.unsorted || []).slice(0, 20),
  };
}

/**
 * @param {string} rootDir
 * @param {string} [manifestPath]
 */
export async function probePdfFixture(rootDir, manifestPath = DEFAULT_MANIFEST) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const pdfPath = join(rootDir, manifest.fixturePdf);
  if (!existsSync(pdfPath)) {
    return { ok: false, pdfPath, error: `PDF missing: ${manifest.fixturePdf}` };
  }
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(readFileSync(pdfPath));
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    return {
      ok: true,
      pdfPath,
      pageCount: pdf.numPages,
      expectedPages: manifest.pdfPageCount ?? 2,
    };
  } catch (err) {
    return { ok: false, pdfPath, error: String(err?.message || err) };
  }
}

/**
 * Load positioned extraction lines from manifest linesJson (spatial regression).
 * @param {string} rootDir
 * @param {object} manifest
 */
function loadManifestLines(rootDir, manifest) {
  const allLines = [];
  for (const rel of manifest.linesJson || []) {
    const raw = JSON.parse(readFileSync(join(rootDir, rel), 'utf8'));
    for (const l of raw.lines || []) {
      allLines.push({
        ...l,
        cleanedText: l.text,
        rawExtraction: l.text,
        confidence: l.confidence ?? 90,
        source: l.source || 'pdf_native',
      });
    }
  }
  return allLines;
}

/**
 * @param {string} rootDir
 * @param {object} [opts]
 */
export async function parseBenchmarkFixture(rootDir, opts = {}) {
  const manifestPath = opts.manifestPath || DEFAULT_MANIFEST;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const fixturePath = join(rootDir, manifest.fixtureText);
  if (!existsSync(fixturePath)) {
    throw new Error(`fixture text missing: ${manifest.fixtureText}`);
  }

  const rawText = readFileSync(fixturePath, 'utf8');
  const cleanedText = cleanExtraction(rawText, { mode: 'strict' });

  let enterpriseExtraction = opts.enterpriseExtraction || null;
  if (!enterpriseExtraction && manifest.linesJson?.length) {
    const lines = loadManifestLines(rootDir, manifest);
    const layoutMemory = buildLayoutMemory(lines, { source: 'pdf_native' });
    const spatialBlocks = spatialBlocksFromLayoutMemory(layoutMemory);
    enterpriseExtraction = {
      rawExtraction: rawText,
      cleanedText,
      text: cleanedText,
      lines,
      method: opts.extractionMethod || 'pdf_native',
      layoutMemory,
      spatialBlocks,
      metadata: {
        spatialBlocks,
        layoutMemory,
        neverParseRawPdfText: true,
        documentReconstruction: true,
        fileType: 'pdf_text',
      },
    };
  }

  const pipe = await runProductionExtractionPipeline(cleanedText, {
    rawText,
    extractionMethod: opts.extractionMethod || (enterpriseExtraction ? 'pdf_native' : 'ocr'),
    enterpriseExtraction,
    structureFirst: true,
  });
  const imp = productionToHirelyImportResult(pipe, null);
  const bridgeApplied = imp.resumeData?.meta?.blockParserBridgeApplied === true;
  const repaired = bridgeApplied
    ? imp.resumeData
    : repairResumeDataFromRaw(imp.resumeData || {}, {
        rawText,
        cleanedText,
      });
  const resumeData = normalizeResumeData(repaired, {
    skipSanitize: bridgeApplied,
    skipPolish: bridgeApplied,
  });

  return {
    manifest,
    rawText,
    cleanedText,
    pipeline: pipe,
    importResult: imp,
    resumeData,
    snapshot: snapshotBenchmarkResume(resumeData),
  };
}

/**
 * @param {string} edu
 */
function educationSchoolKey(edu) {
  const n = norm(edu);
  if (/lisaa/.test(n)) return 'lisaa';
  if (/creapole/.test(n)) {
    if (/product/.test(n)) return 'creapole-product';
    if (/multisectoral|multisectoriel/.test(n)) return 'creapole-multi';
    if (/visual/.test(n)) return 'creapole-visual';
    return 'creapole-other';
  }
  return n.slice(0, 48);
}

/** @param {string[]} education */
export function findDuplicateEducation(education = []) {
  const seen = new Map();
  const dups = [];
  for (const line of education) {
    const key = educationSchoolKey(line);
    if (seen.has(key)) {
      dups.push({ key, a: seen.get(key), b: line });
    } else {
      seen.set(key, line);
    }
  }
  return dups;
}

/**
 * @param {object} actual
 * @param {object} manifest
 * @param {object} [meta]
 */
export function validateBenchmarkResult(actual, manifest, meta = {}) {
  const failures = [];
  const exp = manifest.expectedNormalized || {};
  const id = actual?.identity || {};
  const hayAll = JSON.stringify(actual);

  // --- Identity ---
  if (exp.identity?.full_name && !contains(id.name, exp.identity.full_name)) {
    failures.push(`identity.full_name: expected "${exp.identity.full_name}", got "${id.name || ''}"`);
  }
  for (const part of exp.identity?.title_contains || []) {
    if (!contains(id.title, part)) {
      failures.push(`identity.title must contain "${part}" (got "${id.title || ''}")`);
    }
  }
  if (exp.identity?.email && norm(id.email) !== norm(exp.identity.email)) {
    failures.push(`identity.email: expected "${exp.identity.email}", got "${id.email || ''}"`);
  }
  if (exp.identity?.phone) {
    const digits = (s) => String(s || '').replace(/\D/g, '');
    if (digits(id.phone) !== digits(exp.identity.phone)) {
      failures.push(`identity.phone: expected "${exp.identity.phone}", got "${id.phone || ''}"`);
    }
  }
  const locHay = [id.location, id.address, meta.rawText].filter(Boolean).join(' ');
  if (exp.identity?.address_contains && !contains(locHay, exp.identity.address_contains)) {
    failures.push(
      `identity.address must contain "${exp.identity.address_contains}" (got location="${id.location || ''}")`
    );
  }

  // --- Summary ---
  for (const frag of exp.summary_contains || []) {
    const summaryHay = [actual.summary, meta.rawText].join(' ');
    if (!contains(summaryHay, frag)) {
      failures.push(`summary must contain "${frag}"`);
    }
  }

  // --- Languages ---
  for (const lang of exp.languages || []) {
    const hit = (actual.languages || []).some(
      (l) =>
        contains(l, lang.label_contains) &&
        (!lang.level_contains || contains(l, lang.level_contains))
    );
    if (!hit) {
      failures.push(
        `languages: missing "${lang.label_contains}"${lang.level_contains ? ` (${lang.level_contains})` : ''}`
      );
    }
  }

  // --- Experience segmentation ---
  const exps = actual.experiences || [];
  const expBlob = (e) =>
    [e.role, e.company, e.dates, ...(e.bullets || []), ...(e.clients || [])].join(' ');
  const counts = exp.counts || {};
  if (counts.experiences_min != null && exps.length < counts.experiences_min) {
    failures.push(`experiences: expected >= ${counts.experiences_min}, got ${exps.length}`);
  }

  for (let i = 0; i < (exp.experiences || []).length; i++) {
    const rule = exp.experiences[i];
    const match = exps.find((e) => {
      if (rule.role_contains?.length && !rule.role_contains.every((r) => contains(expBlob(e), r))) {
        return false;
      }
      if (rule.company_contains && !contains(e.company || expBlob(e), rule.company_contains)) {
        return false;
      }
      if (rule.dates_contains && !contains(e.dates || expBlob(e), rule.dates_contains)) {
        return false;
      }
      if (rule.dates_contains_end && !contains(e.dates || expBlob(e), rule.dates_contains_end)) {
        return false;
      }
      if (rule.internship && !/intern/i.test(expBlob(e))) {
        return false;
      }
      return true;
    });
    if (!match) {
      failures.push(`experiences[${i}]: no match for rule ${JSON.stringify(rule)}`);
      continue;
    }
    if (rule.clients_include?.length) {
      const clientHay = [
        ...(match.clients || []),
        ...(actual.clients || []),
        ...(match.bullets || []),
        expBlob(match),
      ].join(' ');
      for (const brand of rule.clients_include) {
        if (!contains(clientHay, brand)) {
          failures.push(`experiences[${i}]: client "${brand}" not found near freelance role`);
        }
      }
    }
  }

  // --- Education (count + dedupe) ---
  const edu = actual.education || [];
  if (counts.education_min != null && edu.length < counts.education_min) {
    failures.push(`education: expected >= ${counts.education_min}, got ${edu.length}`);
  }
  if (counts.education_max != null && edu.length > counts.education_max) {
    failures.push(`education: expected <= ${counts.education_max} distinct entries, got ${edu.length}`);
  }
  const eduDups = findDuplicateEducation(edu);
  for (const dup of eduDups) {
    failures.push(`education duplicate (${dup.key}): "${dup.a}" ≈ "${dup.b}"`);
  }
  for (let i = 0; i < (exp.education || []).length; i++) {
    const rule = exp.education[i];
    const hit = edu.some((line) => {
      if (rule.school_contains && !contains(line, rule.school_contains)) return false;
      if (rule.field_contains && !contains(line, rule.field_contains)) return false;
      if (rule.dates_contains && !contains(line, rule.dates_contains)) return false;
      if (rule.dates_contains_end && !contains(line, rule.dates_contains_end)) return false;
      return true;
    });
    if (!hit) {
      failures.push(`education[${i}]: no match for ${JSON.stringify(rule)}`);
    }
  }

  // --- Skills / interests ---
  for (const skill of exp.skills_include || []) {
    const skillHay = [...(actual.skills || []), ...(actual.tools || [])].join(' ');
    if (!contains(skillHay, skill)) {
      failures.push(`skills/tools must include "${skill}"`);
    }
  }
  if (counts.skills_min != null && (actual.skills || []).length < counts.skills_min) {
    failures.push(`skills count >= ${counts.skills_min} (got ${(actual.skills || []).length})`);
  }

  const interestHay = [...(actual.interests || []), ...(actual.skills || [])].join(' ');
  for (const interest of exp.interests_include || []) {
    if (!contains(interestHay, interest)) {
      failures.push(`interests must include "${interest}"`);
    }
  }

  // --- Clients must NOT be in skills ---
  const skillBlob = norm([...(actual.skills || []), ...(actual.tools || [])].join(' '));
  for (const brand of manifest.clientBrands || []) {
    const b = norm(brand);
    if (skillBlob.includes(b) && !(actual.clients || []).some((c) => contains(c, brand))) {
      // only fail if brand appears as skill-like token without being a proper client entry
      const asSkill = (actual.skills || []).some((s) => norm(s) === b || norm(s).startsWith(b + ' '));
      if (asSkill) {
        failures.push(`client brand "${brand}" leaked into skills`);
      }
    }
  }
  for (const brand of manifest.clientBrands || []) {
    if ((actual.skills || []).some((s) => norm(s) === norm(brand))) {
      failures.push(`skills must not list client brand "${brand}"`);
    }
  }

  // --- Portfolio page pollution ---
  const expEduHay = edu.join(' ');
  const expExpHay = exps.map((e) => expBlob(e)).join(' ');
  for (const marker of manifest.page2PortfolioMarkers || []) {
    if (contains(expExpHay, marker)) {
      failures.push(`portfolio caption "${marker}" polluted experiences`);
    }
    if (contains(expEduHay, marker)) {
      failures.push(`portfolio caption "${marker}" polluted education`);
    }
    if (contains(id.name, marker) || contains(id.title, marker)) {
      failures.push(`portfolio caption "${marker}" polluted identity`);
    }
    if ((actual.skills || []).some((s) => contains(s, marker))) {
      failures.push(`portfolio caption "${marker}" polluted skills`);
    }
  }

  // --- Column merge on cleaned text (single-line collapse) ---
  const cleanLines = String(meta.cleanedText || '').split(/\r?\n/);
  for (const rule of manifest.columnMergeForbiddenPatterns || []) {
    const re = new RegExp(rule.pattern, rule.flags || 'i');
    const hit = cleanLines.find((line) => re.test(line));
    if (hit) {
      failures.push(`COLUMN_MERGE: ${rule.reason} (pattern ${rule.id}) — line: "${hit.slice(0, 100)}"`);
    }
  }

  // --- Identity must not be garbage from merged columns ---
  if (id.name && /personal project|cubist|sunglass|god of war|art snowboard/i.test(id.name)) {
    failures.push(`identity.name looks like portfolio/column pollution: "${id.name}"`);
  }
  if (id.phone && /\b(19|20)\d{2}\b/.test(id.phone)) {
    failures.push(`identity.phone looks like merged date column: "${id.phone}"`);
  }

  return { failures, snapshot: actual };
}

/**
 * @param {object} [opts]
 */
export async function runYoazPdfBenchmarkGate(opts = {}) {
  const rootDir = opts.rootDir || root;
  const manifestPath = opts.manifestPath || DEFAULT_MANIFEST;

  if (!existsSync(manifestPath)) {
    return { pass: false, failures: [`manifest missing: ${manifestPath}`], items: [] };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const failures = [];

  const pdfProbe = await probePdfFixture(rootDir, manifestPath);
  if (!pdfProbe.ok) {
    failures.push(pdfProbe.error);
  } else if (pdfProbe.pageCount !== pdfProbe.expectedPages) {
    failures.push(`PDF page count: expected ${pdfProbe.expectedPages}, got ${pdfProbe.pageCount}`);
  }

  let parsed;
  try {
    parsed = await parseBenchmarkFixture(rootDir, { manifestPath });
  } catch (err) {
    return {
      pass: false,
      id: manifest.id,
      label: manifest.label,
      failures: [`parse failed: ${err?.message || err}`],
      pdfProbe,
    };
  }

  const validation = validateBenchmarkResult(parsed.snapshot, manifest, {
    rawText: parsed.rawText,
    cleanedText: parsed.cleanedText,
  });
  failures.push(...validation.failures);

  return {
    pass: failures.length === 0,
    id: manifest.id,
    label: manifest.label,
    fixture: manifest.fixtureText,
    fixturePdf: manifest.fixturePdf,
    pdfProbe,
    failures,
    snapshot: parsed.snapshot,
    counts: {
      experiences: parsed.snapshot.experiences?.length ?? 0,
      education: parsed.snapshot.education?.length ?? 0,
      skills: parsed.snapshot.skills?.length ?? 0,
      interests: parsed.snapshot.interests?.length ?? 0,
      clients: parsed.snapshot.clients?.length ?? 0,
    },
  };
}
