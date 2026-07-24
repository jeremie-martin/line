/**
 * Exact fixed-prefix impact counterfactual.
 *
 * A pool observation can tell us that an immediate impact repair exists, but
 * not whether the repair survives the remainder of the track.  This study
 * answers that narrower causal question: from the same already-built prefix,
 * insert one fixed normal-pool candidate and give every arm the same fresh
 * suffix budget.
 *
 * The arms are selected before any suffix result is observed:
 * - incumbent: the edge on the full-budget winner's prefix;
 * - no_extra_speed: lowest immediate impact residual without a larger speed
 *   residual than that incumbent;
 * - small_speed_trade: a >= .025 impact repair while accepting .025--.100
 *   additional immediate speed residual, when the 32-proposal pool has one;
 * - impact_specialist: lowest immediate impact residual without an axis guard.
 *
 * This is an observation study.  It neither alters compiler selection nor is
 * a V2 evaluation or promotion gate.
 *
 *   npm run study:impact-suffix
 *   LR_ENGINE=wasm node --expose-gc --import tsx \
 *     scripts/v0/study_impact_suffix_counterfactual.ts [--out=PATH]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import dense from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import lowAir from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import countercurrent from "../../benchmark/v2/cases/normative/representative/countercurrent.ts";
import denseDialogueImpact from "../../benchmark/v2/cases/variants/representative/dense_dialogue_impact_contrast_10.ts";
import offgrid from "../../benchmark/v2/cases/normative/representative/offgrid_conversation.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
} from "./optimizer/handoff.ts";
import { extendNodeCached, getCandidatesSorted } from "./optimizer/node.ts";
import type { LeafKey } from "./optimizer/register.ts";
import type { Candidate, SpecContext } from "./optimizer/sample.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { scoreDriftReport } from "./score.ts";
import { CALIB, FPS, secToFrame, type AxisName, type AxisValues, type Gap, type Spec } from "./types.ts";

// This is intentionally a fast falsification screen.  The full V2 probe
// remains the only promotion measurement; these budgets must fit the whole
// fixed panel in one interactive command.
const FULL_BUDGET = 250_000;
const SUFFIX_BUDGET = 50_000;
const SEED = 28;
const NORMAL_POOL_SIZE = 32;
const MATERIAL_IMPACT_REPAIR = 0.025;
const SMALL_SPEED_TRADE_MIN = 0.025;
const SMALL_SPEED_TRADE_MAX = 0.100;
const CASES = [
  { id: "frontier_dense_recovery", regime: "capability_dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", regime: "representative_dense", spec: denseDialogueImpact },
  { id: "countercurrent", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", regime: "development_music", spec: believer },
  { id: "frontier_low_air_endurance_4s", regime: "capability_low_air", spec: lowAir },
  { id: "offgrid_conversation", regime: "representative_pickup", spec: offgrid },
] as const satisfies readonly { id: string; regime: string; spec: Spec }[];
const AXES: readonly AxisName[] = ["impact", "speed", "air", "elevation"];

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_impact_suffix_counterfactual.ts [--out=PATH]\n" +
    "Runs a fixed six-regime, one-seed equal-suffix counterfactual. Observation only.\n",
  );
  process.exit(0);
}
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = argument("out") ?? "generated/studies/impact-suffix-counterfactual/v1/result.json";
const unknown = argv.filter((value) => !value.startsWith("--out="));
if (unknown.length > 0) throw new Error(`unknown argument(s): ${unknown.join(", ")}`);

type Regime = typeof CASES[number]["regime"];
type ArmName = "incumbent" | "no_extra_speed" | "small_speed_trade" | "impact_specialist";
type Setup = { gaps: Gap[]; ctx: SpecContext };
type Visit = { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent };
type CandidateMetrics = {
  poolRank: number | null;
  sampleAttempt: number | null;
  impactAbsError: number | null;
  speedAbsError: number | null;
  airAbsError: number | null;
  elevationAbsError: number | null;
  qualityObjective: number | null;
  cost: number;
};
type Arm = {
  name: ArmName;
  candidate: Candidate | null;
  unavailable: string | null;
  metrics: CandidateMetrics | null;
};
type SuffixOutcome = {
  name: ArmName;
  /** A deterministic alias, not an independent replay, when two frozen rules
   * select identical geometry. */
  reusedFrom: ArmName | null;
  unavailable: string | null;
  metrics: CandidateMetrics | null;
  valid: boolean | null;
  score: number | null;
  hardFailures: string[] | null;
  contactsHit: number | null;
  contactsMissing: number | null;
  gapCommits: number | null;
  deepestGap: number | null;
  terminus: unknown | null;
  elapsedMs: number | null;
};
type FullSource = {
  valid: boolean;
  score: number;
  hardFailures: string[];
  contactsHit: number;
  contactsMissing: number;
  gapCommits: number;
  deepestGap: number | null;
};
type CaseRow = {
  caseId: string;
  regime: Regime;
  seed: number;
  fullCompileElapsedMs: number;
  fullSource: FullSource;
  checkpointGapIndex: number | null;
  incumbentWasInNormalPool: boolean | null;
  arms: SuffixOutcome[];
};

const rows: CaseRow[] = [];
for (const definition of CASES) {
  const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
  const setup = buildSetup(spec, SEED);
  const visits: Visit[] = [];
  let winner: HandoffNode | null = null;
  const started = performance.now();
  const checkpoint = compileHandoff(spec, SEED, {
    budget: FULL_BUDGET,
    onNode(node, key, event) {
      visits.push({ node, key, event });
      if (event.improved) winner = node;
    },
  });
  const fullCompileElapsedMs = Math.round(performance.now() - started);
  const fullSource = sourceSummary(checkpoint, spec);
  if (winner === null) throw new Error(`${definition.id}: full compile produced no best node`);
  const parent = winnerParentAtOneThird(visits, winner, setup.gaps);
  if (parent === null) {
    rows.push({
      caseId: definition.id,
      regime: definition.regime,
      seed: SEED,
      fullCompileElapsedMs,
      fullSource,
      checkpointGapIndex: null,
      incumbentWasInNormalPool: null,
      arms: unavailableArms("winner prefix does not expose a one-third ordinary parent"),
    });
    continue;
  }
  const gap = setup.gaps[parent.node.search.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    rows.push({
      caseId: definition.id,
      regime: definition.regime,
      seed: SEED,
      fullCompileElapsedMs,
      fullSource,
      checkpointGapIndex: parent.node.search.gapIndex,
      incumbentWasInNormalPool: null,
      arms: unavailableArms("one-third winner parent is not a contact boundary"),
    });
    continue;
  }
  const incumbent = winner.search.prefixFits[parent.node.search.gapIndex];
  if (incumbent === null) {
    rows.push({
      caseId: definition.id,
      regime: definition.regime,
      seed: SEED,
      fullCompileElapsedMs,
      fullSource,
      checkpointGapIndex: parent.node.search.gapIndex,
      incumbentWasInNormalPool: null,
      arms: unavailableArms("winner skipped the checkpoint contact"),
    });
    continue;
  }
  // This is an exact deterministic normal-prefix replay at the frozen parent.
  // It is deliberately fixed at 32 proposals: the ordinary current quality
  // pool's standard width, independent of adaptive search pressure.
  const pool = getCandidatesSorted(
    parent.node.search,
    setup.gaps,
    setup.ctx,
    parent.node.searchSeed,
    NORMAL_POOL_SIZE,
  );
  const arms = selectArms(incumbent, pool, parent.node, gap, setup);
  rows.push({
    caseId: definition.id,
    regime: definition.regime,
    seed: SEED,
    fullCompileElapsedMs,
    fullSource,
    checkpointGapIndex: parent.node.search.gapIndex,
    incumbentWasInNormalPool: pool.some((candidate) => sameCandidate(candidate, incumbent)),
    arms: resumeArms(arms, parent, setup, spec, SEED),
  });
  process.stderr.write(
    `${definition.id}/s${SEED}: full=${fullSource.score} checkpoint=g${parent.node.search.gapIndex} ` +
    `suffixes=${rows.at(-1)!.arms.filter((arm) => arm.score !== null).length}/4 ` +
    `(${(fullCompileElapsedMs / 1000).toFixed(1)}s full)\n`,
  );
  (globalThis as { gc?: () => void }).gc?.();
}

const output = {
  schema: "line.study-impact-suffix-counterfactual.v1",
  purpose: [
    "Equal-budget continuation test of fixed immediate-impact alternatives from identical winner-prefix states.",
    "A positive suffix result would falsify the claim that immediate impact repair necessarily harms the whole continuation.",
    "A negative suffix result applies only to this normal-pool arm set and this suffix budget; it is not a physical impossibility claim.",
  ],
  frozenConfig: {
    fullBudget: FULL_BUDGET,
    suffixBudget: SUFFIX_BUDGET,
    seed: SEED,
    joltMs: benchmarkPolicy.transform.joltMs,
    cases: CASES.map(({ id, regime }) => ({ id, regime })),
    checkpoint: "last visited ordinary ancestor on the full-budget winner prefix at one-third of authored contact boundaries",
    normalPool: `${NORMAL_POOL_SIZE} exact deterministic ordinary normal proposals at the frozen parent`,
    arms: {
      incumbent: "winner-prefix edge",
      no_extra_speed: "minimum immediate impact absolute residual subject to speed residual <= incumbent",
      small_speed_trade: `minimum immediate impact absolute residual subject to impact improvement >= ${MATERIAL_IMPACT_REPAIR} and speed-residual increase in [${SMALL_SPEED_TRADE_MIN}, ${SMALL_SPEED_TRADE_MAX}]`,
      impact_specialist: "minimum immediate impact absolute residual without an axis guard",
    },
  },
  rows,
  summary: summarize(rows),
};
const json = `${JSON.stringify(output, null, 2)}\n`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
process.stdout.write(`${JSON.stringify({ schema: output.schema, output: outPath, summary: output.summary }, null, 2)}\n`);

function winnerParentAtOneThird(
  visits: readonly Visit[],
  winner: HandoffNode,
  gaps: readonly Gap[],
): Visit | null {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  const target = contacts[Math.floor((contacts.length - 1) / 3)];
  if (target === undefined) return null;
  const matches = visits.filter((visit) =>
    visit.node.skippedContacts === 0 &&
    visit.node.search.gapIndex === target &&
    isPrefix(visit.node.search.prefixFits, winner.search.prefixFits)
  );
  return matches.at(-1) ?? null;
}

function isPrefix(prefix: readonly (Candidate | null)[], whole: readonly (Candidate | null)[]): boolean {
  return prefix.every((candidate, index) => candidate === whole[index]);
}

function selectArms(
  incumbent: Candidate,
  pool: readonly Candidate[],
  node: HandoffNode,
  gap: Gap,
  setup: Setup,
): Arm[] {
  const incumbentMetrics = candidateMetrics(incumbent, pool, node, gap, setup);
  const candidates = pool.map((candidate) => ({
    candidate,
    metrics: candidateMetrics(candidate, pool, node, gap, setup),
  }));
  const impactable = candidates.filter(({ metrics }) => metrics.impactAbsError !== null);
  const speedable = impactable.filter(({ metrics }) => metrics.speedAbsError !== null && incumbentMetrics.speedAbsError !== null);
  const noExtraSpeed = choose(
    speedable.filter(({ metrics }) => metrics.speedAbsError! <= incumbentMetrics.speedAbsError! + 1e-12),
  );
  const smallTrade = choose(
    speedable.filter(({ metrics }) =>
      metrics.impactAbsError! <= incumbentMetrics.impactAbsError! - MATERIAL_IMPACT_REPAIR &&
      metrics.speedAbsError! >= incumbentMetrics.speedAbsError! + SMALL_SPEED_TRADE_MIN - 1e-12 &&
      metrics.speedAbsError! <= incumbentMetrics.speedAbsError! + SMALL_SPEED_TRADE_MAX + 1e-12
    ),
  );
  const impactSpecialist = choose(impactable);
  return [
    { name: "incumbent", candidate: incumbent, unavailable: null, metrics: incumbentMetrics },
    noExtraSpeed === null
      ? { name: "no_extra_speed", candidate: null, unavailable: "no normal candidate has readable impact and no larger speed residual", metrics: null }
      : { name: "no_extra_speed", candidate: noExtraSpeed.candidate, unavailable: null, metrics: noExtraSpeed.metrics },
    smallTrade === null
      ? { name: "small_speed_trade", candidate: null, unavailable: "no normal candidate meets the fixed small speed-for-impact trade rule", metrics: null }
      : { name: "small_speed_trade", candidate: smallTrade.candidate, unavailable: null, metrics: smallTrade.metrics },
    impactSpecialist === null
      ? { name: "impact_specialist", candidate: null, unavailable: "no normal candidate has readable impact", metrics: null }
      : { name: "impact_specialist", candidate: impactSpecialist.candidate, unavailable: null, metrics: impactSpecialist.metrics },
  ];
}

function choose<T extends { metrics: CandidateMetrics }>(values: readonly T[]): T | null {
  const sorted = [...values].sort((a, b) =>
    (a.metrics.impactAbsError ?? Infinity) - (b.metrics.impactAbsError ?? Infinity) ||
    (a.metrics.speedAbsError ?? Infinity) - (b.metrics.speedAbsError ?? Infinity) ||
    (b.metrics.qualityObjective ?? -Infinity) - (a.metrics.qualityObjective ?? -Infinity) ||
    a.metrics.cost - b.metrics.cost ||
    (a.metrics.sampleAttempt ?? Infinity) - (b.metrics.sampleAttempt ?? Infinity)
  );
  return sorted[0] ?? null;
}

function candidateMetrics(
  candidate: Candidate,
  pool: readonly Candidate[],
  node: HandoffNode,
  gap: Gap,
  setup: Setup,
): CandidateMetrics {
  const targets = setup.ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const values = candidate.achieved;
  const poolIndex = pool.findIndex((entry) => sameCandidate(entry, candidate));
  const error = (axis: AxisName): number | null => finite(targets[axis]) && finite(values[axis])
    ? round(Math.abs(values[axis]! - targets[axis]!))
    : null;
  return {
    poolRank: poolIndex < 0 ? null : poolIndex,
    sampleAttempt: candidate.sampleAttempt ?? null,
    impactAbsError: error("impact"),
    speedAbsError: error("speed"),
    airAbsError: error("air"),
    elevationAbsError: error("elevation"),
    qualityObjective: nullableRound(candidateQualityObjective(node.search.prefixEngine, candidate, gap, setup.gaps, setup.ctx)),
    cost: round(candidate.cost),
  };
}

function resumeArm(
  arm: Arm,
  parent: Visit,
  setup: Setup,
  spec: Spec,
  seed: number,
): SuffixOutcome {
  if (arm.candidate === null) {
    return {
      name: arm.name,
      reusedFrom: null,
      unavailable: arm.unavailable,
      metrics: null,
      valid: null,
      score: null,
      hardFailures: null,
      contactsHit: null,
      contactsMissing: null,
      gapCommits: null,
      deepestGap: null,
      terminus: null,
      elapsedMs: null,
    };
  }
  const poolRank = arm.metrics?.poolRank ?? -1;
  const actualTrace = arm.name === "incumbent"
    ? parent.node.rankTrace[parent.node.search.gapIndex] ?? { rank: poolRank, source: "pool" as const }
    : { rank: poolRank, source: "pool" as const };
  const child: HandoffNode = {
    ...parent.node,
    search: extendNodeCached(parent.node.search, arm.candidate),
    deferExpansion: false,
    rankTrace: [...parent.node.rankTrace, actualTrace],
  };
  const started = performance.now();
  const checkpoint = compileHandoffFromSnapshot(
    spec,
    seed,
    snapshotHandoffNode(child, parent.key, parent.event),
    { budget: SUFFIX_BUDGET, searchSeed: parent.node.searchSeed },
  );
  const elapsedMs = Math.round(performance.now() - started);
  const score = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
  return {
    name: arm.name,
    reusedFrom: null,
    unavailable: null,
    metrics: arm.metrics,
    valid: score.contract_passed,
    score: round(score.score),
    hardFailures: score.hard_failures,
    contactsHit: checkpoint.report.contacts.filter((contact) => contact.status === "hit").length,
    contactsMissing: checkpoint.report.contacts.filter((contact) => contact.status === "missing").length,
    gapCommits: checkpoint.stats.gap_commits,
    deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
    terminus: checkpoint.report.terminus,
    elapsedMs,
  };
}

function resumeArms(
  arms: readonly Arm[],
  parent: Visit,
  setup: Setup,
  spec: Spec,
  seed: number,
): SuffixOutcome[] {
  const outcomes: SuffixOutcome[] = [];
  for (const arm of arms) {
    const prior = arm.candidate === null ? undefined : outcomes.find((outcome, index) => {
      const priorArm = arms[index];
      return priorArm?.candidate !== null && sameCandidate(priorArm.candidate, arm.candidate!);
    });
    if (prior !== undefined) {
      outcomes.push({
        ...prior,
        name: arm.name,
        reusedFrom: prior.reusedFrom ?? prior.name,
        unavailable: arm.unavailable,
        metrics: arm.metrics,
      });
    } else {
      outcomes.push(resumeArm(arm, parent, setup, spec, seed));
    }
  }
  return outcomes;
}

function sourceSummary(
  checkpoint: ReturnType<typeof compileHandoff>,
  spec: Spec,
): FullSource {
  const score = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
  return {
    valid: score.contract_passed,
    score: round(score.score),
    hardFailures: score.hard_failures,
    contactsHit: checkpoint.report.contacts.filter((contact) => contact.status === "hit").length,
    contactsMissing: checkpoint.report.contacts.filter((contact) => contact.status === "missing").length,
    gapCommits: checkpoint.stats.gap_commits,
    deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
  };
}

function unavailableArms(message: string): SuffixOutcome[] {
  return (["incumbent", "no_extra_speed", "small_speed_trade", "impact_specialist"] as const).map((name) => ({
    name,
    reusedFrom: null,
    unavailable: message,
    metrics: null,
    valid: null,
    score: null,
    hardFailures: null,
    contactsHit: null,
    contactsMissing: null,
    gapCommits: null,
    deepestGap: null,
    terminus: null,
    elapsedMs: null,
  }));
}

function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined
    ? []
    : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const current = gaps[index];
    const next = gaps[index + 1];
    if (current.endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      current.nextImpact = next.targets.impact;
    }
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function summarize(rows: readonly CaseRow[]) {
  const outcomes = rows.flatMap((row) => row.arms.map((arm) => ({ row, arm })));
  const incumbentByCase = new Map(rows.map((row) => [row.caseId, row.arms.find((arm) => arm.name === "incumbent")]));
  const arms = Object.fromEntries(([
    "incumbent", "no_extra_speed", "small_speed_trade", "impact_specialist",
  ] as const).map((name) => {
    const entries = outcomes.filter(({ arm }) => arm.name === name && arm.score !== null);
    const compared = entries.flatMap(({ row, arm }) => {
      const incumbent = incumbentByCase.get(row.caseId);
      return incumbent?.score === null || incumbent?.score === undefined ? [] : [{ arm, incumbent }];
    });
    const validPairs = compared.filter(({ arm, incumbent }) => arm.valid && incumbent.valid);
    const validIncumbentPairs = compared.filter(({ incumbent }) => incumbent.valid);
    const immediatePairs = compared.filter(({ arm, incumbent }) =>
      arm.metrics?.impactAbsError !== null && incumbent.metrics?.impactAbsError !== null
    );
    return [name, {
      available: entries.length,
      valid: entries.filter(({ arm }) => arm.valid).length,
      immediateImpactRepairs: immediatePairs.filter(({ arm, incumbent }) =>
        arm.metrics!.impactAbsError! < incumbent.metrics!.impactAbsError! - 1e-12
      ).length,
      materialImmediateImpactRepairs: immediatePairs.filter(({ arm, incumbent }) =>
        arm.metrics!.impactAbsError! <= incumbent.metrics!.impactAbsError! - MATERIAL_IMPACT_REPAIR
      ).length,
      immediateImpactGainMean: mean(immediatePairs.map(({ arm, incumbent }) =>
        incumbent.metrics!.impactAbsError! - arm.metrics!.impactAbsError!
      )),
      equalBudgetValidPairs: validPairs.length,
      equalBudgetScoreGainVsIncumbentMean: mean(validPairs.map(({ arm, incumbent }) => arm.score! - incumbent.score!)),
      strictEqualBudgetScoreWinsVsIncumbent: validPairs.filter(({ arm, incumbent }) => arm.score! > incumbent.score! + 1e-9).length,
      validityRegressionsVsValidIncumbent: validIncumbentPairs.filter(({ arm }) => !arm.valid).length,
      noHardFailureRegressionWithinValidPairs: validPairs.filter(({ arm, incumbent }) =>
        arm.hardFailures!.length <= incumbent.hardFailures!.length
      ).length,
    }];
  }));
  return {
    declaredCases: rows.length,
    checkpointAvailable: rows.filter((row) => row.checkpointGapIndex !== null).length,
    incumbentInNormalPool: rows.filter((row) => row.incumbentWasInNormalPool === true).length,
    fullSource: {
      valid: rows.filter((row) => row.fullSource.valid).length,
      scoreMean: mean(rows.map((row) => row.fullSource.score)),
    },
    arms,
  };
}

function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a === b || (
    a.lines.length === b.lines.length &&
    a.lines.every((line, index) => {
      const other = b.lines[index];
      return other !== undefined && line.id === other.id && line.x1 === other.x1 && line.y1 === other.y1 &&
        line.x2 === other.x2 && line.y2 === other.y2 && line.flipped === other.flipped;
    })
  );
}

function finite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function nullableRound(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
