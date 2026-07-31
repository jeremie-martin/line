/** Active campaign improvement policy.
 *
 * `totalAlpha` is the only operator-facing tolerance.  The calibration
 * artifact derives the single O'Brien-Fleming boundary constant from it; the
 * live evaluator never carries separately editable per-look probabilities.
 */
export const benchmarkSequentialEvalPolicy = {
  schema: "line.benchmark-v2.sequential-eval-policy.v1",
  mode: "improvement",
  maximumDepth: 48,
  looks: [8, 16, 32, 48],
  totalAlpha: 0.05,
  calibrationTargetFraction: 0.8,
  calibrationTrialsPerScenario: 10_000,
  validationTrialsPerScenario: 10_000,
  boundaryFamily: "obrien-fleming-t",
  symmetricHarmBoundary: true,
  predictiveFutility: false,
} as const;

/**
 * Historical fixed-N operating-point rows and exit codes.
 *
 * They remain available only for explicit simplification and historical/deep
 * fixed-N work. Active campaign improvements use
 * `benchmarkSequentialEvalPolicy` above.
 */

export const EVAL_CERTIFICATION_ARTIFACT_PATHS = {
  menuCertification: "benchmark/v2/studies/menu-certification.json",
  holdoutValidation: "benchmark/v2/studies/holdout-validation.json",
  powerGrid: "benchmark/v2/studies/power-grid.json",
  probeFutility: "benchmark/v2/studies/probe-futility.json",
} as const;

/** Each confirmation depth is authorized by its own independently retained
 * certification pair. Adding a deeper point therefore cannot silently
 * repurpose the shallow point's calibration evidence. */
export type EvalCertificationArtifactPaths = Readonly<{
  menuCertification: string;
  holdoutValidation: string;
}>;

/** Which statistic of a certification cell carries the certified rate. */
export type CertifiedCellReference = {
  id: string;
  statistic: "accept" | "netAccept";
};

export type EvalOperatingPoint = {
  id: string;
  mode: "improvement" | "simplification";
  margin: number | null;
  /** Canonical seeds per budget at the verdict. */
  depth: number;
  /** One-sided level for the accept/reject bound (the derated level). */
  criticalAlpha: number;
  /** Interim looks, in completed seed blocks; empty = no looks. */
  futilitySchedule: readonly number[];
  /** One-sided upper-bound level for a futility stop. */
  futilityAlpha: number;
  cells: {
    /** Certified power: Wilson lower must clear the power bar. */
    power: CertifiedCellReference;
    /**
     * The operating null whose Wilson-upper accept bound was reported by the
     * historical calibrated workflow.
     */
    spendNull: CertifiedCellReference;
    /** Additional null/stress cells that must clear the false-accept bar. */
    additionalNulls: readonly CertifiedCellReference[];
  };
  /** The true effect (headline points) at which power is certified. */
  certifiedDetectableEffect: number;
  /** Frozen calibration evidence for this exact depth and stopping rule. */
  certification: EvalCertificationArtifactPaths;
};

export const benchmarkEvalPolicy = {
  version: 2,
  operatingPoints: [
    {
      id: "improve-t0-d48",
      mode: "improvement",
      margin: null,
      depth: 48,
      criticalAlpha: 0.01,
      futilitySchedule: [2, 3, 4, 8, 16],
      futilityAlpha: 0.05,
      cells: {
        power: { id: "futility_power_5", statistic: "netAccept" },
        spendNull: { id: "futility_null", statistic: "netAccept" },
        additionalNulls: [
          { id: "improve_null_empirical", statistic: "accept" },
          { id: "improve_null_validity_flips", statistic: "accept" },
          { id: "improve_null_hard_zero", statistic: "accept" },
        ],
      },
      certifiedDetectableEffect: 5,
      certification: {
        menuCertification: EVAL_CERTIFICATION_ARTIFACT_PATHS.menuCertification,
        holdoutValidation: EVAL_CERTIFICATION_ARTIFACT_PATHS.holdoutValidation,
      },
    },
    {
      /** A deliberately declared deep confirmation for a modest, broad
       * improvement. It has no interim looks: all 300 fresh seed blocks are
       * collected before a verdict, avoiding a new stopping-policy variable.
       * Its +2 power and error bars are independently regenerated and bound
       * below; this is not a way to pool a preceding inconclusive attempt. */
      id: "improve-t0-d300",
      mode: "improvement",
      margin: null,
      depth: 300,
      criticalAlpha: 0.01,
      futilitySchedule: [],
      futilityAlpha: 0.05,
      cells: {
        power: { id: "improve_power_2", statistic: "accept" },
        spendNull: { id: "improve_null_empirical", statistic: "accept" },
        additionalNulls: [
          { id: "improve_null_validity_flips", statistic: "accept" },
          { id: "improve_null_hard_zero", statistic: "accept" },
        ],
      },
      certifiedDetectableEffect: 2,
      certification: {
        menuCertification: "benchmark/v2/studies/menu-certification-d300.json",
        holdoutValidation: "benchmark/v2/studies/holdout-validation-d300.json",
      },
    },
    {
      // Simplification runs WITHOUT interim futility looks in v1: only the
      // improvement chain's futility rule is certified. The verdict falls at
      // full depth.
      id: "simplify-m5-d48",
      mode: "simplification",
      margin: 5,
      depth: 48,
      criticalAlpha: 0.01,
      futilitySchedule: [],
      futilityAlpha: 0.05,
      cells: {
        power: { id: "simplify_m5_noninferiority", statistic: "accept" },
        spendNull: { id: "simplify_m5_boundary", statistic: "accept" },
        additionalNulls: [],
      },
      certifiedDetectableEffect: 5,
      certification: {
        // This row has no interim looks. It cannot reuse the improvement
        // certificate, whose predeclared plan includes futility looks.
        menuCertification: "benchmark/v2/studies/menu-certification-d48-no-futility.json",
        holdoutValidation: "benchmark/v2/studies/holdout-validation-d48-no-futility.json",
      },
    },
  ],
  bars: {
    /** Every null/stress cell: Wilson-95 upper accept bound at most this. */
    nullFalseAcceptWilsonUpperMax: 0.05,
    /** The power cell: Wilson-95 lower bound at least this. */
    powerWilsonLowerMin: 0.8,
  },
  /**
   * Exit codes are per mode: automation always knows which contract applies
   * from the flags it passed. Stage 0 emits only completed/invalid.
   */
  exitCodes: {
    stage0: { completed: 0, invalid: 1 },
    verdict: { accept: 0, invalid: 1, inconclusive: 2, reject: 3, futilityStop: 4 },
  },
} as const;

export function evalOperatingPoint(
  mode: "improvement" | "simplification",
  margin: number | null,
  depth: number,
): EvalOperatingPoint | undefined {
  return benchmarkEvalPolicy.operatingPoints.find((point) =>
    point.mode === mode && point.margin === margin && point.depth === depth
  );
}

export function cheapestOperatingPoint(
  mode: "improvement" | "simplification",
  margin: number | null,
): EvalOperatingPoint | undefined {
  return [...benchmarkEvalPolicy.operatingPoints]
    .filter((point) => point.mode === mode && point.margin === margin)
    .sort((a, b) => a.depth - b.depth)[0];
}
