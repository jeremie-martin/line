/** Adapted from archive/pre-rework-2026-10-03:scripts/v0/bench/perf_ab.ts.
 * Fixed-size paired bootstrap + median safeguard, with an exact sign gate.
 * Bootstrap support is an empirical resampling fraction, not a calibrated
 * posterior probability. Independent pairs and a fixed stopping rule matter.
 */
import assert from 'node:assert/strict';

export function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296;};
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2;};

export function signTail(wins: number, n: number) {
  assert(Number.isInteger(n) && n >= 0 && n <= 256 && Number.isInteger(wins) && wins >= 0 && wins <= n);
  let term = 2 ** -n, tail = wins === 0 ? term : 0;
  for (let k = 1; k <= n; k++) {term *= (n - k + 1) / k; if (k >= wins) tail += term;}
  return Math.min(1, tail);
}

export function decide(pairs: readonly {base: number; candidate: number}[], threshold = .95, resamples = 50_000) {
  assert(pairs.length >= 3 && pairs.length <= 256);
  assert(Number.isFinite(threshold) && threshold > .5 && threshold < 1);
  assert(Number.isInteger(resamples) && resamples >= 1000);
  assert(pairs.every(p => Number.isFinite(p.base) && p.base > 0 && Number.isFinite(p.candidate) && p.candidate > 0));
  const deltas = pairs.map(p => 100 * (p.candidate - p.base) / p.base);
  const wins = deltas.filter(d => d < 0).length, losses = deltas.filter(d => d > 0).length;
  const ties = pairs.length - wins - losses;
  const rng = random(0x2545f491), means: number[] = [];
  let faster = 0;
  for (let i = 0; i < resamples; i++) {
    let sum = 0;
    for (let j = 0; j < deltas.length; j++) sum += deltas[Math.floor(rng() * deltas.length)];
    const m = sum / deltas.length;
    means.push(m); faster += m < 0 ? 1 : m === 0 ? .5 : 0;
  }
  means.sort((a, b) => a - b);
  const support = faster / resamples, med = median(deltas);
  // Ties are excluded from the binomial count; an all-tie run supplies no sign evidence.
  const fasterSignP = signTail(wins, wins + losses), slowerSignP = signTail(losses, wins + losses);
  const keep = support >= threshold && med < 0 && fasterSignP <= 1 - threshold;
  const reject = 1 - support >= threshold && med > 0 && slowerSignP <= 1 - threshold;
  return {n: pairs.length, meanDeltaPct: mean(deltas), medianDeltaPct: med,
    intervalPct: [means[Math.floor(.025 * resamples)], means[Math.floor(.975 * resamples)]],
    bootstrapSupportFaster: support, wins, losses, ties, fasterSignP,
    twoSidedSignP: Math.min(1, 2 * Math.min(fasterSignP, slowerSignP)), threshold, resamples,
    verdict: keep ? 'KEEP' : reject ? 'REJECT' : 'INCONCLUSIVE'};
}

type CompileSample = {round: number; arm: number; measurements: {cell: number; compileMs: number}[]};
export function decideCompileCells(samples: readonly CompileSample[], cells: readonly number[], threshold = .95) {
  const rounds = [...new Set(samples.map(s => s.round))];
  for (const round of rounds) for (const arm of [0, 1]) {
    assert.equal(samples.filter(s => s.round === round && s.arm === arm).length, 1, 'one sample per arm and round required');
  }
  const decisions = cells.map(cell => ({cell, decision: decide(rounds.map(round => {
    const values = [0, 1].map(arm => samples.find(s => s.round === round && s.arm === arm)!.measurements
      .filter(m => m.cell === cell).reduce((sum, m) => sum + m.compileMs, 0));
    return {base: values[0], candidate: values[1]};
  }), threshold)}));
  return {decisions, regressionGuardPassed: decisions.every(c => c.decision.verdict !== 'REJECT')};
}
