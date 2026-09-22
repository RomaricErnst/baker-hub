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
  const tartine = family === 'tartine';
  const examples = pizza ? pizzaExamples.map(item => ({...item, name: !fr && item.nameEn ? item.nameEn : item.name}))
    : SANDWICH_RECIPES.filter(item => item.familyId === family).slice(0, 3).map(item => ({...item, name: item.name[fr ? 'fr' : 'en']}));
  const actionLabel = selectedCount > 0 ? (fr ? `Modifier ma sélection · ${selectedCount}` : `Edit my selection · ${selectedCount}`) : (fr ? 'Voir les recettes' : 'Explore recipes');

  return <section className="bh-fillings-invitation" aria-labelledby="fillings-invitation-title">
    <div className="bh-fillings-invitation-copy">
      <span className="bh-fillings-eyebrow">{fr ? 'Et pour les garnir ?' : 'What will you put on them?'}</span>
      <h3 id="fillings-invitation-title">{pizza ? (fr ? 'Quelles pizzas vous font envie ?' : 'Which pizzas will you make?')
        : tartine ? (fr ? 'Votre pain devient une tartine' : 'Turn your bread into open-faced toasts')
        : (fr ? 'Composez vos sandwichs' : 'Make your sandwiches')}</h3>
      <p>{pizza ? (fr ? `Choisissez les recettes pour vos ${count} pizza${count > 1 ? 's' : ''}.` : `Choose recipes for your ${count} pizza${count > 1 ? 's' : ''}.`)
        : tartine ? (fr ? 'Choisissez vos recettes, puis le nombre de portions à garnir.' : 'Choose recipes, then how many portions to top.')
        : (fr ? 'Des recettes pour le pain que vous avez choisi. Ajustez ensuite le nombre de sandwichs.' : 'Recipes for your chosen bread. Then choose how many sandwiches to make.')}</p>
    </div>
    <button className="bh-fillings-preview" type="button" onClick={onChoose} aria-label={actionLabel}>
      <span className="bh-fillings-examples" aria-hidden="true">{examples.map(item => <span key={item.id} className="bh-fillings-example">
        <Image src={item.image} alt="" width={240} height={160} sizes="(max-width: 600px) 30vw, 180px" />
        <span>{item.name}</span>
      </span>)}</span>
      <span className="bh-fillings-choose">{actionLabel}<span aria-hidden="true"> →</span></span>
    </button>
    <p className="bh-fillings-optional">{selectedCount > 0 ? (fr ? 'Votre sélection est conservée. Vous pouvez la modifier à tout moment.' : 'Your selection is saved. You can change it at any time.') : (fr ? 'Facultatif — vous pouvez continuer avec la pâte seule et choisir plus tard.' : 'Optional — continue with dough only and choose later.')}</p>
  </section>;
}
