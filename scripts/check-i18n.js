#!/usr/bin/env node
// Baker Hub i18n check
// Usage: node scripts/check-i18n.js
// Fails if any key in en.json is missing from fr.json.
// Run this manually or as part of npm run build.

const fs   = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/fr.json'), 'utf8'));

const missing = [];

function check(enObj, frObj, prefix = '') {
  for (const key of Object.keys(enObj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in frObj)) {
      missing.push(fullKey);
    } else if (typeof enObj[key] === 'object' && enObj[key] !== null) {
      check(enObj[key], frObj[key] ?? {}, fullKey);
    }
  }
}

check(en, fr);

if (missing.length > 0) {
  console.error('\n❌ i18n check failed — missing in fr.json:');
  missing.forEach(k => console.error('  ' + k));
  console.error('\nAdd French translations for these keys in messages/fr.json.');
  process.exit(1);
}

console.log('✅ i18n check passed — fr.json has all keys from en.json.');
