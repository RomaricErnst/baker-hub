// scripts/audit-compatible-styles.js
// Full systematic audit of every pizza:
// 1. Does it have compatibleStyles? If not — does it NEED them?
// 2. For each style it appears in — does the correct image exist?
// 3. Generates a full report + a fix list
// Run: node scripts/audit-compatible-styles.js

const fs = require('fs');
const path = require('path');

// ── Parse pizza IDs + compatibleStyles from TypeScript source ──────────────────
// We read the .ts file as text and extract pizza entries via regex.
// This avoids needing tsx/ts-node.

const dbSrc = fs.readFileSync(
  path.join(__dirname, '../app/lib/toppingDatabase.ts'), 'utf8'
);

// Extract PIZZAS array content and DESSERT_PIZZAS array content
function extractArrayContent(src, arrayName) {
  // Find the start of the array
  const startRegex = new RegExp(`(?:^|\\n)(?:export )?const ${arrayName}[^=]*=\\s*\\[`);
  const match = src.match(startRegex);
  if (!match) return '';
  const start = src.indexOf(match[0]) + match[0].length;
  // Find matching closing bracket
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    if (src[i] === '[' || src[i] === '{') depth++;
    else if (src[i] === ']' || src[i] === '}') depth--;
    i++;
  }
  return src.slice(start, i - 1);
}

// Parse pizza objects from array source text
// Returns array of { id, compatibleStyles, name }
function parsePizzas(arraySrc) {
  const pizzas = [];
  // Split into top-level { ... } blocks
  let depth = 0;
  let blockStart = -1;
  for (let i = 0; i < arraySrc.length; i++) {
    if (arraySrc[i] === '{') {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (arraySrc[i] === '}') {
      depth--;
      if (depth === 0 && blockStart >= 0) {
        const block = arraySrc.slice(blockStart, i + 1);
        const pizza = parseBlock(block);
        if (pizza) pizzas.push(pizza);
        blockStart = -1;
      }
    }
  }
  return pizzas;
}

function parseBlock(block) {
  // Extract id
  const idMatch = block.match(/\bid:\s*['"]([^'"]+)['"]/);
  if (!idMatch) return null;
  const id = idMatch[1];

  // Extract name.en
  const nameEnMatch = block.match(/name:\s*\{[^}]*en:\s*['"]([^'"]+)['"]/);
  const nameEn = nameEnMatch ? nameEnMatch[1] : id;

  // Extract compatibleStyles array
  const csMatch = block.match(/compatibleStyles:\s*\[([^\]]*)\]/);
  let compatibleStyles = null;
  if (csMatch) {
    compatibleStyles = csMatch[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);
  }

  return { id, name: nameEn, compatibleStyles };
}

const pizzasSrc = extractArrayContent(dbSrc, 'PIZZAS');
const dessertSrc = extractArrayContent(dbSrc, 'DESSERT_PIZZAS');
const allPizzas = [...parsePizzas(pizzasSrc), ...parsePizzas(dessertSrc)];

// ── Image inventory ────────────────────────────────────────────────────────────
const PIZZAS_DIR = path.join(__dirname, '../public/pizzas');
const imageFiles = new Set(
  fs.readdirSync(PIZZAS_DIR)
    .filter(f => f.endsWith('.webp') || f.endsWith('.png'))
    .map(f => f.replace(/\.(webp|png)$/, ''))
);

// ── Style → image suffix mapping ──────────────────────────────────────────────
const VARIANT_MAP = {
  neapolitan:   null,
  sourdough:    null,
  pizza_romana: '_pizza_romana',
  roman:        '_roman',
  newyork:      '_newyork',
  pan:          '_pan',
};

// ── Style-specific base pizza IDs ─────────────────────────────────────────────
const NY_BASE_IDS = new Set([
  'ny_pepperoni_slice','hot_honey_pepperoni','white_clam_apizza','ny_sausage_peppers',
  'vodka_pizza','ny_white_pizza','buffalo_chicken','california_bbq_chicken',
  'smoked_salmon_cream_cheese','ny_clam_garlic','ny_margherita_bufala','ny_diavola',
]);
const PAN_BASE_IDS = new Set([
  'pan_margherita','pan_pepperoni_hot_honey','pan_bbq_chicken','pan_nduja_burrata','pan_4_formaggi',
  'detroit_red_top','detroit_white','detroit_sausage','detroit_veggie','chicago_deep_dish',
]);
const ROMAN_BASE_IDS = new Set([
  'teglia_patata_provola','teglia_funghi_salsiccia','teglia_prosciutto_cotto',
  'teglia_zucchine_fiori','teglia_mortadella_pistacchio','teglia_tonno_cipolla',
  'teglia_4_formaggi','teglia_speck_brie','teglia_verdure','teglia_nduja_stracciatella',
]);
// pizza_romana-native pizzas (their base image IS the romana variant)
const ROMANA_BASE_IDS = new Set([
  'carciofi_romana','carbonara_pizza','cacio_pepe_pizza','gricia_pizza','bianca_rosmarino',
  'bresaola_rucola_pizza','indivia_gorgonzola','prosciutto_stracciatella_romana',
  'patata_rosmarino_romana','verdure_grigliate_burrata','alici_fresche_romana','porcini_pecorino_romana',
]);

const ALL_STYLES = Object.keys(VARIANT_MAP);

// ── Audit ─────────────────────────────────────────────────────────────────────
const issues = [];
const fixes = [];

allPizzas.forEach(pizza => {
  const { id, compatibleStyles, name } = pizza;

  const showsFor = compatibleStyles?.length ? compatibleStyles : ALL_STYLES;
  const hasNoCS = !compatibleStyles?.length;
  const baseImg = imageFiles.has(id);

  const baseIsNY     = NY_BASE_IDS.has(id);
  const baseIsPan    = PAN_BASE_IDS.has(id);
  const baseIsRoman  = ROMAN_BASE_IDS.has(id);
  const baseIsRomana = ROMANA_BASE_IDS.has(id);
  const baseStyle    = baseIsNY ? 'newyork'
    : baseIsPan    ? 'pan'
    : baseIsRoman  ? 'roman'
    : baseIsRomana ? 'pizza_romana'
    : 'neapolitan';

  const pizzaIssues = [];

  // Check 1: No compatibleStyles but base image is style-specific
  if (hasNoCS && (baseIsNY || baseIsPan || baseIsRoman || baseIsRomana)) {
    pizzaIssues.push({
      type: 'WRONG_STYLE_SHOWN',
      severity: 'HIGH',
      msg: `Base image is ${baseStyle} style but pizza shows for ALL styles — will display ${baseStyle} image to wrong-style users`,
    });
    fixes.push({
      id,
      fix: 'ADD_COMPATIBLE_STYLES',
      suggestion: baseIsNY ? ['newyork']
        : baseIsPan    ? ['pan']
        : baseIsRoman  ? ['roman']
        : ['pizza_romana'],
    });
  }

  // Check 2: For each style it shows for — is the right image available?
  showsFor.forEach(style => {
    const suffix = VARIANT_MAP[style];
    const neededImg = suffix ? id + suffix : id;
    const imgExists = imageFiles.has(neededImg);

    if (!imgExists && suffix) {
      if (baseStyle !== 'neapolitan' && (style === 'neapolitan' || style === 'sourdough')) {
        pizzaIssues.push({
          type: 'MISSING_VARIANT_WRONG_BASE',
          severity: 'HIGH',
          msg: `Shows for ${style} but no ${neededImg}.webp — falls back to ${baseStyle} base image (wrong style shown)`,
        });
      } else {
        pizzaIssues.push({
          type: 'MISSING_VARIANT',
          severity: 'LOW',
          msg: `No ${neededImg}.webp — falls back to base image for ${style} (acceptable fallback)`,
        });
      }
    }
  });

  // Check 3: Base image missing entirely
  if (!baseImg) {
    pizzaIssues.push({
      type: 'MISSING_BASE_IMAGE',
      severity: 'HIGH',
      msg: 'No base image found — pizza will show blank',
    });
  }

  if (pizzaIssues.length) {
    issues.push({ id, label: name, compatibleStyles: compatibleStyles || [], baseStyle, issues: pizzaIssues });
  }
});

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('Baker Hub — Pizza Style & Image Audit');
console.log('══════════════════════════════════════════');
console.log('Total pizzas parsed: ' + allPizzas.length);
console.log('Total images found:  ' + imageFiles.size);
console.log('Pizzas with issues:  ' + issues.length + '\n');

const high = issues.filter(i => i.issues.some(x => x.severity === 'HIGH'));
const low  = issues.filter(i => i.issues.every(x => x.severity === 'LOW'));

if (high.length) {
  console.log('── HIGH SEVERITY (' + high.length + ' pizzas) ──────────────────');
  high.forEach(p => {
    console.log('\n  ' + p.id + ' ("' + p.label + '")');
    console.log('  compatibleStyles: ' + (p.compatibleStyles.length ? p.compatibleStyles.join(', ') : 'NONE — shows for all'));
    console.log('  base image style: ' + p.baseStyle);
    p.issues.filter(x => x.severity === 'HIGH').forEach(x => {
      console.log('  ⚠ [' + x.type + '] ' + x.msg);
    });
  });
}

if (low.length) {
  console.log('\n── LOW SEVERITY (' + low.length + ' pizzas) — missing variants, fallback to base ──');
  low.forEach(p => {
    p.issues.forEach(x => console.log('  ' + p.id + ': ' + x.msg));
  });
}

if (fixes.length) {
  console.log('\n── FIXES NEEDED ──────────────────────────');
  fixes.forEach(f => {
    console.log('  ' + f.fix + ': ' + f.id);
    if (f.suggestion) console.log('    → compatibleStyles: [' + f.suggestion.map(s => "'" + s + "'").join(', ') + ']');
  });
}

// Save JSON report
const report = { generated: new Date().toISOString(), total: allPizzas.length, issues };
fs.writeFileSync(path.join(__dirname, 'pizza-style-audit.json'), JSON.stringify(report, null, 2));
console.log('\nFull report saved to scripts/pizza-style-audit.json');
