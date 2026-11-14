import { Children, Fragment, cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';

// Back controls show their destination short, so they fit on one line beside the forward button
// ("‹ Shopping list", not "Back to / Shopping list" on two lines), and keep the full phrase as
// their accessible name ("Back to Shopping list"). 14 Nov 2026 polish audit.
// Plain .ts (createElement, no JSX) so the unit tests' TypeScript loader can run it.
export function shortBackLabel(text: string): string | null {
  const t = text.trim();
  if (t === 'Previous step') return '‹ Previous';
  if (t === 'Étape précédente') return '‹ Précédent';
  const en = t.match(/^Back to (.+)$/);
  if (en) return `‹ ${en[1].replace(/^my choices$/, 'My choices')}`;
  const fr = t.match(/^Retour (?:à la |à l’|aux |au |à )(.+)$/);
  if (fr) return `‹ ${fr[1].charAt(0).toUpperCase()}${fr[1].slice(1)}`;
  return null;
}

export function BackLabel({ text }: { text: ReactNode }) {
  const short = typeof text === 'string' ? shortBackLabel(text) : null;
  if (!short) return createElement(Fragment, null, text);
  return createElement(Fragment, null,
    createElement('span', { className: 'bh-visually-hidden' }, text),
    createElement('span', { 'aria-hidden': 'true' }, short));
}

/** Wraps a back button's plain text child in BackLabel; other children pass through. */
export function withBackLabel(node: ReactNode): ReactNode {
  return Children.map(node, child => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ className?: string; children?: ReactNode }>;
    const cls = el.props.className ?? '';
    if (!/\bbh-(back-action|section-back)\b/.test(cls)) return child;
    const kids = el.props.children;
    if (typeof kids !== 'string') return child;
    return cloneElement(el, {}, createElement(BackLabel, { text: kids }));
  });
}
