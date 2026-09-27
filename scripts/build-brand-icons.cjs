// Reproducible exports from the approved flat vector master.
const sharp = require('sharp');
const path = require('node:path');
const root = path.join(__dirname, '..');
const input = path.join(root, 'public/logos/bakerhub-b-incised.svg');
(async () => {
  for (const size of [32, 180, 192, 512]) {
    await sharp(input).resize(size, size).png().toFile(path.join(root, `public/logos/bakerhub-b-${size}.png`));
  }
})();
