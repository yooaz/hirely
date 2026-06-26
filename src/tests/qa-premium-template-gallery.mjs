#!/usr/bin/env node
/**
 * Premium Template Gallery — catalog, UI wiring, and use-case coverage.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FEATURED_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import {
  PREMIUM_GALLERY_USE_CASES,
  PREMIUM_TEMPLATE_GALLERY_META,
  templateMatchesGalleryFilter,
  galleryCardMeta,
  listGalleryUseCases,
} from '../ui/templates/premium-template-gallery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/premium-template-gallery');

const REQUIRED_USE_CASES = ['ats', 'creative', 'executive', 'portfolio', 'tech', 'consulting'];
const CARD_FIELDS = ['hiringSuccess', 'visualStyle', 'bestFor'];

let failed = 0;
const results = [];

function ok(cond, msg) {
  const pass = !!cond;
  if (!pass) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
  results.push({ check: msg, pass });
  return pass;
}

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const galleryCss = fs.readFileSync(path.join(ROOT, 'src/ui/templates/premium-template-gallery.css'), 'utf8');

ok(indexHtml.includes('premium-template-gallery.css'), 'index links gallery stylesheet');
ok(indexHtml.includes('premium-template-gallery.mjs'), 'index imports gallery module');
ok(indexHtml.includes('premiumTemplateGallery'), 'premium gallery container');
ok(indexHtml.includes('premiumGalleryFilters'), 'use-case filter tabs');
ok(indexHtml.includes('premiumGalleryGrid'), 'large preview grid');
ok(indexHtml.includes('switchTemplateAnimated'), 'animated template switching');
ok(indexHtml.includes('galleryFilter'), 'gallery filter state');
ok(indexHtml.includes('premiumTplCard'), 'premium template cards');
ok(indexHtml.includes('premiumTplHiring'), 'hiring success on cards');
ok(indexHtml.includes('premiumTplStyle'), 'visual style on cards');
ok(indexHtml.includes('cvDocWrap--keynoteOut'), 'keynote preview transition out');
ok(indexHtml.includes('cvDocWrap--keynoteIn'), 'keynote preview transition in');

ok(galleryCss.includes('premiumGalleryGrid'), 'gallery grid CSS');
ok(galleryCss.includes('premiumTplPreview'), 'large preview CSS');
ok(galleryCss.includes('premiumGalleryFilter'), 'use-case filter CSS');
ok(galleryCss.includes('cvKeynoteIn'), 'keynote animation keyframes');
ok(galleryCss.includes('premiumTplPulse'), 'card switch pulse');

ok(PREMIUM_GALLERY_USE_CASES.length >= 7, 'use case tabs include All + 6 categories');
for (const uc of REQUIRED_USE_CASES) {
  ok(PREMIUM_GALLERY_USE_CASES.some((u) => u.id === uc), `use case tab: ${uc}`);
}

for (const id of FEATURED_TEMPLATE_IDS) {
  ok(!!PREMIUM_TEMPLATE_GALLERY_META[id], `gallery meta for ${id}`);
  const meta = PREMIUM_TEMPLATE_GALLERY_META[id];
  ok(Array.isArray(meta.useCases) && meta.useCases.length, `${id} has useCases`);
  ok(String(meta.hiringSuccess || '').length > 8, `${id} hiring success copy`);
  ok(String(meta.visualStyle || '').length > 8, `${id} visual style copy`);
}

const atsIds = FEATURED_TEMPLATE_IDS.filter((id) => templateMatchesGalleryFilter(id, 'ats'));
const creativeIds = FEATURED_TEMPLATE_IDS.filter((id) => templateMatchesGalleryFilter(id, 'creative'));
ok(atsIds.length >= 2, `ATS filter shows ${atsIds.length} templates`);
ok(creativeIds.length >= 3, `Creative filter shows ${creativeIds.length} templates`);
ok(templateMatchesGalleryFilter('ats', 'all'), 'all filter matches every template');
ok(!templateMatchesGalleryFilter('ats', 'portfolio'), 'ATS not in portfolio-only filter');

const sample = galleryCardMeta('creative-director', { bestFor: 'Creative directors', category: 'Creative' });
for (const field of CARD_FIELDS) ok(!!sample[field], `card exposes ${field}`);

const fr = listGalleryUseCases('fr');
const en = listGalleryUseCases('en');
ok(fr.find((u) => u.id === 'creative')?.label === 'Créatif', 'French use-case label');
ok(en.find((u) => u.id === 'portfolio')?.label === 'Portfolio', 'English use-case label');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, 'report.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      featuredCount: FEATURED_TEMPLATE_IDS.length,
      useCases: PREMIUM_GALLERY_USE_CASES.map((u) => u.id),
      filterCounts: Object.fromEntries(
        REQUIRED_USE_CASES.map((uc) => [uc, FEATURED_TEMPLATE_IDS.filter((id) => templateMatchesGalleryFilter(id, uc)).length])
      ),
      checks: results,
      pass: failed === 0,
    },
    null,
    2
  )
);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nqa-premium-template-gallery: PASS');
}
