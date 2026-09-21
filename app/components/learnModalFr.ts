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
    explanation: "Pour une pâte de blé, étirez doucement un petit morceau pour voir s’il forme une membrane fine. C’est un indice de développement, à interpréter selon la farine et la température.",
    tip: "Si la pâte résiste, laissez-la reposer à couvert puis réessayez. Ne prolongez pas le pétrissage uniquement pour obtenir une membrane, notamment avec du seigle ou des farines complètes.",
    videoLabel: 'Lire le guide complet →',
  },
  pumpkin: {
    title: 'La forme de potiron',
    explanation: "Au pétrin à spirale, la pâte peut se rassembler en masse arrondie autour de la barre. Cela indique qu’elle gagne en cohésion, sans mesurer un pourcentage de développement.",
    tip: "Vérifiez l’élasticité et la température de la pâte en plus de sa forme. Respectez les vitesses de pétrissage autorisées par le fabricant.",
    secondTip: "Si vous ajoutez de l’eau réservée, attendez l’incorporation de chaque ajout avant de continuer.",
  },
  autolyse: {
    title: 'Autolyse',
    explanation: "Repos après avoir mélangé farine et eau, avant les autres ingrédients. Suivez cette étape lorsqu’elle est prévue dans la recette.",
    tip: "Gardez la pâte couverte et respectez la durée prévue. N’ajoutez pas un repos supplémentaire à une recette qui ne le prévoit pas.",
    videoLabel: 'Lire le guide complet →',
  },
  bassinage: {
    title: 'Bassinage',
    explanation: "Ajout progressif d’une partie de l’eau de la recette lorsque la pâte commence à se tenir. Il s’agit d’eau réservée, pas d’eau supplémentaire.",
    tip: "Utilisez la quantité réservée dans les instructions de pétrissage. Ajoutez-la par petites quantités et attendez leur incorporation.",
    secondTip: "Suivez l’ordre de votre recette ; cette technique n’est pas nécessaire pour toutes les pâtes.",
  },
  fdt: {
    title: 'Température de la pâte en fin de pétrissage',
    explanation: "La température finale de pâte se mesure juste après le pétrissage. Comparez-la à la cible indiquée dans votre recette.",
    tip: "Préparez l’eau selon la recette, puis mesurez la pâte avec un thermomètre. La température calculée reste une estimation.",
    secondTip: "Si la pâte est plus chaude que prévu, contrôlez la pousse plus tôt ; si elle est plus froide, laissez plus de temps. Vérifiez les signes indiqués dans la recette avant de continuer.",
    videoLabel: 'Lire le guide complet →',
  },
  poke_test: {
    title: 'Le test du doigt',
    explanation: "Appuyez doucement avec un doigt fariné et observez la réaction. Comparez-la à la levée, à la surface et aux repères d’apprêt de la recette.",
    tip: "Pour le pain, un retour lent et partiel avec une levée visible peut indiquer que la pâte est prête. Si elle reste ferme, revient vite et a peu gonflé, prolongez l’apprêt.",
    secondTip: "La température et la farine influencent le résultat. Ne décidez pas d’enfourner sur ce seul test.",
  },
  bulk_fermentation: {
    title: 'Pointage',
    explanation: "La pâte fermente en une seule masse avant la division et le façonnage. Suivez les repères de volume et de texture de cette étape.",
    tip: "Marquez le niveau initial dans un récipient à bords droits. Observez ensemble levée, bulles et tenue plutôt que de viser la même augmentation pour toutes les recettes.",
    videoLabel: 'Lire le guide complet →',
  },
  preferment_ready: {
    title: 'Est-il prêt ?',
    explanation: "Vérifiez le préferment en plus de l’heure prévue. Son aspect dépend de la méthode : poolish, biga ou levain.",
    tip: "Poolish : surface bulleuse qui commence à s’aplanir après la levée. Biga : masse gonflée et alvéoles dans un morceau ouvert. Levain : nette montée et bulles ; le test de flottaison seul ne suffit pas.",
    secondTip: "Si la maturité ne correspond pas au planning, réévaluez-le avant de pétrir. L’odeur seule ne suffit pas à déterminer la maturité.",
  },
  shape_check: {
    title: 'Vérifiez votre façonnage',
    explanation: "Façonnez une surface régulière et fermez la soudure sans déchirer la pâte. Suivez la méthode prévue pour votre pain ou votre pizza.",
    tip: "Arrêtez de resserrer si la surface commence à se déchirer. La tenue dépend de la force de la pâte et de son hydratation.",
    secondTip: "Si la pâte résiste, couvrez-la et laissez-la se détendre avant de reprendre doucement.",
  },
  score_technique: {
    title: 'La technique de lame',
    explanation: "Grignez juste avant d’enfourner, selon le motif et la profondeur prévus pour votre pain. Utilisez une lame affûtée et un geste maîtrisé.",
    tip: "Soutenez la pâte sans l’écraser. Évitez les passages répétés qui accrochent ou déchirent la surface.",
    secondTip: "Le grignage aide à diriger l’ouverture au four ; il ne corrige pas un apprêt insuffisant ou excessif.",
  },
  stretch_bake: {
    title: 'Abaisser et enfourner',
    explanation: "Étalez selon la méthode de votre style de pizza. Préservez la bordure lorsque le style le prévoit ; la romaine fine peut être étalée au rouleau.",
    tip: "Égouttez les garnitures humides, garnissez la pizza et vérifiez qu’elle glisse sur la pelle avant d’enfourner.",
    secondTip: "Si la pâte résiste à l’étalage, couvrez-la et laissez-la reposer avant de réessayer. Suivez les repères de réchauffage et de cuisson de la recette.",
  },
};
