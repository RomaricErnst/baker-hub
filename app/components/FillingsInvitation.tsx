'use client';

import Image from 'next/image';
import { SANDWICH_RECIPES } from '../lib/sandwichCatalog';
import { sandwichFamilyForStyle } from '../lib/sandwich';

const pizzaExamples = [
  { id: 'margherita', name: 'Margherita', image: '/pizzas/margherita.webp' },
  { id: 'diavola', name: 'Diavola', image: '/pizzas/diavola.webp' },
  { id: 'quattro_formaggi', name: '4 Fromages', nameEn: '4 Formaggi', image: '/pizzas/quattro_formaggi.webp' },
];

export default function FillingsInvitation({ fr, pizza, styleKey, count, selectedCount, onChoose }: {
  fr: boolean; pizza: boolean; styleKey: string; count: number; selectedCount: number; onChoose: () => void;
}) {
  const family = sandwichFamilyForStyle(styleKey);
  const examples = pizza ? pizzaExamples.map(item => ({...item, name: !fr && item.nameEn ? item.nameEn : item.name}))
    : SANDWICH_RECIPES.filter(item => item.familyId === family).slice(0, 3).map(item => ({...item, name: item.name[fr ? 'fr' : 'en']}));
  const actionLabel = selectedCount > 0 ? (fr ? `Modifier ma sélection · ${selectedCount}` : `Edit my selection · ${selectedCount}`) : (fr ? 'Choisir mes garnitures' : pizza ? 'Choose my toppings' : 'Choose my fillings');

  return <section className="bh-fillings-invitation" aria-labelledby="fillings-invitation-title">
    <div className="bh-fillings-invitation-copy">
      <h3 id="fillings-invitation-title">{fr ? 'Garnitures' : pizza ? 'Toppings' : 'Fillings'} <small style={{color:'var(--smoke)',fontSize:14,fontWeight:400}}>· {fr?'facultatif':'optional'}</small></h3>
    </div>
    <button className="bh-fillings-preview" type="button" onClick={onChoose} aria-label={actionLabel}>
      <span className="bh-fillings-examples" aria-hidden="true">{examples.map(item => <span key={item.id} className="bh-fillings-example">
        <Image src={item.image} alt="" width={240} height={160} sizes="(max-width: 600px) 30vw, 180px" />
        <span>{item.name}</span>
      </span>)}</span>
      <span className="bh-fillings-choose">{actionLabel}<span aria-hidden="true"> →</span></span>
    </button>
  </section>;
}
