export default function SelectionCoverage({selected,planned,locale}:{selected:number;planned:number;locale:string}) {
  const fr = locale === 'fr';
  const missing = Math.max(0, planned-selected);
  return <p data-testid="selection-coverage" style={{fontFamily:'var(--font-ui)',fontSize:14,lineHeight:1.5,color:'var(--smoke)',margin:'8px 0 16px'}}>
    {fr ? `Garnitures suivies : ${selected} / ${planned} pizzas.` : `Toppings tracked: ${selected} / ${planned} pizzas.`}
    {missing > 0 && <> {fr ? `Les ${missing} autres ne sont pas suivies ici ; prévoyez leurs garnitures séparément.` : `The other ${missing} are not tracked here; plan their toppings separately.`}</>}
    {selected > planned && <> {fr ? 'La sélection dépasse la quantité de pâte prévue.' : 'Your selection exceeds the planned dough quantity.'}</>}
  </p>;
}
