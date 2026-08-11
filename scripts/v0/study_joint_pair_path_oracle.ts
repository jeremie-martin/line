/**
 * Observation-only joint-pair oracle on committed final-path prefixes.
 *
 * Unlike the local current-pool oracle, every alternative here is an exact
 * current+next normal pair from one prefix.  The complete pair is replayed at
 * the current contact to reject retroactive intrusion, and an unchanged normal
 * stream must produce a viable third contact.  The result is therefore a
 * bounded completion-certificate ceiling, not a splice of unrelated states.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { applyJolt } from "../produce/seed.ts";
import { makeRng } from "../lib/rng.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";
import {
  compileHandoff,
  compileHandoffFromSnapshot,
  snapshotHandoffNode,
  type HandoffNode,
  type HandoffNodeEvent,
  type HandoffNodeSnapshot,
} from "./optimizer/handoff.ts";
import { extendNodeCached } from "./optimizer/node.ts";
import {
  getCandidateProbe,
  observeOneCandidate,
  type Candidate,
  type SpecContext,
} from "./optimizer/sample.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import {
  buildDriftReport,
  effectiveAxes,
  sampleGapTargets,
  sliceTimeline,
} from "./core/substrate.ts";
import {
  detectWindow,
  translateTrackLines,
  tryCandidate,
} from "./core/candidate.ts";
import {
  AXES,
  CALIB,
  FPS,
  secToFrame,
  type AxisName,
  type AxisValues,
  type Gap,
  type Spec,
} from "./types.ts";
import type { LeafKey } from "./optimizer/register.ts";
import { scoreDriftReport } from "./score.ts";
import type { SearchNode } from "./optimizer/node.ts";

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
const sourceNames = (arg("sources") ?? DEFAULT_SOURCES).split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "28,29").split(",").map(Number);
const budget = Number(arg("budget") ?? "750000");
const outPath = arg("out") ??
  "generated/studies/joint-pair-path-oracle/v3-full-suffix-750k/result.json";
const STATES_PER_RUN = 3;
const NEXT_ATTEMPTS = 6;
const RETURN_ATTEMPTS = 4;
const MATERIAL_IMPACT_GAIN = .025;
const SUFFIX_BUDGET = 200_000;

type Setup = {
  spec: Spec;
  gaps: Gap[];
  targets: AxisValues[];
  frames: number[];
  durationFrames: number;
  ctx: SpecContext;
};
type PairMetrics = {
  sse: number;
  secondarySse: number;
  rms: number;
  axes: number;
  impactAbsError: number | null;
};
type StateRow = {
  source: string;
  seed: number;
  gapIndex: number;
  currentCandidates: number;
  pairs: number;
  compoundExact: number;
  continuationCertified: number;
  noDebtImpactImproved: number;
  balancedImpactImproved: number;
  incumbent: PairMetrics;
  bestCertified: PairMetrics | null;
  bestNoDebtImpact: PairMetrics | null;
  bestBalancedImpact: PairMetrics | null;
  incumbentSuffixRebuilt: boolean;
  balancedSuffixRebuilt: boolean;
  balancedFullScore: number | null;
  balancedFullLift: number | null;
  ordinarySuffixValid: boolean;
  ordinarySuffixScore: number | null;
  ordinarySuffixLift: number | null;
  ordinarySuffixFrames: number | null;
};
type EvaluatedState = {
  row: StateRow;
  ordinarySnapshot: HandoffNodeSnapshot | null;
};

const manifest = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
const requested = sourceNames.map((name) => {
  const source = manifest.find((candidate) => candidate.id === name);
  if (source === undefined) throw new Error(`unknown source ${name}`);
  return source;
});

const rows: StateRow[] = [];
const runs: Array<{ source: string; seed: number; valid: boolean; selectedStates: number }> = [];
for (const source of requested) {
  for (const seed of seeds) {
    const spec = applyJolt(await loadSourceSpec(source), -15);
    const result = runOne(source.id, spec, seed);
    rows.push(...result.rows);
    runs.push({ source: source.id, seed, valid: result.valid, selectedStates: result.rows.length });
    process.stderr.write(`${source.id}/s${seed}: ${result.rows.length} joint states\n`);
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const certifiedRows = rows.filter((row) => row.continuationCertified > 0);
const noDebtRows = rows.filter((row) => row.noDebtImpactImproved > 0);
const balancedRows = rows.filter((row) => row.balancedImpactImproved > 0);
const output = {
  schema: "line.study-joint-pair-path-oracle.v2",
  purpose: [
    "Measure exact two-contact quality headroom without splicing prefixes.",
    "Require compound current-axis identity and an unchanged normal third-contact return before calling a pair completion-certified.",
    "Rebuild the unchanged incumbent-guided suffix and score the complete track before assigning any realizable lift.",
  ],
  frozenConfig: {
    sources: sourceNames,
    seeds,
    budget,
    statesPerRun: STATES_PER_RUN,
    selection: "largest non-overlapping committed two-gap SSE with authored impact present",
    currentPopulation: "the exact production-built candidate cache on the committed prefix",
    nextAttempts: NEXT_ATTEMPTS,
    returnAttempts: RETURN_ATTEMPTS,
    materialImpactGain: MATERIAL_IMPACT_GAIN,
    ordinarySuffixBudget: SUFFIX_BUDGET,
    rideOutPolish: false,
  },
  runs,
  rows,
  summary: {
    runs: runs.length,
    validRuns: runs.filter((run) => run.valid).length,
    states: rows.length,
    pairs: sum(rows.map((row) => row.pairs)),
    compoundExact: sum(rows.map((row) => row.compoundExact)),
    continuationCertified: sum(rows.map((row) => row.continuationCertified)),
    noDebtImpactImproved: sum(rows.map((row) => row.noDebtImpactImproved)),
    balancedImpactImproved: sum(rows.map((row) => row.balancedImpactImproved)),
    statesWithCertifiedPair: certifiedRows.length,
    statesWithNoDebtImpactPair: noDebtRows.length,
    statesWithBalancedImpactPair: balancedRows.length,
    meanBestCertifiedRmsLift: mean(certifiedRows.map((row) =>
      row.incumbent.rms - row.bestCertified!.rms
    )),
    meanBestNoDebtImpactRmsLift: mean(noDebtRows.map((row) =>
      row.incumbent.rms - row.bestNoDebtImpact!.rms
    )),
    meanBestNoDebtImpactErrorGain: mean(noDebtRows.map((row) =>
      row.incumbent.impactAbsError! - row.bestNoDebtImpact!.impactAbsError!
    )),
    meanBestBalancedRmsLift: mean(balancedRows.map((row) =>
      row.incumbent.rms - row.bestBalancedImpact!.rms
    )),
    meanBestBalancedImpactErrorGain: mean(balancedRows.map((row) =>
      row.incumbent.impactAbsError! - row.bestBalancedImpact!.impactAbsError!
    )),
    incumbentSuffixRebuilt: rows.filter((row) => row.incumbentSuffixRebuilt).length,
    balancedSuffixRebuilt: rows.filter((row) => row.balancedSuffixRebuilt).length,
    balancedFullImproved: rows.filter((row) => (row.balancedFullLift ?? 0) > 1e-9).length,
    meanBalancedFullLift: mean(rows.flatMap((row) =>
      row.balancedFullLift === null ? [] : [row.balancedFullLift]
    )),
    totalBalancedFullLift: sum(rows.flatMap((row) =>
      row.balancedFullLift === null ? [] : [row.balancedFullLift]
    )),
    ordinarySuffixValid: rows.filter((row) => row.ordinarySuffixValid).length,
    ordinarySuffixImproved: rows.filter((row) => (row.ordinarySuffixLift ?? 0) > 1e-9).length,
    meanOrdinarySuffixLift: mean(rows.flatMap((row) =>
      row.ordinarySuffixLift === null ? [] : [row.ordinarySuffixLift]
    )),
    totalOrdinarySuffixLift: sum(rows.flatMap((row) =>
      row.ordinarySuffixLift === null ? [] : [row.ordinarySuffixLift]
    )),
  },
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: outPath, summary: output.summary }, null, 2)}\n`);

function runOne(source: string, spec: Spec, seed: number): { valid: boolean; rows: StateRow[] } {
  const setup = buildSetup(spec, seed);
  const visits: Array<{ node: HandoffNode; key: LeafKey; event: HandoffNodeEvent }> = [];
  let winner: HandoffNode | null = null;
  const checkpoint = compileHandoff(spec, seed, {
    budget,
    onNode(node: HandoffNode, key: LeafKey, event: HandoffNodeEvent) {
      visits.push({ node, key, event });
      if (event.improved) winner = node;
    },
  });
  if (winner === null) throw new Error(`${source}/s${seed}: no register winner`);
  const finalWinner: HandoffNode = winner;
  const baseline = scoreDriftReport(checkpoint.report, {
    totalFrames: setup.durationFrames,
  });
  const candidates = candidateStates(visits, finalWinner, setup.gaps)
    .sort((left, right) => right.incumbent.sse - left.incumbent.sse);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.some((prior) => Math.abs(prior.gapIndex - candidate.gapIndex) <= 1)) continue;
    selected.push(candidate);
    if (selected.length === STATES_PER_RUN) break;
  }
  const evaluated = selected.map((state) => evaluateState(
    source,
    seed,
    state,
    setup,
    finalWinner.search.prefixFits,
    baseline.score,
  ));
  // Snapshot-resumed compilers reset process-global observational state. Run
  // them only after every local pair has been measured so a suffix cannot
  // perturb a later state's candidate generation or counters.
  for (const result of evaluated) {
    completeOrdinarySuffix(result, setup, spec, seed, baseline.score);
  }
  return {
    valid: scoreDriftReport(checkpoint.report, {
      totalFrames: Math.round(spec.duration * FPS),
    }).contract_passed,
    rows: evaluated.map((result) => result.row),
  };
}

function candidateStates(
  visits: readonly { node: HandoffNode; key: LeafKey; event: HandoffNodeEvent }[],
  winner: HandoffNode,
  gaps: readonly Gap[],
) {
  const states: Array<{
    node: HandoffNode;
    key: LeafKey;
    event: HandoffNodeEvent;
    gapIndex: number;
    current: Candidate;
    next: Candidate;
    incumbent: PairMetrics;
  }> = [];
  for (let gapIndex = 0; gapIndex + 2 < winner.search.prefixFits.length; gapIndex++) {
    const gap = gaps[gapIndex];
    const nextGap = gaps[gapIndex + 1];
    const current = winner.search.prefixFits[gapIndex];
    const next = winner.search.prefixFits[gapIndex + 1];
    if (
      gap === undefined || nextGap === undefined || !gap.endsWithContact || !nextGap.endsWithContact ||
      current === null || next === null || gap.targets.impact === undefined && nextGap.targets.impact === undefined
    ) continue;
    const visit = visits.filter((candidate) =>
      candidate.node.search.gapIndex === gapIndex &&
      isPrefix(candidate.node.search.prefixFits, winner.search.prefixFits)
    ).at(-1);
    if (visit === undefined || visit.node.search._candidatesCache === null) continue;
    states.push({
      node: visit.node,
      key: visit.key,
      event: visit.event,
      gapIndex,
      current,
      next,
      incumbent: pairMetrics(current, next, gap, nextGap),
    });
  }
  return states;
}

function evaluateState(
  source: string,
  seed: number,
  state: ReturnType<typeof candidateStates>[number],
  setup: Setup,
  incumbentFits: readonly (Candidate | null)[],
  baselineScore: number,
): EvaluatedState {
  const currentGap = setup.gaps[state.gapIndex]!;
  const nextGap = setup.gaps[state.gapIndex + 1]!;
  const returnGap = setup.gaps[state.gapIndex + 2]!;
  const currentPool = state.node.search._candidatesCache!.candidates;
  let pairs = 0;
  let compoundExact = 0;
  let continuationCertified = 0;
  let noDebtImpactImproved = 0;
  let balancedImpactImproved = 0;
  let bestCertified: PairMetrics | null = null;
  let bestNoDebtImpact: PairMetrics | null = null;
  let bestBalancedImpact: PairMetrics | null = null;
  let bestBalancedPrefix: SearchNode | null = null;
  for (let currentRank = 0; currentRank < currentPool.length; currentRank++) {
    const current = currentPool[currentRank]!;
    const child = extendNodeCached(state.node.search, current);
    const rng = makeRng((
      Math.imul(state.node.searchSeed | 0, 1_000_033) +
      Math.imul(nextGap.index + 1, 65_537) + currentRank
    ) | 0);
    for (let attempt = 0; attempt < NEXT_ATTEMPTS; attempt++) {
      const observed = observeOneCandidate(
        child.prefixEngine,
        nextGap,
        rng,
        setup.ctx,
        child.prefixNextLineId,
        attempt,
        "normal",
        nextGap.targets,
        undefined,
        { allowRideOutPolish: false },
      );
      const next = observed.fit;
      if (next === null) continue;
      pairs++;
      const metrics = pairMetrics(current, next, currentGap, nextGap);
      const combined = tryCandidateLines(
        state.node.search.prefixEngine,
        currentGap,
        [...current.lines, ...next.lines],
        state.node.search.prefixNextLineId,
        setup.ctx.allContactFrames,
        axisLookaheadEndFrame(currentGap, setup.ctx.allContactFrames),
        currentGap.targets,
        true,
        "normal",
        getCandidateProbe(state.node.search.prefixEngine, currentGap, setup.ctx).preTargetSledTrace,
        { allowRideOutPolish: false },
      ) as Candidate | null;
      if (combined === null || !axesEqual(current.achieved, combined.achieved, currentGap.targets)) continue;
      compoundExact++;
      const grandchild = extendNodeCached(child, next);
      const certifiedPrefix = normalReturnNode(
        grandchild,
        returnGap,
        setup,
        state.node.searchSeed,
        currentRank,
        attempt,
      );
      if (certifiedPrefix === null) continue;
      continuationCertified++;
      if (bestCertified === null || metrics.sse < bestCertified.sse) bestCertified = metrics;
      if (
        metrics.sse <= state.incumbent.sse + 1e-12 &&
        metrics.impactAbsError !== null && state.incumbent.impactAbsError !== null &&
        metrics.impactAbsError + MATERIAL_IMPACT_GAIN < state.incumbent.impactAbsError
      ) {
        noDebtImpactImproved++;
        if (
          bestNoDebtImpact === null ||
          metrics.impactAbsError < bestNoDebtImpact.impactAbsError!
        ) bestNoDebtImpact = metrics;
        if (metrics.secondarySse <= state.incumbent.secondarySse + 1e-12) {
          balancedImpactImproved++;
          if (
            bestBalancedImpact === null ||
            metrics.sse < bestBalancedImpact.sse ||
            metrics.sse === bestBalancedImpact.sse &&
              metrics.impactAbsError < bestBalancedImpact.impactAbsError!
          ) {
            bestBalancedImpact = metrics;
            bestBalancedPrefix = certifiedPrefix;
          }
        }
      }
    }
  }
  const incumbentPrefix = extendNodeCached(
    extendNodeCached(state.node.search, state.current),
    state.next,
  );
  const incumbentTerminal = rebuildGuidedTail(incumbentPrefix, incumbentFits, setup);
  const incumbentReplay = incumbentTerminal === null ? null : scoreTerminal(incumbentTerminal, setup);
  const incumbentSuffixRebuilt = incumbentReplay !== null && incumbentReplay.contract_passed &&
    Math.abs(incumbentReplay.score - baselineScore) <= 1e-9;
  const balancedTerminal = !incumbentSuffixRebuilt || bestBalancedPrefix === null
    ? null
    : rebuildGuidedTail(bestBalancedPrefix, incumbentFits, setup);
  const balancedScore = balancedTerminal === null ? null : scoreTerminal(balancedTerminal, setup);
  const balancedSuffixRebuilt = balancedScore !== null && balancedScore.contract_passed;
  const balancedFullScore = balancedSuffixRebuilt ? balancedScore.score : null;
  const ordinarySnapshot = bestBalancedPrefix === null
    ? null
    : snapshotHandoffNode({
        ...state.node,
        search: bestBalancedPrefix,
        deferExpansion: false,
        rankTrace: [
          ...state.node.rankTrace,
          { rank: -2, source: "reuse" },
          { rank: -2, source: "reuse" },
          { rank: -2, source: "reuse" },
        ],
      }, state.key, state.event);
  return {
    ordinarySnapshot,
    row: {
      source,
      seed,
      gapIndex: state.gapIndex,
      currentCandidates: currentPool.length,
      pairs,
      compoundExact,
      continuationCertified,
      noDebtImpactImproved,
      balancedImpactImproved,
      incumbent: state.incumbent,
      bestCertified,
      bestNoDebtImpact,
      bestBalancedImpact,
      incumbentSuffixRebuilt,
      balancedSuffixRebuilt,
      balancedFullScore,
      balancedFullLift: balancedFullScore === null ? null : balancedFullScore - baselineScore,
      ordinarySuffixValid: false,
      ordinarySuffixScore: null,
      ordinarySuffixLift: null,
      ordinarySuffixFrames: null,
    },
  };
}

function completeOrdinarySuffix(
  evaluated: EvaluatedState,
  setup: Setup,
  spec: Spec,
  seed: number,
  baselineScore: number,
): void {
  if (evaluated.ordinarySnapshot === null) return;
  const ordinarySuffix = compileHandoffFromSnapshot(
    spec,
    seed,
    evaluated.ordinarySnapshot,
    { budget: SUFFIX_BUDGET },
  );
  const scored = scoreDriftReport(ordinarySuffix.report, {
    totalFrames: setup.durationFrames,
  });
  evaluated.row.ordinarySuffixValid = scored.contract_passed;
  evaluated.row.ordinarySuffixScore = scored.contract_passed ? scored.score : null;
  evaluated.row.ordinarySuffixLift = scored.contract_passed
    ? scored.score - baselineScore
    : null;
  evaluated.row.ordinarySuffixFrames = ordinarySuffix.stats.sim_frames;
}

function rebuildGuidedTail(
  initial: SearchNode,
  incumbentFits: readonly (Candidate | null)[],
  setup: Setup,
): SearchNode | null {
  let node = initial;
  for (let index = node.gapIndex; index < setup.gaps.length; index++) {
    const gap = setup.gaps[index]!;
    if (!gap.endsWithContact) {
      node = extendNodeCached(node, null);
      continue;
    }
    const guide = incumbentFits[index];
    if (guide === null || guide === undefined || guide.ref === undefined) return null;
    const probe = getCandidateProbe(node.prefixEngine, gap, setup.ctx);
    const dx = probe.targetState.sledX - guide.ref.x;
    const dy = probe.targetState.sledY - guide.ref.y;
    const lookahead = axisLookaheadEndFrame(gap, setup.ctx.allContactFrames);
    const candidate = guide.arc === null
      ? tryCandidateLines(
        node.prefixEngine,
        gap,
        translateTrackLines(guide.lines, dx, dy, node.prefixNextLineId),
        node.prefixNextLineId,
        setup.ctx.allContactFrames,
        lookahead,
        gap.targets,
        true,
        undefined,
        probe.preTargetSledTrace,
      )
      : tryCandidate(
        node.prefixEngine,
        gap,
        { ...guide.arc, anchor: { x: guide.arc.anchor.x + dx, y: guide.arc.anchor.y + dy } },
        node.prefixNextLineId,
        setup.ctx.allContactFrames,
        lookahead,
        gap.targets,
        true,
        undefined,
        probe.preTargetSledTrace,
      );
    if (candidate === null) return null;
    candidate.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    node = extendNodeCached(node, candidate);
  }
  return node;
}

function scoreTerminal(node: SearchNode, setup: Setup) {
  const detection = detectWindow(node.prefixEngine, 0, setup.durationFrames + 20);
  const report = buildDriftReport(
    detection,
    setup.spec,
    setup.gaps,
    setup.frames,
    setup.durationFrames,
    [],
    node.prefixFits,
    setup.targets,
  );
  return scoreDriftReport(report, { totalFrames: setup.durationFrames });
}

function normalReturnNode(
  prefix: SearchNode,
  gap: Gap,
  setup: Setup,
  searchSeed: number,
  currentRank: number,
  nextAttempt: number,
): SearchNode | null {
  if (!gap.endsWithContact) return extendNodeCached(prefix, null);
  const rng = makeRng((
    Math.imul(searchSeed | 0, 1_000_037) + Math.imul(gap.index + 1, 131_071) +
    Math.imul(currentRank + 1, 257) + nextAttempt
  ) | 0);
  for (let attempt = 0; attempt < RETURN_ATTEMPTS; attempt++) {
    const fit = observeOneCandidate(
      prefix.prefixEngine,
      gap,
      rng,
      setup.ctx,
      prefix.prefixNextLineId,
      attempt,
      "normal",
      gap.targets,
      undefined,
      { allowRideOutPolish: false },
    ).fit;
    if (fit !== null) return extendNodeCached(prefix, fit);
  }
  return null;
}

function pairMetrics(current: Candidate, next: Candidate, currentGap: Gap, nextGap: Gap): PairMetrics {
  const currentErrors = axisErrorEntries(current.achieved, currentGap.targets);
  const nextErrors = axisErrorEntries(next.achieved, nextGap.targets);
  const entries = [...currentErrors, ...nextErrors];
  const errors = entries.map((entry) => entry.error);
  const impacts = [
    impactError(current.achieved, currentGap.targets),
    impactError(next.achieved, nextGap.targets),
  ].filter((value): value is number => value !== null);
  const sse = sum(errors.map((value) => value * value));
  return {
    sse,
    secondarySse: sum(entries.flatMap((entry) =>
      entry.axis === "impact" ? [] : [entry.error * entry.error]
    )),
    rms: errors.length === 0 ? Infinity : Math.sqrt(sse / errors.length),
    axes: errors.length,
    impactAbsError: impacts.length === 0 ? null : sum(impacts) / impacts.length,
  };
}

function axisErrorEntries(
  achieved: AxisValues,
  targets: AxisValues,
): Array<{ axis: AxisName; error: number }> {
  return AXES.flatMap((axis) => finite(achieved[axis]) && finite(targets[axis])
    ? [{ axis, error: achieved[axis]! - targets[axis]! }]
    : []);
}

function impactError(achieved: AxisValues, targets: AxisValues): number | null {
  return finite(achieved.impact) && finite(targets.impact)
    ? Math.abs(achieved.impact - targets.impact)
    : null;
}

function axesEqual(left: AxisValues, right: AxisValues, targets: AxisValues): boolean {
  return (Object.keys(targets) as AxisName[]).every((axis) => {
    const a = left[axis];
    const b = right[axis];
    return a === undefined || b === undefined ? a === b : Math.abs(a - b) <= 1e-9;
  });
}

function isPrefix(prefix: readonly (Candidate | null)[], whole: readonly (Candidate | null)[]): boolean {
  return prefix.every((candidate, index) => candidate === whole[index]);
}

function buildSetup(spec: Spec, seed: number): Setup {
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(
    gapAxisTargets[gap.index],
    spec.jitter ?? CALIB.SIGMA,
    rng,
  );
  const impactByFrame = new Map(spec.contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]
  ));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index]!.impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (gaps[index]!.endsWithContact && gaps[index + 1]!.endsWithContact && gaps[index + 1]!.targets.impact !== undefined) {
      gaps[index]!.nextImpact = gaps[index + 1]!.targets.impact;
    }
  }
  const durationFrames = secToFrame(spec.duration);
  return {
    spec,
    gaps,
    targets: gapAxisTargets,
    frames: allContactFrames,
    durationFrames,
    ctx: { allContactFrames, durationFrames, gapAxisTargets, gaps },
  };
}

function finite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}
