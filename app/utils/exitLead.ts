// The time a cold-proofed dough spends out of the fridge before the bake, carried from one
// bake to the next by Bake again (18 Nov 2026 retention round 4, Thomas: baking one hour
// later moved nothing but the final proof, 3 h → 4 h, while the later exit was free).
// buildSchedule keeps it (exitLeadMin) when that exit is free; otherwise its own exit stands.
import type { ScheduleResult } from '../utils';

export interface ExitLead { min: number; kitchenTemp: number; styleKey: string }

export function normalizeExitLead(value: unknown): ExitLead | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { min, kitchenTemp, styleKey } = value as Record<string, unknown>;
  if (typeof min !== 'number' || !Number.isFinite(min) || min <= 0 || min > 24 * 60) return undefined;
  if (typeof kitchenTemp !== 'number' || !Number.isFinite(kitchenTemp) || typeof styleKey !== 'string' || !styleKey) return undefined;
  return { min, kitchenTemp, styleKey };
}

/** This plan's lead: from the final fridge exit to the bake, when the dough warms up on the
 *  counter after a cold proof (not when it bakes straight from the fridge). */
export function planExitLead(schedule: ScheduleResult | null | undefined, kitchenTemp: number, styleKey: string | null | undefined): ExitLead | undefined {
  if (!schedule || !styleKey || !schedule.coldRetard2Start || !schedule.coldRetard2End || !schedule.rtWarmupStart) return undefined;
  return normalizeExitLead({ min: Math.round((+schedule.bakeStart - +schedule.coldRetard2End) / 60000), kitchenTemp, styleKey });
}

/** The lead to keep for this bake: only in the same kitchen, for the same dough. */
export function exitLeadFor(lead: ExitLead | undefined, kitchenTemp: number, styleKey: string | null | undefined): number | undefined {
  return lead && lead.kitchenTemp === kitchenTemp && lead.styleKey === styleKey ? lead.min : undefined;
}
