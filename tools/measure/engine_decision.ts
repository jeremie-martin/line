/** Fixed-sample paired inference. One estimate, one distribution-free interval:
 * the median percentage change across independent process pairs. Replicates
 * within a process are aggregated before inference. Negative means faster.
 * Order-statistic bounds invert Binomial(n, 1/2); ties are conservative.
 * https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/mediancl.htm */
import assert from 'node:assert/strict';

type CellIdentity = {id: string; seed: number; budget?: number};
/** A parity cell's stable name: positions move when `cells.json` changes. */
export const cellName = (c: CellIdentity) => `${c.id}#${c.seed}${c.budget ? `@${c.budget}` : ''}`;
/** Real compiles: two songs at the standard allowance. */
export const PERF_CELLS = ['canonical-music_luna_bala_44s-automatic#101', 'canonical-music_tiki_tiki_48s-automatic#202'];
export function cellIndices(cells: readonly CellIdentity[], names: readonly string[]) {
  return names.map(name => {
    const index = cells.findIndex(c => cellName(c) === name);
    assert(index >= 0, `unknown parity cell: ${name}`);
    return index;
  });
}

export function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296;};
}

/** Equal numbers of AB and BA pairs, shuffled once before collecting data. */
export function pairOrder(rounds: number, seed: number): number[][] {
  assert(Number.isInteger(rounds) && rounds >= 8 && rounds <= 256 && rounds % 2 === 0, 'rounds must be even, 8..256');
  assert(Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff, 'seed must be a nonzero uint32');
  const order = Array.from({length: rounds}, (_, i) => i % 2), rng = random(seed);
  for (let i = rounds - 1; i > 0; i--) {const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];}
  return order.map(first => [first, 1 - first]);
}

type Pair = {base: number; candidate: number};
type Sample = {round: number; arm: number; cell: string; nsPerFrame: number};

/** Each complete round as a pair: of one cell, or of every cell's mean. A round's
 * cells must have finished in both arms before it counts. */
export function measuredPairs(samples: readonly Sample[], cell?: string): Pair[] {
  const chosen = samples.filter(s => cell === undefined || s.cell === cell);
  const cells = new Set(chosen.map(s => s.cell)).size, pairs: Pair[] = [];
  for (const round of [...new Set(chosen.map(s => s.round))].sort((a, b) => a - b)) {
    const inRound = chosen.filter(s => s.round === round), [base, candidate] = [0, 1].map(arm => inRound.filter(s => s.arm === arm));
    if (base.length !== cells || candidate.length !== cells) continue;
    const total = (arm: Sample[]) => arm.reduce((sum, s) => sum + s.nsPerFrame, 0) / cells;
    pairs.push({base: total(base), candidate: total(candidate)});
  }
  return pairs;
}

function pairedChanges(pairs: readonly Pair[]) {
  assert(pairs.every(p => Number.isFinite(p.base) && p.base > 0 && Number.isFinite(p.candidate) && p.candidate > 0));
  const deltas = pairs.map(p => 100 * (p.candidate - p.base) / p.base).sort((a, b) => a - b);
  assert(deltas.every(Number.isFinite));
  return deltas;
}

const median = (sorted: readonly number[]) => sorted.length % 2 ? sorted[sorted.length >> 1] :
  (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

/** Descriptive progress only: no interval, probability or early verdict. */
export function summarizePairs(pairs: readonly Pair[]) {
  const deltas = pairedChanges(pairs);
  return {n: deltas.length, medianDeltaPct: deltas.length ? median(deltas) : null,
    fasterPairs: deltas.filter(d => d < 0).length, slowerPairs: deltas.filter(d => d > 0).length,
    tiedPairs: deltas.filter(d => d === 0).length};
}

export function decide(pairs: readonly Pair[], confidence = .95, marginPct = .5) {
  const n = pairs.length;
  assert(Number.isInteger(n) && n >= 8 && n <= 256);
  assert(Number.isFinite(confidence) && confidence > .5 && confidence < 1);
  assert(Number.isFinite(marginPct) && marginPct >= 0 && marginPct < 100);
  const deltas = pairedChanges(pairs);
  // P(W <= k) is one excluded tail. Select the narrowest conservative interval.
  let term = 2 ** -n, tail = 0, rank = -1, coverage = 0;
  for (let k = 0; k < Math.floor(n / 2); k++) {
    tail += term;
    const included = 1 - 2 * tail;
    if (included < confidence) break;
    rank = k; coverage = included;
    term *= (n - k) / (k + 1);
  }
  assert(rank >= 0, 'too few pairs for a finite interval at this confidence');
  const intervalPct: [number, number] = [deltas[rank], deltas[n - rank - 1]];
  const [lower, upper] = intervalPct;
  const medianDeltaPct = median(deltas);
  const verdict = upper < -marginPct ? 'FASTER' : lower > marginPct ? 'SLOWER' :
    lower >= -marginPct && upper <= marginPct ? 'EQUIVALENT' : 'INCONCLUSIVE';
  return {n, medianDeltaPct, intervalPct, confidence, coverage, marginPct, verdict};
}
