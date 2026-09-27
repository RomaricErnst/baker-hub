const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/')
    ? path.join(__dirname, '..', request.slice(2))
    : request, ...args);
};
const compileTs = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
require.extensions['.ts'] = compileTs;
require.extensions['.tsx'] = compileTs;

const { futureMixBeforeBake } = require('../app/components/SchedulePicker.tsx');

test('stale sourdough mix is moved to a future slot strictly before bake', () => {
  const now = new Date('2026-09-20T10:07:00');
  const stale = new Date('2026-09-20T09:00:00');
  const bake = new Date('2026-09-20T12:00:00');

  assert.equal(
    futureMixBeforeBake(stale, bake, now)?.toISOString(),
    new Date('2026-09-20T10:30:00').toISOString(),
  );
});

test('past or too-short bake windows return no start instead of clamping to bake', () => {
  const now = new Date('2026-09-20T10:07:00');
  const stale = new Date('2026-09-20T09:00:00');

  assert.equal(futureMixBeforeBake(stale, new Date('2026-09-20T09:00:00'), now), null);
  assert.equal(futureMixBeforeBake(stale, new Date('2026-09-20T10:20:00'), now), null);
  assert.equal(futureMixBeforeBake(new Date('2026-09-20T13:00:00'), new Date('2026-09-20T12:00:00'), now), null);
});

test('empty sourdough fallback and dead-end branches cannot claim green', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../app/components/SchedulePicker.tsx'),
    'utf8',
  );
  const fallbackStart = source.indexOf('// Far-horizon fallback.');
  const fallbackEnd = source.indexOf('buildAndSetResult();', fallbackStart);
  assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
  assert.doesNotMatch(source.slice(fallbackStart, fallbackEnd), /_starterPillState\s*=\s*['"]green/);

  const deadEndStart = source.indexOf('// No feasible candidate');
  const deadEndEnd = source.indexOf('// Intermediate-refresh times', deadEndStart);
  assert.ok(deadEndStart >= 0 && deadEndEnd > deadEndStart);
  assert.doesNotMatch(source.slice(deadEndStart, deadEndEnd), /_starterPillState\s*=\s*['"]green/);
});
