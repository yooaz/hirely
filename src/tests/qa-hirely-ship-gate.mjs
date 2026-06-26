#!/usr/bin/env node
/**
 * P0 — Hirely ship gate: 50 CV real-user acceptance + platform locks.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { assessCoreModule } from '../core/boot/boot-contract.mjs';
import { REAL_WORLD_STRESS_GOAL_PCT } from '../../tests/lib/real-world-stress-catalog.mjs';
import { runRealWorldStressSuite } from './lib/real-world-stress-suite.mjs';

export const HIRELY_SHIP_GATE_V1 = 'HIRELY_SHIP_GATE_V1';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/hirely-ship-gate');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

function runNode(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  return { pass: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  record('version', HIRELY_SHIP_GATE_V1 === 'HIRELY_SHIP_GATE_V1');

  const boot = assessCoreModule(await import('../core/index.js'));
  record('ship:core_boot', boot.importOk && !boot.fatal, boot.tier || 'ok');
  record('ship:no_core_boot_error', boot.importOk && !boot.fatal);

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  record(
    'ship:no_raw_i18n_keys',
    /extractionQuality_emailOk/.test(indexHtml) &&
      /extractionQuality_phoneOk/.test(indexHtml) &&
      !/data-i="extractionQuality_emailOk"/.test(indexHtml)
  );

  const stressReport = await runRealWorldStressSuite();
  const s = stressReport.summary;

  record('cv50:count', stressReport.count === 50, `${stressReport.count}/50`);
  record('cv50:extraction', s.extractionAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `${s.extractionAccuracy}%`);
  record('cv50:identity', s.identityAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `${s.identityAccuracy}%`);
  record('cv50:email', s.emailAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `${s.emailAccuracy}%`);
  record('cv50:phone', s.phoneAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `${s.phoneAccuracy}%`);
  record('cv50:experience', s.experienceAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `${s.experienceAccuracy}% (advisory)`);
  record('cv50:education', s.educationAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `${s.educationAccuracy}% (advisory)`);
  record('cv50:skills', s.skillsAccuracy >= REAL_WORLD_STRESS_GOAL_PCT, `${s.skillsAccuracy}%`);
  record('cv50:import_success', s.importSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT, `${s.importSuccessRate}%`);
  record('cv50:review_success', s.reviewSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT, `${s.reviewSuccessRate}%`);
  record('cv50:template_success', s.templateSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT, `${s.templateSuccessRate}%`);
  record('cv50:pdf_export_success', s.pdfExportSuccessRate >= REAL_WORLD_STRESS_GOAL_PCT, `${s.pdfExportSuccessRate}%`);
  record('ship:no_fake_data', s.noFakeDataRate >= 100, `${s.noFakeDataRate}%`);
  record('ship:no_raw_i18n_preview', s.noRawI18nRate >= 100, `${s.noRawI18nRate}%`);
  record('ship:no_stuck_import', !stressReport.results.some((r) => r.importBlocked), '0 blocked');

  const suites = {
    universalImport: runNode('src/tests/qa-universal-import-pipeline.mjs'),
    noFakePolicy: runNode('src/tests/qa-no-fake-data-policy.mjs'),
    finalPdfLock: runNode('src/tests/qa-final-pdf-export-lock.mjs'),
    ocrCleanup: runNode('src/tests/qa-ocr-data-cleanup.mjs'),
    smoke: runNode('src/tests/qa-smoke.mjs'),
  };

  record('suite:universal_import', suites.universalImport.pass, '7 formats incl. PDF protected');
  record('suite:no_fake_policy', suites.noFakePolicy.pass);
  record('suite:pdf_export_lock', suites.finalPdfLock.pass);
  record('suite:ocr_cleanup', suites.ocrCleanup.pass);
  record('ship:no_broken_export', suites.finalPdfLock.pass);

  const shipCriteria = {
    extraction95: s.extractionAccuracy >= REAL_WORLD_STRESS_GOAL_PCT,
    noFakeData: s.noFakeDataRate >= 100,
    noStuckImport: !stressReport.results.some((r) => r.importBlocked),
    noBrokenExport: suites.finalPdfLock.pass,
    noCoreBootError: boot.importOk && !boot.fatal,
    noRawI18nKeys: s.noRawI18nRate >= 100,
  };

  const shipPass = Object.values(shipCriteria).every(Boolean);

  const report = {
    version: HIRELY_SHIP_GATE_V1,
    generatedAt: new Date().toISOString(),
    pass: shipPass,
    goalPct: REAL_WORLD_STRESS_GOAL_PCT,
    summary: {
      totalChecks: checks.length,
      passChecks: checks.filter((c) => c.pass).length,
      failChecks: failed,
      extractionAccuracy: s.extractionAccuracy,
      importSuccessRate: s.importSuccessRate,
      reviewSuccessRate: s.reviewSuccessRate,
      templateSuccessRate: s.templateSuccessRate,
      pdfExportSuccessRate: s.pdfExportSuccessRate,
      cvPassRate: s.successRate,
    },
    stress: stressReport,
    suites: Object.fromEntries(
      Object.entries(suites).map(([k, v]) => [k, { pass: v.pass, tail: v.out.split('\n').slice(-8).join('\n') }])
    ),
    boot,
    checks,
    shipCriteria,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  console.log(`\n═══ Hirely Ship Gate: ${report.summary.passChecks}/${report.summary.totalChecks} PASS ═══`);
  process.exit(shipPass ? 0 : 1);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error('hirely-ship-gate failed:', err);
    process.exit(1);
  });
}
