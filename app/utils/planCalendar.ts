// A bake plan as a calendar file (.ics). Only the key steps become events, each
// with one alert, so the baker's calendar reminds them without a notification
// system of our own and without a stream of messages:
// - mixing (autolyse and resumed kneading are folded into it),
// - the stretch-and-folds as one event with one alert,
// - fridge in/out, dividing and shaping, preheating, the bake,
// - starter feeds and preferment steps.
// Steps within 20 minutes of each other share one event and one alert. Taking dough out of the fridge and
// preheating alert ten minutes early, since they need the baker to be ready.
// Event ids are stable for a bake, so re-adding the plan after a change updates
// the events in calendars that support it instead of adding a second set.

export type PlanCalendarEvent = {
  at: Date;
  end?: Date;
  label: string;
  /** Stable key for this step within the bake (used for the event id). */
  key?: string;
  /** Minutes before the step that the alert fires. */
  alertBeforeMin?: number;
};

export type PlanAction = { id: string; at: Date; end?: Date };

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

type LabelOpts = { singleLoaf?: boolean; panStyle?: boolean };

/** Labels for the scheduler's action ids, in the words the guide uses. */
export function planActionLabel(id: string, fr: boolean, opts: LabelOpts = {}): string | null {
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
    divide: opts.panStyle ? ['Diviser et presser dans les moules', 'Divide and press into the pans']
      : opts.singleLoaf ? ['Façonner le pain', 'Shape the loaf'] : ['Diviser et façonner', 'Divide and shape'],
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

// Steps whose alert comes early: the baker needs a few minutes to be there.
const EARLY_ALERT = new Set(['cold-out', 'cold-out-2', 'preferment-cold-out', 'preheat', 'starter-fridge_out']);
const EARLY_ALERT_MIN = 10;
// Steps closer than this share one alert (the first one's).
const MERGE_WINDOW_MS = 30 * 60000;

/**
 * Reduces the scheduler's hands-on actions to the key steps a baker needs a
 * reminder for. Mixing absorbs autolyse, resumed kneading and later batches;
 * all folds become one event; past steps are dropped.
 */
export function keyPlanEvents(actions: PlanAction[], fr: boolean, opts: LabelOpts & { from?: number } = {}): PlanCalendarEvent[] {
  const from = opts.from ?? -Infinity;
  const base = (id: string) => id.replace(/-batch-\d+$/, '');
  const mixParts = actions.filter(a => ['autolyse', 'mix', 'mix-finish'].includes(base(a.id)));
  const folds = actions.filter(a => /^fold-\d+$/.test(base(a.id))).sort((a, b) => +a.at - +b.at);
  const events: PlanCalendarEvent[] = [];
  if (mixParts.length) {
    const start = Math.min(...mixParts.map(a => +a.at));
    const end = Math.max(...mixParts.map(a => +(a.end ?? a.at)));
    const autolyse = mixParts.some(a => base(a.id) === 'autolyse');
    if (end >= from) events.push({
      key: 'mix', at: new Date(Math.max(start, from)), end: new Date(end),
      label: autolyse ? (fr ? 'Autolyse puis pétrissage' : 'Autolyse, then Start Dough') : (fr ? 'Pétrir la pâte' : 'Start Dough'),
    });
  }
  const futureFolds = folds.filter(a => +a.at >= from);
  if (futureFolds.length) {
    const sets = new Set(futureFolds.map(a => base(a.id))).size;
    // The spacing between sets of one batch, not between batches folding one after another.
    const firstBatch = futureFolds.filter(a => base(a.id) === a.id);
    const spaced = firstBatch.length > 1 ? firstBatch : futureFolds;
    const gaps = spaced.slice(1).map((a, i) => Math.round((+a.at - +spaced[i].at) / 60000)).filter(m => m > 0);
    const batched = firstBatch.length > 0 && firstBatch.length < futureFolds.length;
    const every = gaps.length ? Math.min(...gaps) : 0;
    const count = batched ? (fr ? `Rabats (${sets} par fournée)` : `Stretch and folds (${sets} per batch)`) : fr ? `Rabats (${sets})` : `Stretch and folds (${sets})`;
    const spacing = every && sets > 1 ? (fr ? `, toutes les ${every} min` : `, every ${every} min`) : '';
    events.push({ key: 'folds', at: futureFolds[0].at, end: new Date(+futureFolds[futureFolds.length - 1].at + 5 * 60000), label: count + spacing });
  }
  const seen = new Set<string>();
  for (const action of actions) {
    const id = base(action.id);
    if (['autolyse', 'mix', 'mix-finish'].includes(id) || /^fold-\d+$/.test(id) || seen.has(id)) continue;
    if (+action.at < from) continue;
    const label = planActionLabel(id, fr, opts);
    if (!label) continue;
    seen.add(id);
    events.push({ key: id, at: action.at, end: action.end, label, alertBeforeMin: EARLY_ALERT.has(id) ? EARLY_ALERT_MIN : 0 });
  }
  return events;
}

/**
 * Steps close together keep their own event (so each has a stable id), but only
 * the first of them alerts: one reminder per moment the baker has to be there.
 */
export function quietCloseAlerts(events: PlanCalendarEvent[]): (PlanCalendarEvent & { silent?: boolean })[] {
  const sorted = [...events].filter(e => Number.isFinite(+e.at)).sort((a, b) => +a.at - +b.at);
  let lastAlert = -Infinity;
  return sorted.map(event => {
    const alertAt = +event.at - (event.alertBeforeMin ?? 0) * 60000;
    if (alertAt - lastAlert < MERGE_WINDOW_MS) return { ...event, silent: true };
    lastAlert = alertAt;
    return { ...event };
  });
}

/**
 * Steps within a few minutes of each other become one event with one alert
 * ("Take the dough out of the fridge · Divide and shape"), so the calendar holds
 * one reminder per moment the baker has to be there. The group keeps its first
 * step's key, so its id stays stable; a step folded into a group is cancelled
 * from the previous export like any step that left the plan. The bake stays its own event.
 */
const GROUP_WINDOW_MS = 20 * 60000;
export function mergeCloseEvents(events: PlanCalendarEvent[]): PlanCalendarEvent[] {
  const sorted = [...events].filter(e => Number.isFinite(+e.at)).sort((a, b) => +a.at - +b.at);
  const groups: PlanCalendarEvent[][] = [];
  for (const event of sorted) {
    const last = groups[groups.length - 1];
    if (last && event.key !== 'bake' && last[0].key !== 'bake' && +event.at - +last[0].at <= GROUP_WINDOW_MS) last.push(event);
    else groups.push([event]);
  }
  return groups.map(group => {
    if (group.length === 1) return group[0];
    const alertAt = Math.min(...group.map(e => +e.at - (e.alertBeforeMin ?? 0) * 60000));
    const end = Math.max(...group.map(e => +(e.end ?? e.at)), +group[group.length - 1].at + 10 * 60000);
    return { key: group[0].key, at: group[0].at, end: new Date(end), label: group.map(e => e.label).join(' · '), alertBeforeMin: Math.round((+group[0].at - alertAt) / 60000) };
  });
}

/** What was last exported for a bake, so a re-export can cancel steps that left the plan. */
export type ExportedSteps = Record<string, { at: number; label: string }>;
const EXPORTS_KEY = 'bh_calendar_exports_v1';
export function readExportedSteps(bakeId: string): ExportedSteps {
  try { return (JSON.parse(localStorage.getItem(EXPORTS_KEY) || '{}') as Record<string, ExportedSteps>)[bakeId] ?? {}; } catch { return {}; }
}
export function hasExportedPlan(bakeId: string | null | undefined): boolean {
  return !!bakeId && Object.keys(readExportedSteps(bakeId)).length > 0;
}
export function writeExportedSteps(bakeId: string, steps: ExportedSteps) {
  try {
    const all = JSON.parse(localStorage.getItem(EXPORTS_KEY) || '{}') as Record<string, ExportedSteps>;
    all[bakeId] = steps;
    // Keep the last 30 bakes.
    const keys = Object.keys(all);
    for (const old of keys.slice(0, Math.max(0, keys.length - 30))) delete all[old];
    localStorage.setItem(EXPORTS_KEY, JSON.stringify(all));
  } catch { /* storage unavailable: re-exports then simply cannot cancel */ }
}

export function buildPlanCalendar({ title, events, bakeAt, bakeLabel, bakeId, previous = {}, now = new Date(), url = 'https://www.bakerhub.app' }: {
  title: string; events: PlanCalendarEvent[]; bakeAt: Date; bakeLabel: string;
  /** Stable for this bake, so a second export updates rather than duplicates. */
  bakeId?: string;
  /** Steps exported last time for this bake: those no longer in the plan are cancelled. */
  previous?: ExportedSteps;
  now?: Date; url?: string;
}): string {
  const all = quietCloseAlerts(mergeCloseEvents([...events, { at: bakeAt, label: bakeLabel, key: 'bake' }]));
  const id = bakeId ?? stamp(bakeAt);
  // Seconds, so two exports in the same minute still count as an update.
  const sequence = Math.floor(+now / 1000) % 2000000000;
  const uidFor = (key: string) => `${id}-${key.replace(/[^A-Za-z0-9_-]/g, '')}@bakerhub.app`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Baker Hub//Bake plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${text(title)}`];
  const used = new Set<string>();
  all.forEach((event, index) => {
    const end = event.end && +event.end > +event.at ? event.end : new Date(+event.at + 10 * 60000);
    let key = event.key || `step-${index}`;
    if (used.has(key)) key = `${key}-${index}`;
    used.add(key);
    const before = Math.max(0, Math.round(event.alertBeforeMin ?? 0));
    lines.push('BEGIN:VEVENT',
      `UID:${uidFor(key)}`,
      // A later export of the same bake carries a higher sequence, so calendars that
      // support updates replace the earlier event.
      `SEQUENCE:${sequence}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(event.at)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${text(`${event.label} · ${title}`)}`,
      `URL:${url}`,
      ...(event.silent ? [] : ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(event.label)}`, `TRIGGER:${before ? `-PT${before}M` : 'PT0M'}`, 'END:VALARM']),
      'END:VEVENT');
  });
  // Steps that left the plan since the last export are cancelled, not left behind.
  for (const [key, step] of Object.entries(previous)) {
    if (used.has(key)) continue;
    lines.push('BEGIN:VEVENT', `UID:${uidFor(key)}`, `SEQUENCE:${sequence}`, `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(new Date(step.at))}`, `DTEND:${stamp(new Date(step.at + 10 * 60000))}`,
      `SUMMARY:${text(`${step.label} · ${title}`)}`, 'STATUS:CANCELLED', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** The steps a file exports, keyed as in the file, for the next export's cancellations. */
export function exportedSteps(events: PlanCalendarEvent[], bakeAt: Date, bakeLabel: string): ExportedSteps {
  const out: ExportedSteps = {};
  const used = new Set<string>();
  quietCloseAlerts(mergeCloseEvents([...events, { at: bakeAt, label: bakeLabel, key: 'bake' }])).forEach((event, index) => {
    let key = event.key || `step-${index}`;
    if (used.has(key)) key = `${key}-${index}`;
    used.add(key);
    out[key] = { at: +event.at, label: event.label };
  });
  return out;
}

/** One id per bake in this browser, kept while the same bake is re-exported. */
export function calendarBakeId(styleKey: string | null | undefined, bakeAt: Date): string {
  const key = 'bh_calendar_v1';
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null') as { id: string; style: string; bakeAt: number } | null;
    // Same style and a bake within three days of the last export: the same bake, possibly moved.
    if (stored && stored.style === (styleKey ?? '') && Math.abs(stored.bakeAt - +bakeAt) < 3 * 86400000) {
      localStorage.setItem(key, JSON.stringify({ ...stored, bakeAt: +bakeAt }));
      return stored.id;
    }
    const id = `bake-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, JSON.stringify({ id, style: styleKey ?? '', bakeAt: +bakeAt }));
    return id;
  } catch {
    return `bake-${stamp(bakeAt)}`;
  }
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
