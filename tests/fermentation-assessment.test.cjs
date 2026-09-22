const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
    fileName: filename,
  }).outputText, filename);
};
const {assessTimingWindow} = require('../app/utils/fermentationAssessment.ts');
const Module = require('node:module');
const path = require('node:path');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  return resolve.call(this, request.startsWith('@/')
    ? path.join(__dirname, '..', request.slice(2)) : request, ...args);
};
require.extensions['.tsx'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
    fileName: filename,
  }).outputText, filename);
};
const {commercialReadinessWindow, STYLE_FERM_DEFAULTS, climateRtH} = require('../app/components/SchedulePicker.tsx');
const date = text => new Date(text);
const base = {
  mixTime: date('2026-09-23T12:00:00Z'),
  bakeTime: date('2026-09-24T18:00:00Z'),
  windowFrom: date('2026-09-23T10:00:00Z'),
  windowTo: date('2026-09-23T14:00:00Z'),
};

test('mixing window includes both boundaries and normalizes positions', () => {
  for (const [hour, marker] of [[10, 0], [12, 0.5], [14, 1]]) {
    assert.deepEqual(assessTimingWindow({...base, mixTime: date(`2026-09-23T${hour}:00:00Z`)}),
      {status: 'within', marker, offsetMinutes: 0});
  }
});

test('earlier and later mixing have signed offsets and bounded markers', () => {
  assert.deepEqual(assessTimingWindow({...base, mixTime: date('2026-09-22T10:00:00Z')}),
    {status: 'early', marker: 0, offsetMinutes: -1440});
  assert.deepEqual(assessTimingWindow({...base, mixTime: date('2026-09-24T14:00:00Z')}),
    {status: 'late', marker: 1, offsetMinutes: 1440});
});

test('multi-day and midnight-spanning windows compare absolute instants', () => {
  assert.deepEqual(assessTimingWindow({...base,
    mixTime: date('2026-09-23T00:00:00Z'),
    windowFrom: date('2026-09-22T12:00:00Z'),
    windowTo: date('2026-09-23T12:00:00Z'),
  }), {status: 'within', marker: 0.5, offsetMinutes: 0});
  assert.equal(assessTimingWindow({...base,
    mixTime: date('2026-09-23T20:00:00+08:00'),
  }).marker, 0.5);
});

test('invalid or absent guidance and impossible ordering stay unavailable without NaN', () => {
  const cases = [
    {windowFrom: null}, {windowTo: null},
    {windowFrom: new Date(NaN)}, {windowTo: new Date(NaN)},
    {mixTime: new Date(NaN)}, {bakeTime: new Date(NaN)},
    {windowFrom: base.windowTo, windowTo: base.windowFrom},
    {windowFrom: base.windowTo},
    {mixTime: base.bakeTime},
    {mixTime: date('2026-09-25T00:00:00Z')},
    {windowTo: base.bakeTime},
    {windowTo: date('2026-09-25T00:00:00Z')},
  ];
  for (const changes of cases) {
    assert.deepEqual(assessTimingWindow({...base, ...changes}),
      {status: 'unavailable', marker: null, offsetMinutes: null});
  }
});

test('style and climate guidance is supplied by the caller, never inferred from duration', () => {
  const windows = [
    ['2026-09-22T10:00:00Z', '2026-09-22T14:00:00Z', 'late'],
    ['2026-09-23T10:00:00Z', '2026-09-23T14:00:00Z', 'within'],
    ['2026-09-24T10:00:00Z', '2026-09-24T14:00:00Z', 'early'],
  ];
  for (const [from, to, status] of windows) {
    const result = assessTimingWindow({...base, windowFrom: date(from), windowTo: date(to)});
    assert.equal(result.status, status);
    assert.ok(Number.isFinite(result.marker));
    assert.ok(result.marker >= 0 && result.marker <= 1);
    assert.ok(Number.isFinite(result.offsetMinutes));
  }
});

const assessHours = ({from, to}, mixHours) => {
  const bakeTime = date('2026-10-01T18:00:00Z');
  return assessTimingWindow({bakeTime,
    mixTime: new Date(+bakeTime - mixHours * 3600000),
    windowFrom: new Date(+bakeTime - from * 3600000),
    windowTo: new Date(+bakeTime - to * 3600000),
  });
};

test('all actual commercial style windows remain finite across climate, flour and cold availability', () => {
  assert.equal(Object.keys(STYLE_FERM_DEFAULTS).length, 15);
  let valid = 0, unavailable = 0;
  for (const [style, defaults] of Object.entries(STYLE_FERM_DEFAULTS)) {
    for (const kitchenTemp of [16, 22, 30, 35]) {
      for (const flourStrength of [0.8, 1, 1.2]) {
        for (const totalWindowH of [1, 96]) {
          const label = `${style}/${kitchenTemp}/${flourStrength}/${totalWindowH}`;
          const bounds = commercialReadinessWindow({...defaults, kitchenTemp, flourStrength,
            totalWindowH, preheatMin: 45});
          assert.ok(Number.isFinite(bounds.from) && Number.isFinite(bounds.to), label);
          const result = assessHours(bounds, (bounds.from + bounds.to) / 2);
          if (bounds.from > bounds.to) {
            valid++;
            assert.equal(result.status, 'within', label);
            assert.ok(Math.abs(result.marker - 0.5) < 1e-8, label);
            assert.equal(assessHours(bounds, bounds.from + 1).status, 'early', label);
            assert.equal(assessHours(bounds, bounds.to - 0.5).status, 'late', label);
          } else {
            unavailable++;
            assert.equal(result.status, 'unavailable', label);
            assert.equal(result.marker, null, label);
          }
        }
      }
    }
  }
  assert.ok(valid > 0 && unavailable > 0, 'matrix exercises usable and contradictory windows');
});

test('shared bounds retain the actual solver window rather than the broad old chart plateau', () => {
  const defaults = STYLE_FERM_DEFAULTS.neapolitan;
  const input = {...defaults, kitchenTemp: 22, flourStrength: 1, totalWindowH: 96, preheatMin: 45};
  const bounds = commercialReadinessWindow(input);
  assert.deepEqual(bounds, {from: 34, to: 8});
  assert.equal(assessHours(bounds, 40).status, 'early', '40h is outside solver guidance despite old 50h graphic');
  assert.equal(assessHours(commercialReadinessWindow({...input, totalWindowH: 1}), 6).status,
    'unavailable', 'no cold availability must not become a fabricated green range');
});

test('commercial climate dosing does not shorten roomy timing guides and stronger flour never narrows them', () => {
  for (const defaults of Object.values(STYLE_FERM_DEFAULTS)) {
    const input = {...defaults, totalWindowH: 96, preheatMin: 45, flourStrength: 1};
    assert.deepEqual(commercialReadinessWindow({...input, kitchenTemp: 16}),
      commercialReadinessWindow({...input, kitchenTemp: 35}));
    const weak = commercialReadinessWindow({...input, kitchenTemp: 22, flourStrength: 0.8});
    const strong = commercialReadinessWindow({...input, kitchenTemp: 22, flourStrength: 1.2});
    assert.ok(strong.from >= weak.from);
    assert.equal(strong.to, weak.to);
    if (defaults.coldH === 0) assert.deepEqual(strong, weak, 'room-only guidance has no cold flour scaling');
  }
});

test('contradictory hot sourdough style bounds remain unavailable rather than reversed into green', () => {
  const invalid = [];
  for (const [style, defaults] of Object.entries(STYLE_FERM_DEFAULTS)) {
    for (const kitchenTemp of [16, 22, 30, 35]) {
      const from = (defaults.preferredColdH ?? defaults.coldH)
        + climateRtH(defaults.rtH, kitchenTemp, true);
      const to = defaults.minTotalFermH;
      const result = assessHours({from, to}, (from + to) / 2);
      if (from <= to) {
        invalid.push(`${style}/${kitchenTemp}`);
        assert.equal(result.status, 'unavailable');
      } else assert.equal(result.status, 'within');
    }
  }
  assert.deepEqual(invalid.sort(), ['roman/30', 'roman/35', 'pan/30', 'pan/35',
    'pain_seigle/30', 'pain_seigle/35'].sort());
});
