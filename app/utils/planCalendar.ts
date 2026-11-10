// A bake plan as a calendar file (.ics): every hands-on step becomes an event
// with an alert at its time, so any phone calendar reminds the baker without a
// notification system of our own.

export type PlanCalendarEvent = { at: Date; end?: Date; label: string };

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
// RFC 5545 text escaping.
const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
// Lines are folded at 75 octets; continuation lines start with a space.
function fold(line: string) {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > (out.length ? 74 : 75)) { out.push(current); current = ''; bytes = 0; }
    current += char; bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** Labels for the scheduler's action ids, in the words the guide uses. */
export function planActionLabel(id: string, fr: boolean, opts: { singleLoaf?: boolean } = {}): string | null {
  const batch = /-batch-(\d+)$/.exec(id);
  const base = batch ? id.slice(0, batch.index) : id;
  const lot = batch ? (fr ? ` (lot ${batch[1]})` : ` (batch ${batch[1]})`) : '';
  const fold = /^fold-(\d+)$/.exec(base);
  if (fold) return (fr ? `Rabat ${fold[1]}` : `Fold ${fold[1]}`) + lot;
  const names: Record<string, [string, string]> = {
    autolyse: ['Autolyse : mélanger farine et eau', 'Autolyse: combine flour and water'],
    mix: ['Pétrir la pâte', 'Start Dough'],
    'mix-finish': ['Reprendre le pétrissage', 'Resume kneading'],
    'cold-in': ['Mettre la pâte au réfrigérateur', 'Dough into the fridge'],
    'cold-out': ['Sortir la pâte du réfrigérateur', 'Take the dough out of the fridge'],
    divide: opts.singleLoaf ? ['Façonner le pain', 'Shape the loaf'] : ['Diviser et façonner', 'Divide and shape'],
    'cold-in-2': opts.singleLoaf ? ['Mettre le pâton au réfrigérateur', 'Shaped loaf into the fridge'] : ['Mettre les pâtons au réfrigérateur', 'Shaped dough into the fridge'],
    'cold-out-2': opts.singleLoaf ? ['Sortir le pâton du réfrigérateur', 'Take the shaped loaf out of the fridge'] : ['Sortir les pâtons du réfrigérateur', 'Take the shaped dough out of the fridge'],
    preheat: ['Préchauffer le four', 'Preheat the oven'],
    poach: ['Pocher', 'Poach'],
    roll: ['Abaisser', 'Roll out'],
    'preferment-cold-in': ['Mettre le préferment au réfrigérateur', 'Preferment into the fridge'],
    'preferment-cold-out': ['Sortir le préferment du réfrigérateur', 'Take the preferment out of the fridge'],
  };
  const name = names[base];
  return name ? name[fr ? 0 : 1] + lot : null;
}

export function buildPlanCalendar({ title, events, bakeAt, bakeLabel, now = new Date(), url = 'https://www.bakerhub.app' }: {
  title: string; events: PlanCalendarEvent[]; bakeAt: Date; bakeLabel: string; now?: Date; url?: string;
}): string {
  const all = [...events, { at: bakeAt, label: bakeLabel }]
    .filter(event => Number.isFinite(+event.at))
    .sort((a, b) => +a.at - +b.at);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Baker Hub//Bake plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${text(title)}`];
  all.forEach((event, index) => {
    const end = event.end && +event.end > +event.at ? event.end : new Date(+event.at + 10 * 60000);
    lines.push('BEGIN:VEVENT',
      `UID:${stamp(bakeAt)}-${index}-${+event.at}@bakerhub.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(event.at)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${text(`${event.label} · ${title}`)}`,
      `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(event.label)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Hands the file to the browser; a phone offers to add the events to its calendar. */
export function downloadPlanCalendar(ics: string, filename: string) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href; link.download = filename; link.rel = 'noopener';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}
