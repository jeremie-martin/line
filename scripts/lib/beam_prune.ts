/**
 * Generic beam-pruning helper.
 *
 * Extracted from the algorithm shell of `scripts/lib/beam_search.ts` so
 * the same prune logic can be reused outside that module (notably by the
 * v0 beam compiler in `scripts/v0/compile_beam.ts`).
 *
 * Behavior:
 *   1. Sort candidates ascending by the supplied comparator (lowest = best).
 *   2. Walk the sorted list, keeping items into a new beam of at most
 *      `beamWidth`, with at most `maxPerBucket` items per `bucketKey`.
 *   3. If the bucket cap left the beam below `beamWidth` while sorted items
 *      remain, fill the remaining slots from the sorted list ignoring the
 *      bucket cap (the standard rare-case fallback in beam_search.ts).
 *
 * Determinism: given a stable sort and deterministic `compare` and
 * `bucketKey`, output ordering is fully determined by input ordering.
 *
 * No domain assumptions. Tested in `tests/lib_beam_prune.test.ts`.
 */

export type PruneOptions = {
  /** Maximum number of items to keep. */
  beamWidth: number;
  /** Maximum items sharing the same bucketKey. Default: `ceil(beamWidth / 2)`
   *  — the same diversity ratio used in `lib/beam_search.ts`. */
  maxPerBucket?: number;
};

/**
 * @param candidates  items to prune
 * @param compare     `(a, b) => number` — return negative iff `a` is better
 *                    (sort is ascending; lower is better). Use a stable
 *                    comparator for deterministic output.
 * @param bucketKey   `(item) => string` — diversity key. Items sharing a
 *                    bucket compete for at most `maxPerBucket` slots.
 * @returns at most `beamWidth` items, in best-to-worst order.
 */
export function pruneBeam<T>(
  candidates: readonly T[],
  compare: (a: T, b: T) => number,
  bucketKey: (item: T) => string,
  opts: PruneOptions,
): T[] {
  const { beamWidth } = opts;
  if (!Number.isInteger(beamWidth) || beamWidth < 0) {
    throw new Error(`beamWidth must be a non-negative integer, got ${beamWidth}`);
  }
  if (beamWidth === 0) return [];
  if (candidates.length === 0) return [];
  const maxPerBucket = opts.maxPerBucket ?? Math.ceil(beamWidth / 2);
  if (maxPerBucket < 1) {
    throw new Error(`maxPerBucket must be >= 1, got ${maxPerBucket}`);
  }

  const sorted = [...candidates].sort(compare);

  const out: T[] = [];
  const bucketCounts = new Map<string, number>();
  const taken = new Set<T>();

  for (const item of sorted) {
    if (out.length >= beamWidth) break;
    const key = bucketKey(item);
    const cnt = bucketCounts.get(key) ?? 0;
    if (cnt >= maxPerBucket) continue;
    bucketCounts.set(key, cnt + 1);
    out.push(item);
    taken.add(item);
  }

  if (out.length < beamWidth) {
    for (const item of sorted) {
      if (out.length >= beamWidth) break;
      if (taken.has(item)) continue;
      out.push(item);
    }
  }

  return out;
}
