import { getBreadProtocol } from './breadProfiles';

/** The existing generic BakeGuide's prescribed offsets from bulk start.
 * These are protocol actions, not a new fermentation model. Bread protocols
 * prescribe conditional folds without fixed times; do not invent those here.
 * Handling duration is unspecified, so availability checks use point events.
 */
export function scheduledFoldMinutes(bulkHours: number, styleKey: string): number[] {
  // Rye (pain de seigle) is never folded: it has too little gluten to strengthen.
  if (getBreadProtocol(styleKey) || styleKey === 'pain_seigle' || !Number.isFinite(bulkHours)) return [];
  if (bulkHours >= 2) return [30, 60, 90, 120];
  if (bulkHours >= 1.5) return [30, 60];
  if (bulkHours >= 0.5) return [15];
  return [];
}
