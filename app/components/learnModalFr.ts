// French content for LearnModal, keyed by term. Kept beside the English in the
// same file rather than in messages/*.json: this is long-form technique prose,
// it is only ever read by one component, and 45 keys of paragraph text would
// bury the interface strings the locale files exist for.
//
// House vocabulary observed throughout: rafraîchi/rafraîchir for feeding a
// levain (never "repas" or "nourrir"), pétrissage for mixing (never
// "mélange"), and water is never "eau du robinet" — the app is
// source-agnostic about water everywhere else and this is no exception.

export type TermFr = {
  title: string;
  explanation: string;
  tip: string;
  secondTip?: string;
  videoLabel?: string;
};

export const TERMS_FR: Record<string, TermFr> = {
  windowpane: {
    title: 'Le test de la vitre',
    explanation: 'Étirez un petit morceau de pâte entre vos doigts jusqu\u2019à ce qu\u2019il devienne assez fin pour laisser passer la lumière sans se déchirer. S\u2019il s\u2019étire en une membrane fine et translucide comme une vitre, le réseau de gluten est complètement développé. S\u2019il se déchire tout de suite, poursuivez le pétrissage.',
    tip: 'Prenez un morceau de la taille d\u2019une balle de golf. Étirez-le lentement dans toutes les directions à partir du centre, en le faisant tourner au fur et à mesure.',
    videoLabel: 'Lire le guide complet →',
  },
  pumpkin: {
    title: 'La forme de potiron',
    explanation: 'Au pétrin spiral, la pâte se décolle progressivement des parois de la cuve et s\u2019enroule serrée autour de la barre, formant une boule lisse et arrondie qui évoque un potiron. Cette forme indique que le réseau de gluten se construit correctement : la pâte a assez de force pour tenir ensemble malgré la rotation de la cuve.',
    tip: 'Observez la transition : au début la pâte est irrégulière et colle aux parois. Elle se rassemble peu à peu et grimpe le long de la barre. Un potiron bien formé correspond à environ 60–70 % du développement — continuez jusqu\u2019à ce que la surface soit lisse et que la pâte se détache complètement de la cuve.',
    secondTip: 'Si vous ajoutez l\u2019eau progressivement (bassinage), attendez que le potiron se reforme entre chaque ajout. Si le potiron s\u2019effondre et que la pâte s\u2019étale, l\u2019eau est venue trop vite : arrêtez et laissez la pâte se reprendre avant de continuer.',
  },
  autolyse: {
    title: 'Autolyse',
    explanation: 'On incorpore la farine et l\u2019eau, puis on laisse reposer avant d\u2019ajouter le reste. Pendant ce repos, la farine s\u2019hydrate naturellement et le gluten commence à se former sans aucun pétrissage. On obtient une pâte plus extensible et plus agréable à travailler.',
    tip: 'Baker Hub réserve 30 min, ce qui suffit pour toute farine raffinée — davantage ne nuit pas. La farine complète en demande plus. À éviter totalement avec le seigle, où le repos affaiblit la pâte. Couvrez pour éviter le croûtage.',
    videoLabel: 'Lire le guide complet →',
  },
  bassinage: {
    title: 'Bassinage',
    explanation: 'Plutôt que d\u2019incorporer toute l\u2019eau d\u2019un coup, on en réserve 10 à 20 % que l\u2019on ajoute progressivement une fois la structure installée. Le gluten se forme d\u2019abord dans une pâte légèrement plus ferme, puis absorbe l\u2019eau supplémentaire sans devenir une masse collante impossible à travailler.',
    tip: 'Attendez que la pâte forme une boule cohérente (ou un potiron au pétrin spiral) avant d\u2019ajouter l\u2019eau réservée. Versez par petites quantités de 30 à 50 g, et attendez l\u2019absorption complète avant le versement suivant.',
    secondTip: 'Le bassinage prend tout son sens au-dessus de 70 % d\u2019hydratation. En dessous, ajoutez simplement toute l\u2019eau au départ : la technique ajoute de la complexité sans grand bénéfice.',
  },
  fdt: {
    title: 'Température de la pâte en fin de pétrissage',
    explanation: 'C\u2019est la température de votre pâte mesurée en fin de pétrissage. Elle commande directement la vitesse de démarrage de la fermentation : trop chaude, la levure part trop vite ; trop froide, elle ne bouge presque pas. Visez 23–25 °C pour la plupart des pâtes à pizza et à pain. À ne pas confondre avec la température de base (TB), qui est la constante du calcul, pas un objectif.',
    tip: 'Pour l\u2019atteindre, ajustez la température de l\u2019eau avant le pétrissage. Baker Hub la calcule pour vous dans la recette. Cuisine chaude : eau froide ou glacée. Cuisine froide : eau légèrement tiède.',
    secondTip: 'Ne dépassez jamais 28 °C en fin de pétrissage : au-delà, la levure devient imprévisible et le gluten s\u2019affaiblit. Si la pâte est tiède au toucher après le pétrissage, placez-la 15 min au froid avant le pointage.',
    videoLabel: 'Lire le guide complet →',
  },
  poke_test: {
    title: 'Le test du doigt',
    explanation: 'Enfoncez doucement un doigt fariné d\u2019environ 1 cm dans la pâte et observez sa réaction. C\u2019est ce qui vous dit si l\u2019apprêt est terminé et si la pâte est prête à enfourner.',
    tip: 'La marque revient immédiatement et la pâte semble tendue → il faut encore du temps. Elle revient lentement et partiellement → c\u2019est le moment d\u2019enfourner. Elle ne revient pas du tout et la pâte paraît molle → sur-fermentée, enfournez sans attendre.',
    secondTip: 'Faites le test sur un pâton resté au moins 20 min à température ambiante. Une pâte sortie du froid paraîtra toujours tendue, quel que soit l\u2019état réel de la fermentation.',
  },
  bulk_fermentation: {
    title: 'Pointage',
    explanation: 'La première longue pousse après le pétrissage, pendant laquelle toute la masse fermente ensemble avant d\u2019être divisée. La levure produit du CO2 (la pousse) et les enzymes décomposent amidons et protéines (le goût). C\u2019est là que se construit l\u2019essentiel des arômes.',
    tip: 'Le pointage est terminé quand la pâte a pris 50 à 75 % de volume, qu\u2019elle paraît aérienne lorsqu\u2019on remue le récipient, et que la surface est légèrement bombée et bulleuse.',
    videoLabel: 'Lire le guide complet →',
  },
  preferment_ready: {
    title: 'Est-il prêt ?',
    explanation: 'Un poolish, une biga ou un levain prêt présente : une surface bombée ou tout juste passé son pic, des bulles dans toute la masse, et un léger retrait sur les bords. Plat = il lui faut encore du temps. Affaissé ou odeur alcoolisée = trop fermenté.',
    tip: 'Poolish : le dôme doit tout juste commencer à redescendre. Biga : cassez un morceau, vous devez voir un réseau de bulles à l\u2019intérieur. Levain : il doit avoir doublé, sentir l\u2019acidulé-levuré, et passer le test de flottaison.',
    secondTip: 'Si le poolish ou la biga sent fortement l\u2019alcool ou l\u2019acétone, c\u2019est allé trop loin. Un poolish légèrement passé peut encore convenir si l\u2019on raccourcit la suite de la fermentation — mais s\u2019il sent l\u2019acétone, jetez-le.',
  },
  shape_check: {
    title: 'Vérifiez votre façonnage',
    explanation: 'Un pâton bien façonné a une surface lisse et tendue, sans déchirure, une soudure bien pincée en dessous, et garde sa forme ronde sans s\u2019étaler immédiatement.',
    tip: 'La surface doit sonner comme une peau de tambour, tendue tout autour. Si elle se déchire, refaçonnez avant l\u2019apprêt. Pour la pizza : un pâton mou et étalé sera difficile à ouvrir sans le percer. Pour une boule de pain : sans tension, le pain sera plat.',
    secondTip: 'Si la pâte se déchire dès que vous cherchez à la tendre, laissez-la détendre 5 min sur le plan de travail. Couvrez sans serrer et laissez le gluten se relâcher avant de recommencer.',
  },
  score_technique: {
    title: 'La technique de lame',
    explanation: 'Tenez la lame à 30–45 degrés de la surface de la pâte. Coupez d\u2019un seul geste franc — l\u2019hésitation fait traîner la lame. Profondeur : 5 à 7 mm.',
    tip: 'Pour une boule : une croix ou un motif en feuille, centré sur le dôme. Pour une baguette : 5 à 7 coups de lame en diagonale qui se chevauchent. Humidifiez légèrement la lame pour éviter qu\u2019elle colle. Une pâte froide se lame plus nettement — si la vôtre est très souple, 15 min au froid avant de lamer.',
    secondTip: 'La grigne décide de l\u2019endroit où le pain s\u2019ouvre. Un coup trop timide donne une croûte fendue au hasard ; pas de lame du tout et le pain éclate sur les côtés. Un seul coup franc et profond vaut mieux que plusieurs coups hésitants.',
  },
  stretch_bake: {
    title: 'Abaisser et enfourner',
    explanation: 'Étirez avec les phalanges et la gravité, jamais au rouleau. Partez du centre et laissez le poids travailler. Préservez la couronne (cornicione). Garnissez vite : sauce, puis fromage, puis le reste.',
    tip: 'Les garnitures humides passent en dernier, sinon la base détrempe. Enfournez d\u2019une seule poussée franche — l\u2019hésitation fait coller. Guettez le léopardage sur la couronne — les taches de léopard : ces marques sombres signent une bonne fermentation et une chaleur suffisante.',
    secondTip: 'Si la pâte résiste et revient sur elle-même, couvrez-la et laissez-la reposer 5 min de plus. Une pâte sortant du froid est presque impossible à étirer : ramenez toujours les pâtons à température ambiante d\u2019abord.',
  },
};
