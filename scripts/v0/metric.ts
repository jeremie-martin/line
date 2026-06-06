/**
 * Headline optimizer metric + paired decision statistics.
 *
 * Single source of truth for the scalar the improvement loop maximizes and for
 * the accept/reject decision rule. Kept SEPARATE from `score.ts` (the per-run
 * scorer) on purpose: this module aggregates already-computed suite scores and
 * must NOT enter `evaluatorFingerprint()` (which hashes the per-run ruler).
 *
 * Design:
 *  - Each budget is an INDEPENDENT full run (no anytime sharing). The headline is the
 *    WEIGHTED AVERAGE of the per-budget suite scores, weights proportional to budget
 *    value (higher-quality expensive runs matter more; lower budgets still count).
 *    Each budget is its own optimization target, so averaging per-budget optima is
 *    the right scalar — `ceiling`/`logAUC` are kept only as reported secondaries.
 *    Interim trade: while the search is still budget-oblivious this rewards
 *    early-budget gains the prior ceiling-heavy metric penalized; that is expected.
 *  - Decision: PAIRED cluster bootstrap on the headline delta (same specs+seeds for
 *    both configs), because pairing cancels common-mode seed luck (~10x noise
 *    collapse). The verdict is the score delta CI alone — accept iff ciLo>0.
 *  - Validity is NOT a gate: an invalid run already scores ~0, and the per-budget
 *    24-seed aggregation folds that into the score. Per-budget validity is reported
 *    as a diagnostic only.
 *  - Weights are keyed by budget (not position), so the decision recomputes safely on
 *    a budget intersection (e.g. a probe tier subset), renormalizing automatically.
 */
import { shiftedGeometricMean } from "./score.ts";

export type CurvePoint = { budget: number; score: number };
export type BudgetWeight = { budget: number; weight: number };

/** Per-config score cube: spec -> seed -> (budget -> score). */
export type ScoreCube = Map<string, Map<number, Map<number, number>>>;
/** Per-config validity cube: spec -> seed -> (budget -> contract_passed). */
export type ValidCube = Map<string, Map<number, Map<number, boolean>>>;

/**
 * Area under the quality-vs-log(budget) curve, normalized by the log-budget span
 * so the result is in score units (comparable to a single-budget score).
 * Trapezoidal in log-budget because diminishing returns live in log space and so
 * the value is robust to refining the budget grid.
 *
 * TODO(usage-weighting): `budgetWeights[i]` weights the i-th log-budget interval
 * by real deployment-budget frequency instead of uniform. Unused today (uniform);
 * wire to a deployment usage distribution when one is chosen.
 */
export function logAUC(points: CurvePoint[], budgetWeights?: number[]): number {
  const pts = points.filter((p) => p.budget > 0).sort((a, b) => a.budget - b.budget);
  if (pts.length === 0) return 0;
  if (pts.length === 1) return pts[0].score;
  const xs = pts.map((p) => Math.log(p.budget));
  let area = 0;
  let span = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = xs[i] - xs[i - 1];
    const w = budgetWeights ? budgetWeights[i - 1] ?? 1 : 1;
    area += w * dx * (pts[i].score + pts[i - 1].score) / 2;
    span += w * dx;
  }
  if (span <= 0) return pts.reduce((s, p) => s + p.score, 0) / pts.length;
  return area / span;
}

/** Suite quality at the largest budget present (the ceiling). */
export function ceilingAt(points: CurvePoint[]): number {
  if (points.length === 0) return 0;
  return points.reduce((best, p) => (p.budget > best.budget ? p : best), points[0]).score;
}

/**
 * THE HEADLINE SCALAR: weighted average of per-budget suite scores,
 * `Σ w_b·score_b / Σ w_b`, over the budgets present in BOTH `points` and
 * `weightByBudget`. Weights are looked up by budget (not position), and the divisor
 * is the sum of the weights actually used — so scoring a budget SUBSET (an
 * intersection / probe tier) renormalizes automatically with no positional drift.
 */
export function weightedBudgetScore(points: CurvePoint[], weightByBudget: BudgetWeight[]): number {
  return weightedBudgetScoreFromMap(points, weightMapOf(weightByBudget));
}

/** Build the budget→weight lookup once; hoist out of hot loops. */
function weightMapOf(weightByBudget: BudgetWeight[]): Map<number, number> {
  return new Map(weightByBudget.map((x) => [x.budget, x.weight]));
}

/** weightedBudgetScore with a precomputed weight map — used in the bootstrap hot
 *  loop so the (constant) map isn't rebuilt per resample. */
function weightedBudgetScoreFromMap(points: CurvePoint[], w: Map<number, number>): number {
  let num = 0;
  let den = 0;
  for (const p of points) {
    const wb = w.get(p.budget);
    if (wb === undefined || wb <= 0) continue;
    num += wb * p.score;
    den += wb;
  }
  return den > 0 ? num / den : 0;
}

/** Parse/validate a comma-separated budget list (positive integer frames). Uses
 *  Number, NOT parseInt, so "50k" -> NaN -> a loud error instead of a silent 50. */
export function parseBudgetList(raw: string): number[] {
  return raw.split(",").map((part) => {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`budget list must be comma-separated positive integer frames, got "${part.trim()}"`);
    }
    return n;
  });
}

/** Suite score from per-spec seed-score groups: shifted-geomean over seeds within
 *  each spec, then over specs. This is the SAME two-level aggregation golden.ts
 *  applies via groupScores()+suiteScore(); keep the two in sync (parity is pinned
 *  by tests/v0_metric.test.ts). */
export function suiteFromGroups(perSpecSeedScores: number[][]): number {
  return shiftedGeometricMean(perSpecSeedScores.map((g) => shiftedGeometricMean(g)));
}

// ── paired decision statistics ──────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) so a verdict is reproducible across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}

/** Headline score for a (possibly resampled) set of specs and per-spec seeds.
 *  Takes a precomputed weight map (the bootstrap calls this ~2·B times with the
 *  same constant weighting, so the map is built once by the caller). */
function headlineForSample(
  cube: ScoreCube,
  specsSample: string[],
  seedsBySpec: Map<string, number[]>,
  budgets: number[],
  weightMap: Map<number, number>,
): number {
  const points: CurvePoint[] = budgets.map((b) => {
    const groups: number[][] = [];
    for (const spec of specsSample) {
      const seedCurves = cube.get(spec);
      const seeds = seedsBySpec.get(spec);
      if (!seedCurves || !seeds || seeds.length === 0) continue;
      // Missing cells default to 0, but the decide-tool scope guard ensures common
      // specs/seeds/budgets and each (spec,seed,budget) is its own run, so this
      // fallback should not fire on well-formed archives.
      groups.push(seeds.map((se) => seedCurves.get(se)?.get(b) ?? 0));
    }
    // Same two-level aggregation as golden.ts's per-budget suiteScore (see suiteFromGroups).
    return { budget: b, score: suiteFromGroups(groups) };
  });
  return weightedBudgetScoreFromMap(points, weightMap);
}

/** Suite validity rate per budget (mean over specs of mean-over-seeds pass rate). */
export function validityByBudget(valid: ValidCube, budgets: number[]): { budget: number; rate: number }[] {
  const specs = [...valid.keys()];
  return budgets.map((b) => {
    const perSpec = specs.map((spec) => {
      const seeds = valid.get(spec)!;
      const vals = [...seeds.values()].map((m) => (m.get(b) ? 1 : 0));
      return mean(vals);
    });
    return { budget: b, rate: mean(perSpec) };
  });
}

export type Decision = {
  baseHeadline: number;
  candidateHeadline: number;
  delta: number;
  ciLo: number;
  ciHi: number;
  pLeZero: number;
  effect: number; // mean / sd  (paired Cohen's d analog)
  budgets: number[];
  weightByBudget: BudgetWeight[];
  /** Per-budget validity rates, REPORTED as a diagnostic only — they never gate. */
  validity: { budget: number; baseRate: number; candRate: number }[];
  verdict: "accept" | "reject" | "inconclusive";
};

/**
 * Paired CLUSTER bootstrap on the headline-metric delta (candidate - baseline).
 * Resample specs with replacement, then resample each chosen spec's seeds with
 * replacement; apply the SAME resample to both configs (paired). Propagates both
 * between-spec and within-spec (seed) variance.
 *
 * The verdict is the score delta CI ALONE: accept iff ciLo>0, reject iff ciHi<0,
 * else inconclusive. Validity does not gate (an invalid run already scores ~0); the
 * per-budget validity rates are computed and returned for reporting only.
 */
export function pairedBootstrapCI(
  base: ScoreCube,
  cand: ScoreCube,
  budgets: number[],
  opts: {
    weightByBudget: BudgetWeight[];
    B?: number;
    level?: number;
    rngSeed?: number;
    validBase?: ValidCube;
    validCand?: ValidCube;
  },
): Decision {
  const weightByBudget = opts.weightByBudget;
  const weightMap = weightMapOf(weightByBudget); // built once; reused across all resamples
  const B = opts.B ?? 10000;
  const level = opts.level ?? 0.95;
  const rand = mulberry32(opts.rngSeed ?? 12345);

  const specs = [...base.keys()].filter((s) => cand.has(s)).sort();
  const seedsOf = (spec: string): number[] => {
    const b = base.get(spec);
    const c = cand.get(spec);
    if (!b || !c) return [];
    return [...b.keys()].filter((se) => c.has(se)).sort((x, y) => x - y);
  };

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  // Precompute each spec's paired seed list ONCE (it never changes across the B
  // iterations); the loop only resamples from it.
  const seedsBySpecAll = new Map(specs.map((s) => [s, seedsOf(s)] as const));
  const deltas: number[] = [];

  for (let i = 0; i < B; i++) {
    const specsSample = specs.map(() => pick(specs));
    const seedsBySpec = new Map<string, number[]>();
    for (const spec of new Set(specsSample)) {
      const seeds = seedsBySpecAll.get(spec)!;
      seedsBySpec.set(spec, seeds.map(() => pick(seeds)));
    }
    deltas.push(
      headlineForSample(cand, specsSample, seedsBySpec, budgets, weightMap) -
        headlineForSample(base, specsSample, seedsBySpec, budgets, weightMap),
    );
  }

  deltas.sort((a, b) => a - b);
  const lo = (1 - level) / 2;
  const dMean = mean(deltas);
  const sd = Math.sqrt(mean(deltas.map((d) => (d - dMean) ** 2)));
  const baseHeadline = headlineForSample(base, specs, seedsBySpecAll, budgets, weightMap);
  const candidateHeadline = headlineForSample(cand, specs, seedsBySpecAll, budgets, weightMap);
  const pointDelta = candidateHeadline - baseHeadline;
  const ciLo = quantile(deltas, lo);
  const ciHi = quantile(deltas, 1 - lo);

  // Reported diagnostic only — per-budget validity rates, NOT a gate.
  const validity = opts.validBase && opts.validCand
    ? budgets.map((b) => ({
      budget: b,
      baseRate: validityByBudget(opts.validBase!, [b])[0].rate,
      candRate: validityByBudget(opts.validCand!, [b])[0].rate,
    }))
    : [];

  const verdict: Decision["verdict"] =
    ciLo > 0 ? "accept" : ciHi < 0 ? "reject" : "inconclusive";

  return {
    baseHeadline,
    candidateHeadline,
    delta: pointDelta,
    ciLo,
    ciHi,
    pLeZero: mean(deltas.map((d) => (d <= 0 ? 1 : 0))),
    effect: sd > 0 ? dMean / sd : 0,
    budgets,
    weightByBudget,
    validity,
    verdict,
  };
}
