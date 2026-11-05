/** Fixed-sample paired inference. One estimate, one distribution-free interval:
 * the median percentage change across independent process pairs. Replicates
 * within a process are aggregated before inference. Negative means faster.
 * Order-statistic bounds invert Binomial(n, 1/2); ties are conservative.
 * https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/mediancl.htm */
import assert from 'node:assert/strict';

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

export function decide(pairs: readonly Pair[], confidence = .95, marginPct = 2) {
  const n = pairs.length;
  assert(Number.isInteger(n) && n >= 8 && n <= 256);
  assert(Number.isFinite(confidence) && confidence > .5 && confidence < 1);
  assert(Number.isFinite(marginPct) && marginPct > 0 && marginPct < 100);
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

type CompileSample = {round: number; arm: number; iterations: {rep: number; cell: number; compileMs: number}[]};
export function decideCompileCells(samples: readonly CompileSample[], cells: readonly number[], confidence = .95, marginPct = 2) {
  assert(cells.length > 0 && new Set(cells).size === cells.length, 'unique cells required');
  const rounds = [...new Set(samples.map(s => s.round))];
  for (const round of rounds) for (const arm of [0, 1]) {
    assert.equal(samples.filter(s => s.round === round && s.arm === arm).length, 1, 'one sample per arm and round required');
  }
  const decisions = cells.map(cell => ({cell, decision: decide(rounds.map(round => {
    const observations = [0, 1].map(arm => samples.find(s => s.round === round && s.arm === arm)!.iterations.filter(m => m.rep >= 0 && m.cell === cell));
    assert(observations[0].length > 0 && observations[0].length === observations[1].length, 'equal nonempty cell replicates required');
    const values = observations.map(ms => ms.reduce((sum, m) => sum + m.compileMs, 0));
    return {base: values[0], candidate: values[1]};
  }), confidence, marginPct)}));
  // Inconclusive harm is not evidence of non-regression. Every declared cell
  // must bound its median slowdown by the predeclared practical margin.
  return {decisions, regressionGuardPassed: decisions.every(c => c.decision.intervalPct[1] <= marginPct)};
}
