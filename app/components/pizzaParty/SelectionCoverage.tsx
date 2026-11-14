// One line under the Shopping list title: what the toppings cover, with a way to choose the rest
// (14 Nov 2026 audit: "Plan toppings for the other 2 separately" read as an instruction).
export default function SelectionCoverage({selected,planned,locale,onChoose}:{selected:number;planned:number;locale:string;onChoose?:()=>void}) {
  const fr = locale === 'fr';
  const missing = Math.max(0, planned-selected);
  const link = (text:string) => onChoose
    ? <button type="button" data-choose-pizzas onClick={onChoose} style={{font:'inherit',color:'var(--terra)',background:'none',border:0,padding:'12px 0',margin:'-12px 0',textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'}}>{text}</button>
    : null;
  return <p data-testid="selection-coverage" style={{fontFamily:'var(--font-ui)',fontSize:14,lineHeight:1.5,color:'var(--ash)',margin:'4px 0 12px'}}>
    {selected === 0
      ? <>{fr ? 'Pâte uniquement' : 'Dough ingredients only'}{onChoose && <> · {link(fr ? 'Ajouter des garnitures' : 'Add toppings')}</>}</>
      : selected > planned
      ? (fr ? `Garnitures pour ${selected} pizzas : plus que les ${planned} pâtons prévus.` : `Toppings for ${selected} pizzas: more than your ${planned} dough balls.`)
      : missing > 0
      ? <>{fr ? `Garnitures pour ${selected===1?'votre pizza choisie':`vos ${selected} pizzas choisies`}` : `Toppings for your ${selected===1?'chosen pizza':`${selected} chosen pizzas`}`}{' · '}{link(fr ? `Choisir ${missing===1?'la dernière':`les ${missing} autres`}` : `Choose the other ${missing}`) ?? (fr ? `${missing} à choisir` : `${missing} still to choose`)}</>
      : <>{fr ? `Garnitures pour vos ${planned} pizzas` : `Toppings for your ${planned} pizzas`}{onChoose && <> · {link(fr ? 'Modifier' : 'Change')}</>}</>}
  </p>;
}
