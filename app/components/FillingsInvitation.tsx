'use client';

export default function FillingsInvitation({ fr, pizza, styleKey, count, selectedCount, onChoose }: {
  fr: boolean; pizza: boolean; styleKey: string; count: number; selectedCount: number; onChoose: () => void;
}) {
  const unit = fr ? (pizza ? 'pizzas' : 'portions') : (pizza ? 'pizzas' : 'servings');
  const actionLabel = selectedCount > 0 ? (fr ? `Modifier mes garnitures · ${selectedCount}` : `Edit my selection · ${selectedCount}`) : (fr ? 'Choisir mes garnitures' : pizza ? 'Choose my toppings' : 'Choose my fillings');

  return <section className="bh-fillings-invitation" aria-label={fr?'Garnitures facultatives':'Optional toppings and fillings'}>
    <h2 style={{fontSize:18,margin:'0 0 6px'}}>{selectedCount>0?(fr?'Mes garnitures':'My toppings and fillings'):(pizza?(fr?'Et dessus ?':'And on top?'):(fr?'Et pour accompagner ?':'Make it a meal?'))}</h2>
    <p style={{fontSize:14,lineHeight:1.5,margin:'0 0 6px'}}>{selectedCount>0
      ? (fr?`Garnitures prévues pour ${selectedCount} ${unit} sur ${count}.`:`Toppings or fillings planned for ${selectedCount} of ${count} ${unit}.`)
      : (fr?'Ajoutez vos garnitures pour compléter les courses et leur préparation. C’est facultatif.':'Add toppings or fillings to complete your shopping and preparation. This is optional.')}</p>
    <button type="button" onClick={onChoose} style={{minHeight:44,border:0,background:'none',padding:'8px 0',color:'var(--terra)',font:'inherit',textDecoration:'underline'}}>{actionLabel}</button>
  </section>;
}
