#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const messages = Object.fromEntries(['en', 'fr'].map(locale => [
  locale, JSON.parse(fs.readFileSync(path.join(root, 'messages', locale + '.json'), 'utf8')),
]));
const failures = new Set();
function lookup(object, key) {
  return key.split('.').reduce((value, part) => value == null ? undefined : value[part], object);
}
function parity(source, target, prefix, locale) {
  for (const key of Object.keys(source)) {
    const full = prefix ? prefix + '.' + key : key;
    if (target?.[key] === undefined) failures.add(locale + ': ' + full);
    else if (source[key] && typeof source[key] === 'object') parity(source[key], target[key], full, locale);
  }
}
parity(messages.en, messages.fr, '', 'fr');
parity(messages.fr, messages.en, '', 'en');

function scope(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isBlock(parent) || ts.isSourceFile(parent)) return parent;
  }
}
function inspect(file) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const bindings = [];
  const calls = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === 'useTranslations') {
      const namespace = node.initializer.arguments[0];
      if (!namespace || ts.isStringLiteral(namespace)) {
        bindings.push({name: node.name.text, namespace: namespace?.text || '', scope: scope(node)});
      }
    }
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const call of calls) {
    let expression = call.expression;
    if (ts.isPropertyAccessExpression(expression) && ['raw', 'rich', 'markup'].includes(expression.name.text)) expression = expression.expression;
    if (!ts.isIdentifier(expression)) continue;
    const key = call.arguments[0];
    if (!key || !ts.isStringLiteral(key)) continue;
    // Resolve the closest lexical translator, so identical names in separate
    // components do not cause false namespace matches.
    const binding = bindings.filter(b => b.name === expression.text && b.scope &&
      b.scope.pos <= call.pos && b.scope.end >= call.end).sort((a,b) =>
      (a.scope.end-a.scope.pos)-(b.scope.end-b.scope.pos))[0];
    if (!binding) continue;
    const full = [binding.namespace, key.text].filter(Boolean).join('.');
    for (const locale of ['en','fr']) {
      if (lookup(messages[locale], full) === undefined) {
        failures.add(locale + ': ' + full + ' used in ' + path.relative(root,file));
      }
    }
  }
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.[jt]sx?$/.test(file)) inspect(file);
  }
}
walk(path.join(root, 'app'));
if (failures.size) {
  console.error('Translation check failed:\n' + [...failures].join('\n'));
  process.exit(1);
}
console.log('Translation parity and statically used translation keys passed.');
