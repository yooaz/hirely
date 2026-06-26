/**
 * Golden CV gate — assert structured parse metrics for canonical fixtures.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSectionEngineV2 } from '../../src/core/parsing/section-engine-v2.js';
import { buildParserCoverageReport } from '../../src/core/parsing/parser-coverage-report.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * @param {object} caseDef — from cv-expectations.json
 * @param {string} rootDir
 */
export function runGoldenCvCase(caseDef, rootDir = root) {
  const fixturePath = join(rootDir, caseDef.fixture);
  if (!existsSync(fixturePath)) {
    return {
      id: caseDef.id,
      pass: false,
      failures: [`fixture missing: ${caseDef.fixture}`],
      metrics: null,
    };
  }

  const raw = readFileSync(fixturePath, 'utf8');
  const expect = caseDef.expect || {};
  const failures = [];

  let structured;
  let coveragePercent = 0;
  let resumeJson = null;

  if (caseDef.pipeline === 'section_engine_v2') {
    const result = runSectionEngineV2(raw, { rawText: raw, extractionMethod: 'paste' });
    structured = result.structured;
    resumeJson = result.resumeJson;
    const report = buildParserCoverageReport(raw, structured, { rawText: raw });
    coveragePercent = report.coveragePercent;
  } else {
    failures.push(`unknown pipeline: ${caseDef.pipeline}`);
  }

  const id = structured?.identity || {};
  const name = String(id.name || resumeJson?.name || '').trim();
  const title = String(id.title || resumeJson?.title || '').trim();
  const experienceCount = (structured?.experiences || []).length;
  const skillsCount = (structured?.skills || []).length;
  const languageCount = (structured?.languages || []).length;

  const metrics = {
    name,
    title,
    experienceCount,
    skillsCount,
    languageCount,
    coveragePercent,
    resumeExperienceLines: (resumeJson?.experience || []).length,
    graphExperienceNodes: structured?.metadata?.resumeGraph?.stats?.experience ?? null,
  };

  if (expect.name && name !== expect.name) {
    failures.push(`name expected "${expect.name}" got "${name}"`);
  }

  for (const fragment of expect.titleIncludes || []) {
    if (!title.toLowerCase().includes(String(fragment).toLowerCase())) {
      failures.push(`title must include "${fragment}" (got "${title}")`);
    }
  }

  if (experienceCount < (expect.experienceCountMin ?? 0)) {
    failures.push(
      `experience count ${experienceCount} < min ${expect.experienceCountMin}`
    );
  }

  if (skillsCount < (expect.skillsCountMin ?? 0)) {
    failures.push(`skills count ${skillsCount} < min ${expect.skillsCountMin}`);
  }

  if (languageCount < (expect.languageCountMin ?? 0)) {
    failures.push(`language count ${languageCount} < min ${expect.languageCountMin}`);
  }

  if (coveragePercent < (expect.coveragePercentMin ?? 0)) {
    failures.push(
      `coverage ${coveragePercent}% < min ${expect.coveragePercentMin}%`
    );
  }

  if (structured?.metadata?.neverBuildJsonFromOcr !== true) {
    failures.push('resume JSON must come from graph engine (neverBuildJsonFromOcr)');
  }

  return {
    id: caseDef.id,
    label: caseDef.label,
    pass: failures.length === 0,
    failures,
    metrics,
    expect,
  };
}

/**
 * @param {object} manifest — parsed cv-expectations.json
 * @param {string} [rootDir]
 */
export function runGoldenCvSuite(manifest, rootDir = root) {
  const cases = manifest?.cases || [];
  const results = cases.map((c) => runGoldenCvCase(c, rootDir));
  const pass = results.every((r) => r.pass);
  return { pass, results, manifestVersion: manifest?.version };
}
