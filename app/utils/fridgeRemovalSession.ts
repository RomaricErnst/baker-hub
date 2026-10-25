import type { AvailabilityBlock } from '../utils';
import { getFinalFridgeRemoval, isFridgeRemovalCovered, type AvailabilityAction } from './scheduleAvailability';

/** A changed committed plan must not resurrect a previously arranged action. */
export function retainCurrentFridgeRemoval(blocks: AvailabilityBlock[], actions: AvailabilityAction[]): AvailabilityBlock[] {
  const action = getFinalFridgeRemoval(actions);
  let changed = false;
  const next = blocks.map(block => {
    if (!block.fridgeRemoval || (action && +block.from <= +action.at && +action.at < +block.to && isFridgeRemovalCovered(action, block))) return block;
    changed = true;
    const { fridgeRemoval: _removed, ...rest } = block;
    return rest;
  });
  return changed ? next : blocks;
}
