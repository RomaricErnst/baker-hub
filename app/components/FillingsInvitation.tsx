'use client';

export default function FillingsInvitation({ fr, pizza, count, selectedCount, onChoose, compact = false }: {
  compact?: boolean; fr: boolean; pizza: boolean; styleKey: string; count: number; selectedCount: number; onChoose: () => void;
}) {
  const unit = pizza ? (selectedCount===1?'pizza':'pizzas') : fr ? (selectedCount===1?'portion':'portions') : (selectedCount===1?'serving':'servings');
  const actionLabel = selectedCount > 0
    ? (fr ? `Modifier les garnitures · ${selectedCount} ${unit}` : `Edit ${pizza ? 'toppings' : 'fillings'} · ${selectedCount} ${unit}`)
    : (fr ? 'Ajouter des garnitures — facultatif' : `Add ${pizza ? 'toppings' : 'fillings'} — optional`);

  return <section className={compact ? "bh-fillings-invitation bh-fillings-invitation-compact" : "bh-fillings-invitation"} aria-label={fr?'Garnitures facultatives':'Optional toppings and fillings'}>
    <button type="button" onClick={onChoose} style={{minHeight:44,border:'1px solid var(--border, #E0D8CF)',borderRadius:10,background:'var(--cream, #F3EEE4)',padding:'10px 14px',color:'var(--terra)',font:'inherit',textAlign:'left'}}>{actionLabel}</button>
    {pizza && selectedCount > 0 && selectedCount !== count && <p style={{fontSize:14,lineHeight:1.5,margin:'6px 0 0'}}>{selectedCount < count
      ? (fr ? `Garnitures pour ${selectedCount} pizzas sur ${count}. Prévoyez les autres séparément.` : `Toppings for ${selectedCount} of ${count} pizzas. Plan the others separately.`)
      : (fr ? 'La sélection dépasse la quantité de pâte prévue.' : 'Your selection exceeds the planned dough quantity.')}</p>}
  </section>;
}
