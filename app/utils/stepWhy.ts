// Step notes that explain *why* rather than say *how*. In a step they are moved
// out of the instruction line into one "Why?" under the list, so the line reads
// as what to do. Generated from the paired EN/FR step notes (same key paths).
const WHY_FULL = new Set<string>([
 "Follow the dough, not only the clock.",
 "Observez la pâte, pas seulement l’heure.",
 "Size and tin change timing.",
 "Taille et moule changent la durée.",
 "all home ovens have hot spots near the element",
 "all ovens have hot spots",
 "as hot as it goes",
 "as hot as your oven allows",
 "aussi chaud que votre four le permet",
 "back of fridge is coldest and most consistent",
 "booste l’élément du haut pour un meilleur contraste",
 "chaque ouverture fait perdre 20–30 °C",
 "a clear tub shows the rise",
 "the dough is ready when it has grown by half to three quarters",
 "cold fermentation is slow and forgiving",
 "couper chaud rend la mie gommeuse",
 "crumb is still cooking from residual heat — cutting hot makes it gummy",
 "cutting hot makes the crumb gummy",
 "electric elements can have hot spots near the edges",
 "electric ovens have small cavities — heat escapes fast",
 "electric ovens lose heat fast — keep closed until ready",
 "even heat is more important than peak heat",
 "every opening loses 20–30°C",
 "final proof begins now",
 "follow this cold-fermentation schedule",
 "fresh ratio ferments faster and more predictably",
 "gluten relaxes, makes final shaping easier",
 "la chaleur du dessus crée le léopardage",
 "la constance de température est critique",
 "la fermentation froide est lente et tolérante",
 "la mie cuit encore à la chaleur résiduelle — couper chaud = mie gommeuse",
 "la vapeur emprisonnée crée la grigne et le développement",
 "la vapeur garde la croûte extensible pour le développement",
 "le fond est le plus froid et le plus régulier",
 "le gluten se détend, facilite le façonnage final",
 "le poolish fermente au froid — lentement et de façon contrôlée",
 "le poolish fermente à température ambiante pour ce planning",
 "les fours électriques perdent rapidement la chaleur",
 "les tôles fines chauffent vite mais perdent vite la chaleur aussi",
 "les éléments électriques ont des points chauds",
 "l’apprêt commence maintenant",
 "petite cavité — la chaleur s’échappe vite",
 "poolish ferments at room temp for this schedule",
 "poolish ferments cold — slow and controlled",
 "ratio frais fermente plus vite et plus régulièrement",
 "un récipient transparent montre la pousse",
 "la pâte est prête quand elle a pris la moitié à trois quarts de volume",
 "steam keeps crust extensible for oven spring",
 "steam trapped inside creates the ear and oven spring",
 "suivez ce planning de fermentation au froid",
 "suivi visuel de la montée",
 "supercharges the top element for better char",
 "temperature consistency is critical",
 "thin trays heat fast but lose heat fast too — longer is better",
 "top heat is what drives leoparding in a home oven",
 "tous les fours ont des points chauds",
 "tous les fours ont des points chauds près de l’élément",
 "tracks rise visually",
 "très petite quantité — le poolish fermente lentement",
 "une chaleur uniforme est plus importante que la chaleur maximale",
 "very small amount — poolish ferments slowly"
]);
const WHY_SUFFIX = new Set<string>([
 "creates ear",
 "creates tension",
 "crée la grigne",
 "crée la tension",
 "dough skin is the enemy",
 "electric ovens are forgiving but thin bases still bake best",
 "elle roule comme des billes sous la pâte et facilite l’enfournement",
 "eyeballing leads to uneven baking",
 "hesitation causes sticking",
 "it rolls like ball bearings under the dough and makes launching easy",
 "la chaleur du dessus crée le léopardage",
 "la masse doit être saturée, pas seulement la surface",
 "la vapeur doit rester",
 "le repos détend le gluten ; une pâte longuement fermentée et souple peut toutefois s’étirer encore fraîche",
 "les fours électriques sont indulgents mais les bases fines cuisent mieux",
 "l’enfournement glisse au lieu de coller",
 "l’hésitation colle",
 "resting relaxes the gluten; a long-fermented, supple dough can still be stretched while cool",
 "sans balance les boules seront inégales",
 "steam does the work of a Dutch oven",
 "steam must stay in",
 "the launch slides instead of sticking",
 "the mass must saturate, not just the surface",
 "top heat drives leoparding"
]);

/** Splits a step note into what stays on the line and the reason, if any. */
export function splitStepWhy(note: string): { note: string; why: string } {
  if (WHY_FULL.has(note)) return { note: '', why: note };
  const at = note.lastIndexOf(' — ');
  if (at > 0) {
    const tail = note.slice(at + 3);
    if (WHY_SUFFIX.has(tail)) return { note: note.slice(0, at), why: tail };
  }
  return { note, why: '' };
}

/** Closing sentences of a bread protocol line that give the reason, not the action. */
const WHY_SENTENCES = [
 'Follow the dough, not only the clock.',
 'Observez la pâte, pas seulement l’heure.',
 'Size and tin change timing.',
 'Taille et moule changent la durée.',
];
/** Moves a trailing reason sentence of a protocol line to the step's note, where "Why?" collects it. */
export function splitLineWhy(line: string): { bold: string; note: string } {
  for (const sentence of WHY_SENTENCES) {
    if (line.endsWith(' ' + sentence)) return { bold: line.slice(0, -sentence.length - 1), note: sentence };
  }
  return { bold: line, note: '' };
}
