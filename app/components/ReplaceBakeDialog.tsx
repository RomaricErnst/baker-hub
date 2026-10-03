'use client';

import { useEffect, useRef } from 'react';

export default function ReplaceBakeDialog({ fr, onAnswer }: { fr: boolean; onAnswer: (replace: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="replace-bake-title" aria-describedby="replace-bake-description"
      onCancel={event => { event.preventDefault(); onAnswer(false); }}
      onClick={event => { if (event.target === event.currentTarget) onAnswer(false); }}
      style={{ width: 'min(360px, calc(100vw - 32px))', padding: 0, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--warm)', color: 'var(--char)' }}>
      <div style={{ padding: 20 }}>
        <h2 id="replace-bake-title" style={{ margin: '0 0 10px', fontSize: 21 }}>{fr ? 'Commencer une nouvelle fournée ?' : 'Start a new bake?'}</h2>
        <p id="replace-bake-description" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>{fr ? 'Cela remplacera votre fournée en cours.' : 'This will replace your unfinished bake.'}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button autoFocus onClick={() => onAnswer(false)} style={{ minHeight: 44, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--char)', font: 'inherit' }}>{fr ? 'Garder ma fournée' : 'Keep current bake'}</button>
          <button onClick={() => onAnswer(true)} style={{ minHeight: 44, padding: 12, borderRadius: 12, border: 'none', background: 'var(--terra)', color: 'white', font: 'inherit', fontWeight: 600 }}>{fr ? 'Commencer une nouvelle fournée' : 'Start new bake'}</button>
        </div>
      </div>
    </dialog>
  );
}
