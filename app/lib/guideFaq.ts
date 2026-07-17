// ── Bake Guide FAQ content ────────────────────────────────────────
// Short, honest answers to the questions bakers actually ask mid-bake.
// Keyed by guide step. Science base: Modernist Pizza Vol.4 / Modernist Bread Vol.6.

export interface FaqEntry {
  q: { en: string; fr: string };
  a: { en: string; fr: string };
}

export const GUIDE_FAQ: Record<string, FaqEntry[]> = {
  poolish: [
    {
      q: { en: 'My poolish collapsed — is it ruined?', fr: 'Mon poolish est retombé — est-il fichu ?' },
      a: {
        en: 'No. A recently collapsed poolish still works — flavour is fine, you just lose a little rising power. Use it now rather than waiting longer. If it collapsed many hours ago and smells sharply alcoholic, reduce the fermentation of the final dough slightly.',
        fr: "Non. Un poolish qui vient de retomber fonctionne encore — la saveur est là, il perd juste un peu de force. Utilisez-le maintenant plutôt que d'attendre. S'il est retombé depuis des heures et sent fort l'alcool, raccourcissez légèrement la fermentation de la pâte finale.",
      },
    },
    {
      q: { en: 'It looks flat with no bubbles — what now?', fr: "Il est plat, sans bulles — que faire ?" },
      a: {
        en: 'It needs more time or more warmth. Move it somewhere warmer (25–27°C is ideal) and check every 30 min. If your yeast was old, a flat poolish after 12h+ means start a fresh one with new yeast.',
        fr: "Il lui faut plus de temps ou de chaleur. Placez-le dans un endroit plus chaud (25–27°C idéalement) et vérifiez toutes les 30 min. Si votre levure était vieille, un poolish plat après 12h+ signifie qu'il faut en relancer un avec de la levure neuve.",
      },
    },
    {
      q: { en: 'Can I hold a ready poolish in the fridge?', fr: 'Puis-je garder un poolish prêt au frigo ?' },
      a: {
        en: 'Yes — a poolish at or near its peak holds well in the fridge for several hours (up to ~24h total). Take it out ~30 min before mixing so the yeast wakes up.',
        fr: "Oui — un poolish à son pic ou presque tient plusieurs heures au frigo (jusqu'à ~24h au total). Sortez-le ~30 min avant le pétrissage pour réveiller la levure.",
      },
    },
  ],
  biga: [
    {
      q: { en: 'My biga looks dry and shaggy — is that right?', fr: 'Ma biga semble sèche et grumeleuse — est-ce normal ?' },
      a: {
        en: 'Yes. At ~45% hydration a biga should look like rough, shaggy lumps — not a smooth dough. Resist the urge to knead it smooth; the loose structure is what develops its signature aroma.',
        fr: "Oui. À ~45% d'hydratation, une biga doit ressembler à des morceaux grossiers — pas à une pâte lisse. Ne la pétrissez pas : cette structure lâche développe son arôme caractéristique.",
      },
    },
    {
      q: { en: 'Only 24h instead of 48h — will it still work?', fr: 'Seulement 24h au lieu de 48h — ça marche quand même ?' },
      a: {
        en: 'Yes. A fridge biga is solid from ~24h; 48h just gives deeper flavour. Your yeast amount was calibrated to your actual planned window, so the timing still works.',
        fr: "Oui. Une biga au frigo est au point dès ~24h ; 48h donne simplement plus de profondeur. La levure a été calibrée sur votre fenêtre réelle, donc le timing reste bon.",
      },
    },
    {
      q: { en: 'How do I know it is ready?', fr: 'Comment savoir si elle est prête ?' },
      a: {
        en: 'Break a piece open: you want visible bubbles inside, a slightly domed mass, and a sweet-alcoholic smell. Dense with no bubbles = give it more time somewhere slightly warmer.',
        fr: "Cassez un morceau : il faut des bulles visibles à l'intérieur, une masse légèrement bombée et une odeur douce-alcoolisée. Dense et sans bulles = laissez-lui plus de temps, un peu plus au chaud.",
      },
    },
  ],
  starter: [
    {
      q: { en: 'My starter passed its peak — can I still use it?', fr: 'Mon levain a dépassé son pic — puis-je l\'utiliser ?' },
      a: {
        en: 'Within ~1–2h past peak, yes — expect slightly more tang. Much later than that, give it a quick refresh feed and mix at the next peak instead.',
        fr: "Dans l'heure ou les deux heures après le pic, oui — avec un peu plus d'acidité. Bien au-delà, refaites un rafraîchi rapide et pétrissez au pic suivant.",
      },
    },
    {
      q: { en: 'How do I know it is at peak?', fr: 'Comment savoir s\'il est au pic ?' },
      a: {
        en: 'Domed top, doubled or more, bubbles along the jar sides, pleasantly sour smell. The float test helps when unsure: a spoonful floats in water at peak.',
        fr: "Dôme au sommet, volume doublé ou plus, bulles sur les parois, odeur agréablement acidulée. En cas de doute, test de flottaison : une cuillerée flotte dans l'eau au pic.",
      },
    },
    {
      q: { en: 'I missed the feed time — what now?', fr: "J'ai raté l'heure du rafraîchi — que faire ?" },
      a: {
        en: 'Feed it now. Your mix time shifts by roughly the same delay. If the dough window gets too tight, push the bake time back rather than mixing with a weak starter.',
        fr: "Nourrissez-le maintenant. Le pétrissage se décale d'environ le même retard. Si la fenêtre devient trop courte, repoussez la cuisson plutôt que de pétrir avec un levain faible.",
      },
    },
  ],
  mix: [
    {
      q: { en: 'My dough is too sticky to handle', fr: 'Ma pâte est trop collante' },
      a: {
        en: 'Wet your hands instead of adding flour — bench flour changes the recipe, water does not. Stickiness also drops a lot after the first rest: gluten needs time, not more flour.',
        fr: "Mouillez vos mains au lieu d'ajouter de la farine — la farine change la recette, l'eau non. Le collant diminue beaucoup après le premier repos : le gluten a besoin de temps, pas de farine.",
      },
    },
    {
      q: { en: 'It fails the windowpane test — keep kneading?', fr: 'Le test de la membrane échoue — continuer à pétrir ?' },
      a: {
        en: 'Give it a 15–20 min covered rest first, then test again — gluten develops during rest too. Only knead more if it still tears after resting.',
        fr: "Laissez d'abord reposer 15–20 min à couvert, puis retestez — le gluten se développe aussi au repos. Ne re-pétrissez que si ça déchire encore après le repos.",
      },
    },
    {
      q: { en: 'My dough feels too warm after mixing', fr: 'Ma pâte est trop chaude après pétrissage' },
      a: {
        en: 'Above ~28°C, pop it in the fridge for 15–20 min before starting bulk. A warm dough ferments faster than the plan assumes — cooling it now keeps your schedule honest.',
        fr: "Au-dessus de ~28°C, mettez-la 15–20 min au frigo avant la pointe. Une pâte chaude fermente plus vite que prévu — la refroidir maintenant garde votre planning juste.",
      },
    },
  ],
  bulk: [
    {
      q: { en: 'How much should it rise during bulk?', fr: 'De combien doit-elle lever pendant la pointe ?' },
      a: {
        en: 'Look for 50–80% growth, a domed top and visible bubbles at the sides — not a full doubling for pizza. Judge by the dough, not the clock.',
        fr: "Visez 50–80% de volume en plus, un dessus bombé et des bulles sur les côtés — pas un doublement complet pour la pizza. Jugez la pâte, pas l'horloge.",
      },
    },
    {
      q: { en: 'I have to leave before bulk is done', fr: 'Je dois partir avant la fin de la pointe' },
      a: {
        en: 'Put the dough in the fridge — cold slows fermentation ~5×. Resume where you left off when back, adding a little extra time for the dough to re-warm.',
        fr: "Mettez la pâte au frigo — le froid ralentit la fermentation ~5×. Reprenez au retour, en ajoutant un peu de temps pour qu'elle se réchauffe.",
      },
    },
    {
      q: { en: 'Do I really need the stretch & folds?', fr: 'Les rabats sont-ils vraiment nécessaires ?' },
      a: {
        en: 'For higher-hydration doughs, yes — they build strength without kneading. For stiff doughs (≤60%) they matter less. Skipping one set is fine; skipping all of them gives a flatter result.',
        fr: "Pour les pâtes très hydratées, oui — ils donnent de la force sans pétrir. Pour les pâtes fermes (≤60%), moins. Sauter une série passe ; tout sauter donne un résultat plus plat.",
      },
    },
  ],
  cold: [
    {
      q: { en: 'Can I shorten or extend the fridge time?', fr: 'Puis-je raccourcir ou prolonger le frigo ?' },
      a: {
        en: 'Both work within reason. Shorter = milder flavour, still fine. Longer (up to ~72h for most doughs) = deeper flavour and more tang; past that, gluten starts degrading.',
        fr: "Les deux marchent raisonnablement. Plus court = saveur plus douce, tout à fait correct. Plus long (jusqu'à ~72h pour la plupart des pâtes) = plus de profondeur et d'acidité ; au-delà, le gluten se dégrade.",
      },
    },
    {
      q: { en: 'The dough grew a lot in the fridge — problem?', fr: 'La pâte a beaucoup gonflé au frigo — problème ?' },
      a: {
        en: 'Some growth is normal in the first hours while the dough cools. If it doubled overnight, your fridge is likely above 6°C — use the dough a bit earlier and check the fridge setting.',
        fr: "Un peu de pousse est normal les premières heures, le temps que la pâte refroidisse. Si elle a doublé pendant la nuit, votre frigo est sans doute au-dessus de 6°C — utilisez la pâte un peu plus tôt et vérifiez le réglage.",
      },
    },
  ],
  divide: [
    {
      q: { en: 'My balls will not hold their shape', fr: 'Mes pâtons ne tiennent pas leur forme' },
      a: {
        en: 'The surface needs more tension: drag each ball toward you on an unfloured patch of bench to tighten the skin, and pinch the seam closed underneath. If the dough resists, rest 10 min and re-ball.',
        fr: "La surface manque de tension : faites glisser chaque pâton vers vous sur un plan non fariné pour tendre la peau, et pincez la soudure dessous. Si la pâte résiste, laissez 10 min et refaçonnez.",
      },
    },
    {
      q: { en: 'The pieces are not equal weight — does it matter?', fr: 'Les pâtons ne font pas le même poids — grave ?' },
      a: {
        en: 'Within ±10g nobody will notice. Bigger gaps mean uneven bake times — steal a bit of dough from the heavy ones and press it into the seam of the light ones.',
        fr: "À ±10g près, personne ne verra rien. Au-delà, la cuisson devient inégale — prélevez un peu des gros et soudez-le sous les petits.",
      },
    },
  ],
  proof: [
    {
      q: { en: 'Poke test says over-proofed — can I save it?', fr: 'Le test du doigt dit sur-levée — récupérable ?' },
      a: {
        en: 'For pizza: handle gently, stretch a little thinner and bake — it will still be good, just less puffy. For bread: reshape gently, proof 20–30 min and bake; expect a denser crumb.',
        fr: "Pour la pizza : manipulez doucement, étalez un peu plus fin et cuisez — ce sera bon, juste moins gonflé. Pour le pain : refaçonnez délicatement, laissez 20–30 min et cuisez ; la mie sera plus dense.",
      },
    },
    {
      q: { en: 'Dough is still cold from the fridge — bake anyway?', fr: 'La pâte est encore froide du frigo — cuire quand même ?' },
      a: {
        en: 'Cold pizza dough tears and stays dense in the centre. Give it the full warmup — it is worth pushing dinner 20 min rather than fighting cold dough.',
        fr: "Une pâte froide se déchire et reste dense au centre. Respectez le réchauffage complet — mieux vaut décaler le dîner de 20 min que lutter contre une pâte froide.",
      },
    },
  ],
  preheat: [
    {
      q: { en: 'Is a shorter preheat really a problem?', fr: 'Un préchauffage plus court, vraiment un problème ?' },
      a: {
        en: 'Yes, for steel/stone: the surface needs the full time to store heat even if the air reaches temperature quickly. A cool surface = pale, dense base — the most common home-oven mistake.',
        fr: "Oui, pour l'acier/la pierre : la surface a besoin de tout ce temps pour emmagasiner la chaleur, même si l'air est vite chaud. Surface tiède = base pâle et dense — l'erreur n°1 au four domestique.",
      },
    },
    {
      q: { en: 'My oven does not reach the target temperature', fr: "Mon four n'atteint pas la température cible" },
      a: {
        en: 'Bake anyway at max — just expect a longer bake and check the base colour before pulling. Position the rack closer to the top element for better top colour.',
        fr: "Cuisez quand même à fond — comptez juste plus long et vérifiez la couleur du dessous avant de sortir. Rapprochez la grille de la résistance du haut pour mieux colorer le dessus.",
      },
    },
  ],
  bake: [
    {
      q: { en: 'The base is done but the top is pale', fr: 'Le dessous est cuit mais le dessus est pâle' },
      a: {
        en: 'Finish under the broiler/grill for 60–90 seconds, watching constantly. Next time, move the rack (and steel/stone) higher so the top element does more work.',
        fr: "Terminez sous le gril 60–90 secondes en surveillant constamment. La prochaine fois, montez la grille (et l'acier/la pierre) pour que la résistance du haut travaille plus.",
      },
    },
    {
      q: { en: 'The pizza stuck to the peel', fr: 'La pizza a collé à la pelle' },
      a: {
        en: 'Work faster and flour the peel more — top the pizza ON the peel and give it a small shake test before opening the oven. If it sticks mid-launch, slide it onto parchment and bake on that.',
        fr: "Travaillez plus vite et farinez mieux la pelle — garnissez la pizza SUR la pelle et faites un petit test de glisse avant d'ouvrir le four. Si ça colle au lancement, glissez-la sur du papier cuisson et enfournez avec.",
      },
    },
    {
      q: { en: 'Should bread really cool before cutting?', fr: 'Le pain doit-il vraiment refroidir avant la coupe ?' },
      a: {
        en: 'Yes — the crumb finishes setting as steam escapes. Cutting hot gives a gummy texture. One hour minimum for boules; 20–30 min for baguettes.',
        fr: "Oui — la mie finit de se structurer pendant que la vapeur s'échappe. Couper chaud donne une mie gommeuse. Une heure minimum pour les boules ; 20–30 min pour les baguettes.",
      },
    },
  ],
};
