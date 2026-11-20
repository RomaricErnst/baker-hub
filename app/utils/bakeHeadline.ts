import { breadNoun } from './breadNames';
import { formatClock } from './units';

// The pizza style as a word in front of "pizzas" (EN) or after it (FR): "4 Neapolitan pizzas",
// « 4 pizzas napolitaines ». FR agrees in number.
const PIZZA_STYLE_WORD: Record<string, { en: string; fr: [string, string] }> = {
  neapolitan: { en: 'Neapolitan', fr: ['napolitaine', 'napolitaines'] },
  newyork: { en: 'New York', fr: ['new-yorkaise', 'new-yorkaises'] },
  pizza_romana: { en: 'thin Roman', fr: ['romaine fine', 'romaines fines'] },
  roman: { en: 'Roman tray', fr: ['romaine sur plaque', 'romaines sur plaque'] },
  pan: { en: 'pan', fr: ['en moule', 'en moule'] },
  sourdough: { en: 'sourdough', fr: ['au levain', 'au levain'] },
};

// Breads whose noun is the generic "loaf" are named by the style, as bakers say them in both
// languages: "1 pain de campagne", "2 pains au levain".
const BREAD_STYLE_NOUN: Record<string, [string, string]> = {
  pain_campagne: ['pain de campagne', 'pains de campagne'],
  pain_levain: ['pain au levain', 'pains au levain'],
  pain_complet: ['pain complet', 'pains complets'],
  pain_seigle: ['pain de seigle', 'pains de seigle'],
  pain_au_seigle: ['pain au seigle', 'pains au seigle'],
};

/** What is being made, with its style: "4 Neapolitan pizzas", "2 baguettes", "1 pain de campagne". */
export function bakeWhat(bakeType: string | null | undefined, styleKey: string | null | undefined, count: number, fr: boolean): string {
  const plural = count === 1 ? 0 : 1;
  if (bakeType === 'bread') {
    const named = styleKey ? BREAD_STYLE_NOUN[styleKey] : undefined;
    return `${count} ${named ? named[plural] : breadNoun(styleKey, count, fr)}`;
  }
  const noun = plural ? 'pizzas' : 'pizza';
  const word = styleKey ? PIZZA_STYLE_WORD[styleKey] : undefined;
  if (!word) return `${count} ${noun}`;
  return fr ? `${count} ${noun} ${word.fr[plural]}` : `${count} ${word.en} ${noun}`;
}

/** "Sun 22 Nov, 7:00pm" / « dim. 22 nov. à 19h00 ». */
export function bakeWhen(at: Date, locale: string): string {
  const fr = locale.startsWith('fr');
  const lang = fr ? 'fr-FR' : 'en-GB';
  const day = `${at.toLocaleDateString(lang, { weekday: 'short' })} ${at.getDate()} ${at.toLocaleDateString(lang, { month: 'short' })}`;
  return fr ? `${day} à ${formatClock(at, locale)}` : `${day}, ${formatClock(at, locale)}`;
}

/** The one line that sums up My bake in the "Your bake" sheet (round 7, option A):
 *  "4 Neapolitan pizzas · Sun 22 Nov, 7:00pm"; before a bake time is set, the what alone. */
export function bakeHeadline(bakeType: string | null | undefined, styleKey: string | null | undefined, count: number, bakeAt: Date | null | undefined, locale: string): string {
  const what = bakeWhat(bakeType, styleKey, count, locale.startsWith('fr'));
  return bakeAt && Number.isFinite(+bakeAt) ? `${what} · ${bakeWhen(bakeAt, locale)}` : what;
}

/** The Recipe's summary line, led by the day: "Sun 22 Nov · 7:00pm · 4 × 260 g Neapolitan",
 *  "Sat 21 Nov · 9:00am · 2 baguettes". `each` is the weight of one pizza, already formatted. */
export function recipeSummaryLine(bakeType: string | null | undefined, styleKey: string | null | undefined, count: number, bakeAt: Date | null | undefined, locale: string, each?: string | null): string {
  const fr = locale.startsWith('fr');
  const lang = fr ? 'fr-FR' : 'en-GB';
  const when = bakeAt && Number.isFinite(+bakeAt)
    ? [`${bakeAt.toLocaleDateString(lang, { weekday: 'short' })} ${bakeAt.getDate()} ${bakeAt.toLocaleDateString(lang, { month: 'short' })}`, formatClock(bakeAt, locale)]
    : [];
  let what: string;
  if (bakeType !== 'bread' && each) {
    const word = styleKey ? PIZZA_STYLE_WORD[styleKey] : undefined;
    // EN "4 × 260 g Neapolitan"; FR « 4 pizzas napolitaines de 260 g ».
    what = fr
      ? `${bakeWhat(bakeType, styleKey, count, true)} de ${each}`
      : `${count} × ${each}${word ? ` ${word.en.charAt(0).toUpperCase()}${word.en.slice(1)}` : ''}`;
  } else {
    what = bakeWhat(bakeType, styleKey, count, fr);
  }
  return [...when, what].join(' · ');
}
