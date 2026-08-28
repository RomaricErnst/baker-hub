'use client';

/**
 * The one info affordance, used everywhere.
 *
 * The app had four sizes for the same sign — 13px in the recipe, 15px in the
 * fine settings, 16px in the scheduler, 36px on the yeast list. Nobody sees it
 * on one screen; everybody feels it moving between them.
 *
 * Size: the mark is 22px, the target is 44px. Apple asks for 44pt and Google
 * for 48dp of TOUCH AREA, not of glyph, so a small mark inside a large button
 * satisfies both — and the 13-16px ones were below the threshold entirely.
 *
 * Placement is two rules, because there are two relationships:
 *   inline — the dot explains a WORD ("Oil %"), so it follows that word like
 *            punctuation. Right-aligning it would strand it beside a
 *            neighbouring column and leave ownership ambiguous.
 *   row    — the dot explains a ROW that is itself tappable, so it is a
 *            secondary action and sits at the trailing edge, where actions go.
 *
 * The test: does the thing being explained have a right edge of its own? A
 * label does not; a row does.
 */
export default function InfoDot({ onClick, label, inline = false }: {
  onClick: () => void;
  label: string;
  inline?: boolean;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      style={{
        width: '44px', height: '44px', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: 'none', padding: 0, cursor: 'pointer',
        // Inline, the full target would stretch the label's line box. Negative
        // margins keep the visual line 22px tall while the finger still gets 44.
        ...(inline ? { margin: '-11px -11px', verticalAlign: 'middle' } : {}),
      }}
    >
      <span style={{
        width: '22px', height: '22px', borderRadius: '11px',
        border: '1px solid rgba(156,130,72,0.45)', color: 'var(--brass)',
        fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
      }}>i</span>
    </button>
  );
}

/*
 * InfoPopover lived here. It is gone, and so is every dot that opened one.
 *
 * The rule that replaced it: if an explanation is one sentence, show it as a
 * caption under the control it explains. If it needs more than that, it opens
 * a sheet. Nothing in between. A floating panel was the worst of both — it
 * hid a sentence behind a tap, needed positioning maths that two separate
 * clipping bugs came out of, and made `i` mean three different things
 * depending on where you tapped it.
 *
 * InfoDot itself stays for the one job left: opening a sheet.
 */
