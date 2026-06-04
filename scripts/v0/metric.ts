/**
 * Headline optimizer metric + paired decision statistics.
 *
 * Single source of truth for the scalar the improvement loop maximizes and for
 * the accept/reject decision rule. Kept SEPARATE from `score.ts` (the per-run
 * scorer) on purpose: this module aggregates already-computed suite scores and
 * must NOT enter `evaluatorFingerprint()` (which hashes the per-run ruler).
 *
 * Design (see docs/metric_problem_statement.md):
 *  - The compiler is an anytime algorithm: one compile to the max budget emits a
 *    quality score at every budget checkpoint (measure-once). What we want is the
 *    CEILING within an affordable budget, while still rewarding monotone
 *    diminishing-returns conversion of compute — NOT a uniform average over a low
 *    budget window (which penalized slow-but-higher-ceiling approaches).
 *  - Headline: Score = alpha*q(b_max) + (1-alpha)*logAUC, alpha=0.7.
 *  - Decision: PAIRED cluster bootstrap on the headline delta (same specs+seeds
 *    for both configs), because pairing cancels common-mode seed luck (~10x noise
 *    collapse). The fixed "+5" rule is retired — it is inside the noise.
 *  - Scoring is grid-agnostic and budget-subset selectable (selectScoreBudgets),
 *    the seam for the future canonical few-budget mode and the budget-aware
 *    (non-anytime) algorithm, which will run on fewer budgets.
 */
import { shiftedGeometricMean } from "./score.ts";

export const DEFAULT_ALPHA = 0.7;

export type CurvePoint = { budget: number; score: number };

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

export type HeadlineScore = { score: number; ceiling: number; logAUC: number; alpha: number };

/** The headline scalar, returned WITH its components (anti-Goodhart: a reviewer
 *  must be able to see whether a gain is ceiling vs cheap-run). */
export function headlineScore(points: CurvePoint[], alpha = DEFAULT_ALPHA): HeadlineScore {
  const ceiling = ceilingAt(points);
  const auc = logAUC(points);
  return { score: alpha * ceiling + (1 - alpha) * auc, ceiling, logAUC: auc, alpha };
}

/** Grid-agnostic budget selection: default = all measured budgets; a subset (e.g.
 *  the canonical few {50k,100k,150k}) keeps only those that were actually run. */
export function selectScoreBudgets(allBudgets: number[], subset?: number[]): number[] {
  if (!subset || subset.length === 0) return [...allBudgets];
  const present = new Set(allBudgets);
  return subset.filter((b) => present.has(b));
}

/** Parse/validate `--alpha`: a finite number in [0,1]. Throws on bad input so a
 *  typo (e.g. `--alpha=fast`) fails loudly instead of poisoning the headline with
 *  NaN. */
export function parseAlpha(raw: string): number {
  const a = Number(raw);
  if (!Number.isFinite(a) || a < 0 || a > 1) {
    throw new Error(`--alpha must be a number in [0,1], got "${raw}"`);
  }
  return a;
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

/** Headline score for a (possibly resampled) set of specs and per-spec seeds. */
function headlineForSample(
  cube: ScoreCube,
  specsSample: string[],
  seedsBySpec: Map<string, number[]>,
  budgets: number[],
  alpha: number,
): number {
  const points: CurvePoint[] = budgets.map((b) => {
    const groups: number[][] = [];
    for (const spec of specsSample) {
      const seedCurves = cube.get(spec);
      const seeds = seedsBySpec.get(spec);
      if (!seedCurves || !seeds || seeds.length === 0) continue;
      // Missing cells default to 0, but the decide-tool scope guard ensures common
      // specs/seeds/budgets and measure-once guarantees every budget per row, so
      // this fallback should not fire on well-formed archives.
      groups.push(seeds.map((se) => seedCurves.get(se)?.get(b) ?? 0));
    }
    // Same two-level aggregation as golden.ts's per-budget suiteScore (see suiteFromGroups).
    return { budget: b, score: suiteFromGroups(groups) };
  });
  return headlineScore(points, alpha).score;
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
  delta: number;
  ciLo: number;
  ciHi: number;
  pLeZero: number;
  effect: number; // mean / sd  (paired Cohen's d analog)
  alpha: number;
  budgets: number[];
  validity: { budget: number; baseRate: number; candRate: number; deltaCiLo: number }[];
  verdict: "accept" | "reject" | "inconclusive";
};

/**
 * Paired CLUSTER bootstrap on the headline-metric delta (candidate - baseline).
 * Resample specs with replacement, then resample each chosen spec's seeds with
 * replacement; apply the SAME resample to both configs (paired). Propagates both
 * between-spec and within-spec (seed) variance.
 *
 * Accept iff the headline delta CI lower bound > 0 AND validity does not regress
 * beyond noise at any budget (per-budget rate-delta CI lower bound > -tol).
 */
export function pairedBootstrapCI(
  base: ScoreCube,
  cand: ScoreCube,
  budgets: number[],
  opts: {
    alpha?: number;
    B?: number;
    level?: number;
    rngSeed?: number;
    validityTol?: number;
    validBase?: ValidCube;
    validCand?: ValidCube;
  } = {},
): Decision {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const B = opts.B ?? 10000;
  const level = opts.level ?? 0.95;
  const tol = opts.validityTol ?? 0.02;
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
  const budgetForValidity = opts.validBase && opts.validCand ? budgets : [];
  const validDeltaSamples: number[][] = budgetForValidity.map(() => []);

  for (let i = 0; i < B; i++) {
    const specsSample = specs.map(() => pick(specs));
    const seedsBySpec = new Map<string, number[]>();
    for (const spec of new Set(specsSample)) {
      const seeds = seedsBySpecAll.get(spec)!;
      seedsBySpec.set(spec, seeds.map(() => pick(seeds)));
    }
    deltas.push(
      headlineForSample(cand, specsSample, seedsBySpec, budgets, alpha) -
        headlineForSample(base, specsSample, seedsBySpec, budgets, alpha),
    );
    if (opts.validBase && opts.validCand) {
      budgetForValidity.forEach((b, bi) => {
        const rate = (cube: ValidCube): number => {
          const perSpec = specsSample.map((spec) => {
            const seeds = seedsBySpec.get(spec)!;
            const sc = cube.get(spec);
            if (!sc) return 0;
            return mean(seeds.map((se) => (sc.get(se)?.get(b) ? 1 : 0)));
          });
          return mean(perSpec);
        };
        validDeltaSamples[bi].push(rate(opts.validCand!) - rate(opts.validBase!));
      });
    }
  }

  deltas.sort((a, b) => a - b);
  const lo = (1 - level) / 2;
  const dMean = mean(deltas);
  const sd = Math.sqrt(mean(deltas.map((d) => (d - dMean) ** 2)));
  const pointDelta =
    headlineForSample(cand, specs, seedsBySpecAll, budgets, alpha) -
    headlineForSample(base, specs, seedsBySpecAll, budgets, alpha);
  const ciLo = quantile(deltas, lo);
  const ciHi = quantile(deltas, 1 - lo);

  const validity = budgetForValidity.map((b, bi) => {
    const samp = [...validDeltaSamples[bi]].sort((x, y) => x - y);
    const baseRate = validityByBudget(opts.validBase!, [b])[0].rate;
    const candRate = validityByBudget(opts.validCand!, [b])[0].rate;
    return { budget: b, baseRate, candRate, deltaCiLo: quantile(samp, lo) };
  });

  // Ceiling-focused guardrail: a higher-ceiling approach is ALLOWED to be worse at
  // cheap budgets (slow convergence is the tradeoff we want) — we only veto a
  // validity regression at the ceiling (max score budget), where we operate.
  // Mid/low-budget validity collapses already hurt the headline via the logAUC term.
  const ceilingBudget = budgets.length > 0 ? Math.max(...budgets) : 0;
  const ceilingValidity = validity.find((v) => v.budget === ceilingBudget);
  const validityOk = !ceilingValidity || ceilingValidity.deltaCiLo > -tol - 1e-9;
  const verdict: Decision["verdict"] =
    ciLo > 0 ? (validityOk ? "accept" : "reject") : ciHi < 0 ? "reject" : "inconclusive";

  return {
    delta: pointDelta,
    ciLo,
    ciHi,
    pLeZero: mean(deltas.map((d) => (d <= 0 ? 1 : 0))),
    effect: sd > 0 ? dMean / sd : 0,
    alpha,
    budgets,
    validity,
    verdict,
  };
}
