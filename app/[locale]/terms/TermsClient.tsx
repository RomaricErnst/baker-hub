'use client';
import LegalPage, { type LegalContent } from '../../components/LegalPage';

const CONTENT: Record<string, LegalContent> = {
  en: {
    pageTitle: 'Terms of Service',
    pageSubtitle: 'Last updated 3 September 2026',
    footer: 'Baker Hub Beta',
    sections: [
      {
        title: 'What Baker Hub is',
        paragraphs: [
          'Baker Hub is a planning tool for home bakers. It calculates recipes and builds fermentation schedules around the time you actually have. It is run by Romaric Ernst and you can reach me at rom@bakerhub.app.',
          'Using Baker Hub means accepting what follows. It is written to be read, not to be skipped.',
        ],
      },
      {
        title: 'Your account',
        paragraphs: [
          'You sign in with a code sent to your email address, or with Google. Keeping access to that email address secure is what keeps your account secure, so treat a sign-in code the way you would treat a password: it is for you, not for forwarding.',
          'You are responsible for what happens under your account. Tell me at rom@bakerhub.app if you think someone else has got into it.',
        ],
      },
      {
        title: 'What you make stays yours',
        paragraphs: [
          'Your recipes, notes, sessions and photos belong to you. Baker Hub claims no ownership of them and makes no commercial use of them.',
          'To run the service, Baker Hub needs permission to store your content, show it back to you, and display it to anyone you deliberately share a link with. That permission covers nothing else and ends when you delete the content.',
        ],
      },
      {
        title: 'Baking is yours to judge',
        paragraphs: [
          'This is the part that matters most, so it is stated plainly rather than buried.',
          'Every schedule Baker Hub produces is an estimate. Fermentation depends on your actual kitchen temperature, your particular flour, the health of your starter, and a dozen things no model sees. A plan is a well-reasoned starting point, not a guarantee, and dough that is ready before or after the app says so is normal.',
          'You remain responsible for judging your own dough and for handling food safely — refrigeration, ingredient freshness, cooking temperatures, and allergens among them. Baker Hub gives no food-safety, dietary, medical or nutritional advice, and cannot be held responsible for a bake that fails or for illness arising from how ingredients were stored, handled or cooked.',
        ],
      },
      {
        title: 'Using it reasonably',
        paragraphs: [
          'Use Baker Hub for planning and baking. Do not attempt to break, overload or extract data from the service by automated means, do not upload content you have no right to upload, and do not use it to store or share anything unlawful.',
          'An account used to attack the service or harm other people can be closed without notice.',
        ],
      },
      {
        title: 'It is a beta, and it will change',
        paragraphs: [
          'Baker Hub is under active development by one person. Features appear, change and occasionally disappear. It may be unavailable for periods, planned or otherwise, and no particular level of availability is promised.',
          'Baker Hub is provided as it is. There is no warranty that it will be uninterrupted, error-free, or fit for any particular purpose. To the extent the law allows, liability for loss arising from using it — including a wasted bake, a lost session, or ingredients bought for a plan that changed — is excluded.',
        ],
      },
      {
        title: 'Ending it',
        paragraphs: [
          'You can stop using Baker Hub whenever you like, and ask at rom@bakerhub.app for your account and everything in it to be deleted.',
          'If the service is ever discontinued, reasonable notice will be given so you can take a copy of what you have made.',
        ],
      },
      {
        title: 'Governing law',
        paragraphs: [
          'These terms are governed by the laws of Singapore, and disputes fall to the courts of Singapore. If you are a consumer resident elsewhere, this does not remove any protection you have under the mandatory law of your own country.',
        ],
      },
      {
        title: 'Changes to these terms',
        paragraphs: [
          'If these terms change in a way that affects you, the date at the top changes with them. Continuing to use Baker Hub after that means accepting the revised version.',
        ],
      },
    ],
  },
  fr: {
    pageTitle: 'Conditions d\u2019utilisation',
    pageSubtitle: 'Dernière mise à jour le 3 septembre 2026',
    footer: 'Baker Hub Bêta',
    sections: [
      {
        title: 'Ce qu\u2019est Baker Hub',
        paragraphs: [
          'Baker Hub est un outil de planification pour les boulangers amateurs. Il calcule des recettes et construit des plannings de fermentation autour du temps dont vous disposez réellement. Il est géré par Romaric Ernst, joignable à rom@bakerhub.app.',
          'Utiliser Baker Hub, c\u2019est accepter ce qui suit. C\u2019est écrit pour être lu, pas pour être passé.',
        ],
      },
      {
        title: 'Votre compte',
        paragraphs: [
          'Vous vous connectez avec un code envoyé à votre adresse e-mail, ou avec Google. C\u2019est la sécurité de cette adresse qui fait celle de votre compte : traitez un code de connexion comme un mot de passe, il vous est destiné et ne se transfère pas.',
          'Vous êtes responsable de ce qui se passe sous votre compte. Écrivez-moi à rom@bakerhub.app si vous pensez qu\u2019une autre personne y a accédé.',
        ],
      },
      {
        title: 'Ce que vous créez vous appartient',
        paragraphs: [
          'Vos recettes, vos notes, vos fournées et vos photos vous appartiennent. Baker Hub n\u2019en revendique aucune propriété et n\u2019en fait aucun usage commercial.',
          'Pour faire fonctionner le service, Baker Hub a besoin de l\u2019autorisation de conserver vos contenus, de vous les réafficher, et de les montrer aux personnes à qui vous partagez délibérément un lien. Cette autorisation ne couvre rien d\u2019autre et prend fin lorsque vous supprimez le contenu.',
        ],
      },
      {
        title: 'C\u2019est à vous de juger votre pâte',
        paragraphs: [
          'C\u2019est le point le plus important, il est donc dit clairement plutôt qu\u2019enfoui.',
          'Chaque planning produit par Baker Hub est une estimation. La fermentation dépend de la température réelle de votre cuisine, de votre farine, de la santé de votre levain, et d\u2019une douzaine de facteurs qu\u2019aucun modèle ne voit. Un plan est un point de départ raisonné, pas une garantie, et une pâte prête avant ou après l\u2019heure annoncée est une chose normale.',
          'Vous restez responsable de l\u2019appréciation de votre pâte et de la sécurité alimentaire — réfrigération, fraîcheur des ingrédients, températures de cuisson et allergènes compris. Baker Hub ne donne aucun conseil sanitaire, diététique, médical ou nutritionnel, et ne saurait être tenu responsable d\u2019une fournée ratée ni d\u2019une maladie liée à la conservation, à la manipulation ou à la cuisson des ingrédients.',
        ],
      },
      {
        title: 'Un usage raisonnable',
        paragraphs: [
          'Utilisez Baker Hub pour planifier et pour cuire. N\u2019essayez pas de casser, de surcharger ou d\u2019extraire automatiquement les données du service, n\u2019envoyez pas de contenus que vous n\u2019avez pas le droit d\u2019envoyer, et ne vous en servez pas pour stocker ou diffuser quoi que ce soit d\u2019illicite.',
          'Un compte utilisé pour attaquer le service ou nuire à autrui peut être fermé sans préavis.',
        ],
      },
      {
        title: 'C\u2019est une bêta, et elle évoluera',
        paragraphs: [
          'Baker Hub est développé activement par une seule personne. Des fonctions apparaissent, changent et disparaissent parfois. Le service peut être indisponible, de façon planifiée ou non, et aucun niveau de disponibilité particulier n\u2019est promis.',
          'Baker Hub est fourni en l\u2019état. Aucune garantie n\u2019est donnée quant à un fonctionnement ininterrompu, sans erreur, ou adapté à un usage particulier. Dans la limite permise par la loi, la responsabilité pour les pertes liées à son utilisation — fournée gâchée, session perdue, ingrédients achetés pour un plan qui a changé — est exclue.',
        ],
      },
      {
        title: 'Y mettre fin',
        paragraphs: [
          'Vous pouvez cesser d\u2019utiliser Baker Hub quand vous le souhaitez, et demander à rom@bakerhub.app la suppression de votre compte et de tout ce qu\u2019il contient.',
          'Si le service devait être arrêté, un préavis raisonnable serait donné afin que vous puissiez récupérer une copie de ce que vous avez créé.',
        ],
      },
      {
        title: 'Droit applicable',
        paragraphs: [
          'Ces conditions sont régies par le droit de Singapour, et les litiges relèvent des tribunaux de Singapour. Si vous êtes un consommateur résidant ailleurs, cela ne vous prive d\u2019aucune protection impérative dont vous bénéficiez dans votre propre pays.',
        ],
      },
      {
        title: 'Modifications de ces conditions',
        paragraphs: [
          'Si ces conditions évoluent d\u2019une manière qui vous concerne, la date en haut de page change avec elles. Continuer à utiliser Baker Hub après cette date vaut acceptation de la version révisée.',
        ],
      },
    ],
  },
};

export default function TermsClient() {
  return <LegalPage content={CONTENT} />;
}
