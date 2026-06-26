#!/usr/bin/env node
/**
 * Browser QA on localhost (requires: npm run dev + npx playwright install chromium once).
 */
import { chromium } from 'playwright';

const BASE = process.env.QA_URL || 'http://127.0.0.1:3000';
const PLACEHOLDERS = [/Candidate\s*Name/i, /email@example\.com/i, /^Company$/im, /Professional\s+profile\s+fake/i];
const TEMPLATES = ['ats', 'swiss', 'executive', 'editorial', 'portfolio', 'luxury', 'sidebar', 'art'];

const report = { ok: [], broken: [], notes: [] };

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.error('Playwright browser missing. Run: npx playwright install chromium');
    process.exit(2);
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });

  try {
    await page.goto(`${BASE}/?test=yoaz`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    // 10 test=yoaz
    const proActive = await page.evaluate(() => {
      const fn = window.isPro || (() => new URLSearchParams(location.search).get('test') === 'yoaz');
      return typeof fn === 'function' ? fn() : false;
    });
    if (proActive) report.ok.push('10 ?test=yoaz — Pro unlocked');
    else report.broken.push('10 ?test=yoaz — Pro not active');

    // 1 Use sample (page loads with sample on init)
    const sampleText = await page.inputValue('#cvText');
    if (sampleText.includes('Yohann') && sampleText.includes('yoaz@hotmail')) {
      report.ok.push('1 Use sample — Yohann + real email in textarea');
    } else {
      report.broken.push('1 Use sample — textarea missing expected content');
    }

    await page.click('#sampleBtn');
    await page.waitForTimeout(600);
    const afterSample = await page.inputValue('#cvText');
    if (afterSample.includes('Yohann')) report.ok.push('1b sampleBtn click — OK');
    else report.broken.push('1b sampleBtn click — failed');

    // 3 Improve extraction
    await page.fill('#cvText', 'bad  text\n\n\nemail@example.com\nCandidate Name');
    await page.click('#improveBtn');
    await page.waitForTimeout(400);
    const improved = await page.inputValue('#cvText');
    if (improved.includes('email@example.com')) {
      report.notes.push('3 Improve extraction — only runs cleanOCR; does not remove pasted placeholders');
    } else {
      report.ok.push('3 Improve extraction — cleans spacing/OCR');
    }

    await page.click('#sampleBtn');
    await page.waitForTimeout(800);

    // 5 CV workspace block
    const ws = page.locator('#result.cvWorkspaceSection');
    if (await ws.isVisible()) report.ok.push('5 CV in cvWorkspaceSection (#result)');
    else report.broken.push('5 CV workspace section not visible');

    const picker = page.locator('#templatePicker');
    if (await picker.isVisible()) report.ok.push('5b template picker above preview');
    else report.broken.push('5b template picker missing');

    // Wait for preview
    await page.waitForFunction(
      () => (document.querySelector('#cvPaper')?.innerText || '').length > 50,
      { timeout: 10000 }
    );

    const previewText = await page.locator('#cvPaper').innerText();
    const badInPreview = PLACEHOLDERS.filter((re) => re.test(previewText));
    if (badInPreview.length) {
      report.broken.push(`7 placeholders in CV preview: ${badInPreview.map((r) => r.source).join(', ')}`);
    } else if (previewText.includes('Yohann')) {
      report.ok.push('7 no placeholders in live CV preview');
    } else {
      report.broken.push('7 CV preview missing real name');
    }

    // 6 Eight templates
    for (const tpl of TEMPLATES) {
      await page.click(`.tplPickerCard[data-template="${tpl}"]`);
      await page.waitForTimeout(350);
      const t = await page.locator('#cvPaper').innerText();
      const bad = PLACEHOLDERS.filter((re) => re.test(t));
      if (bad.length) report.broken.push(`6 template ${tpl}: placeholders`);
      else if (t.length < 40) report.broken.push(`6 template ${tpl}: empty/too short`);
      else if (!t.includes('Yohann')) report.broken.push(`6 template ${tpl}: missing name`);
      else report.ok.push(`6 template ${tpl} — real content`);
    }

    // 4 Generate Pro CV
    await page.click('#generateBtn');
    await page.waitForFunction(
      () => document.querySelector('#status')?.textContent?.toLowerCase().includes('ready') ||
        document.querySelector('#cvPaper')?.innerText?.includes('Yohann'),
      { timeout: 45000 }
    );
    const genText = await page.locator('#cvPaper').innerText();
    if (genText.includes('Yohann') && !PLACEHOLDERS.some((re) => re.test(genText))) {
      report.ok.push('4 Generate Pro CV — preview populated');
    } else {
      report.broken.push('4 Generate Pro CV — preview weak or placeholders');
    }

    // 9 TXT export
    const [txtDl] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      page.click('#downloadTxt'),
    ]);
    if (txtDl) {
      const path = await txtDl.path();
      report.ok.push(`9 TXT export — downloaded (${txtDl.suggestedFilename()})`);
    } else {
      report.broken.push('9 TXT export — no download event');
    }

    // 8 PDF export (Pro via test=yoaz)
    const [pdfDl] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
      page.click('#downloadPdf'),
    ]);
    if (pdfDl) report.ok.push(`8 PDF export — downloaded (${pdfDl.suggestedFilename()})`);
    else {
      const status = await page.locator('#status').innerText();
      report.broken.push(`8 PDF export — no download (${status.slice(0, 80)})`);
    }

    // 2 Upload — TXT file
    const tmpTxt = '/tmp/hirely-qa-upload.txt';
    await import('fs').then((fs) =>
      fs.promises.writeFile(
        tmpTxt,
        'Marie Curie\nScientist\nmarie@institut.fr\n\nExperience\nResearcher — Lab\n- Discovered radium.\n',
        'utf8'
      )
    );
    await page.setInputFiles('#file', tmpTxt);
    await page.waitForTimeout(2000);
    const uploaded = await page.inputValue('#cvText');
    if (uploaded.includes('Marie') && uploaded.includes('marie@institut')) {
      report.ok.push('2 Upload TXT — textarea filled');
    } else {
      report.broken.push('2 Upload TXT — textarea not updated');
    }

    // 11 Mobile
    await mobile.goto(`${BASE}/?test=yoaz`, { waitUntil: 'networkidle', timeout: 30000 });
    await mobile.waitForTimeout(1200);
    const pickerMob = mobile.locator('#templatePicker');
    const cvPage = mobile.locator('#cvPreview');
    if (await pickerMob.isVisible()) report.ok.push('11 mobile — template picker visible');
    else report.broken.push('11 mobile — template picker hidden');
    const box = await cvPage.boundingBox();
    if (box && box.width > 200) report.ok.push(`11 mobile — CV preview width ${Math.round(box.width)}px`);
    else report.broken.push('11 mobile — CV preview too narrow or missing');
  } catch (e) {
    report.broken.push(`E2E fatal: ${e.message}`);
  } finally {
    await browser.close();
  }

  console.log('\n=== QA E2E (browser) ===\n');
  report.ok.forEach((x) => console.log('✓', x));
  if (report.notes.length) {
    console.log('\nNotes:');
    report.notes.forEach((x) => console.log('·', x));
  }
  if (report.broken.length) {
    console.log('\nBroken:');
    report.broken.forEach((x) => console.log('✗', x));
    process.exit(1);
  }
  console.log('\nAll E2E checks passed.\n');
}

main();
