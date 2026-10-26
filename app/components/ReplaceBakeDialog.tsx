'use client';

import { useEffect, useRef } from 'react';

export default function ReplaceBakeDialog({ fr, rebake = false, onAnswer }: { fr: boolean; rebake?: boolean; onAnswer: (replace: boolean) => void }) {
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
      style={{ margin: 'auto', width: 'min(360px, calc(100vw - 32px))', padding: 0, border: '1px solid var(--border)', borderRadius: 16, background: 'var(--warm)', color: 'var(--char)' }}>
      <div style={{ padding: 20 }}>
        <h2 id="replace-bake-title" style={{ margin: '0 0 10px', fontSize: 21 }}>{rebake ? (fr ? 'Refaire cette recette ?' : 'Bake this recipe again?') : (fr ? 'Ouvrir cette fournée enregistrée ?' : 'Open this saved bake?')}</h2>
        <p id="replace-bake-description" style={{ margin: '0 0 20px', lineHeight: 1.5 }}>{fr ? 'Cela remplacera la fournée ouverte sur cet appareil. Vos fournées enregistrées seront conservées.' : 'This replaces the bake open on this device. Your saved bakes will stay saved.'}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button autoFocus onClick={() => onAnswer(false)} style={{ minHeight: 44, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--char)', font: 'inherit' }}>{fr ? 'Annuler' : 'Cancel'}</button>
          <button onClick={() => onAnswer(true)} style={{ minHeight: 44, padding: 12, borderRadius: 12, border: 'none', background: 'var(--terra)', color: 'white', font: 'inherit', fontWeight: 600 }}>{rebake ? (fr ? 'Refaire cette recette' : 'Bake again') : (fr ? 'Ouvrir la fournée' : 'Open saved bake')}</button>
        </div>
      </div>
    </dialog>
  );
}
