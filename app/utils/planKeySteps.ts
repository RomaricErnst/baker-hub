/*
 * Your plan on the Recipe shows the key stages only (20 Nov 2026 round 7, owner): the preferment or the
 * levain build, the mix and the bake, each with its time; "All steps" opens the detailed list. A row the
 * baker can act on stays in the short list too: a time they can change, a step in a busy time.
 */

/** Plan row keys that are key stages: Make Poolish/Biga, the pre-mix levain feed, Start Dough, Bake. */
export function isKeyStageKey(key: string): boolean {
  return key === 'preferment' || key === 'mix' || key === 'bake' || key.startsWith('starter-pre_mix');
}

export type PlanRowFacts = {
  /** Every step key the row carries (steps at the same shown time share a row). */
  keys: string[];
  /** The plan's first action (its own row, the start of the plan). */
  own: boolean;
  busy?: boolean;
};

/**
 * Whether a row stays in the short plan. `startIsKey`: the plan's first action is a key stage (the poolish,
 * the pre-mix feed, the mix or an autolyse before it), not an earlier starter feed or revival, which the
 * full list keeps. `editable`: keys whose time the baker changes from the plan. `pinned`: keys with an
 * editor or a note open under them.
 */
export function isKeyPlanRow(row: PlanRowFacts, opts: { startIsKey: boolean; editable?: string[]; pinned?: (string | null | undefined)[] }): boolean {
  if (row.keys.some(isKeyStageKey)) return true;
  if (row.own && opts.startIsKey) return true;
  if (row.busy) return true;
  if (opts.editable?.some(key => row.keys.includes(key))) return true;
  if (opts.pinned?.some(key => !!key && row.keys.includes(key))) return true;
  return false;
}
