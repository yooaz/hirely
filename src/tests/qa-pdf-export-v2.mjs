#!/usr/bin/env node
/**
 * PDF Export V2 — static QA (packet builder, A4 pages, wiring).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPdfExportV2Packet, PDF_EXPORT_V2 } from '../core/export/pdf-export-v2.js';
import { buildRecruiterCommandCenterAudit } from '../core/validation/recruiter-command-center.js';
import { computeProductScore } from '../core/validation/product-score.js';
import { PDF_EXPORT_ENGINE_V2, A4_WIDTH_PX, A4_HEIGHT_PX } from '../core/export/pdf-export-config.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const v2Js = fs.readFileSync(path.join(ROOT, 'src/ui/export/pdf-export-v2.js'), 'utf8');
const v2Css = fs.readFileSync(path.join(ROOT, 'src/ui/export/pdf-export-v2.css'), 'utf8');
const exportJs = fs.readFileSync(path.join(ROOT, 'src/ui/export/hirely-pdf-export.js'), 'utf8');

ok(PDF_EXPORT_V2 === 'PDF_EXPORT_V2', 'packet version constant');
ok(PDF_EXPORT_ENGINE_V2 === 'PDF_EXPORT_V2', 'config engine V2');
ok(A4_WIDTH_PX === 794 && A4_HEIGHT_PX === 1123, 'A4 dimensions locked');

ok(/pdf-export-v2\.css/.test(indexHtml), 'index links pdf-export-v2.css');
ok(/pdf-export-v2\.js/.test(indexHtml), 'index loads pdf-export-v2.js');
ok(/exportPacketV2/.test(indexHtml), 'downloadPDF uses exportPacketV2');
ok(/buildPdfExportV2Context/.test(indexHtml), 'buildPdfExportV2Context helper');
ok(/exportPacketV2/.test(exportJs), 'hirely-pdf-export exportPacketV2');
ok(/exportPacketV2Blob/.test(exportJs), 'hirely-pdf-export exportPacketV2Blob');
ok(/rasterizePage/.test(exportJs), 'page-by-page rasterize');

ok(/pdfV2Page/.test(v2Css), 'fixed A4 page class');
ok(/794px/.test(v2Css), '794px width in CSS');
ok(/1123px/.test(v2Css), '1123px height in CSS');
ok(/buildCoverPage/.test(v2Js), 'cover page builder');
ok(/buildSummaryPage/.test(v2Js), 'summary page builder');
ok(/buildAuditPage/.test(v2Js), 'audit page builder');
ok(/buildNotesPage/.test(v2Js), 'recruiter notes page');
ok(/buildRecommendationsPage/.test(v2Js), 'recommendations page');
ok(/cloneCvPages/.test(v2Js), 'CV pages cloned from preview');

const fixturePath = path.join(ROOT, 'tests/fixtures/developer-cv/fixture.txt');
if (fs.existsSync(fixturePath)) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: 'developer-cv', extractionMethod: 'paste' });
  const cv = imp.cvData || imp.resumeData;
  const score = computeProductScore(cv, {
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  const audit = buildRecruiterCommandCenterAudit({
    scoreReport: score,
    cvData: cv,
    finalResumeData: imp.finalResumeData || imp.resumeData,
    resumeData: imp.resumeData,
  });
  const packet = buildPdfExportV2Packet({
    cvData: cv,
    scoreReport: score,
    recruiterAudit: audit,
    templateId: 'ats',
    templateName: 'ATS Clean',
  });

  ok(packet.version === PDF_EXPORT_V2, 'packet version');
  ok(packet.cover?.name, 'cover has candidate name');
  ok(packet.candidateSummary?.summary, 'candidate summary populated');
  ok(typeof packet.auditScore?.total === 'number', 'audit score total');
  ok(Array.isArray(packet.recruiterNotes?.strengths), 'recruiter notes strengths');
  ok(packet.recommendations?.length >= 1, 'recommendations present');
  ok(packet.includeAuditPacket === true, 'audit packet included by default');
} else {
  console.warn('SKIP fixture packet test — developer-cv fixture missing');
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll PDF Export V2 checks passed');
process.exit(failed ? 1 : 0);
