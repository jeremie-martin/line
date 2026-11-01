/** V7 explicit geometry requests (stratum E; docs/research/v7-design-20261101.md).
 * A song's own spec.ts, unchanged, where three consecutive gaps ask for one
 * geometry in three places: early, middle and late (the gaps starting at the
 * impacts nearest 20%, 50% and 80% of the ride). The rest of the ride is the
 * automatic plan. The windows come from the spec's own impacts, never by hand. */
import type { Spec } from "../scripts/v0/types.ts";

export type Rail = "offered" | "required" | "handover";
export function explicitRequest(spec: Spec, family: string, rail: Rail, pattern: string) {
  const t = spec.contacts.map((c) => c.t), n = t.length;
  const construction = [0.2, 0.5, 0.8].map((at) => {
    // Gap k starts at impact k − 1; the window holds the three gaps that start at impacts k−1, k, k+1.
    const k = Math.min(n - 3, Math.max(1, Math.round(at * n)));
    return { from: t[k - 1], to: (t[k + 1] + t[k + 2]) / 2, family, rail };
  });
  return { stratum: "E" as const, pattern, windows: construction.map((w) => [w.from, w.to] as [number, number]), construction };
}
