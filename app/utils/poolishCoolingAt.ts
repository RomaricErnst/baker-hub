import type {RecipeResult, ScheduleResult} from '../utils';

/** Use the first mix even when subsequent batches have separate start times. */
export function poolishCoolingAt(schedule: ScheduleResult | Date, recipe?: RecipeResult | null): Date | null {
  const hours = recipe?.thermal?.prefermentCooldownHours ?? 0;
  if (hours <= 0 || !recipe?.preferment || recipe.preferment.cold) return null;
  const mix = schedule instanceof Date ? schedule : schedule.availabilityActions?.find(action => action.id === 'mix')?.at
    ?? schedule.batchMixWindows?.[0]?.start;
  return mix ? new Date(+mix - hours * 3600000) : null;
}
