/**
 * Seedable deterministic RNG. Two trials with the same seed produce the
 * exact same sequence of numbers — essential for reproducibility.
 *
 * Algorithm: mulberry32. Tiny, fast, good enough for our search.
 */

export function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Apply ±pct (default ±20%) jitter to a base value using the given RNG.
 * When `rng` is undefined, returns `base` unchanged — adapters opt in by
 * passing the RNG (i.e. only the seeded search-mode path jitters).
 */
export function jitter(rng: (() => number) | undefined, base: number, pct = 0.2): number {
  if (rng === undefined) return base;
  return base * (1 - pct + rng() * 2 * pct);
}

/**
 * Integer variant of `jitter` — clamps to integer with the same band.
 */
export function jitterInt(rng: (() => number) | undefined, base: number, pct = 0.2): number {
  if (rng === undefined) return base;
  return Math.max(1, Math.round(base * (1 - pct + rng() * 2 * pct)));
}
