/**
 * Charged feasibility assay for the phase-locked vector-intercept transient.
 *
 * The component preserves an exact ordinary normal catch at k.  At k+1 it
 * builds one state-derived transient whose launch vector intercepts the
 * unforced k+2 reference.  It is a fixed physical construction, never a
 * control menu, selector, ranker, or compiler source.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, engineLineFromTrackLine, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { compileHandoff, type HandoffNode, type HandoffNodeEvent } from "./optimizer/handoff.ts";
import { getCandidateProbe, observeOneCandidate, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { getSimFrames } from "./optimizer/sim_frames.ts";
import { scoreCurrentTargetQuality } from "./optimizer/objective.ts";
import { contactKinematicFrameFromPlanningState } from "./trajectory/contact_kinematic_frame.ts";
import { realizePhaseLockedTransient } from "./trajectory/phase_locked_transient.ts";
import { extractPlanningState } from "./trajectory/state.ts";
import { targetFrameFromPlanningState } from "./trajectory/target_frame.ts";
import { CALIB, secToFrame, type AxisName, type AxisValues, type Gap, type Spec, type TrackLine } from "./types.ts";

const CASES = [
  { id: "frontier_dense_recovery", regime: "dense", spec: dense },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense", spec: denseDialogueImpact },
  { id: "countercurrent", regime: "representative", spec: countercurrent },
  { id: "believer_56_6s", regime: "development_music", spec: believer },
  { id: "frontier_low_air_endurance_4s", regime: "low_air", spec: lowAir },
  { id: "offgrid_conversation", regime: "pickup", spec: offgrid },
] as const satisfies readonly { id: string; regime: string; spec: Spec }[];

const DISCOVERY_SEEDS = [42, 43] as const;
const REPLICATION_SEEDS = [44, 45] as const;
const BUDGET = 500_000;
const RAW_ATTEMPTS = 32;
const CURRENT_VIABLE_PREFIX = 4;
const RETURN_ATTEMPTS = 8;
const BATCH_SIZE = 2;
const OUT_DIR = "generated/studies/phase-locked-vector-intercept/v1";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: study_phase_locked_transient.ts --batch=0|1|2 | --aggregate [--replication] [--out-dir=DIR]\n");
  process.exit(0);
}
const aggregate = argv.includes("--aggregate");
const replication = argv.includes("--replication");
const unexpected = argv.filter((value) => value !== "--aggregate" && value !== "--replication" && !value.startsWith("--batch=") && !value.startsWith("--out-dir="));
if (unexpected.length > 0) throw new Error(`unknown argument(s): ${unexpected.join(", ")}`);
const outDir = arg("out-dir") ?? (replication ? `${OUT_DIR}/v2` : OUT_DIR);
const seeds = replication ? REPLICATION_SEEDS : DISCOVERY_SEEDS;
const batchRaw = arg("batch");
if (aggregate === (batchRaw !== undefined)) throw new Error("provide exactly one of --aggregate or --batch=0|1|2");

if (aggregate) {
  const batches = Array.from({ length: Math.ceil(CASES.length / BATCH_SIZE) }, (_, index) => {
    const path = `${outDir}/batch-${index}.json`;
    if (!existsSync(path)) throw new Error(`missing phase-locked transient batch ${path}`);
    return JSON.parse(readFileSync(path, "utf8")) as BatchDocument;
  });
  const rows = batches.flatMap((batch) => batch.rows);
  const result = { schema: replication ? "line.study-phase-locked-vector-intercept-replication.aggregate.v1" : "line.study-phase-locked-vector-intercept.aggregate.v1", frozenConfig: batches[0]?.frozenConfig, rows, summary: summarize(rows) };
  const path = `${outDir}/result.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: path, summary: result.summary }, null, 2)}\n`);
  process.exit(0);
}

const batch = Number(batchRaw);
if (!Number.isSafeInteger(batch) || batch < 0 || batch >= Math.ceil(CASES.length / BATCH_SIZE)) {
  throw new Error(`--batch must be an integer in [0, ${Math.ceil(CASES.length / BATCH_SIZE) - 1}]`);
}
const activeCases = CASES.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE);
const started = performance.now();
const rows: StateRow[] = [];
for (const definition of activeCases) {
  for (const seed of seeds) {
    rows.push(runCase(definition, seed));
    (globalThis as { gc?: () => void }).gc?.();
  }
}
const document: BatchDocument = {
  schema: replication ? "line.study-phase-locked-vector-intercept-replication.v1" : "line.study-phase-locked-vector-intercept.v1",
  batch,
  frozenConfig: {
    seeds,
    budget: BUDGET,
    joltMs: benchmarkPolicy.transform.joltMs,
    checkpoint: "last ordinary winner ancestor at one-third of authored contacts",
    currentPopulation: `first ${CURRENT_VIABLE_PREFIX} viable raw-normal fits from attempts 0..${RAW_ATTEMPTS - 1}`,
    component: "one frame-centred distributed k+1 capture-to-launch curve; launch velocity is the discrete ballistic intercept to the unforced k+2 reference",
    return: `first ${RETURN_ATTEMPTS} unchanged ordinary-normal attempts at k+2 from each byte-stable pair`,
    ...(replication ? {
      directControl: `first viable member of an equal ${RETURN_ATTEMPTS}-attempt ordinary-normal k+1 stream from the same raw-k engine state, followed by the same k+2 normal-return stream`,
      discard: "retire if the vector-intercept form loses materialized normal-return support to the direct control in dense, pickup, or low-air, if current axes change on materialization, or if the exact component cannot materialize",
    } : {
      discard: "retire if dense, pickup, or low-air lacks a width-1 normal return on either frozen seed, if current axes change on materialization, or if the exact component cannot materialize",
    }),
  },
  elapsedMs: round(performance.now() - started),
  rows,
  summary: summarize(rows),
};
const path = `${outDir}/batch-${batch}.json`;
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: path, summary: document.summary }, null, 2)}\n`);

type Regime = typeof CASES[number]["regime"];
type Setup = { gaps: Gap[]; ctx: SpecContext };
type Visit = { node: HandoffNode; event: HandoffNodeEvent };
type ReturnResult = { attempted: number; geometryAvailable: number; admitted: number; frames: number };
type PairRow = {
  currentAttempt: number;
  nextGapIndex: number;
  afterNextGapIndex: number;
  unforcedReferenceAvailable: boolean;
  component: { available: boolean; reason: string | null; interceptAngleDeg: number | null; interceptSpeed: number | null; frames: number };
  nextAdmitted: boolean;
  nextFrames: number;
  materialized: boolean;
  materializationFrames: number;
  currentAxesExact: boolean;
  twoGapRms: number | null;
  normalReturn: ReturnResult | null;
  direct: DirectPair | null;
};
type DirectPair = {
  nextAdmitted: boolean;
  nextFrames: number;
  materialized: boolean;
  materializationFrames: number;
  currentAxesExact: boolean;
  twoGapRms: number | null;
  normalReturn: ReturnResult | null;
};
type StateRow = { caseId: string; regime: Regime; seed: number; checkpointGapIndex: number | null; rows: PairRow[] };
type BatchDocument = { schema: string; batch: number; frozenConfig: unknown; elapsedMs: number; rows: StateRow[]; summary: unknown };

function runCase(definition: typeof CASES[number], seed: number): StateRow {
  const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
  const setup = buildSetup(spec, seed);
  const visits: Visit[] = [];
  let winner: HandoffNode | null = null;
  compileHandoff(spec, seed, {
    budget: BUDGET,
    onNode(node, _key, event) {
      visits.push({ node, event });
      if (event.improved) winner = node;
    },
  });
  if (winner === null) throw new Error(`${definition.id}/s${seed}: compiler produced no winner`);
  const parent = winnerParentAtOneThird(visits, winner, setup.gaps);
  if (parent === null) return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex: null, rows: [] };
  const current = setup.gaps[parent.node.search.gapIndex];
  const next = current === undefined ? null : nextContact(setup.gaps, current.index + 1);
  const afterNext = next === null ? null : nextContact(setup.gaps, next.index + 1);
  if (current === undefined || next === null || afterNext === null || !current.endsWithContact) {
    return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex: current?.index ?? null, rows: [] };
  }
  const candidates = firstRawViable(parent.node, current, setup);
  const rows = candidates.map((candidate) => evaluatePair(parent.node, candidate, current, next, afterNext, setup));
  process.stderr.write(`${definition.id}/s${seed}: g${current.index}->${next.index}->${afterNext.index}, raw=${candidates.length}, next=${rows.filter((row) => row.nextAdmitted).length}, return=${rows.filter((row) => (row.normalReturn?.admitted ?? 0) > 0).length}${replication ? `, direct-return=${rows.filter((row) => (row.direct?.normalReturn?.admitted ?? 0) > 0).length}` : ""}\n`);
  return { caseId: definition.id, regime: definition.regime, seed, checkpointGapIndex: current.index, rows };
}

function evaluatePair(node: HandoffNode, current: Candidate, currentGap: Gap, nextGap: Gap, afterNext: Gap, setup: Setup): PairRow {
  const currentEngine = node.search.prefixEngine.addLine(current.lines.map(engineLineFromTrackLine));
  const nextState = extractPlanningState(currentEngine, nextGap.endFrame);
  const futureState = extractPlanningState(currentEngine, afterNext.endFrame);
  const empty = (reason: string): PairRow => ({
    currentAttempt: current.sampleAttempt ?? -1, nextGapIndex: nextGap.index, afterNextGapIndex: afterNext.index,
    unforcedReferenceAvailable: futureState !== null,
    component: { available: false, reason, interceptAngleDeg: null, interceptSpeed: null, frames: 0 },
    nextAdmitted: false, nextFrames: 0, materialized: false, materializationFrames: 0, currentAxesExact: false, twoGapRms: null, normalReturn: null, direct: null,
  });
  if (nextState === null || futureState === null) return empty("next or unforced future planning state unavailable");
  let component;
  try {
    component = realizePhaseLockedTransient(
      contactKinematicFrameFromPlanningState(nextState, targetFrameFromPlanningState(nextState), nextGap.targets),
      futureState.reference,
      afterNext.endFrame - nextGap.endFrame,
      node.search.prefixNextLineId + current.lines.length,
    );
  } catch (error) {
    return empty(error instanceof Error ? error.message : String(error));
  }
  if (component.status !== "ready") return empty(component.reason);
  const nextBefore = getSimFrames();
  const nextFit = tryCandidateLines(
    currentEngine, nextGap, component.lines, node.search.prefixNextLineId + current.lines.length,
    setup.ctx.allContactFrames, axisLookaheadEndFrame(nextGap, setup.ctx.allContactFrames),
    setup.ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets, true, "normal",
    getCandidateProbe(currentEngine, nextGap, setup.ctx).preTargetSledTrace, { allowRideOutPolish: false },
  ) as Candidate | null;
  const nextFrames = getSimFrames() - nextBefore;
  const metadata = {
    available: true,
    reason: null,
    interceptAngleDeg: round(component.intercept.launchAngleDeg),
    interceptSpeed: round(Math.hypot(component.intercept.launchVelocity.x, component.intercept.launchVelocity.y)),
  };
  const direct = replication ? evaluateDirectPair(node, current, currentGap, nextGap, afterNext, setup) : null;
  if (nextFit === null) {
    return { ...empty("exact k+1 gate rejected phase-locked transient"), component: { ...metadata, frames: nextFrames }, nextFrames, direct };
  }
  const combined = [...current.lines, ...nextFit.lines];
  const materializeBefore = getSimFrames();
  const fullFit = tryCandidateLines(
    node.search.prefixEngine, currentGap, combined, node.search.prefixNextLineId,
    setup.ctx.allContactFrames, axisLookaheadEndFrame(currentGap, setup.ctx.allContactFrames),
    setup.ctx.gapAxisTargets?.[currentGap.index] ?? currentGap.targets, true, "normal",
    getCandidateProbe(node.search.prefixEngine, currentGap, setup.ctx).preTargetSledTrace, { allowRideOutPolish: false },
  ) as Candidate | null;
  const materializationFrames = getSimFrames() - materializeBefore;
  const materialized = fullFit !== null && sameLines(fullFit.lines, combined);
  const currentAxesExact = fullFit !== null && sameAxes(current, fullFit, currentGap);
  const normalReturn = materialized
    ? normalReturnFrom(
      node.search.prefixEngine.addLine(combined.map(engineLineFromTrackLine)), afterNext,
      node.search.prefixNextLineId + combined.length, setup, node.searchSeed, current.sampleAttempt ?? -1,
    )
    : null;
  return {
    currentAttempt: current.sampleAttempt ?? -1,
    nextGapIndex: nextGap.index,
    afterNextGapIndex: afterNext.index,
    unforcedReferenceAvailable: true,
    component: { ...metadata, frames: nextFrames },
    nextAdmitted: true,
    nextFrames,
    materialized,
    materializationFrames,
    currentAxesExact,
    twoGapRms: twoGapRms(current, currentGap, nextFit, nextGap),
    normalReturn,
    direct,
  };
}

function evaluateDirectPair(node: HandoffNode, current: Candidate, currentGap: Gap, nextGap: Gap, afterNext: Gap, setup: Setup): DirectPair {
  const currentEngine = node.search.prefixEngine.addLine(current.lines.map(engineLineFromTrackLine));
  const rng = makeRng((Math.imul(node.searchSeed | 0, 1_000_003) + nextGap.index + 1) | 0);
  let next: Candidate | null = null;
  let nextFrames = 0;
  for (let attempt = 0; attempt < RETURN_ATTEMPTS; attempt++) {
    const before = getSimFrames();
    const observed = observeOneCandidate(
      currentEngine, nextGap, rng, setup.ctx, node.search.prefixNextLineId + current.lines.length,
      attempt, "normal", nextGap.targets, undefined, { allowRideOutPolish: false },
    );
    nextFrames += getSimFrames() - before;
    if (observed.fit !== null) { next = observed.fit; break; }
  }
  if (next === null) {
    return { nextAdmitted: false, nextFrames, materialized: false, materializationFrames: 0, currentAxesExact: false, twoGapRms: null, normalReturn: null };
  }
  const combined = [...current.lines, ...next.lines];
  const before = getSimFrames();
  const fullFit = tryCandidateLines(
    node.search.prefixEngine, currentGap, combined, node.search.prefixNextLineId,
    setup.ctx.allContactFrames, axisLookaheadEndFrame(currentGap, setup.ctx.allContactFrames),
    setup.ctx.gapAxisTargets?.[currentGap.index] ?? currentGap.targets, true, "normal",
    getCandidateProbe(node.search.prefixEngine, currentGap, setup.ctx).preTargetSledTrace, { allowRideOutPolish: false },
  ) as Candidate | null;
  const materializationFrames = getSimFrames() - before;
  const materialized = fullFit !== null && sameLines(fullFit.lines, combined);
  return {
    nextAdmitted: true,
    nextFrames,
    materialized,
    materializationFrames,
    currentAxesExact: fullFit !== null && sameAxes(current, fullFit, currentGap),
    twoGapRms: twoGapRms(current, currentGap, next, nextGap),
    normalReturn: materialized
      ? normalReturnFrom(node.search.prefixEngine.addLine(combined.map(engineLineFromTrackLine)), afterNext, node.search.prefixNextLineId + combined.length, setup, node.searchSeed, current.sampleAttempt ?? -1)
      : null,
  };
}

function normalReturnFrom(engine: any, gap: Gap, lineIdStart: number, setup: Setup, seed: number, currentAttempt: number): ReturnResult {
  const rng = makeRng((Math.imul(seed | 0, 1_000_037) + Math.imul(gap.index + 1, 65_537) + currentAttempt + 1) | 0);
  let geometryAvailable = 0;
  let admitted = 0;
  let frames = 0;
  for (let attempt = 0; attempt < RETURN_ATTEMPTS; attempt++) {
    const before = getSimFrames();
    const observed = observeOneCandidate(engine, gap, rng, setup.ctx, lineIdStart, attempt, "normal", gap.targets, undefined, { allowRideOutPolish: false });
    frames += getSimFrames() - before;
    if (observed.fit !== null) {
      geometryAvailable++;
      admitted++;
    }
  }
  return { attempted: RETURN_ATTEMPTS, geometryAvailable, admitted, frames };
}

function firstRawViable(node: HandoffNode, gap: Gap, setup: Setup): Candidate[] {
  const rng = makeRng((Math.imul(node.searchSeed | 0, 1_000_003) + gap.index + 1) | 0);
  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < RAW_ATTEMPTS && candidates.length < CURRENT_VIABLE_PREFIX; attempt++) {
    const observed = observeOneCandidate(node.search.prefixEngine, gap, rng, setup.ctx, node.search.prefixNextLineId, attempt, "normal", gap.targets, undefined, { allowRideOutPolish: false });
    if (observed.fit !== null) candidates.push(observed.fit);
  }
  return candidates;
}

function winnerParentAtOneThird(visits: readonly Visit[], winner: HandoffNode, gaps: readonly Gap[]): Visit | null {
  const contacts = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  const target = contacts[Math.floor((contacts.length - 1) / 3)];
  return target === undefined ? null : visits.filter((visit) =>
    visit.node.skippedContacts === 0 && visit.node.search.gapIndex === target &&
    visit.node.search.prefixFits.every((fit, index) => fit === winner.search.prefixFits[index]),
  ).at(-1) ?? null;
}

function nextContact(gaps: readonly Gap[], start: number): Gap | null {
  for (let index = start; index < gaps.length; index++) if (gaps[index]?.endsWithContact) return gaps[index]!;
  return null;
}

function buildSetup(userSpec: Spec, seed: number): Setup {
  const spec: Spec = { ...userSpec, preroll: undefined, contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5) };
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, secToFrame(spec.duration));
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function sameLines(left: readonly TrackLine[], right: readonly TrackLine[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameAxes(left: Candidate, right: Candidate, gap: Gap): boolean {
  const a = left.achievedAtEnd ?? left.achieved;
  const b = right.achievedAtEnd ?? right.achieved;
  return (Object.keys(gap.targets) as AxisName[]).every((axis) => a[axis] === b[axis]);
}

function twoGapRms(first: Candidate, firstGap: Gap, second: Candidate, secondGap: Gap): number | null {
  const errors = [
    ...axisErrors(first, firstGap),
    ...axisErrors(second, secondGap),
  ];
  return errors.length === 0 ? null : round(Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length));
}

function axisErrors(candidate: Candidate, gap: Gap): number[] {
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  return (Object.keys(gap.targets) as AxisName[]).flatMap((axis) => {
    const target = gap.targets[axis];
    const value = achieved[axis];
    return typeof target === "number" && typeof value === "number" ? [value - target] : [];
  });
}

function summarize(states: readonly StateRow[]) {
  const pairs = states.flatMap((state) => state.rows);
  const byRegime = Object.fromEntries([...new Set(states.map((state) => state.regime))].map((regime) => {
    const rows = states.filter((state) => state.regime === regime).flatMap((state) => state.rows);
    return [regime, {
      current: rows.length,
      available: rows.filter((row) => row.component.available).length,
      nextAdmitted: rows.filter((row) => row.nextAdmitted).length,
      materialized: rows.filter((row) => row.materialized).length,
      currentAxesExact: rows.filter((row) => row.currentAxesExact).length,
      normalReturns: rows.reduce((sum, row) => sum + (row.normalReturn?.admitted ?? 0), 0),
      pairsWithNormalReturn: rows.filter((row) => (row.normalReturn?.admitted ?? 0) > 0).length,
    }];
  }));
  return {
    states: states.length,
    currentRows: pairs.length,
    componentAvailable: pairs.filter((row) => row.component.available).length,
    nextAdmitted: pairs.filter((row) => row.nextAdmitted).length,
    materialized: pairs.filter((row) => row.materialized).length,
    currentAxesExact: pairs.filter((row) => row.currentAxesExact).length,
    pairsWithNormalReturn: pairs.filter((row) => (row.normalReturn?.admitted ?? 0) > 0).length,
    normalReturns: pairs.reduce((sum, row) => sum + (row.normalReturn?.admitted ?? 0), 0),
    meanTwoGapRms: mean(pairs.map((row) => row.twoGapRms).filter((value): value is number => value !== null)),
    ...(replication ? directComparison(pairs) : {}),
    byRegime,
  };
}

function directComparison(rows: readonly PairRow[]) {
  const comparable = rows.filter((row) => row.materialized && row.direct?.materialized === true);
  return {
    directMaterialized: rows.filter((row) => row.direct?.materialized).length,
    directPairsWithNormalReturn: rows.filter((row) => (row.direct?.normalReturn?.admitted ?? 0) > 0).length,
    directNormalReturns: rows.reduce((sum, row) => sum + (row.direct?.normalReturn?.admitted ?? 0), 0),
    comparable: comparable.length,
    meanPhaseMinusDirectRms: mean(comparable.map((row) => row.twoGapRms! - row.direct!.twoGapRms!)),
    phaseMinusDirectReturnCount: rows.reduce((sum, row) => sum + (row.normalReturn?.admitted ?? 0) - (row.direct?.normalReturn?.admitted ?? 0), 0),
  };
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
