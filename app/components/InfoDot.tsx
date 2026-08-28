'use client';
import { useState, useRef, useEffect } from 'react';

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

/**
 * The one anchored info popover, used everywhere a dot explains a label.
 *
 * There were four copies of this markup with identical styling and no shared
 * behaviour: none closed on an outside tap, none closed on Escape, and two
 * could sit open at once because each owned a separate boolean. The only way
 * out was to find the dot again and tap it a second time.
 *
 * The dismissal rule across the app, by weight of the thing being dismissed:
 *   popover — outside tap, Escape, or the dot again. No close button: an X on
 *             two lines of context is heavier than the context.
 *   sheet   — an explicit close control, plus backdrop and Escape.
 *
 * Owning the open state here also means opening one closes any other, since
 * the outside-tap listener fires on the one already open.
 */
export function InfoPopover({ label, children, inline = true, warn = false }: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
  warn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ up: boolean; right: boolean }>({ up: true, right: false });
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen(o => {
      if (!o && ref.current) {
        const r = ref.current.getBoundingClientRect();
        // Open upward by default, but not off the top; align right when a
        // 220px panel would otherwise run past the screen edge.
        setPlace({ up: r.top > 190, right: r.left + 220 > window.innerWidth - 12 });
      }
      return !o;
    });
  };

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <InfoDot inline={inline} label={label} onClick={toggle} />
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 40,
            ...(place.up ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            ...(place.right ? { right: 0 } : { left: 0 }),
            background: 'var(--warm)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '8px 12px', fontSize: '12px',
            color: warn ? 'var(--terra)' : '#3D3530', lineHeight: 1.5,
            minWidth: '180px', maxWidth: '220px', width: 'max-content',
            fontFamily: 'var(--font-ui)', boxShadow: '0 2px 8px rgba(43, 36, 32,0.08)',
            whiteSpace: 'normal', textTransform: 'none', letterSpacing: 'normal',
          }}
        >{children}</div>
      )}
    </span>
  );
}
