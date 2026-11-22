// Night steps of a plan the baker chose with their own amount (round 9, owner decision of 22 Nov 2026): an entered
// yeast amount, or "Keep the biga and bake …", is never refused for steps between 22:00 and 07:00; the plan is
// made and one quiet line names those steps ("This plan has folds at 10:40pm and 11:10pm."), with the nearest
// amount or bake that avoids them and a way to keep it. The automatic plan keeps its rule (no undeclared night step).
import type { AvailabilityAction } from './scheduleAvailability';

/** What a step is called in the line, by its plan id (the plural for repeated folds). */
function stepNoun(id: string, fr: boolean, preferment: 'poolish' | 'biga' | null, count: number): string {
  if (/^fold-\d+/.test(id)) return fr ? (count > 1 ? 'des rabats' : 'un rabat') : (count > 1 ? 'folds' : 'a fold');
  if (/^(mix|autolyse)/.test(id)) return fr ? 'le pétrissage' : 'Start Dough';
  if (id === 'divide' || id === 'roll') return fr ? 'le façonnage' : 'shaping';
  if (/^cold-in/.test(id)) return fr ? 'la pâte au frigo' : 'the dough into the fridge';
  if (/^cold-out/.test(id)) return fr ? 'la sortie du frigo' : 'the take-out';
  if (id === 'preheat') return fr ? 'le préchauffage' : 'the preheat';
  if (id === 'preferment') return preferment === 'biga' ? (fr ? 'la biga' : 'Make Biga') : (fr ? 'le poolish' : 'Make Poolish');
  if (id === 'preferment-cold-out' || id === 'preferment-cold-in') return fr ? `${preferment === 'biga' ? 'la biga' : 'le poolish'} hors du frigo` : `the ${preferment ?? 'preferment'} out of the fridge`;
  return fr ? 'une étape' : 'a step';
}

/** A clock time in the baker's language: "10:40pm" / « 22h40 ». */
export function clockLabel(d: Date, fr: boolean): string {
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  if (fr) return `${h}h${m}`;
  return `${h % 12 || 12}:${m}${h < 12 ? 'am' : 'pm'}`;
}

/** "This plan has folds at 10:40pm and 11:10pm, the take-out at 4:30am." (FR « Ce planning a des rabats à 22h40
 * et 23h10, la sortie du frigo à 4h30. »); null without night steps. Steps of one kind are named once. */
export function nightStepsLine(steps: readonly AvailabilityAction[], fr: boolean, preferment: 'poolish' | 'biga' | null = null): string | null {
  if (!steps.length) return null;
  const sorted = [...steps].sort((a, b) => +a.at - +b.at);
  const groups: { key: string; ids: string[]; times: Date[] }[] = [];
  for (const step of sorted) {
    const key = stepNoun(step.id, fr, preferment, 2);
    const group = groups.find(g => g.key === key);
    if (group) { if (!group.times.some(t => +t === +step.at)) { group.times.push(step.at); group.ids.push(step.id); } }
    else groups.push({ key, ids: [step.id], times: [step.at] });
  }
  const and = fr ? ' et ' : ' and ';
  const parts = groups.map(g => {
    const times = g.times.map(t => clockLabel(t, fr));
    const list = times.length > 1 ? `${times.slice(0, -1).join(', ')}${and}${times.at(-1)}` : times[0];
    return `${stepNoun(g.ids[0], fr, preferment, g.times.length)} ${fr ? 'à' : 'at'} ${list}`;
  });
  return fr ? `Ce planning a ${parts.join(', ')}.` : `This plan has ${parts.join(', ')}.`;
}
