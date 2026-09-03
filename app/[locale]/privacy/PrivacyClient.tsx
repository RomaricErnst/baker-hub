'use client';
import LegalPage, { type LegalContent } from '../../components/LegalPage';

const CONTENT: Record<string, LegalContent> = {
  en: {
    pageTitle: 'Privacy Policy',
    pageSubtitle: 'Last updated 3 September 2026',
    footer: 'Baker Hub Beta',
    sections: [
      {
        title: 'Who runs Baker Hub',
        paragraphs: [
          'Baker Hub is an independent project operated by Romaric Ernst. You can reach me at rom@bakerhub.app about anything on this page, including a request to see or delete your data.',
          'This policy describes what Baker Hub collects, why, and who else can see it. It reflects what the application actually does, not what a general template assumes.',
        ],
      },
      {
        title: 'What Baker Hub collects',
        paragraphs: ['There are three kinds of information, and they behave differently.'],
        bullets: [
          'Your account. If you sign in by email, that is your email address and nothing else. If you sign in with Google, Google shares your email address and basic profile information with Baker Hub. Baker Hub never receives your Google password and asks for no access to your Google account beyond identifying you.',
          'What you make. Recipes you save, dough settings, bake sessions and their snapshots, notes you write, pizza party plans and quantities, and photos you attach to a bake.',
          'Settings kept on your device. Your unit preference, shopping location, and the ticks on your prep and shopping checklists live in your browser and are never sent anywhere. Clearing your browser data removes them.',
        ],
      },
      {
        title: 'What Baker Hub does not do',
        paragraphs: [
          'There is no analytics, no advertising, no tracking pixels, and no third-party marketing tools. Nobody pays to appear in your recipes or your shopping list. The only cookie Baker Hub sets is the one that keeps you signed in.',
          'Your baking data is never sold, rented, or shared for anyone else\u2019s commercial purposes.',
        ],
      },
      {
        title: 'Photos, and the AI that reads them',
        paragraphs: [
          'Two features send a photo away from your device for analysis. When you scan a flour bag label, and when you ask for feedback on a bake, the image is sent to Anthropic\u2019s Claude API, analysed, and returned to you as text. Anthropic processes these images to produce that response.',
          'Only photographs you deliberately capture for these features are sent. Baker Hub has no access to your camera roll and reads no other images.',
        ],
      },
      {
        title: 'Photos you save, and who can see them',
        paragraphs: [
          'Photos attached to a saved bake are stored with Baker Hub\u2019s hosting provider and are served from a public link. That link is long and not published anywhere, but anyone who has it can open the photo without signing in.',
          'This is worth knowing before you upload: treat a bake photo as something you would be comfortable sharing, not as something private. You can delete any photo from the session it belongs to, which removes it from storage.',
        ],
      },
      {
        title: 'Links you share on purpose',
        paragraphs: [
          'When you share a shopping list, Baker Hub creates a public link to it. Anyone with that link can open the list without signing in. It stops being private the moment you send it, which is the point of the feature, but it is worth saying plainly.',
        ],
      },
      {
        title: 'Where your data lives, and who processes it',
        paragraphs: [
          'Baker Hub relies on a small number of services. Each one only receives what it needs to do its job.',
        ],
        bullets: [
          'Supabase — the database, sign-in, and photo storage. Your data is held on servers in Singapore.',
          'Vercel — hosting for the application itself.',
          'Anthropic — analysis of the flour-label and bake-coaching photos described above.',
          'Google — only if you choose to sign in with Google.',
          'Namecheap Private Email — delivery of your sign-in codes.',
        ],
      },
      {
        title: 'How long it is kept',
        paragraphs: [
          'Recipes and sessions stay until you delete them or ask for your account to be removed. Photos have a per-account limit; when you pass it, the oldest photos are removed automatically to keep storage in hand.',
          'To delete your account and everything attached to it, email rom@bakerhub.app. It will be done, and you will get confirmation when it is.',
        ],
      },
      {
        title: 'Your rights',
        paragraphs: [
          'Depending on where you live, you may have the right to see the data held about you, to correct it, to have it deleted, to receive a copy in a portable form, and to object to how it is handled. Baker Hub honours these requests regardless of where you live.',
          'One email to rom@bakerhub.app is enough. You do not need to give a reason.',
        ],
      },
      {
        title: 'Children',
        paragraphs: [
          'Baker Hub is not aimed at children and does not knowingly collect information from anyone under 16. If you believe a child has created an account, write to rom@bakerhub.app and it will be removed.',
        ],
      },
      {
        title: 'Changes to this policy',
        paragraphs: [
          'If this policy changes in a way that affects you, the date at the top changes with it and the change is described here rather than quietly applied.',
        ],
      },
    ],
  },
  fr: {
    pageTitle: 'Politique de confidentialité',
    pageSubtitle: 'Dernière mise à jour le 3 septembre 2026',
    footer: 'Baker Hub Bêta',
    sections: [
      {
        title: 'Qui gère Baker Hub',
        paragraphs: [
          'Baker Hub est un projet indépendant géré par Romaric Ernst. Vous pouvez me joindre à rom@bakerhub.app pour toute question portant sur cette page, y compris pour consulter ou supprimer vos données.',
          'Cette politique décrit ce que Baker Hub collecte, pourquoi, et qui d\u2019autre peut y accéder. Elle reflète ce que l\u2019application fait réellement, et non ce qu\u2019un modèle générique suppose.',
        ],
      },
      {
        title: 'Ce que Baker Hub collecte',
        paragraphs: ['Il y a trois types d\u2019informations, et elles ne se comportent pas de la même façon.'],
        bullets: [
          'Votre compte. Si vous vous connectez par e-mail, il s\u2019agit de votre adresse e-mail et de rien d\u2019autre. Si vous vous connectez avec Google, Google transmet à Baker Hub votre adresse e-mail et vos informations de profil de base. Baker Hub ne reçoit jamais votre mot de passe Google et ne demande aucun accès à votre compte Google au-delà de votre identification.',
          'Ce que vous créez. Les recettes que vous enregistrez, vos réglages de pâte, vos fournées et leurs instantanés, les notes que vous écrivez, vos soirées pizza et leurs quantités, ainsi que les photos que vous attachez à une fournée.',
          'Les préférences gardées sur votre appareil. Votre choix d\u2019unités, votre lieu de courses et les cases cochées de vos listes de préparation et de courses restent dans votre navigateur et ne sont envoyés nulle part. Effacer les données de votre navigateur les supprime.',
        ],
      },
      {
        title: 'Ce que Baker Hub ne fait pas',
        paragraphs: [
          'Il n\u2019y a ni mesure d\u2019audience, ni publicité, ni pixel de suivi, ni outil marketing tiers. Personne ne paie pour apparaître dans vos recettes ou dans votre liste de courses. Le seul cookie déposé par Baker Hub est celui qui vous garde connecté.',
          'Vos données de boulangerie ne sont jamais vendues, louées, ni partagées à des fins commerciales pour le compte de tiers.',
        ],
      },
      {
        title: 'Les photos, et l\u2019IA qui les lit',
        paragraphs: [
          'Deux fonctions envoient une photo hors de votre appareil pour analyse. Lorsque vous scannez l\u2019étiquette d\u2019un sac de farine, et lorsque vous demandez un retour sur une fournée, l\u2019image est envoyée à l\u2019API Claude d\u2019Anthropic, analysée, puis vous revient sous forme de texte. Anthropic traite ces images pour produire cette réponse.',
          'Seules les photos que vous prenez délibérément pour ces fonctions sont envoyées. Baker Hub n\u2019a aucun accès à votre pellicule et ne lit aucune autre image.',
        ],
      },
      {
        title: 'Les photos que vous enregistrez, et qui peut les voir',
        paragraphs: [
          'Les photos attachées à une fournée enregistrée sont conservées chez l\u2019hébergeur de Baker Hub et servies depuis un lien public. Ce lien est long et n\u2019est publié nulle part, mais toute personne qui le possède peut ouvrir la photo sans se connecter.',
          'Cela mérite d\u2019être su avant d\u2019envoyer quoi que ce soit : considérez une photo de fournée comme quelque chose que vous accepteriez de partager, et non comme un contenu privé. Vous pouvez supprimer une photo depuis la fournée à laquelle elle appartient, ce qui l\u2019efface du stockage.',
        ],
      },
      {
        title: 'Les liens que vous partagez volontairement',
        paragraphs: [
          'Lorsque vous partagez une liste de courses, Baker Hub en crée un lien public. Toute personne disposant de ce lien peut ouvrir la liste sans se connecter. Elle cesse d\u2019être privée dès que vous l\u2019envoyez, ce qui est bien l\u2019objet de la fonction, mais cela mérite d\u2019être dit clairement.',
        ],
      },
      {
        title: 'Où vivent vos données, et qui les traite',
        paragraphs: [
          'Baker Hub s\u2019appuie sur un petit nombre de services. Chacun ne reçoit que ce qui lui est nécessaire.',
        ],
        bullets: [
          'Supabase — la base de données, la connexion et le stockage des photos. Vos données sont hébergées sur des serveurs à Singapour.',
          'Vercel — l\u2019hébergement de l\u2019application elle-même.',
          'Anthropic — l\u2019analyse des photos d\u2019étiquettes de farine et de coaching de fournée décrites plus haut.',
          'Google — uniquement si vous choisissez de vous connecter avec Google.',
          'Namecheap Private Email — l\u2019envoi de vos codes de connexion.',
        ],
      },
      {
        title: 'Durée de conservation',
        paragraphs: [
          'Les recettes et les fournées sont conservées jusqu\u2019à ce que vous les supprimiez ou que vous demandiez la suppression de votre compte. Les photos sont soumises à une limite par compte ; au-delà, les plus anciennes sont supprimées automatiquement pour maîtriser le stockage.',
          'Pour supprimer votre compte et tout ce qui y est rattaché, écrivez à rom@bakerhub.app. Ce sera fait, et vous recevrez une confirmation.',
        ],
      },
      {
        title: 'Vos droits',
        paragraphs: [
          'Selon votre lieu de résidence, vous pouvez avoir le droit de consulter les données vous concernant, de les corriger, de les faire supprimer, d\u2019en recevoir une copie dans un format portable, et de vous opposer à leur traitement. Baker Hub honore ces demandes quel que soit votre pays.',
          'Un e-mail à rom@bakerhub.app suffit. Vous n\u2019avez pas à motiver votre demande.',
        ],
      },
      {
        title: 'Les enfants',
        paragraphs: [
          'Baker Hub ne s\u2019adresse pas aux enfants et ne collecte pas sciemment d\u2019informations concernant une personne de moins de 16 ans. Si vous pensez qu\u2019un enfant a créé un compte, écrivez à rom@bakerhub.app et il sera supprimé.',
        ],
      },
      {
        title: 'Modifications de cette politique',
        paragraphs: [
          'Si cette politique évolue d\u2019une manière qui vous concerne, la date en haut de page change avec elle et la modification est décrite ici plutôt qu\u2019appliquée en silence.',
        ],
      },
    ],
  },
};

export default function PrivacyClient() {
  return <LegalPage content={CONTENT} />;
}
