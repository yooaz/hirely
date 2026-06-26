#!/usr/bin/env node
/**
 * P0 — PORTFOLIO_EXTRACTION_ENGINE QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  PORTFOLIO_EXTRACTION_ENGINE,
  PORTFOLIO_ANCHOR_TARGETS,
  parsePortfolioLine,
  detectPortfolioLinksFromText,
  runPortfolioExtraction,
  auditPortfolioExtraction,
} from '../core/parsing/portfolio-extraction-engine.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/portfolio-links-rich.txt');
const OUT = path.join(ROOT, 'tests/output/portfolio-extraction/report.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const text = fs.readFileSync(FIXTURE, 'utf8');

const contactLine =
  'jane@studio.com · behance.net/janecreative · dribbble.com/janecreative · instagram.com/janecreative · artstation.com/janecreative';
const contactParsed = parsePortfolioLine(contactLine);
ok(contactParsed.length >= 4, `contact line parses ${contactParsed.length} links`);
ok(contactParsed.some((l) => /behance/i.test(l)), 'contact: Behance');
ok(contactParsed.some((l) => /dribbble/i.test(l)), 'contact: Dribbble');
ok(contactParsed.some((l) => /instagram/i.test(l)), 'contact: Instagram');
ok(contactParsed.some((l) => /artstation/i.test(l)), 'contact: ArtStation');

const labeled = detectPortfolioLinksFromText(
  [
    'Portfolio: https://janecreative.com',
    'Website: www.janecreative.design',
    'LinkedIn: linkedin.com/in/janecreative',
    'Foundation: foundation.app/@janecreative',
  ].join('\n')
);
for (const platform of ['Portfolio', 'Website', 'LinkedIn', 'Foundation']) {
  ok(labeled.some((l) => new RegExp(platform, 'i').test(l)), `labeled: ${platform}`);
}

const audit = auditPortfolioExtraction(text);
ok(audit.engine === PORTFOLIO_EXTRACTION_ENGINE, 'audit engine id');
ok(audit.recallPct >= 70, `fixture platform recall ${audit.recallPct}%`);
ok(audit.count >= 8, `fixture detected ${audit.count} links`);

const parsed = runSectionEngineV2(text, { rawText: text });
ok(
  parsed.structured?.metadata?.portfolioExtraction?.engine === PORTFOLIO_EXTRACTION_ENGINE,
  'section engine wires portfolio extraction'
);

const rd = buildResumeData({
  importResult: { resumeData: parsed.structured },
  structured: parsed.structured,
  rawText: text,
  cleanedText: text,
});
ok((rd.portfolioLinks || []).length >= 8, `resumeData.portfolioLinks ${(rd.portfolioLinks || []).length}`);
ok((rd.portfolioLinks || []).some((l) => /behance/i.test(l)), 'resumeData has Behance');
ok((rd.portfolioLinks || []).some((l) => /foundation/i.test(l)), 'resumeData has Foundation');
ok(rd.identity?.linkedin && /linkedin/i.test(rd.identity.linkedin), 'identity.linkedin set');

const cv = resumeDataToCvData(rd);
ok((cv.portfolioLinks || []).length >= 8, `cvData.portfolioLinks ${(cv.portfolioLinks || []).length}`);

const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
const sb = { console };
sb.window = sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(code, sb);
sb.initHirelyTemplates({
  esc: (s) => String(s || ''),
  sectionLabel: (k) => k,
  cvBlock: (t, h) => h || '',
  cvSkillsHtml: () => '',
  getPhotoHtml: () => '',
});
const html = sb.HirelyTemplates.render(cv, 'portfolio-artist');
ok(/cvSection--portfolio/.test(html), 'template renders portfolio section');
ok(/behance/i.test(html) && /foundation/i.test(html), 'template HTML includes portfolio links');

const forced = runPortfolioExtraction({ experiences: [], portfolioLinks: [], unsorted: [], identity: {} }, text, {
  forceCreative: true,
});
ok((forced.portfolioLinks || []).length >= 8, `forced extraction ${forced.portfolioLinks.length} links`);

for (const platform of PORTFOLIO_ANCHOR_TARGETS) {
  const inSource = new RegExp(platform, 'i').test(text) || new RegExp(platform.replace('ArtStation', 'artstation'), 'i').test(text);
  if (!inSource) continue;
  const hit = (rd.portfolioLinks || []).some((l) => new RegExp(platform, 'i').test(l));
  ok(hit, `anchor platform in resume: ${platform}`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      feature: 'PORTFOLIO_EXTRACTION_ENGINE',
      generatedAt: new Date().toISOString(),
      engine: PORTFOLIO_EXTRACTION_ENGINE,
      anchorTargets: PORTFOLIO_ANCHOR_TARGETS,
      audit,
      resumePortfolioLinks: rd.portfolioLinks,
      cvPortfolioLinks: cv.portfolioLinks,
      identityLinkedin: rd.identity?.linkedin,
      pipelineWired: Boolean(parsed.structured?.metadata?.portfolioExtraction),
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL portfolio-extraction' : '\nPASS portfolio-extraction');
process.exit(failed ? 1 : 0);
