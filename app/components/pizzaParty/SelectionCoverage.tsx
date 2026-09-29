export default function SelectionCoverage({selected,planned,locale}:{selected:number;planned:number;locale:string}) {
  const fr = locale === 'fr';
  const missing = Math.max(0, planned-selected);
  return <p data-testid="selection-coverage" style={{fontFamily:'var(--font-ui)',fontSize:14,lineHeight:1.5,color:'var(--smoke)',margin:'8px 0 16px'}}>
    {selected === 0 ? (fr ? 'Pâte uniquement' : 'Dough ingredients only') : (fr ? `Garnitures pour ${selected} pizza${selected===1?'':'s'} sur ${planned}.` : `Toppings for ${selected} of ${planned} pizzas.`)}
    {selected > 0 && missing > 0 && <> {fr ? `Prévoyez les garnitures des ${missing} autres séparément.` : `Plan toppings for the other ${missing} separately.`}</>}
    {selected > planned && <> {fr ? 'La sélection dépasse la quantité de pâte prévue.' : 'Your selection exceeds the planned dough quantity.'}</>}
  </p>;
}
