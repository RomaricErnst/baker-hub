/* ─────────────────────────────────────────────────────────────────
   Baker Hub — Sourdough engine audit harness
   Load on bakerhub.app (any page with the scheduler mounted):

     const s = document.createElement('script');
     s.src = '/sourdough-audit.js'; document.head.appendChild(s);

   Then:
     __bhAudit.capture('label')   → one structured snapshot + assertions
     __bhAudit.report()           → cumulative pass/fail table
     __bhAudit.clear()            → reset stored captures
     __bhAudit.click('Yesterday') → click a UI element by visible text
     __bhAudit.help()

   Method (matches the audit methodology from the May/June sessions):
   chart SVG ↔ card text ↔ FermentChart props must agree. Divergence = bug.
   ───────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── React fiber access ──────────────────────────────────────────
  function fiberOf(el) {
    if (!el) return null;
    const k = Object.keys(el).find(x => x.startsWith('__reactFiber$'));
    return k ? el[k] : null;
  }

  // Find the FermentChart props: walk up from the chart <svg> until a fiber
  // whose memoizedProps carry eatTime + startTime-ish chart props.
  function chartProps() {
    const svgs = [...document.querySelectorAll('svg')].filter(s => s.getAttribute('viewBox'));
    for (const svg of svgs) {
      let f = fiberOf(svg) || fiberOf(svg.parentElement);
      let hops = 0;
      while (f && hops < 40) {
        const p = f.memoizedProps;
        if (p && p.eatTime instanceof Date && ('mixOffsetH' in p || 'prefOffsetH' in p)) return { props: p, svg };
        f = f.return; hops++;
      }
    }
    return null;
  }

  // ── DOM extraction ─────────────────────────────────────────────
  function cardRows() {
    // Card rows are UPPERCASE mono labels followed by a date line.
    const LABELS = ['NEXT FEED', 'REFRESH FEED', 'PRE-MIX FEED', 'LAST FED', 'PEAK', 'REMOVE FROM FRIDGE',
      'INTO FRIDGE', 'START DOUGH', 'MAKE POOLISH', 'MAKE BIGA', 'FEED',
      'RAFRAÎCHI', 'PIC', 'SORTIR DU FRIGO', 'PÉTRISSAGE'];
    const out = [];
    document.querySelectorAll('div').forEach(d => {
      const t = (d.textContent || '').trim();
      if (d.children.length === 0 && LABELS.some(L => t === L || t.startsWith(L + ' '))) {
        const val = d.nextElementSibling ? (d.nextElementSibling.textContent || '').trim() : '';
        out.push({ label: t, value: val });
      }
    });
    return out;
  }

  function svgIntegrity(svg) {
    const paths = [...svg.querySelectorAll('path')];
    const bad = paths.filter(p => /NaN|Infinity/.test(p.getAttribute('d') || ''));
    const diamonds = [...svg.querySelectorAll('rect,polygon,path')]
      .filter(el => (el.getAttribute('transform') || '').includes('rotate(45'));
    return { pathCount: paths.length, badPaths: bad.length, diamondCount: diamonds.length };
  }

  function pillStates() {
    return [...document.querySelectorAll('span,div')]
      .filter(el => el.children.length === 0)
      .map(el => (el.textContent || '').trim())
      .filter(t => /^(🟢|🟡|🔴|●)/.test(t))
      .slice(0, 12);
  }

  // ── Assertions ────────────────────────────────────────────────
  function assess(cp) {
    const problems = [];
    const notes = [];
    if (!cp) { problems.push('FermentChart props not found — is the scheduler visible?'); return { problems, notes }; }
    const { props: p, svg } = cp;
    const integ = svgIntegrity(svg);
    if (integ.badPaths > 0) problems.push(`${integ.badPaths} SVG path(s) contain NaN/Infinity`);

    const bakeMs = p.eatTime.getTime();
    const hbf = (d) => (bakeMs - d.getTime()) / 3600000;

    // Event coherence: every event in the future should have a visible diamond
    const evs = (p.starterEvents || []).filter(e => e && e.kind && e.kind !== 'fridge_out');
    if (evs.length && integ.diamondCount + 1 < evs.length) {
      notes.push(`events=${evs.length} vs diamonds≈${integ.diamondCount} — verify visually (collision suppression can hide some)`);
    }

    // Chronology: events strictly ordered, all before bake
    const times = (p.starterEvents || []).map(e => e.time instanceof Date ? e.time.getTime() : null).filter(Boolean);
    for (let i = 1; i < times.length; i++) {
      if (times[i] < times[i - 1]) problems.push(`event #${i} out of chronological order`);
    }
    times.forEach((t, i) => { if (t > bakeMs) problems.push(`event #${i} is AFTER bake time`); });

    // Feed-to-mix biology: mix should not be closer than 0.5×adjPeak to the last feed
    const feeds = (p.starterEvents || []).filter(e => /feed|refresh|pre_mix/.test(e.kind || ''));
    if (feeds.length && p.mixOffsetH != null) {
      const lastFeed = feeds[feeds.length - 1];
      if (lastFeed.time instanceof Date) {
        const feedToMixH = hbf(lastFeed.time) - p.mixOffsetH;
        if (feedToMixH < 2) problems.push(`last feed only ${feedToMixH.toFixed(1)}h before mix — starter cannot peak`);
        if (feedToMixH > 48) notes.push(`last feed ${feedToMixH.toFixed(1)}h before mix — long; expected only for fridge-hold paths`);
      }
    }

    return { problems, notes, integ, eventKinds: (p.starterEvents || []).map(e => e.kind) };
  }

  // ── Public API ────────────────────────────────────────────────
  const captures = [];
  window.__bhAudit = {
    capture(label) {
      const cp = chartProps();
      const a = assess(cp);
      const snap = {
        label: label || `capture_${captures.length + 1}`,
        at: new Date().toISOString(),
        bakeTime: cp ? cp.props.eatTime.toISOString() : null,
        mixOffsetH: cp ? cp.props.mixOffsetH : null,
        prefOffsetH: cp ? cp.props.prefOffsetH : null,
        eventKinds: a.eventKinds || [],
        cardRows: cardRows(),
        pills: pillStates(),
        svg: a.integ || null,
        problems: a.problems,
        notes: a.notes,
        pass: a.problems.length === 0,
      };
      captures.push(snap);
      try { localStorage.setItem('bh_audit_v2', JSON.stringify(captures)); } catch (e) {}
      console.log(`[bhAudit] ${snap.label}: ${snap.pass ? 'PASS' : 'FAIL'}`, snap);
      return snap;
    },
    report() {
      console.table(captures.map(c => ({
        label: c.label, pass: c.pass,
        problems: c.problems.join(' | '),
        events: c.eventKinds.join(','),
        rows: c.cardRows.length, badPaths: c.svg ? c.svg.badPaths : '-',
      })));
      return captures;
    },
    clear() { captures.length = 0; try { localStorage.removeItem('bh_audit_v2'); } catch (e) {} },
    click(text) {
      const el = [...document.querySelectorAll('button,span,div,label')]
        .find(e => e.children.length === 0 && (e.textContent || '').trim() === text);
      if (el) { el.click(); return true; }
      console.warn(`[bhAudit] no element with text "${text}"`); return false;
    },
    help() {
      console.log(`Baker Hub sourdough audit
Suggested sweep (set up a sourdough bake in Custom mode first):
  for each lastFedAge chip in [Today, Yesterday, 2-3 days ago, 4-5 days ago, A week+]:
    for each location in [Room temp, Fridge]:
      __bhAudit.click(location); __bhAudit.click(age);
      await new Promise(r=>setTimeout(r,800));
      __bhAudit.capture(location+'_'+age);
  __bhAudit.report();
Checks per capture: SVG NaN/Infinity, event chronology, events after bake,
feed→mix biology, card rows + pills captured for manual cross-check.`);
    },
  };
  console.log('[bhAudit] ready — __bhAudit.help()');
})();
