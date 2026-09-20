// Approved bilingual step guidance, materialized from prototype review.
export interface FaqEntry { q: {en:string;fr:string}; a: {en:string;fr:string}; }
export const GUIDE_FAQ: Record<string,FaqEntry[]> = {
  "poolish": [
    {
      "q": {
        "en": "My poolish collapsed — is it ruined?",
        "fr": "Mon poolish est retombé — est-il fichu ?"
      },
      "a": {
        "en": "No. A recently collapsed poolish still works — flavour is fine, you just lose a little rising power. Use it now rather than waiting longer. If it collapsed many hours ago and smells sharply alcoholic, reduce the fermentation of the final dough slightly.",
        "fr": "Non. Un poolish qui vient de retomber fonctionne encore — la saveur est là, il perd juste un peu de force. Utilisez-le maintenant plutôt que d'attendre. S'il est retombé depuis des heures et sent fort l'alcool, raccourcissez légèrement la fermentation de la pâte finale."
      }
    },
    {
      "q": {
        "en": "It looks flat with no bubbles — what now?",
        "fr": "Il est plat, sans bulles — que faire ?"
      },
      "a": {
        "en": "It needs more time or more warmth. Move it somewhere warmer (25–27°C is ideal) and check every 30 min. If your yeast was old, a flat poolish after 12h+ means start a fresh one with new yeast.",
        "fr": "Il lui faut plus de temps ou de chaleur. Placez-le dans un endroit plus chaud (25–27°C idéalement) et vérifiez toutes les 30 min. Si votre levure était vieille, un poolish plat après 12h+ signifie qu'il faut en relancer un avec de la levure neuve."
      }
    },
    {
      "q": {
        "en": "Can I hold a ready poolish in the fridge?",
        "fr": "Puis-je garder un poolish prêt au frigo ?"
      },
      "a": {
        "en": "Refrigeration slows a ripe poolish. Check its condition before use and use its actual temperature in the main-mix water plan; warming it first is not always needed.",
        "fr": "Le froid ralentit un poolish mûr. Vérifiez son état et utilisez sa température réelle pour préparer l’eau du mélange final ; le réchauffer n’est pas toujours nécessaire."
      }
    },
    {
      "q": {
        "en": "How do I know it's exactly at its peak?",
        "fr": "Comment savoir qu'il est pile à son pic ?"
      },
      "a": {
        "en": "Domed surface, bubbles all through the mass, and the first faint wrinkles at the centre. The smell says it too: nutty and yogurt-like at peak, sharply alcoholic past it.",
        "fr": "Surface bombée, bulles dans toute la masse, et les premières rides discrètes au centre. L'odeur le dit aussi : noisette et yaourt au pic, franchement alcoolisée au-delà."
      }
    },
    {
      "q": {
        "en": "Can I use cold water to slow it down?",
        "fr": "Puis-je utiliser de l'eau froide pour le ralentir ?"
      },
      "a": {
        "en": "Cooler water can delay the rise. The effect depends on the starting temperature and how quickly the mixture warms; follow signs of ripeness.",
        "fr": "Une eau plus fraîche peut retarder la montée. L’effet dépend des températures et du réchauffement du mélange ; surveillez les signes de maturité."
      }
    }
  ],
  "biga": [
    {
      "q": {
        "en": "My biga looks dry and shaggy — is that right?",
        "fr": "Ma biga semble sèche et grumeleuse — est-ce normal ?"
      },
      "a": {
        "en": "Yes. At ~45% hydration a biga should look like rough, shaggy lumps — not a smooth dough. Resist the urge to knead it smooth; the loose structure is what develops its signature aroma.",
        "fr": "Oui. À ~45% d'hydratation, une biga doit ressembler à des morceaux grossiers — pas à une pâte lisse. Ne la pétrissez pas : cette structure lâche développe son arôme caractéristique."
      }
    },
    {
      "q": {
        "en": "Only 24h instead of 48h — will it still work?",
        "fr": "Seulement 24h au lieu de 48h — ça marche quand même ?"
      },
      "a": {
        "en": "Yes. A fridge biga is solid from ~24h; 48h just gives deeper flavour. Your yeast amount was calibrated to your actual planned window, so the timing still works.",
        "fr": "Oui. Une biga au frigo est au point dès ~24h ; 48h donne simplement plus de profondeur. La levure a été calibrée sur votre fenêtre réelle, donc le timing reste bon."
      }
    },
    {
      "q": {
        "en": "How do I know it is ready?",
        "fr": "Comment savoir si elle est prête ?"
      },
      "a": {
        "en": "Break a piece open: you want visible bubbles inside, a slightly domed mass, and a sweet-alcoholic smell. Dense with no bubbles = give it more time somewhere slightly warmer.",
        "fr": "Cassez un morceau : il faut des bulles visibles à l'intérieur, une masse légèrement bombée et une odeur douce-alcoolisée. Dense et sans bulles = laissez-lui plus de temps, un peu plus au chaud."
      }
    },
    {
      "q": {
        "en": "There are chunks of biga in my final dough",
        "fr": "Il reste des morceaux de biga dans ma pâte finale"
      },
      "a": {
        "en": "Harmless — they disappear during bulk. Next time, dissolve the biga in the recipe water for a minute before adding flour; it incorporates far more easily.",
        "fr": "Sans gravité — ils disparaissent pendant le pointage. La prochaine fois, délayez la biga une minute dans l'eau de la recette avant la farine ; elle s'incorpore bien plus facilement."
      }
    },
    {
      "q": {
        "en": "My biga smells like alcohol",
        "fr": "Ma biga sent l'alcool"
      },
      "a": {
        "en": "Slightly boozy is normal — a stiff biga ferments with little oxygen. A sharp nail-polish note means it went too far: usable, but shorten the time or find a cooler spot next round.",
        "fr": "Légèrement alcoolisée, c'est normal — une biga ferme fermente avec peu d'oxygène. Une note piquante de dissolvant signifie qu'elle est allée trop loin : utilisable, mais raccourcissez ou placez-la plus au frais la prochaine fois."
      }
    }
  ],
  "starter": [
    {
      "q": {
        "en": "My starter passed its peak — can I still use it?",
        "fr": "Mon levain a dépassé son pic — puis-je l'utiliser ?"
      },
      "a": {
        "en": "Within ~1–2h past peak, yes — expect slightly more tang. Much later than that, give it a quick refresh feed and mix at the next peak instead.",
        "fr": "Dans l'heure ou les deux heures après le pic, oui — avec un peu plus d'acidité. Bien au-delà, refaites un rafraîchi rapide et pétrissez au pic suivant."
      }
    },
    {
      "q": {
        "en": "How do I know it is at peak?",
        "fr": "Comment savoir s'il est au pic ?"
      },
      "a": {
        "en": "Look for a clear rise and bubbles throughout, following your starter’s usual pattern. A float test alone cannot confirm readiness.",
        "fr": "Observez une montée nette et des bulles, selon le rythme habituel de votre levain. Le test de flottaison seul ne confirme pas sa maturité."
      }
    },
    {
      "q": {
        "en": "I missed the feed time — what now?",
        "fr": "J'ai raté l'heure du rafraîchi — que faire ?"
      },
      "a": {
        "en": "Feed it now. Your mix time shifts by roughly the same delay. If the dough window gets too tight, push the bake time back rather than mixing with a weak starter.",
        "fr": "Nourrissez-le maintenant. Le pétrissage se décale d'environ le même retard. Si la fenêtre devient trop courte, repoussez la cuisson plutôt que de pétrir avec un levain faible."
      }
    },
    {
      "q": {
        "en": "Is the float test reliable?",
        "fr": "Le test de flottaison est-il fiable ?"
      },
      "a": {
        "en": "Indicative, not definitive. A mature starter that was stirred or is past peak can sink and still leaven perfectly. Volume rise and a domed, bubbled surface are better witnesses.",
        "fr": "Indicatif, pas définitif. Un levain mûr qui a été remué ou a dépassé son pic peut couler et lever parfaitement. La montée en volume et une surface bombée et bullée sont de meilleurs témoins."
      }
    },
    {
      "q": {
        "en": "I missed the peak — feed again or use it?",
        "fr": "J'ai raté le pic — nourrir à nouveau ou l'utiliser ?"
      },
      "a": {
        "en": "Within an hour or two past peak, use it — flavour is a touch tangier, power is fine. Much later, give it a quick 1:1 refresh and wait for the new rise.",
        "fr": "Une à deux heures après le pic, utilisez-le — un peu plus acidulé, la force est là. Bien plus tard, offrez-lui un rafraîchi rapide à 1:1 et attendez la nouvelle montée."
      }
    }
  ],
  "mix": [
    {
      "q": {
        "en": "My dough is too sticky to handle",
        "fr": "Ma pâte est trop collante"
      },
      "a": {
        "en": "Try lightly damp hands and a scraper, then a covered rest. Avoid adding large amounts of flour or water: either changes the recipe.",
        "fr": "Essayez des mains légèrement humides, une corne et un repos couvert. Évitez d’ajouter beaucoup de farine ou d’eau : les deux modifient la recette."
      }
    },
    {
      "q": {
        "en": "It fails the windowpane test — keep kneading?",
        "fr": "Le test de la membrane échoue — continuer à pétrir ?"
      },
      "a": {
        "en": "Rest covered, then reassess. Dough development depends on the flour and style; not every dough forms a thin, transparent membrane.",
        "fr": "Laissez reposer à couvert, puis réévaluez. Le développement dépend de la farine et du style ; toutes les pâtes ne forment pas une membrane fine et transparente."
      }
    },
    {
      "q": {
        "en": "My dough feels too warm after mixing",
        "fr": "Ma pâte est trop chaude après pétrissage"
      },
      "a": {
        "en": "Check against your dough-temperature target. Cool it if needed and reassess fermentation timing; a brief fridge rest does not instantly cool the whole dough.",
        "fr": "Comparez à la température cible. Refroidissez si nécessaire et réévaluez le temps de fermentation ; un bref passage au froid ne refroidit pas instantanément toute la pâte."
      }
    },
    {
      "q": {
        "en": "The dough is sticky — should I add flour?",
        "fr": "La pâte colle — dois-je ajouter de la farine ?"
      },
      "a": {
        "en": "Try lightly damp hands and a scraper, then a covered rest. Avoid adding large amounts of flour or water: either changes the recipe.",
        "fr": "Essayez des mains légèrement humides, une corne et un repos couvert. Évitez d’ajouter beaucoup de farine ou d’eau : les deux modifient la recette."
      }
    },
    {
      "q": {
        "en": "The windowpane test fails after kneading",
        "fr": "Le test de la membrane échoue après pétrissage"
      },
      "a": {
        "en": "Rest covered, then reassess. Dough development depends on the flour and style; not every dough forms a thin, transparent membrane.",
        "fr": "Laissez reposer à couvert, puis réévaluez. Le développement dépend de la farine et du style ; toutes les pâtes ne forment pas une membrane fine et transparente."
      }
    }
  ],
  "bulk": [
    {
      "q": {
        "en": "How much should it rise during bulk?",
        "fr": "De combien doit-elle lever pendant la pointe ?"
      },
      "a": {
        "en": "Look for 50–80% growth, a domed top and visible bubbles at the sides — not a full doubling for pizza. Judge by the dough, not the clock.",
        "fr": "Visez 50–80% de volume en plus, un dessus bombé et des bulles sur les côtés — pas un doublement complet pour la pizza. Jugez la pâte, pas l'horloge."
      }
    },
    {
      "q": {
        "en": "I have to leave before bulk is done",
        "fr": "Je dois partir avant la fin de la pointe"
      },
      "a": {
        "en": "Put the dough in the fridge — cold slows fermentation ~5×. Resume where you left off when back, adding a little extra time for the dough to re-warm.",
        "fr": "Mettez la pâte au frigo — le froid ralentit la fermentation ~5×. Reprenez au retour, en ajoutant un peu de temps pour qu'elle se réchauffe."
      }
    },
    {
      "q": {
        "en": "Do I really need the stretch & folds?",
        "fr": "Les rabats sont-ils vraiment nécessaires ?"
      },
      "a": {
        "en": "For higher-hydration doughs, yes — they build strength without kneading. For stiff doughs (≤60%) they matter less. Skipping one set is fine; skipping all of them gives a flatter result.",
        "fr": "Pour les pâtes très hydratées, oui — ils donnent de la force sans pétrir. Pour les pâtes fermes (≤60%), moins. Sauter une série passe ; tout sauter donne un résultat plus plat."
      }
    },
    {
      "q": {
        "en": "How much should it actually rise?",
        "fr": "De combien doit-elle vraiment monter ?"
      },
      "a": {
        "en": "For pizza, think 50–70% — not doubled. A straight-sided container with a rubber band at the start level beats every guess.",
        "fr": "Pour la pizza, visez 50–70% — pas le double. Un récipient à bords droits avec un élastique au niveau de départ vaut mieux que toutes les estimations."
      }
    },
    {
      "q": {
        "en": "My kitchen got warmer than planned",
        "fr": "Ma cuisine est devenue plus chaude que prévu"
      },
      "a": {
        "en": "The biology follows the thermometer, not the plan — check the dough earlier. The visual cues (volume, surface bubbles) outrank the clock whenever they disagree.",
        "fr": "La biologie suit le thermomètre, pas le plan — surveillez la pâte plus tôt. Les repères visuels (volume, bulles en surface) priment sur l'horloge dès qu'ils divergent."
      }
    }
  ],
  "cold": [
    {
      "q": {
        "en": "Can I shorten or extend the fridge time?",
        "fr": "Puis-je raccourcir ou prolonger le frigo ?"
      },
      "a": {
        "en": "Changing the cold rest can change readiness and flavour. Recheck the schedule and dough condition; there is no single maximum duration for every recipe.",
        "fr": "Modifier le repos au froid change la maturité et le goût. Revérifiez le planning et la pâte ; aucune durée maximale ne convient à toutes les recettes."
      }
    },
    {
      "q": {
        "en": "The dough grew a lot in the fridge — problem?",
        "fr": "La pâte a beaucoup gonflé au frigo — problème ?"
      },
      "a": {
        "en": "Some growth continues while the dough cools. Check the fridge temperature and dough readiness; growth alone cannot tell you the fridge temperature.",
        "fr": "La pâte continue de monter pendant son refroidissement. Vérifiez le réfrigérateur et la maturité ; la montée seule ne permet pas de déduire sa température."
      }
    },
    {
      "q": {
        "en": "No room in the fridge — can I stay at room temperature?",
        "fr": "Pas de place au frigo — puis-je rester à température ambiante ?"
      },
      "a": {
        "en": "A room-temperature fermentation needs a different schedule. Recalculate before changing methods; do not substitute hours directly.",
        "fr": "Une fermentation ambiante nécessite un autre planning. Recalculez avant de changer de méthode ; les durées ne sont pas interchangeables."
      }
    },
    {
      "q": {
        "en": "A skin formed on the dough in the fridge",
        "fr": "Une croûte s'est formée sur la pâte au frigo"
      },
      "a": {
        "en": "A light skin folds back in during shaping. A thick, dry layer is better trimmed off. Next time: tighter cover or a film of oil on the surface.",
        "fr": "Une fine pellicule se réincorpore au façonnage. Une couche épaisse et sèche se retire plutôt. La prochaine fois : couverture plus hermétique ou un voile d'huile en surface."
      }
    }
  ],
  "divide": [
    {
      "q": {
        "en": "My balls will not hold their shape",
        "fr": "Mes pâtons ne tiennent pas leur forme"
      },
      "a": {
        "en": "The surface needs more tension: drag each ball toward you on an unfloured patch of bench to tighten the skin, and pinch the seam closed underneath. If the dough resists, rest 10 min and re-ball.",
        "fr": "La surface manque de tension : faites glisser chaque pâton vers vous sur un plan non fariné pour tendre la peau, et pincez la soudure dessous. Si la pâte résiste, laissez 10 min et refaçonnez."
      }
    },
    {
      "q": {
        "en": "The pieces are not equal weight — does it matter?",
        "fr": "Les pâtons ne font pas le même poids — grave ?"
      },
      "a": {
        "en": "Within ±10g nobody will notice. Bigger gaps mean uneven bake times — steal a bit of dough from the heavy ones and press it into the seam of the light ones.",
        "fr": "À ±10g près, personne ne verra rien. Au-delà, la cuisson devient inégale — prélevez un peu des gros et soudez-le sous les petits."
      }
    },
    {
      "q": {
        "en": "My balls come out different sizes",
        "fr": "Mes pâtons sortent de tailles différentes"
      },
      "a": {
        "en": "The scale beats the eye — a few seconds per ball buys even bakes. That said, ±5 g is invisible once baked.",
        "fr": "La balance bat l'œil — quelques secondes par pâton garantissent des cuissons régulières. Cela dit, ±5 g est invisible une fois cuit."
      }
    },
    {
      "q": {
        "en": "The surface tears when I shape the balls",
        "fr": "La surface se déchire quand je boule"
      },
      "a": {
        "en": "You are tightening past what the gluten allows right now. Let the pieces relax 10 minutes and reshape with a lighter hand — tension should build, not tear.",
        "fr": "Vous serrez au-delà de ce que le gluten permet à cet instant. Laissez détendre 10 minutes et refaçonnez d'une main plus légère — la tension doit se construire, pas déchirer."
      }
    }
  ],
  "proof": [
    {
      "q": {
        "en": "Poke test says over-proofed — can I save it?",
        "fr": "Le test du doigt dit sur-levée — récupérable ?"
      },
      "a": {
        "en": "For pizza: handle gently, stretch a little thinner and bake — it will still be good, just less puffy. For bread: reshape gently, proof 20–30 min and bake; expect a denser crumb.",
        "fr": "Pour la pizza : manipulez doucement, étalez un peu plus fin et cuisez — ce sera bon, juste moins gonflé. Pour le pain : refaçonnez délicatement, laissez 20–30 min et cuisez ; la mie sera plus dense."
      }
    },
    {
      "q": {
        "en": "Dough is still cold from the fridge — bake anyway?",
        "fr": "La pâte est encore froide du frigo — cuire quand même ?"
      },
      "a": {
        "en": "Cold pizza dough tears and stays dense in the centre. Give it the full warmup — it is worth pushing dinner 20 min rather than fighting cold dough.",
        "fr": "Une pâte froide se déchire et reste dense au centre. Respectez le réchauffage complet — mieux vaut décaler le dîner de 20 min que lutter contre une pâte froide."
      }
    },
    {
      "q": {
        "en": "How does the poke test read?",
        "fr": "Comment lire le test du doigt ?"
      },
      "a": {
        "en": "Press a floured fingertip in: a slow spring-back that leaves a slight dimple means ready; an instant spring-back means wait; no spring-back at all means bake without delay.",
        "fr": "Enfoncez un doigt fariné : un retour lent qui laisse une légère empreinte = prête ; un retour immédiat = attendez ; aucun retour = enfournez sans tarder."
      }
    },
    {
      "q": {
        "en": "My balls flattened and spread",
        "fr": "Mes pâtons se sont aplatis et étalés"
      },
      "a": {
        "en": "Warmth or time went a little far. They still bake well — handle gently and stretch from the edge. A cooler spot or shorter proof next time restores the dome.",
        "fr": "Chaleur ou durée ont un peu dépassé. Ils cuisent encore très bien — manipulez doucement et étirez depuis le bord. Un endroit plus frais ou une pousse plus courte la prochaine fois redonnera le dôme."
      }
    }
  ],
  "preheat": [
    {
      "q": {
        "en": "Is a shorter preheat really a problem?",
        "fr": "Un préchauffage plus court, vraiment un problème ?"
      },
      "a": {
        "en": "Yes, for steel/stone: the surface needs the full time to store heat even if the air reaches temperature quickly. A cool surface = pale, dense base — the most common home-oven mistake.",
        "fr": "Oui, pour l'acier/la pierre : la surface a besoin de tout ce temps pour emmagasiner la chaleur, même si l'air est vite chaud. Surface tiède = base pâle et dense — l'erreur n°1 au four domestique."
      }
    },
    {
      "q": {
        "en": "My oven does not reach the target temperature",
        "fr": "Mon four n'atteint pas la température cible"
      },
      "a": {
        "en": "Bake anyway at max — just expect a longer bake and check the base colour before pulling. Position the rack closer to the top element for better top colour.",
        "fr": "Cuisez quand même à fond — comptez juste plus long et vérifiez la couleur du dessous avant de sortir. Rapprochez la grille de la résistance du haut pour mieux colorer le dessus."
      }
    },
    {
      "q": {
        "en": "How do I know the stone is truly hot?",
        "fr": "Comment savoir si la pierre est vraiment chaude ?"
      },
      "a": {
        "en": "Trust time, not the oven beep — the thermostat reads air, the stone lags 45–60 minutes behind it. An infrared thermometer removes all doubt for a few euros.",
        "fr": "Fiez-vous au temps, pas au bip du four — le thermostat lit l'air, la pierre a 45–60 minutes de retard sur lui. Un thermomètre infrarouge lève tout doute pour quelques euros."
      }
    },
    {
      "q": {
        "en": "Should I run the broiler during preheat?",
        "fr": "Dois-je lancer le gril pendant le préchauffage ?"
      },
      "a": {
        "en": "The last 10 minutes, yes — it loads the top of the oven with heat so the first pizza gets colour instead of paying the warm-up cost.",
        "fr": "Les 10 dernières minutes, oui — cela charge le haut du four en chaleur et la première pizza prend de la couleur au lieu de payer la mise en route."
      }
    }
  ],
  "bake": [
    {
      "q": {
        "en": "The base is done but the top is pale",
        "fr": "Le dessous est cuit mais le dessus est pâle"
      },
      "a": {
        "en": "Finish under the broiler/grill for 60–90 seconds, watching constantly. Next time, move the rack (and steel/stone) higher so the top element does more work.",
        "fr": "Terminez sous le gril 60–90 secondes en surveillant constamment. La prochaine fois, montez la grille (et l'acier/la pierre) pour que la résistance du haut travaille plus."
      }
    },
    {
      "q": {
        "en": "The pizza stuck to the peel",
        "fr": "La pizza a collé à la pelle"
      },
      "a": {
        "en": "Work faster and flour the peel more — top the pizza ON the peel and give it a small shake test before opening the oven. If it sticks mid-launch, slide it onto parchment and bake on that.",
        "fr": "Travaillez plus vite et farinez mieux la pelle — garnissez la pizza SUR la pelle et faites un petit test de glisse avant d'ouvrir le four. Si ça colle au lancement, glissez-la sur du papier cuisson et enfournez avec."
      }
    },
    {
      "q": {
        "en": "Should bread really cool before cutting?",
        "fr": "Le pain doit-il vraiment refroidir avant la coupe ?"
      },
      "a": {
        "en": "Yes — the crumb finishes setting as steam escapes. Cutting hot gives a gummy texture. One hour minimum for boules; 20–30 min for baguettes.",
        "fr": "Oui — la mie finit de se structurer pendant que la vapeur s'échappe. Couper chaud donne une mie gommeuse. Une heure minimum pour les boules ; 20–30 min pour les baguettes."
      }
    },
    {
      "q": {
        "en": "Why is my first pizza always the worst?",
        "fr": "Pourquoi ma première pizza est-elle toujours la moins réussie ?"
      },
      "a": {
        "en": "The open door and the cold dough both tax the stone. Give it 4–5 minutes between pizzas to recover, and let the first one be the sacrifice that tunes your timing.",
        "fr": "La porte ouverte et la pâte froide taxent toutes deux la pierre. Laissez-lui 4–5 minutes entre les pizzas pour récupérer, et laissez la première régler votre chronométrage."
      }
    },
    {
      "q": {
        "en": "The base chars before the top colours",
        "fr": "La base noircit avant que le dessus colore"
      },
      "a": {
        "en": "Floor running hotter than the air: turn more often, raise the pizza on a screen or higher rack, and finish under the dome or broiler for the top.",
        "fr": "La sole est plus chaude que l'air : tournez plus souvent, surélevez la pizza (grille ou écran) et finissez sous la voûte ou le gril pour le dessus."
      }
    }
  ],
  "fold": [
    {
      "q": {
        "en": "How far should I stretch?",
        "fr": "Jusqu’où étirer ?"
      },
      "a": {
        "en": "Lift gently until you feel resistance, then fold over. Stop before the dough tears.",
        "fr": "Soulevez doucement jusqu’à sentir une résistance, puis repliez. Arrêtez avant de déchirer."
      }
    },
    {
      "q": {
        "en": "It keeps tearing—what next?",
        "fr": "La pâte se déchire : que faire ?"
      },
      "a": {
        "en": "Cover and let it relax before trying again. Use gentler folds; do not force another set.",
        "fr": "Couvrez et laissez détendre avant de réessayer. Rabattez plus doucement, sans forcer."
      }
    }
  ],
  "cool": [
    {
      "q": {
        "en": "Can I slice it now?",
        "fr": "Puis-je déjà trancher ?"
      },
      "a": {
        "en": "Let the loaf cool on a rack so the crumb can set. Larger and denser loaves need longer.",
        "fr": "Laissez refroidir sur une grille pour stabiliser la mie. Les pains volumineux ou denses prennent plus de temps."
      }
    },
    {
      "q": {
        "en": "Should I cover it?",
        "fr": "Faut-il le couvrir ?"
      },
      "a": {
        "en": "Leave it uncovered while cooling so steam can escape. Store it once cool.",
        "fr": "Laissez-le découvert pendant le refroidissement pour évacuer la vapeur. Rangez-le une fois refroidi."
      }
    }
  ]
};
