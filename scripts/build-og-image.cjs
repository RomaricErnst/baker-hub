#!/usr/bin/env node
// Renders the link-preview cards (1200×630) to public/og-en.png and
// public/og-fr.png. Run by hand when the promise line or the photo changes:
//   node scripts/build-og-image.cjs
// Cream ground, the wordmark in brand brown, one promise line, and the approved
// opening photo of the country loaf on the right.
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const W = 1200, H = 630, PHOTO_W = 540;
const SERIF = "Georgia, 'Liberation Serif', 'Times New Roman', serif";

const cards = {
  en: ['Pizza and bread dough,', 'planned around your day.'],
  fr: ['Vos pâtes à pizza et à pain,', 'planifiées autour de votre journée.'],
};

function svg(lines) {
  const promise = lines.map((line, i) =>
    `<tspan x="72" dy="${i === 0 ? 0 : 52}">${line}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#FDFBF7"/>
  <text x="72" y="292" font-family="${SERIF}" font-weight="700" font-size="104" letter-spacing="-2.5" fill="#6B4423">bakerhub.</text>
  <rect x="74" y="330" width="64" height="3" fill="#6B4423"/>
  <text x="72" y="404" font-family="${SERIF}" font-size="38" fill="#2B2420">${promise}</text>
</svg>`;
}

(async () => {
  const photo = await sharp(path.join(root, 'public/images/approved/opening-v2/bread.webp'))
    .resize({ height: H })
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((photo.info.width - PHOTO_W) / 2);
  const panel = await sharp(photo.data).extract({ left, top: 0, width: PHOTO_W, height: H }).toBuffer();
  for (const [locale, lines] of Object.entries(cards)) {
    const out = path.join(root, 'public', `og-${locale}.png`);
    await sharp(Buffer.from(svg(lines)))
      .composite([{ input: panel, left: W - PHOTO_W, top: 0 }])
      .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
      .toFile(out);
    console.log('wrote', path.relative(root, out));
  }
})();
