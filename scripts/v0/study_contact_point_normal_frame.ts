/**
 * Frozen observation-only comparison of the ordinary normal sampler's
 * geometry frame. The production arm uses the existing lowest-sled-point
 * anchor plus rider COM tangent; comparators keep that anchor and exact
 * evaluator but supply either the velocity of the same lowest point or the
 * aggregate velocity of the three zero-friction sled points.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --out=generated/studies/contact-point-normal-frame/v1/result.json
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --zero-friction-average --batch=0 \
 *     --out=generated/studies/zero-friction-average-normal-frame/v1/batch-0.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { getRiderMetered, SLED_POINT_ORDER } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  sampleArcPlacementGeometry,
  type ImpactFrameTargetState,
} from "./arc_placement.ts";
import { candidateQualityObjective } from "./optimizer/aim.ts";
import {
  compileHandoff,
  setHandoffFrontierNodeProbeHook,
  type HandoffNode,
} from "./optimizer/handoff.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import {
  getCandidateProbe,
  sampleOneCandidate,
  type Candidate,
  type SpecContext,
} from "./optimizer/sample.ts";
import { axisLookaheadEndFrame, tryCandidateGeometry } from "./core/candidate.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_contact_point_normal_frame.ts [--zero-friction-average --batch=0|1|2] [--out=PATH]\n",
  );
  process.exit(0);
}
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = arg("out");
const zeroFrictionAverage = argv.includes("--zero-friction-average");
const batchArgument = arg("batch");
const batch = batchArgument === undefined ? undefined : Number(batchArgument);
const unknownArgs = argv.filter((value) =>
  value !== "--zero-friction-average" && !value.startsWith("--out=") && !value.startsWith("--batch=")
);
if (unknownArgs.length > 0) throw new Error(`unknown argument(s): ${unknownArgs.join(", ")}`);
if (!zeroFrictionAverage && batch !== undefined) throw new Error("--batch is reserved for --zero-friction-average");
if (zeroFrictionAverage && (batch === undefined || !Number.isSafeInteger(batch) || batch < 0 || batch > 2)) {
  throw new Error("--zero-friction-average requires --batch=0|1|2");
}

const BUDGET = 500_000;
const CONTACT_POINT_SEEDS = [26, 27] as const;
const ZERO_FRICTION_AVERAGE_SEEDS = [48, 49] as const;
const SEEDS = zeroFrictionAverage ? ZERO_FRICTION_AVERAGE_SEEDS : CONTACT_POINT_SEEDS;
const CONTACT_POINT_CASES = [
  { id: "dense_dialogue", regime: "dense" },
  { id: "river_reentry", regime: "representative" },
  { id: "pickup_lattice", regime: "pickup" },
  { id: "frontier_pickup_progression", regime: "pickup" },
  { id: "frontier_low_air_endurance_6s", regime: "low_air" },
  { id: "believer_impact_56s", regime: "development_music" },
] as const;
const ZERO_FRICTION_AVERAGE_CASES = [
  { id: "frontier_dense_recovery_240ms_figures", regime: "dense" },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense" },
  { id: "rising_switch", regime: "representative" },
  { id: "pickup_lattice_speed_minus_4", regime: "pickup" },
  { id: "frontier_low_air_endurance_7s", regime: "low_air" },
  { id: "believer_56_6s_impact_relief", regime: "development_music" },
] as const;
const CASES = zeroFrictionAverage ? ZERO_FRICTION_AVERAGE_CASES : CONTACT_POINT_CASES;
const ACTIVE_CASES = batch === undefined ? CASES : CASES.slice(batch * 2, batch * 2 + 2);

type Regime = typeof CASES[number]["regime"];
type Captured = {
  checkpoint: "one_third" | "two_thirds";
  gapIndex: number;
  node: HandoffNode;
};
type RawPoolSnapshot = {
  seed: number;
  count: number;
  candidates: Array<{ attempt: number; geometryHash: string }>;
};
type CandidateDigest = {
  attempt: number;
  geometryHash: string;
  cost: number;
  axisRms: number;
  qualityObjective: number | null;
};
type ArmSummary = {
  attempts: number;
  viable: number;
  bestCost: number | null;
  bestAxisRms: number | null;
  bestQualityObjective: number | null;
  candidates: CandidateDigest[];
};
type ContactFrame = {
  targetState: ImpactFrameTargetState;
  anchor: (typeof SLED_POINT_ORDER)[number] | "rider";
  velocitySource: "contact_point_velocity" | "zero_friction_average" | "rider_com_fallback";
  frameShiftDeg: number;
};
type Row = {
  caseId: string;
  regime: Regime;
  seed: number;
  checkpoint: Captured["checkpoint"];
  gapIndex: number;
  candidateCount: number | null;
  captureAvailable: boolean;
  replayEquivalent: boolean | null;
  replayMessage: string | null;
  contactFrame: {
    anchor: ContactFrame["anchor"];
    velocitySource: ContactFrame["velocitySource"];
    frameShiftDeg: number;
  } | null;
  productionCom: ArmSummary | null;
  contactPoint: ArmSummary | null;
  deltas: {
    viable: number | null;
    bestAxisRms: number | null;
    bestQualityObjective: number | null;
    bestCost: number | null;
  } | null;
};

const catalog = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case]));
const definitions = ACTIVE_CASES.map((entry) => {
  const value = catalog.get(entry.id);
  if (value === undefined) throw new Error(`frozen case ${entry.id} is absent from development catalog`);
  return { ...entry, spec: value.spec };
});

const rows: Row[] = [];
for (const definition of definitions) {
  for (const seed of SEEDS) {
    const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
    const setup = buildSetup(spec, seed);
    const checkpointGaps = checkpointGapIndices(setup.gaps);
    const captured = new Map<number, Captured>();
    const rawSnapshots = new WeakMap<object, RawPoolSnapshot>();
    setHandoffFrontierNodeProbeHook(({ selected }) => {
      if (selected.skippedContacts !== 0 || selected.search.gapIndex === setup.gaps.length) return;
      const checkpoint = checkpointGaps.get(selected.search.gapIndex);
      if (checkpoint !== undefined && !captured.has(selected.search.gapIndex)) {
        captured.set(selected.search.gapIndex, {
          checkpoint,
          gapIndex: selected.search.gapIndex,
          node: selected,
        });
      }
    });
    setNormalPoolSnapshotHook((record) => captureRawPool(rawSnapshots, record));
    const started = performance.now();
    try {
      compileHandoff(spec, seed, { budget: BUDGET });
    } finally {
      setHandoffFrontierNodeProbeHook(null);
      setNormalPoolSnapshotHook(null);
    }

    for (const [gapIndex, checkpoint] of checkpointGaps) {
      const capturedState = captured.get(gapIndex);
      if (capturedState === undefined) {
        rows.push(unavailableRow(definition.id, definition.regime, seed, checkpoint, gapIndex, "frontier state unavailable"));
        continue;
      }
      rows.push(replayCapturedState(
        definition.id,
        definition.regime,
        seed,
        capturedState,
        rawSnapshots.get(capturedState.node.search) ?? null,
        setup,
      ));
    }
    process.stderr.write(
      `${definition.id}/s${seed}: ${captured.size}/${checkpointGaps.size} checkpoints captured in ` +
      `${((performance.now() - started) / 1000).toFixed(1)}s\n`,
    );
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const result = {
  schema: zeroFrictionAverage
    ? "line.study-zero-friction-average-normal-frame.v1"
    : "line.study-contact-point-normal-frame.v1",
  purpose: [
    "observation-only replay of ordinary normal candidate pools from immutable frontier states",
    zeroFrictionAverage
      ? "same PRNG, anchor, candidate count, attempt indices, exact gates, and scorer; COM tangent versus the mean velocity frame of TAIL/NOSE/STRING"
      : "same PRNG, anchor, candidate count, attempt indices, exact gates, and scorer; COM tangent versus lowest-contact-point tangent",
    "no alternate compiler run, no source change, and no V2 evaluation",
  ],
  frozenConfig: {
    budget: BUDGET,
    joltMs: benchmarkPolicy.transform.joltMs,
    seeds: SEEDS,
    cases: ACTIVE_CASES,
    checkpoints: "first ordinary frontier state at one-third and two-thirds authored-contact gap indices",
    frame: zeroFrictionAverage
      ? "mean finite non-zero velocity of TAIL/NOSE/STRING at the immutable target state; no point identity is selected"
      : "velocity of the selected lowest sled point, with rider COM fallback only when that point has no finite non-zero velocity",
    ...(batch === undefined ? {} : { batch }),
  },
  rows,
  summary: summarize(rows),
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`${JSON.stringify({ ...result, rows: undefined }, null, 2)}\n`);
}

function captureRawPool(
  snapshots: WeakMap<object, RawPoolSnapshot>,
  record: { node: object; seed: number; nCand: number; sampleOrder: readonly Candidate[] },
): void {
  const prior = snapshots.get(record.node);
  if (prior === undefined || prior.seed !== record.seed || record.nCand < prior.count) {
    snapshots.set(record.node, {
      seed: record.seed,
      count: record.nCand,
      candidates: record.sampleOrder.map((candidate) => ({
        attempt: candidate.sampleAttempt ?? -1,
        geometryHash: geometryHash(candidate),
      })),
    });
    return;
  }
  if (record.nCand > prior.count) {
    prior.candidates.push(...record.sampleOrder
      .filter((candidate) => (candidate.sampleAttempt ?? -1) >= prior.count)
      .map((candidate) => ({
        attempt: candidate.sampleAttempt ?? -1,
        geometryHash: geometryHash(candidate),
      })));
    prior.count = record.nCand;
  }
}

function replayCapturedState(
  caseId: string,
  regime: Regime,
  seed: number,
  captured: Captured,
  rawPool: RawPoolSnapshot | null,
  setup: Setup,
): Row {
  if (rawPool === null || rawPool.count <= 0) {
    return unavailableRow(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "generation-time ordinary pool snapshot unavailable");
  }
  const gap = setup.gaps[captured.gapIndex];
  if (gap === undefined || !gap.endsWithContact) {
    return unavailableRow(caseId, regime, seed, captured.checkpoint, captured.gapIndex, "checkpoint is not a contact gap");
  }
  const count = rawPool.count;
  const rngSeed = (Math.imul(rawPool.seed | 0, 1_000_003) + gap.index + 1) | 0;
  const productionCom = sampleProductionArm(captured.node, gap, setup.ctx, setup.gaps, count, rngSeed);
  const replay = compareGeneratedRawReplay(rawPool.candidates, productionCom.candidates);
  const frame = readContactFrame(captured.node.search.prefixEngine, gap, setup.ctx);
  const contactPoint = sampleContactPointArm(captured.node, gap, setup.ctx, setup.gaps, count, rngSeed, frame.targetState);
  return {
    caseId,
    regime,
    seed,
    checkpoint: captured.checkpoint,
    gapIndex: captured.gapIndex,
    candidateCount: count,
    captureAvailable: true,
    replayEquivalent: replay.ok,
    replayMessage: replay.message,
    contactFrame: { anchor: frame.anchor, velocitySource: frame.velocitySource, frameShiftDeg: frame.frameShiftDeg },
    productionCom,
    contactPoint,
    deltas: {
      viable: contactPoint.viable - productionCom.viable,
      bestAxisRms: pairedImprovement(productionCom.bestAxisRms, contactPoint.bestAxisRms, false),
      bestQualityObjective: pairedImprovement(productionCom.bestQualityObjective, contactPoint.bestQualityObjective, true),
      bestCost: pairedImprovement(productionCom.bestCost, contactPoint.bestCost, false),
    },
  };
}

function unavailableRow(
  caseId: string,
  regime: Regime,
  seed: number,
  checkpoint: Captured["checkpoint"],
  gapIndex: number,
  message: string,
): Row {
  return {
    caseId, regime, seed, checkpoint, gapIndex,
    candidateCount: null,
    captureAvailable: false,
    replayEquivalent: null,
    replayMessage: message,
    contactFrame: null,
    productionCom: null,
    contactPoint: null,
    deltas: null,
  };
}

function sampleProductionArm(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): ArmSummary {
  const rng = makeRng(seed);
  const candidates: CandidateDigest[] = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const candidate = sampleOneCandidate(node.search.prefixEngine, gap, rng, ctx, node.search.prefixNextLineId, attempt);
    if (candidate !== null) candidates.push(digestCandidate(candidate, node, gap, gaps, ctx));
  }
  return summarizeArm(count, candidates);
}

function sampleContactPointArm(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
  targetState: ImpactFrameTargetState,
): ArmSummary {
  const rng = makeRng(seed);
  const candidates: CandidateDigest[] = [];
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  for (let attempt = 0; attempt < count; attempt++) {
    const geometry = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: targetState.sledX, y: targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digestCandidate(fit, node, gap, gaps, ctx));
    }
  }
  return summarizeArm(count, candidates);
}

function summarizeArm(attempts: number, candidates: CandidateDigest[]): ArmSummary {
  const finiteAxis = candidates.filter((candidate) => Number.isFinite(candidate.axisRms));
  const finiteObjective = candidates.filter((candidate) => candidate.qualityObjective !== null);
  return {
    attempts,
    viable: candidates.length,
    bestCost: minOrNull(candidates.map((candidate) => candidate.cost)),
    bestAxisRms: minOrNull(finiteAxis.map((candidate) => candidate.axisRms)),
    bestQualityObjective: maxOrNull(finiteObjective.map((candidate) => candidate.qualityObjective!)),
    candidates,
  };
}

function readContactFrame(engine: any, gap: Gap, ctx: SpecContext): ContactFrame {
  const probe = getCandidateProbe(engine, gap, ctx);
  const rider = getRiderMetered(engine, gap.endFrame);
  let selected: (typeof SLED_POINT_ORDER)[number] | "rider" = "rider";
  let selectedVelocity: { x: number; y: number } | null = null;
  let lowestY = probe.refY;
  for (const name of SLED_POINT_ORDER) {
    const point = rider?.get?.(name);
    if (!finiteVec(point?.pos) || point.pos.y <= lowestY) continue;
    lowestY = point.pos.y;
    selected = name;
    selectedVelocity = finiteNonZeroVec(point?.vel ?? point?.velocity);
  }
  const comVelocity = finiteNonZeroVec(rider?.velocity);
  const zeroFrictionVelocity = zeroFrictionAverage ? averageZeroFrictionVelocity(rider) : null;
  const velocity = zeroFrictionVelocity ?? selectedVelocity ?? comVelocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);
  const comAngleDeg = comVelocity === null ? 0 : Math.atan2(comVelocity.y, comVelocity.x) * 180 / Math.PI;
  const frameAngleDeg = speed > 0 ? Math.atan2(velocity.y, velocity.x) * 180 / Math.PI : 0;
  return {
    targetState: {
      sledX: probe.targetState.sledX,
      sledY: probe.targetState.sledY,
      velocity,
      speed,
      angleDeg: speed > 0 ? Math.atan2(velocity.y, velocity.x) * 180 / Math.PI : 0,
    },
    anchor: selected,
    velocitySource: zeroFrictionVelocity !== null
      ? "zero_friction_average"
      : selectedVelocity === null ? "rider_com_fallback" : "contact_point_velocity",
    frameShiftDeg: signedAngleDelta(comAngleDeg, frameAngleDeg),
  };
}

function averageZeroFrictionVelocity(
  rider: { get?: (name: string) => { vel?: unknown; velocity?: unknown } | undefined } | null | undefined,
): { x: number; y: number } | null {
  const velocities = ["TAIL", "NOSE", "STRING"]
    .map((name) => finiteNonZeroVec(rider?.get?.(name)?.vel ?? rider?.get?.(name)?.velocity))
    .filter((velocity): velocity is { x: number; y: number } => velocity !== null);
  if (velocities.length !== 3) return null;
  const average = velocities.reduce(
    (sum, velocity) => ({ x: sum.x + velocity.x / velocities.length, y: sum.y + velocity.y / velocities.length }),
    { x: 0, y: 0 },
  );
  return Math.hypot(average.x, average.y) > 1e-9 ? average : null;
}

function finiteVec(value: unknown): value is { x: number; y: number } {
  return typeof value === "object" && value !== null &&
    Number.isFinite((value as { x?: unknown }).x) && Number.isFinite((value as { y?: unknown }).y);
}

function finiteNonZeroVec(value: unknown): { x: number; y: number } | null {
  return finiteVec(value) && Math.hypot(value.x, value.y) > 1e-9 ? { x: value.x, y: value.y } : null;
}

function digestCandidate(candidate: Candidate, node: HandoffNode, gap: Gap, gaps: Gap[], ctx: SpecContext): CandidateDigest {
  return {
    attempt: candidate.sampleAttempt ?? -1,
    geometryHash: geometryHash(candidate),
    cost: round(candidate.cost),
    axisRms: round(axisRms(candidate, ctx.gapAxisTargets?.[gap.index] ?? gap.targets)),
    qualityObjective: nullableRound(candidateQualityObjective(node.search.prefixEngine, candidate, gap, gaps, ctx)),
  };
}

function axisRms(candidate: Candidate, targets: AxisValues): number {
  const achieved = candidate.achievedAtEnd ?? candidate.achieved;
  const errors = Object.entries(targets).flatMap(([axis, target]) => {
    const value = achieved[axis as keyof AxisValues];
    return typeof target === "number" && typeof value === "number" && Number.isFinite(value)
      ? [(value - target) ** 2]
      : [];
  });
  return errors.length === 0 ? Infinity : Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length);
}

function compareGeneratedRawReplay(
  generated: readonly { attempt: number; geometryHash: string }[],
  replayed: readonly CandidateDigest[],
): { ok: boolean; message: string } {
  const expected = [...generated].sort((a, b) => a.attempt - b.attempt);
  const actual = [...replayed]
    .map((candidate) => ({ attempt: candidate.attempt, geometryHash: candidate.geometryHash }))
    .sort((a, b) => a.attempt - b.attempt);
  if (expected.length !== actual.length) {
    return { ok: false, message: `viable count ${actual.length} does not match generation-time ${expected.length}` };
  }
  for (let index = 0; index < expected.length; index++) {
    if (expected[index].attempt !== actual[index].attempt || expected[index].geometryHash !== actual[index].geometryHash) {
      return {
        ok: false,
        message: `candidate mismatch at viable index ${index}: ` +
          `expected a${expected[index].attempt}/${expected[index].geometryHash.slice(0, 12)}, ` +
          `got a${actual[index].attempt}/${actual[index].geometryHash.slice(0, 12)}`,
      };
    }
  }
  return { ok: true, message: "sample attempts and geometry hashes match generation-time raw-normal pool" };
}

function checkpointGapIndices(gaps: readonly Gap[]): Map<number, Captured["checkpoint"]> {
  const contactIndices = gaps.filter((gap) => gap.endsWithContact).map((gap) => gap.index);
  if (contactIndices.length < 3) throw new Error("frozen source has fewer than three contact gaps");
  const first = contactIndices[Math.floor((contactIndices.length - 1) / 3)];
  const second = contactIndices[Math.floor((2 * (contactIndices.length - 1)) / 3)];
  if (first === undefined || second === undefined || first === second) {
    throw new Error("unable to derive distinct one-third/two-thirds checkpoint gaps");
  }
  return new Map([[first, "one_third"], [second, "two_thirds"]]);
}

type Setup = { gaps: Gap[]; ctx: SpecContext };
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
  const impactByFrame = new Map(spec.contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const],
  ));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    if (!gaps[index].endsWithContact) continue;
    const next = gaps[index + 1];
    if (next.endsWithContact && next.targets.impact !== undefined) gaps[index].nextImpact = next.targets.impact;
  }
  return { gaps, ctx: { allContactFrames, durationFrames: secToFrame(spec.duration), gapAxisTargets } };
}

function geometryHash(candidate: Candidate): string {
  return createHash("sha256").update(JSON.stringify(candidate.lines.map((line) => [
    round(line.x1), round(line.y1), round(line.x2), round(line.y2),
  ]))).digest("hex");
}

function summarize(rows: readonly Row[]) {
  const usable = rows.filter((row) =>
    row.replayEquivalent === true && row.deltas !== null && row.contactFrame?.velocitySource ===
      (zeroFrictionAverage ? "zero_friction_average" : "contact_point_velocity")
  );
  const byRegime = Object.fromEntries([...new Set(ACTIVE_CASES.map((entry) => entry.regime))].map((regime) => {
    const regimeRows = usable.filter((row) => row.regime === regime);
    return [regime, summarizeRows(regimeRows)];
  }));
  const regimeSummaries = Object.values(byRegime) as ReturnType<typeof summarizeRows>[];
  return {
    declaredRows: rows.length,
    captureAvailable: rows.filter((row) => row.captureAvailable).length,
    replayEquivalent: rows.filter((row) => row.replayEquivalent === true).length,
    replayFailures: rows.filter((row) => row.replayEquivalent === false).length,
    pointVelocityRows: rows.filter((row) => row.contactFrame?.velocitySource === "contact_point_velocity").length,
    zeroFrictionAverageRows: rows.filter((row) => row.contactFrame?.velocitySource === "zero_friction_average").length,
    comFallbackRows: rows.filter((row) => row.contactFrame?.velocitySource === "rider_com_fallback").length,
    usableRows: usable.length,
    byRegime,
    regimeBalanced: {
      viableDelta: mean(regimeSummaries.map((row) => row.viableDelta).filter(isFiniteNumber)),
      bestAxisRmsImprovement: mean(regimeSummaries.map((row) => row.bestAxisRmsImprovement).filter(isFiniteNumber)),
      bestQualityObjectiveImprovement: mean(regimeSummaries.map((row) => row.bestQualityObjectiveImprovement).filter(isFiniteNumber)),
      bestCostImprovement: mean(regimeSummaries.map((row) => row.bestCostImprovement).filter(isFiniteNumber)),
    },
  };
}

function signedAngleDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta <= -180) delta += 360;
  if (delta > 180) delta -= 360;
  return delta;
}

function summarizeRows(rows: readonly Row[]) {
  return {
    rows: rows.length,
    viableDelta: mean(rows.map((row) => row.deltas!.viable)),
    bestAxisRmsImprovement: mean(rows.map((row) => row.deltas!.bestAxisRms).filter(isFiniteNumber)),
    bestQualityObjectiveImprovement: mean(rows.map((row) => row.deltas!.bestQualityObjective).filter(isFiniteNumber)),
    bestCostImprovement: mean(rows.map((row) => row.deltas!.bestCost).filter(isFiniteNumber)),
  };
}

function pairedImprovement(production: number | null, contactPoint: number | null, higherIsBetter: boolean): number | null {
  if (production === null || contactPoint === null) return null;
  return round(higherIsBetter ? contactPoint - production : production - contactPoint);
}

function minOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(Math.min(...values));
}
function maxOrNull(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(Math.max(...values));
}
function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function nullableRound(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : round(value);
}
function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}
function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
