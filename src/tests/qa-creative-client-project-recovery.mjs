#!/usr/bin/env node
/**
 * P1 — CREATIVE_CLIENT_PROJECT_RECOVERY QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  CREATIVE_CLIENT_PROJECT_RECOVERY,
  CREATIVE_RECOVERY_CLIENT_ANCHORS,
  CREATIVE_RECOVERY_PROJECT_TYPES,
  lineHasRoleDateCompany,
  recoverClientsFromText,
  recoverProjectsFromText,
  runCreativeClientProjectRecovery,
  auditCreativeClientProjectRecovery,
} from '../core/parsing/creative-client-project-recovery.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/creative-client-project-recovery.txt');
const CREATIVE_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt');
const RICH_FIXTURE = path.join(ROOT, 'tests/fixtures/creative-experience-rich.txt');
const OUT = path.join(ROOT, 'tests/output/creative-client-project-recovery/report.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const text = fs.readFileSync(FIXTURE, 'utf8');
const creativeText = fs.readFileSync(CREATIVE_FIXTURE, 'utf8');
const richText = fs.readFileSync(RICH_FIXTURE, 'utf8');

ok(
  !lineHasRoleDateCompany('Collaborated with Nike, Adobe, Marvel'),
  'client list line is not strict job row'
);
ok(
  lineHasRoleDateCompany('Art Director — McCann Paris — 2018 — 2020'),
  'role+date+company line detected as job row'
);

const recoveredClients = recoverClientsFromText(text);
for (const anchor of CREATIVE_RECOVERY_CLIENT_ANCHORS) {
  ok(
    recoveredClients.some((c) => c.toLowerCase() === anchor.toLowerCase()),
    `recovered client ${anchor}`
  );
}

const recoveredProjects = recoverProjectsFromText(text);
for (const type of CREATIVE_RECOVERY_PROJECT_TYPES) {
  const re = new RegExp(`\\b${type.replace(/\s+/g, '\\s+')}\\b`, 'i');
  ok(recoveredProjects.some((p) => re.test(p)), `recovered project type ${type}`);
}

const audit = auditCreativeClientProjectRecovery(text);
ok(audit.engine === CREATIVE_CLIENT_PROJECT_RECOVERY, 'audit engine id');
ok(audit.clientRecallPct >= 90, `client recall ${audit.clientRecallPct}%`);
ok(audit.projectTypeRecallPct >= 80, `project type recall ${audit.projectTypeRecallPct}%`);

const parsed = runSectionEngineV2(text, { rawText: text });
ok(
  parsed.structured?.metadata?.creativeClientProjectRecovery?.engine === CREATIVE_CLIENT_PROJECT_RECOVERY,
  'section engine wires recovery'
);
ok((parsed.structured?.clients || []).length >= 12, `structured.clients ${(parsed.structured?.clients || []).length}`);
ok((parsed.structured?.projects || []).length >= 8, `structured.projects ${(parsed.structured?.projects || []).length}`);

const expBefore = (parsed.structured?.experiences || []).length;
const recovery = runCreativeClientProjectRecovery(parsed.structured, text, { forceCreative: true });
const expAfter = (recovery.structured?.experiences || []).length;
ok(expAfter === expBefore, `no fake experiences (${expBefore} → ${expAfter})`);
ok(recovery.stats.experienceInflation === 0, 'experienceInflation is 0');

const rd = buildResumeData({
  importResult: { resumeData: parsed.structured },
  structured: parsed.structured,
  rawText: text,
  cleanedText: text,
});
ok((rd.clients || []).length >= 10, `resumeData.clients ${(rd.clients || []).length}`);
ok((rd.projects || []).length >= 6, `resumeData.projects ${(rd.projects || []).length}`);

const cv = resumeDataToCvData(rd);
const cvText = JSON.stringify(cv);
ok(/nike/i.test(cvText) && /louis\s+vuitton/i.test(cvText), 'cv data retains major clients');
ok(/poster|campaign|packaging|scarf|billboard/i.test(cvText), 'cv data retains project history');

const richParsed = runSectionEngineV2(richText, { rawText: richText });
ok(
  (richParsed.structured?.clients || []).some((c) => /nike|adobe|playstation|marvel/i.test(c)),
  'rich fixture recovers clients from experience bullet'
);
const richExpCount = (richParsed.structured?.experiences || []).length;
ok(
  richParsed.structured?.metadata?.creativeClientProjectRecovery?.experienceInflation === 0,
  `rich fixture recovery does not inflate experiences (count=${richExpCount})`
);

const creativeParsed = runSectionEngineV2(creativeText, { rawText: creativeText });
ok((creativeParsed.structured?.clients || []).length >= 6, `creative-cv fixture clients ${(creativeParsed.structured?.clients || []).length}`);

const report = {
  engine: CREATIVE_CLIENT_PROJECT_RECOVERY,
  pass: failed === 0,
  failed,
  audit,
  recoveryStats: recovery.stats,
  clients: rd.clients,
  projects: rd.projects,
  fixtures: {
    recovery: { clients: parsed.structured?.clients?.length, projects: parsed.structured?.projects?.length },
    creativeCv: { clients: creativeParsed.structured?.clients?.length },
    rich: { clients: richParsed.structured?.clients?.length, experiences: richParsed.structured?.experiences?.length },
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nCREATIVE_CLIENT_PROJECT_RECOVERY QA PASS');
