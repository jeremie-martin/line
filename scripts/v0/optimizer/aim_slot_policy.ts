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

export type AimModelImpactPolicy =
  | "off"
  | "full"
  | "distilled"
  | "pool-value"
  | "pool-value-repair"
  | "requested-pool-second";

export type AimPrimaryImpactArtifact = "off" | "full" | "distilled" | "pool-value";

/** Resolve the primary scorer without inspecting any search state beyond the
 * explicit lane bit. In particular, repair-only pool value is byte-identical
 * to the deployed scorer everywhere outside an independent repair attempt. */
export function primaryAimImpactArtifact(
  policy: AimModelImpactPolicy,
  repairLaneActive: boolean,
): AimPrimaryImpactArtifact {
  if (policy === "pool-value-repair") {
    return repairLaneActive ? "pool-value" : "distilled";
  }
  if (policy === "requested-pool-second") return "distilled";
  return policy;
}
