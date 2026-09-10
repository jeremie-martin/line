/**
 * Observation-only current-pool oracle on the compiler's final committed path.
 *
 * The study joins three existing read-only hooks by exact SearchNode identity:
 * the currently expanded prefix, its normal candidate pool, and its final
 * ranked/branched options.  After compilation it retains only prefixes on the
 * register winner's path.  It then re-scores local axis substitutions at four
 * boundaries: generated, admitted, exact-forward eligible, and branched.
 *
 * These substitutions are deliberately NON-COMPOSABLE: choosing a different
 * candidate changes the next prefix.  Their scores are ceilings that locate the
 * first lossy boundary, never claimed compiler outcomes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { applyJolt } from "../produce/seed.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";
import {
  compileLegacyHandoff,
  setHandoffFrontierNodeProbeHook,
  setHandoffPoolProbeHook,
  setHandoffRankedOptionsProbeHook,
  type HandoffNode,
  type HandoffNodeEvent,
  type HandoffPoolProbeRecord,
  type HandoffRankTraceEntry,
  type HandoffRankedOptionsProbeRecord,
} from "./optimizer/legacy_handoff.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { scoreDriftReport } from "./score.ts";
import {
  AXES,
  FPS,
  type AxisValues,
  type DriftReport,
  type Spec,
} from "./types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const DEFAULT_SOURCES = [
  "river_reentry_tempo_fast_5",
  "dense_dialogue_impact_contrast_10",
  "dense_dialogue",
  "frontier_pickup_progression",
  "believer_56_6s",
  "regression_transition_mosaic_tempo_fast_5",
].join(",");
const sourceNames = (arg("sources") ?? DEFAULT_SOURCES)
  .split(",")
  .filter(Boolean);
const seeds = (arg("seeds") ?? "28,29").split(",").map(Number);
const budget = Number(arg("budget") ?? "750000");
const outPath =
  arg("out") ??
  "generated/studies/current-pool-path-oracle/v1-current-750k/result.json";
if (!Number.isSafeInteger(budget) || budget <= 0)
  throw new Error(`bad budget ${budget}`);
for (const seed of seeds)
  if (!Number.isSafeInteger(seed)) throw new Error(`bad seed ${seed}`);

type CandidateView = {
  source: string;
  rank: number;
  achieved: AxisValues;
};

type PoolCapture = {
  generated: CandidateView[];
  admitted: CandidateView[];
};

type RankedCapture = {
  eligible: CandidateView[];
  branched: CandidateView[];
};

type Winner = {
  startRank: number;
  gapIndex: number;
  rankTrace: HandoffRankTraceEntry[];
};

const LAYERS = ["generated", "admitted", "eligible", "branched"] as const;
type Layer = (typeof LAYERS)[number];
type ChoiceKind = "quality" | "impact" | "impactNoDebt";

type Choice = {
  source: string;
  rank: number;
  achieved: AxisValues;
  axisSse: number;
  impactError: number | null;
};

type GapRow = {
  source: string;
  seed: number;
  gapIndex: number;
  incumbentAxisSse: number;
  incumbentImpactError: number | null;
  choices: Record<Layer, Record<ChoiceKind, Choice | null>>;
};

type OracleScores = Record<
  Layer,
  {
    qualityWhole: number;
    impactOnly: number;
    impactWhole: number;
    impactNoDebtOnly: number;
    impactNoDebtWhole: number;
  }
>;

type Run = {
  source: string;
  seed: number;
  valid: boolean;
  baselineScore: number;
  simFrames: number;
  targetGaps: number;
  committedChoices: number;
  matchedPrefixes: number;
  matchCoverage: number;
  oracleScores: OracleScores;
  rows: GapRow[];
};

function serializeTrace(trace: readonly HandoffRankTraceEntry[]): string {
  return trace
    .map((entry) => `${entry.source}:${entry.rank}:${entry.sourceAxis ?? ""}`)
    .join("|");
}

function nodeKey(
  startRank: number,
  gapIndex: number,
  trace: readonly HandoffRankTraceEntry[],
): string {
  return `${startRank}|${gapIndex}|${serializeTrace(trace)}`;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function copyAxes(values: AxisValues): AxisValues {
  const copy: AxisValues = {};
  for (const axis of AXES) if (finite(values[axis])) copy[axis] = values[axis];
  return copy;
}

function targetsOf(report: DriftReport, gapIndex: number): AxisValues | null {
  const gap = report.gaps.find((candidate) => candidate.gap_index === gapIndex);
  if (gap === undefined) return null;
  const targets: AxisValues = {};
  for (const axis of AXES) {
    const detail = gap.axes[axis];
    if (detail !== undefined && finite(detail.target))
      targets[axis] = detail.target;
  }
  return targets;
}

function achievedOf(report: DriftReport, gapIndex: number): AxisValues | null {
  const gap = report.gaps.find((candidate) => candidate.gap_index === gapIndex);
  if (gap === undefined) return null;
  const achieved: AxisValues = {};
  for (const axis of AXES) {
    const detail = gap.axes[axis];
    if (detail !== undefined && finite(detail.achieved))
      achieved[axis] = detail.achieved;
  }
  return achieved;
}

function axisSse(targets: AxisValues, achieved: AxisValues): number {
  let sum = 0;
  let count = 0;
  for (const axis of AXES) {
    const target = targets[axis];
    const value = achieved[axis];
    if (!finite(target) || !finite(value)) continue;
    sum += (value - target) ** 2;
    count++;
  }
  return count === 0 ? Infinity : sum;
}

function impactError(targets: AxisValues, achieved: AxisValues): number | null {
  const target = targets.impact;
  const value = achieved.impact;
  return finite(target) && finite(value) ? Math.abs(value - target) : null;
}

function summarizeChoice(
  candidate: CandidateView,
  targets: AxisValues,
): Choice {
  return {
    source: candidate.source,
    rank: candidate.rank,
    achieved: copyAxes(candidate.achieved),
    axisSse: axisSse(targets, candidate.achieved),
    impactError: impactError(targets, candidate.achieved),
  };
}

function choose(
  candidates: CandidateView[],
  targets: AxisValues,
  incumbentAxisSse: number,
  kind: ChoiceKind,
): Choice | null {
  const choices = candidates
    .map((candidate) => summarizeChoice(candidate, targets))
    .filter((candidate) => Number.isFinite(candidate.axisSse));
  const eligible =
    kind === "impactNoDebt"
      ? choices.filter(
          (candidate) =>
            candidate.impactError !== null &&
            candidate.axisSse <= incumbentAxisSse + 1e-12,
        )
      : kind === "impact"
        ? choices.filter((candidate) => candidate.impactError !== null)
        : choices;
  if (eligible.length === 0) return null;
  return eligible.reduce((best, candidate) => {
    const candidateValue =
      kind === "quality" ? candidate.axisSse : candidate.impactError!;
    const bestValue = kind === "quality" ? best.axisSse : best.impactError!;
    return candidateValue < bestValue ? candidate : best;
  });
}

function patchReport(
  baseline: DriftReport,
  rows: GapRow[],
  layer: Layer,
  kind: ChoiceKind,
  impactOnly: boolean,
): DriftReport {
  const report = structuredClone(baseline);
  const choices = new Map(
    rows.flatMap((row) => {
      const choice = row.choices[layer][kind];
      return choice === null ? [] : [[row.gapIndex, choice] as const];
    }),
  );
  for (const gap of report.gaps) {
    const choice = choices.get(gap.gap_index);
    if (choice === undefined) continue;
    for (const axis of AXES) {
      if (impactOnly && axis !== "impact") continue;
      const detail = gap.axes[axis];
      const value = choice.achieved[axis];
      if (detail === undefined || !finite(value)) continue;
      detail.achieved = value;
      detail.error = value - detail.target;
    }
  }
  return report;
}

function scoreOracle(
  report: DriftReport,
  rows: GapRow[],
  totalFrames: number,
): OracleScores {
  return Object.fromEntries(
    LAYERS.map((layer) => [
      layer,
      {
        qualityWhole: scoreDriftReport(
          patchReport(report, rows, layer, "quality", false),
          { totalFrames },
        ).score,
        impactOnly: scoreDriftReport(
          patchReport(report, rows, layer, "impact", true),
          { totalFrames },
        ).score,
        impactWhole: scoreDriftReport(
          patchReport(report, rows, layer, "impact", false),
          { totalFrames },
        ).score,
        impactNoDebtOnly: scoreDriftReport(
          patchReport(report, rows, layer, "impactNoDebt", true),
          { totalFrames },
        ).score,
        impactNoDebtWhole: scoreDriftReport(
          patchReport(report, rows, layer, "impactNoDebt", false),
          { totalFrames },
        ).score,
      },
    ]),
  ) as OracleScores;
}

function candidateFromRanked(
  entry: HandoffRankedOptionsProbeRecord["eligible"][number],
): CandidateView | null {
  return entry.achieved === null
    ? null
    : {
        source: entry.source,
        rank: entry.rank,
        achieved: copyAxes(entry.achieved),
      };
}

function runOne(source: string, spec: Spec, seed: number): Run {
  const poolByNode = new Map<string, PoolCapture>();
  const rankedByNode = new Map<string, RankedCapture>();
  let current: {
    startRank: number;
    gapIndex: number;
    trace: HandoffRankTraceEntry[];
  } | null = null;
  let winner: Winner | null = null;

  setHandoffFrontierNodeProbeHook(({ selected }) => {
    current = {
      startRank: selected.startRank,
      gapIndex: selected.search.gapIndex,
      trace: selected.rankTrace.map((entry) => ({ ...entry })),
    };
  });
  setHandoffPoolProbeHook((record: HandoffPoolProbeRecord) => {
    if (current === null || current.gapIndex !== record.gapIndex) return;
    const key = nodeKey(current.startRank, current.gapIndex, current.trace);
    const generated = record.candidates.map((candidate) => ({
      source: "pool",
      rank: candidate.qualityRank,
      achieved: copyAxes(candidate.achieved),
    }));
    poolByNode.set(key, {
      generated,
      admitted: generated.filter(
        (_, index) => record.candidates[index]!.admitted,
      ),
    });
  });
  setHandoffRankedOptionsProbeHook(
    (record: HandoffRankedOptionsProbeRecord) => {
      if (current === null || current.gapIndex !== record.gapIndex) return;
      const key = nodeKey(current.startRank, current.gapIndex, current.trace);
      rankedByNode.set(key, {
        eligible: record.eligible.flatMap((entry) => {
          const candidate = candidateFromRanked(entry);
          return candidate === null ? [] : [candidate];
        }),
        branched: record.selected.flatMap((entry) => {
          const candidate = candidateFromRanked(entry);
          return candidate === null ? [] : [candidate];
        }),
      });
    },
  );
  const onNode = (
    node: HandoffNode,
    _key: LeafKey,
    event: HandoffNodeEvent,
  ): void => {
    if (!event.improved) return;
    winner = {
      startRank: node.startRank,
      gapIndex: node.search.gapIndex,
      rankTrace: node.rankTrace.map((entry) => ({ ...entry })),
    };
  };

  const checkpoint = compileLegacyHandoff(spec, seed, { budget, onNode });
  setHandoffFrontierNodeProbeHook(null);
  setHandoffPoolProbeHook(null);
  setHandoffRankedOptionsProbeHook(null);
  if (winner === null)
    throw new Error(`${source}/s${seed}: no register winner captured`);

  const finalWinner: Winner = winner;
  const offset = finalWinner.gapIndex - finalWinner.rankTrace.length;
  const rows: GapRow[] = [];
  let committedChoices = 0;
  for (let index = 0; index < finalWinner.rankTrace.length; index++) {
    const entry = finalWinner.rankTrace[index]!;
    if (entry.rank < 0) continue;
    committedChoices++;
    const gapIndex = offset + index;
    const targets = targetsOf(checkpoint.report, gapIndex);
    const incumbent = achievedOf(checkpoint.report, gapIndex);
    if (targets === null || incumbent === null) continue;
    const key = nodeKey(
      finalWinner.startRank,
      gapIndex,
      finalWinner.rankTrace.slice(0, index),
    );
    const pool = poolByNode.get(key);
    const ranked = rankedByNode.get(key);
    if (pool === undefined || ranked === undefined) continue;
    const incumbentAxisSse = axisSse(targets, incumbent);
    const candidates: Record<Layer, CandidateView[]> = {
      generated: pool.generated,
      admitted: pool.admitted,
      eligible: ranked.eligible,
      branched: ranked.branched,
    };
    rows.push({
      source,
      seed,
      gapIndex,
      incumbentAxisSse,
      incumbentImpactError: impactError(targets, incumbent),
      choices: Object.fromEntries(
        LAYERS.map((layer) => [
          layer,
          {
            quality: choose(
              candidates[layer],
              targets,
              incumbentAxisSse,
              "quality",
            ),
            impact: choose(
              candidates[layer],
              targets,
              incumbentAxisSse,
              "impact",
            ),
            impactNoDebt: choose(
              candidates[layer],
              targets,
              incumbentAxisSse,
              "impactNoDebt",
            ),
          },
        ]),
      ) as GapRow["choices"],
    });
  }

  const totalFrames = Math.round(spec.duration * FPS);
  const baseline = scoreDriftReport(checkpoint.report, { totalFrames });
  return {
    source,
    seed,
    valid: baseline.contract_passed,
    baselineScore: baseline.score,
    simFrames: checkpoint.stats.sim_frames,
    targetGaps: checkpoint.report.gaps.length,
    committedChoices,
    matchedPrefixes: rows.length,
    matchCoverage: committedChoices === 0 ? 0 : rows.length / committedChoices,
    oracleScores: scoreOracle(checkpoint.report, rows, totalFrames),
    rows,
  };
}

const manifest = loadSourceManifest("benchmark/v2/compat/source-manifest.json");
const available = resolveSources(manifest);
const requested = sourceNames.map((name) => {
  const source = available.find((candidate) => candidate.id === name);
  if (source === undefined) throw new Error(`unknown V2 source ${name}`);
  return source;
});

const runs: Run[] = [];
for (const source of requested) {
  const spec = applyJolt(await loadSourceSpec(source), -15);
  for (const seed of seeds) {
    const started = Date.now();
    const run = runOne(source.id, spec, seed);
    runs.push(run);
    process.stderr.write(
      `${source.id}/s${seed}: ${run.baselineScore.toFixed(2)} ` +
        `${run.matchedPrefixes}/${run.committedChoices} prefixes ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s\n`,
    );
  }
}

const mean = (values: number[]): number =>
  values.length === 0
    ? NaN
    : values.reduce((sum, value) => sum + value, 0) / values.length;
const baselineMean = mean(runs.map((run) => run.baselineScore));
const aggregate = {
  runs: runs.length,
  valid: runs.filter((run) => run.valid).length,
  baselineMean,
  meanMatchCoverage: mean(runs.map((run) => run.matchCoverage)),
  layers: Object.fromEntries(
    LAYERS.map((layer) => [
      layer,
      {
        qualityWholeMean: mean(
          runs.map((run) => run.oracleScores[layer].qualityWhole),
        ),
        qualityWholeLift: mean(
          runs.map(
            (run) => run.oracleScores[layer].qualityWhole - run.baselineScore,
          ),
        ),
        impactOnlyMean: mean(
          runs.map((run) => run.oracleScores[layer].impactOnly),
        ),
        impactOnlyLift: mean(
          runs.map(
            (run) => run.oracleScores[layer].impactOnly - run.baselineScore,
          ),
        ),
        impactWholeMean: mean(
          runs.map((run) => run.oracleScores[layer].impactWhole),
        ),
        impactWholeLift: mean(
          runs.map(
            (run) => run.oracleScores[layer].impactWhole - run.baselineScore,
          ),
        ),
        impactNoDebtOnlyMean: mean(
          runs.map((run) => run.oracleScores[layer].impactNoDebtOnly),
        ),
        impactNoDebtOnlyLift: mean(
          runs.map(
            (run) =>
              run.oracleScores[layer].impactNoDebtOnly - run.baselineScore,
          ),
        ),
        impactNoDebtWholeMean: mean(
          runs.map((run) => run.oracleScores[layer].impactNoDebtWhole),
        ),
        impactNoDebtWholeLift: mean(
          runs.map(
            (run) =>
              run.oracleScores[layer].impactNoDebtWhole - run.baselineScore,
          ),
        ),
      },
    ]),
  ) as Record<Layer, Record<string, number>>,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      schema: "line.study-current-pool-path-oracle.v1",
      caveat:
        "non-composable local substitutions on exact final-path prefixes; ceiling, not compiler output",
      budget,
      seeds,
      sources: sourceNames,
      aggregate,
      runs,
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(`\n=== current-pool final-path oracle ===\n`);
process.stdout.write(
  `baseline mean ${baselineMean.toFixed(3)}, valid ${aggregate.valid}/${aggregate.runs}, ` +
    `mean path coverage ${(100 * aggregate.meanMatchCoverage).toFixed(1)}%\n`,
);
for (const layer of LAYERS) {
  const row = aggregate.layers[layer];
  process.stdout.write(
    `${layer.padEnd(10)} quality ${row.qualityWholeLift.toFixed(3)} | ` +
      `impact-only ${row.impactOnlyLift.toFixed(3)} | impact-whole ${row.impactWholeLift.toFixed(3)} | ` +
      `no-debt impact-only ${row.impactNoDebtOnlyLift.toFixed(3)} | ` +
      `no-debt whole ${row.impactNoDebtWholeLift.toFixed(3)}\n`,
  );
}
process.stdout.write(`rows -> ${outPath}\n`);
