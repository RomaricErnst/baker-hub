/** Bake again with fewer pizzas (20 Nov 2026 round 6, Maya: 6 picks carried onto a 4-pizza bake read "6 of 4
 *  chosen"). The carried picks scale to the new count, largest remainder first, so each pizza keeps its share;
 *  a pizza whose share rounds to nothing is dropped. Never scales up. */
export function scalePicks(qtys: Record<string, number>, count: number): Record<string, number> {
  const entries = Object.entries(qtys).filter(([, qty]) => qty > 0);
  const total = entries.reduce((sum, [, qty]) => sum + qty, 0);
  const target = Math.max(0, Math.floor(count));
  if (total <= target) return qtys;
  const shares = entries.map(([id, qty], index) => ({ id, index, exact: qty * target / total, qty: Math.floor(qty * target / total) }));
  let left = target - shares.reduce((sum, share) => sum + share.qty, 0);
  for (const share of [...shares].sort((a, b) => (b.exact - b.qty) - (a.exact - a.qty) || a.index - b.index)) {
    if (left <= 0) break;
    share.qty++; left--;
  }
  return Object.fromEntries(shares.filter(share => share.qty > 0).map(share => [share.id, share.qty]));
}

/** All the pizzas chosen have come out of the oven (round 6, Wei Ling: the bar still said "Now: Bake the pizzas"). */
export function allPicksBaked(qtys: Record<string, number>, baked: Record<string, number>): boolean {
  const picked = Object.entries(qtys).filter(([, qty]) => qty > 0);
  return picked.length > 0 && picked.every(([id, qty]) => (baked[id] ?? 0) >= qty);
}
