/**
 * Creative parsing mode — clients/awards/exhibitions/publications separate from experience.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const CV = `ALEX MARTIN
Art Director · Illustrator

SUMMARY
Creative director across Nike, Marvel, and Adobe ecosystems.

EXPERIENCE
2020 – Present · Nike — Lead Designer
Campaign systems in Illustrator

CLIENTS
Adobe
Nike
Marvel
Converse
Pantone
Apple
Fortune
PlayStation

AWARDS
D&AD Pencil 2022
Cannes Lions Shortlist

EXHIBITIONS
Saatchi Gallery — Group Show 2021

PUBLICATIONS
Featured in Communication Arts

PORTFOLIO
https://www.behance.net/alexmartin
behance.net/alexmartin

EDUCATION
LISAA — Bachelor Design
`;

async function main() {
  const mapper = await import(
    pathToFileURL(path.join(root, 'src/core/parsing/section-mapper.js')).href
  );
  const creative = await import(
    pathToFileURL(path.join(root, 'src/core/parsing/creative-parsing-mode.js')).href
  );

  const mode = creative.detectCreativeParsingMode(CV);
  if (!mode.active) throw new Error('creative mode not detected');

  for (const role of creative.CREATIVE_MODE_TARGET_ROLES) {
    if (!creative.detectTargetCreativeRoles(role).includes(role)) {
      throw new Error(`target role not detected: ${role}`);
    }
  }
  for (const brand of ['Adobe', 'Nike', 'Marvel', 'Converse', 'Pantone', 'Apple', 'Fortune', 'PlayStation']) {
    if (!creative.isCreativeClientEntityLine(brand)) {
      throw new Error(`not client entity: ${brand}`);
    }
  }

  const blocks = mapper.collectSectionsOrderAgnostic(CV);
  for (const section of ['clients', 'awards', 'exhibitions', 'publications']) {
    if (!(blocks[section] || []).length) throw new Error(`${section} bucket empty`);
  }
  const exp = (blocks.experience || []).join('\n');
  for (const b of ['Adobe', 'Marvel', 'D&AD', 'Saatchi', 'behance', 'Communication Arts']) {
    if (new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(exp)) {
      throw new Error(`${b} leaked into experience`);
    }
  }
  if (!blocks.clients?.some((l) => /Nike/i.test(l))) throw new Error('Nike missing from clients');
  if (!blocks.awards?.length) throw new Error('awards bucket empty');
  if (!blocks.exhibitions?.length) throw new Error('exhibitions bucket empty');
  if (!blocks.publications?.length) throw new Error('publications bucket empty');
  if (!blocks.portfolioLinks?.length && !blocks.portfolio?.length) {
    throw new Error('portfolio links missing');
  }
  if (!blocks.experience?.some((l) => /Nike/i.test(l) && /Designer/i.test(l))) {
    throw new Error('Nike job missing from experience');
  }

  console.log('qa-creative-parsing: PASS', {
    creativeScore: mode.score,
    clients: blocks.clients?.length,
    awards: blocks.awards?.length,
    exhibitions: blocks.exhibitions?.length,
  });
}

main().catch((e) => {
  console.error('qa-creative-parsing: FAIL', e.message);
  console.error(e.stack);
  process.exit(1);
});
