const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SKIP = ['logo.png', 'logo-mark.png'];

async function convertDir(dir, label) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && !SKIP.includes(f));
  console.log(`\n[${label}] Converting ${files.length} PNGs...`);
  let done = 0;
  for (const f of files) {
    const input = path.join(dir, f);
    const output = path.join(dir, f.replace('.png', '.webp'));
    await sharp(input).webp({ quality: 85 }).toFile(output);
    fs.unlinkSync(input);
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${files.length}`);
  }
  console.log(`  [${label}] Done: ${done} converted.`);
}

async function run() {
  const root = path.join(__dirname, '../public');
  const pizzas = path.join(__dirname, '../public/pizzas');
  await convertDir(pizzas, 'pizzas');
  await convertDir(root, 'root');
  console.log('\nAll done!');
}

run().catch(console.error);
