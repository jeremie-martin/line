/** Stable two-role ordering for a fixed-count proposal lane.
 *
 * The exploit comparator owns the first element exactly. When the exploration
 * slot is enabled, its comparator orders only the remaining elements. A later
 * geometry-distinctness filter may skip an element, so the complete remainder
 * is ordered rather than only swapping positions one and two.
 */
export function orderExploitThenExplore<T>(
  candidates: readonly T[],
  compareExploit: (left: T, right: T) => number,
  compareExplore: (left: T, right: T) => number,
  explorationSlotEnabled: boolean,
): T[] {
  const exploitOrder = candidates.slice().sort(compareExploit);
  if (!explorationSlotEnabled || exploitOrder.length < 2) return exploitOrder;
  const [exploit, ...remaining] = exploitOrder;
  remaining.sort(compareExplore);
  return [exploit, ...remaining];
}
