import type React from 'react';
import { createElement } from 'react';

// ── Step navigation ───────────────────────────
// One Back and one Next for the whole app. These were duplicated per flow —
// My Dough drew a 12px crust-brown rectangle in DM Mono, Pizza Party drew
// near-black pills and rounded rectangles in the body font at three different
// weights — for controls doing exactly the same job. A baker crossing from one
// tab to the other had to relearn which shape moves them forward.
//
// The rule that comes with them: Next names where it goes. "Next: Shopping",
// not "Continue"; "Next: Prep", not "Shopping done? See the prep plan". The
// destination is the useful half of the sentence and the only half that
// changes.

export const NEXT_CTA: React.CSSProperties = {
  border: 'none', borderRadius: '12px', padding: '15px 18px',
  background: 'var(--terra)', color: '#fff',
  fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 700,
  cursor: 'pointer', boxShadow: '0 2px 9px rgba(107,68,35,0.22)',
  lineHeight: 1.2, width: '100%', minHeight: '44px',
};

export const BACK_CTA: React.CSSProperties = {
  border: '1px solid var(--border)', background: 'transparent', borderRadius: '12px',
  padding: '16px 20px', fontFamily: 'var(--font-ui)', fontSize: '14px',
  color: 'var(--ash)', cursor: 'pointer', minHeight: '44px',
};

// Secondary actions that sit beside a Next — share, skip, view. Same geometry
// as Back so a row of them lines up, but never competing with the CTA.
export const SECONDARY_CTA: React.CSSProperties = {
  ...BACK_CTA,
  background: 'var(--warm)',
  width: '100%',
  fontWeight: 500,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
};

// One sheet header across Pizzas and Fillings (16 Nov 2026 design pass): a 17 px title and a
// 44 px cream ✕ circle whose right edge sits on the 16 px gutter.
export const SHEET_TITLE: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 17, fontWeight: 600, lineHeight: 1.3, color: 'var(--char)',
};
export const SHEET_CLOSE: React.CSSProperties = {
  width: 44, height: 44, flexShrink: 0, padding: 0, margin: 0, borderRadius: '50%',
  background: 'var(--cream)', border: 0, fontSize: 14, color: 'var(--ash)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// A bottom-bar label that stays on one line (16 Nov 2026 design review): the words end in an
// ellipsis and the arrow stays visible. The button carries the class `bh-cta-one-line` and the full
// label as its aria-label, so the accessible name is the whole sentence however short it displays.
export function oneLineCta(label: string): { className: string; 'aria-label': string; children: React.ReactNode } {
  const text = label.replace(/\s*→\s*$/, '');
  return {
    className: 'bh-cta-one-line',
    'aria-label': `${text} →`,
    children: [
      createElement('span', { key: 't', className: 'bh-cta-text' }, text),
      createElement('span', { key: 'a', className: 'bh-cta-arrow', 'aria-hidden': 'true' }, ' →'),
    ],
  };
}
