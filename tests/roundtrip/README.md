# Starter round-trip regression

Adapted from the user-supplied Claude round-trip kit (27 September 2026).
The real SchedulePicker is bundled with real English messages; jsdom supplies
DOM APIs and a fixed planning clock. The parent records emitted times and
starter events. PAGE=1 also feeds overrides, accepted-plan state and events back
into the component, matching the page's state flow.

```sh
npm install --prefix .ci-tools --no-audit --no-fund esbuild@0.28.2 jsdom@30.1.1
node tests/roundtrip/build.mjs
TZ=Asia/Singapore PAGE=1 SETTLE=400 node tests/roundtrip/run.mjs .ci-tools/starter-roundtrip.js
```

Six scenarios, two ratio modes, Nights and starter storage toggles: 24 trips.
Every trip starts from a new mount. The null test must be stable, controls must
exist, displayed text must return to its initial value, and parent data must
also return. Runtime errors fail the process. A no-op is reported as untested;
it is not counted as demonstrated coverage.

This is not a browser layout or biological validation. The historical harness
does not supply the parent's built dough schedule, so it cannot certify the
validity indicators. The separate mobile suite checks the real page, manual
pins, nights, visible event times, and reload persistence.

The build and JSON results live under .ci-tools, outside application source.
