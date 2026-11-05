// Velvet Pages dashboard to PDF.
// Usage: node make_pdf.js DASHBOARD_HTML YYYY-MM OUT_PDF
// Prints three views into one A4 PDF: Instagram and Substack for the month, then Instagram year to date.
// Fonts come from the local @fontsource packages (run `npm install` in this folder first), so the PDF
// looks right even where Google Fonts cannot be reached.
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs'), path = require('path');

const [src, month, out] = process.argv.slice(2);
if (!src || !/^\d{4}-\d{2}$/.test(month || '') || !out) { console.error('usage: node make_pdf.js DASHBOARD_HTML YYYY-MM OUT_PDF'); process.exit(1); }
const F = path.join(__dirname, 'node_modules', '@fontsource');
const face = (fam, dir, file, w, st = 'normal') => `@font-face{font-family:"${fam}";font-style:${st};font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(F, dir, 'files', file)).toString('base64')}) format("woff2")}`;
const fonts = [face('Anton', 'anton', 'anton-latin-400-normal.woff2', 400)]
  .concat([400, 500, 600, 700].map(w => face('Inter', 'inter', `inter-latin-${w}-normal.woff2`, w)))
  .concat([400, 500, 600].map(w => face('Cormorant', 'cormorant', `cormorant-latin-${w}-normal.woff2`, w)))
  .concat([face('Cormorant', 'cormorant', 'cormorant-latin-400-italic.woff2', 400, 'italic')]).join('\n');

(async () => {
  const browser = await chromium.launch();
  const merged = await PDFDocument.create();
  const views = [['ig', month], ['sub', month], ['ig', 'ytd']];
  const errors = [];
  for (const [platform, period] of views) {
    const page = await browser.newPage({ viewport: { width: 1180, height: 1600 } });
    page.on('pageerror', e => errors.push(`${platform}/${period}: ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com/, r => r.abort());
    await page.addInitScript(s => { window.__VP_PDF = true; window.__VP_STATE = s; try { sessionStorage.clear(); } catch (e) {} }, { platform, period });
    await page.goto('file://' + path.resolve(src));
    await page.addStyleTag({ content: fonts });
    await page.waitForSelector('#views .kpis');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.querySelectorAll('.rv').forEach(e => e.classList.add('in')));
    await page.waitForTimeout(1800); // bars and counters finish animating
    const title = await page.textContent('#heroKicker');
    if (period !== 'ytd' && !title.includes(new Date(month + '-15').toLocaleDateString('en-GB', { month: 'long' }))) errors.push(`${platform}/${period}: wrong period shown (${title})`);
    const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, scale: 0.7 });
    const doc = await PDFDocument.load(buf);
    (await merged.copyPages(doc, doc.getPageIndices())).forEach(p => merged.addPage(p));
    console.log(`${platform}/${period}: ${doc.getPageCount()} pages (${title})`);
    await page.close();
  }
  merged.setTitle('Velvet Pages Performance Dashboard ' + month);
  merged.setAuthor('PBV Agency');
  fs.writeFileSync(out, await merged.save());
  await browser.close();
  console.log('wrote', out, merged.getPageCount(), 'pages', Math.round(fs.statSync(out).size / 1024), 'KB');
  if (errors.length) { console.error('ERRORS', errors); process.exit(3); }
})();
