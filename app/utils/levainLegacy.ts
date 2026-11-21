import { recipeFlourStrength, type FlourBlend } from '../data';
import type { SessionData } from '../lib/session';

// A levain bake saved before 21 Nov 2026 with a levain % (the baker's or the planner's raise) timed
// its bulk against the flour-scaled reference: it keeps that bulk (legacyStarterBulkFactor) while its
// % and flour stay, so opening it never re-times it. Bakes saved since carry null.
export type LevainLegacy = { pct: number; strength: number } | null;
export function restoredLevainLegacy(s: Pick<SessionData, 'levainLegacy' | 'yeastType' | 'starterPctOverride' | 'autoStarterPct' | 'styleKey' | 'flourChosen' | 'flourBlend'>): LevainLegacy {
  if (s.levainLegacy !== undefined) return s.levainLegacy && Number.isFinite(s.levainLegacy.pct) && Number.isFinite(s.levainLegacy.strength) ? { pct: s.levainLegacy.pct, strength: s.levainLegacy.strength } : null;
  const pct = s.yeastType === 'sourdough' ? s.starterPctOverride ?? s.autoStarterPct : undefined;
  if (pct == null || !Number.isFinite(pct)) return null;
  const strength = recipeFlourStrength(s.styleKey ?? '', 'custom', s.flourChosen && s.flourBlend ? s.flourBlend as FlourBlend : undefined);
  return strength === 1 ? null : { pct, strength };
}

