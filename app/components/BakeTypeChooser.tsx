'use client';
import {useEffect,useRef} from 'react';
import OpeningChoices from './OpeningChoices';
import type {BakeType} from '../data';

/** Browsing the two families never clears the current bake. */
export default function BakeTypeChooser({fr,current,onChoose,onClose}:{fr:boolean;current:BakeType;onChoose:(type:BakeType)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=dialog.current;node?.showModal();return()=>{node?.close();};},[]);
  return <dialog ref={dialog} className="bh-type-dialog" aria-labelledby="bh-type-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="bh-type-dialog-inner">
      <button type="button" className="bh-section-back" onClick={onClose}>{fr?'← Revenir à ma fournée':'← Back to my bake'}</button>
      <h2 id="bh-type-title">{fr?'Pizza ou pain ?':'Pizza or bread?'}</h2>
      <p>{fr?'Votre choix actuel est conservé. Choisir l’autre famille recommence le choix de pâte.':'Your current choice is kept. Choosing the other family starts a new dough selection.'}</p>
      <OpeningChoices fr={fr} onSelect={type=>{if(type!==current)onChoose(type);onClose();}}/>
    </div>
  </dialog>;
}
