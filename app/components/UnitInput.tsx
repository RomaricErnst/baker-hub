'use client';
import React, { useState } from 'react';

// A number box whose unit sits inside it ("23 °C", "2.8 %"), so the row label fits one line
// (20 Nov 2026 round 7). The unit is painted, not typed: it is not part of the value, cannot be
// selected or edited, and is hidden from assistive technology, which reads the input's aria-label
// (the full phrase with its unit) instead. An empty box shows its placeholder ("Auto") without
// the unit; the unit appears as soon as the baker types a number.
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  suffix: string;
  /** The complete accessible name, e.g. "Dough temperature after mixing, °C". */
  label: string;
  /** Outer width; the label takes the rest of the row. */
  width?: number | string;
  /** A decimal typed in either separator (round 8: « 0,1 » in French): a text box with the decimal keypad, read
   * with parseDecimal. A number box drops or misreads a comma in some browsers ("0,1" became 1). */
  decimal?: boolean;
};

export const UNIT_INPUT_STYLE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 44, fontSize: 16, padding: '10px 12px',
  textAlign: 'right', border: '1px solid var(--border)', borderRadius: 9, background: 'white', color: 'var(--char)',
};

const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

export default function UnitInput({ suffix, label, width = 96, style, onInput, decimal = false, ...rest }: Props) {
  // A text box takes no min/max/step (the page clamps the value it reads).
  const input = decimal ? Object.fromEntries(Object.entries(rest).filter(([key]) => !['min', 'max', 'step'].includes(key))) as typeof rest : rest;
  // Uncontrolled boxes are re-keyed by the page when their value changes, so the initial state is enough;
  // typing updates it. A controlled box follows its value.
  const [typedEmpty, setTypedEmpty] = useState(isEmpty(input.defaultValue));
  const empty = 'value' in input ? isEmpty(input.value) : typedEmpty;
  const showSuffix = !empty;
  // About 9.5 px per character at 16 px Figtree, plus a 4 px gap: the unit starts just after the number.
  const suffixRoom = 12 + Math.ceil(suffix.length * 9.5) + 5;
  return (
    <span data-unit-input style={{ position: 'relative', display: 'inline-flex', flex: typeof width === 'number' ? `0 0 ${width}px` : undefined, width }}>
      <input type={decimal ? 'text' : 'number'} {...(decimal ? { inputMode: 'decimal' as const, autoComplete: 'off', spellCheck: false } : {})} aria-label={label} {...input}
        onInput={e => { setTypedEmpty(e.currentTarget.value === ''); onInput?.(e); }}
        style={{ ...UNIT_INPUT_STYLE, ...style, paddingRight: showSuffix ? suffixRoom : 12 }} />
      {showSuffix && <span aria-hidden="true" data-unit-suffix
        style={{ position: 'absolute', left: `calc(100% - ${suffixRoom - 4}px)`, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--smoke)',
          pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none', whiteSpace: 'nowrap' }}>{suffix}</span>}
    </span>
  );
}
