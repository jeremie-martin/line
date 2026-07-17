/**
 * Frozen observation-only comparison of the ordinary normal sampler's
 * geometry frame. The production arm uses the existing lowest-sled-point
 * anchor plus rider COM tangent; comparators keep that anchor and exact
 * evaluator but supply either the velocity of the same lowest point or the
 * aggregate velocity of the three zero-friction sled points, transport the
 * existing post-contact tangent field with the full four-point rigid sled
 * velocity field, or reparameterize that tangent field by full-sled
 * gravity-time, or densify its existing turn in the scored six-frame
 * full-sled response window.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --out=generated/studies/contact-point-normal-frame/v1/result.json
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --zero-friction-average --batch=0 \
 *     --out=generated/studies/zero-friction-average-normal-frame/v1/batch-0.json
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --co-rotating-contact-field --batch=0 \
 *     --out=generated/studies/co-rotating-contact-field-normal-pool/v1/batch-0.json
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --full-sled-gravity-time-field --batch=0 \
 *     --out=generated/studies/full-sled-gravity-time-field-normal-pool/v1/batch-0.json
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --full-sled-windowed-redirection-field --batch=0 \
 *     --out=generated/studies/full-sled-windowed-redirection-field-normal-pool/v1/batch-0.json
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_contact_point_normal_frame.ts \
 *     --full-sled-affine-contact-flow-field --batch=0 \
 *     --out=generated/studies/full-sled-affine-contact-flow-field-normal-pool/v1/batch-0.json
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
  wasLastGeometryImpactTemplate,
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
import { realizeCoRotatingContactField } from "./trajectory/co_rotating_contact_field.ts";
import { realizeFullSledGravityTimeField } from "./trajectory/full_sled_gravity_time_field.ts";
import { realizeFullSledWindowedRedirectionField } from "./trajectory/full_sled_windowed_redirection_field.ts";
import { realizeAffineContactFlowField, type AffineContactFlowPoint } from "./trajectory/affine_contact_flow_field.ts";
import { extractPlanningState, type PlanningState } from "./trajectory/state.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(
    "Usage: study_contact_point_normal_frame.ts [--zero-friction-average|--co-rotating-contact-field|--full-sled-gravity-time-field|--full-sled-windowed-redirection-field|--full-sled-affine-contact-flow-field --batch=0|1|2] [--out=PATH]\n",
  );
  process.exit(0);
}
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outPath = arg("out");
const zeroFrictionAverage = argv.includes("--zero-friction-average");
const coRotatingContactField = argv.includes("--co-rotating-contact-field");
const fullSledGravityTimeField = argv.includes("--full-sled-gravity-time-field");
const fullSledWindowedRedirectionField = argv.includes("--full-sled-windowed-redirection-field");
const fullSledAffineContactFlowField = argv.includes("--full-sled-affine-contact-flow-field");
const batchArgument = arg("batch");
const batch = batchArgument === undefined ? undefined : Number(batchArgument);
const unknownArgs = argv.filter((value) =>
  value !== "--zero-friction-average" && value !== "--co-rotating-contact-field" && value !== "--full-sled-gravity-time-field" && value !== "--full-sled-windowed-redirection-field" && value !== "--full-sled-affine-contact-flow-field" && !value.startsWith("--out=") && !value.startsWith("--batch=")
);
if (unknownArgs.length > 0) throw new Error(`unknown argument(s): ${unknownArgs.join(", ")}`);
if ([zeroFrictionAverage, coRotatingContactField, fullSledGravityTimeField, fullSledWindowedRedirectionField, fullSledAffineContactFlowField].filter(Boolean).length > 1) throw new Error("normal-pool comparator modes are mutually exclusive");
if (!zeroFrictionAverage && !coRotatingContactField && !fullSledGravityTimeField && !fullSledWindowedRedirectionField && !fullSledAffineContactFlowField && batch !== undefined) throw new Error("--batch is reserved for an experimental comparator");
if ((zeroFrictionAverage || coRotatingContactField || fullSledGravityTimeField || fullSledWindowedRedirectionField || fullSledAffineContactFlowField) && (batch === undefined || !Number.isSafeInteger(batch) || batch < 0 || batch > 2)) {
  throw new Error("experimental comparators require --batch=0|1|2");
}

const BUDGET = 500_000;
const CONTACT_POINT_SEEDS = [26, 27] as const;
const ZERO_FRICTION_AVERAGE_SEEDS = [48, 49] as const;
const CO_ROTATING_CONTACT_FIELD_SEEDS = [50, 51] as const;
const FULL_SLED_GRAVITY_TIME_FIELD_SEEDS = [52, 53] as const;
const FULL_SLED_WINDOWED_REDIRECTION_FIELD_SEEDS = [54, 55] as const;
const FULL_SLED_AFFINE_CONTACT_FLOW_FIELD_SEEDS = [58, 59] as const;
const SEEDS = fullSledAffineContactFlowField
  ? FULL_SLED_AFFINE_CONTACT_FLOW_FIELD_SEEDS
  : fullSledWindowedRedirectionField
  ? FULL_SLED_WINDOWED_REDIRECTION_FIELD_SEEDS
  : fullSledGravityTimeField
  ? FULL_SLED_GRAVITY_TIME_FIELD_SEEDS
  : coRotatingContactField
  ? CO_ROTATING_CONTACT_FIELD_SEEDS
  : zeroFrictionAverage ? ZERO_FRICTION_AVERAGE_SEEDS : CONTACT_POINT_SEEDS;
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
const CO_ROTATING_CONTACT_FIELD_CASES = [
  { id: "frontier_dense_recovery_240ms_figures", regime: "dense" },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense" },
  { id: "rising_switch", regime: "representative" },
  { id: "pickup_lattice_speed_minus_4", regime: "pickup" },
  { id: "frontier_low_air_endurance_7s", regime: "low_air" },
  { id: "believer_56_6s_impact_relief", regime: "development_music" },
] as const;
const FULL_SLED_GRAVITY_TIME_FIELD_CASES = [
  { id: "frontier_dense_recovery_240ms_figures", regime: "dense" },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense" },
  { id: "rising_switch", regime: "representative" },
  { id: "pickup_lattice_speed_minus_4", regime: "pickup" },
  { id: "frontier_low_air_endurance_7s", regime: "low_air" },
  { id: "believer_56_6s_impact_relief", regime: "development_music" },
] as const;
const FULL_SLED_WINDOWED_REDIRECTION_FIELD_CASES = [
  { id: "frontier_dense_recovery_240ms_figures", regime: "dense" },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense" },
  { id: "rising_switch", regime: "representative" },
  { id: "pickup_lattice_speed_minus_4", regime: "pickup" },
  { id: "frontier_low_air_endurance_7s", regime: "low_air" },
  { id: "believer_56_6s_impact_relief", regime: "development_music" },
] as const;
const FULL_SLED_AFFINE_CONTACT_FLOW_FIELD_CASES = [
  { id: "frontier_dense_recovery_240ms_figures", regime: "dense" },
  { id: "dense_dialogue_impact_contrast_10", regime: "dense" },
  { id: "rising_switch", regime: "representative" },
  { id: "pickup_lattice_speed_minus_4", regime: "pickup" },
  { id: "frontier_low_air_endurance_7s", regime: "low_air" },
  { id: "believer_56_6s_impact_relief", regime: "development_music" },
] as const;
const CASES = fullSledAffineContactFlowField
  ? FULL_SLED_AFFINE_CONTACT_FLOW_FIELD_CASES
  : fullSledWindowedRedirectionField
  ? FULL_SLED_WINDOWED_REDIRECTION_FIELD_CASES
  : fullSledGravityTimeField
  ? FULL_SLED_GRAVITY_TIME_FIELD_CASES
  : coRotatingContactField
  ? CO_ROTATING_CONTACT_FIELD_CASES
  : zeroFrictionAverage ? ZERO_FRICTION_AVERAGE_CASES : CONTACT_POINT_CASES;
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
type CoRotatingFieldTelemetry = {
  stateAvailable: boolean;
  templatesSkipped: number;
  transformed: number;
  unavailable: Record<string, number>;
  meanAbsTerminalRotationDeg: number | null;
  maxAbsTerminalRotationDeg: number | null;
};
type FullSledGravityTimeFieldTelemetry = {
  stateAvailable: boolean;
  templatesSkipped: number;
  transformed: number;
  unavailable: Record<string, number>;
  meanAbsTangentShiftDeg: number | null;
  maxAbsTangentShiftDeg: number | null;
};
type FullSledWindowedRedirectionFieldTelemetry = {
  stateAvailable: boolean;
  templatesSkipped: number;
  transformed: number;
  unavailable: Record<string, number>;
  meanAbsTangentShiftDeg: number | null;
  maxAbsTangentShiftDeg: number | null;
  meanAbsRawTurnDeg: number | null;
};
type FullSledAffineContactFlowFieldTelemetry = {
  stateAvailable: boolean;
  templatesSkipped: number;
  transformed: number;
  unavailable: Record<string, number>;
  meanTerminalDisplacementPx: number | null;
  maxTerminalDisplacementPx: number | null;
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
  coRotatingContactField: CoRotatingFieldTelemetry | null;
  fullSledGravityTimeField: FullSledGravityTimeFieldTelemetry | null;
  fullSledWindowedRedirectionField: FullSledWindowedRedirectionFieldTelemetry | null;
  fullSledAffineContactFlowField: FullSledAffineContactFlowFieldTelemetry | null;
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
  schema: fullSledAffineContactFlowField
    ? "line.study-full-sled-affine-contact-flow-field-normal-pool.v1"
    : fullSledWindowedRedirectionField
    ? "line.study-full-sled-windowed-redirection-field-normal-pool.v1"
    : fullSledGravityTimeField
    ? "line.study-full-sled-gravity-time-field-normal-pool.v1"
    : coRotatingContactField
    ? "line.study-co-rotating-contact-field-normal-pool.v1"
    : zeroFrictionAverage
    ? "line.study-zero-friction-average-normal-frame.v1"
    : "line.study-contact-point-normal-frame.v1",
  purpose: [
    "observation-only replay of ordinary normal candidate pools from immutable frontier states",
    fullSledAffineContactFlowField
      ? "same PRNG coordinates, attempts, raw curve prefix, segment count, line flags, exact gates, and scorer; only each raw curve's locus is transported under the four-point affine velocity flow in its existing arclength-time"
      : fullSledWindowedRedirectionField
      ? "same PRNG coordinates, attempts, raw curve prefix, segment count, lengths, terminal tangent, line flags, exact gates, and scorer; only the raw post-contact turn timing is densified into the physical six-frame full-sled response distance"
      : fullSledGravityTimeField
      ? "same PRNG coordinates, attempts, raw curve prefix, segment count, lengths, tangent range, line flags, exact gates, and scorer; only the existing post-contact tangent field is reparameterized by full-sled collective gravity-time"
      : coRotatingContactField
      ? "same PRNG coordinates, attempts, raw curve prefix, segment count, lengths, line flags, exact gates, and scorer; only the post-contact tangent field is transported by the four-point rigid sled angular velocity over gravity-time traversal"
      : zeroFrictionAverage
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
    frame: fullSledAffineContactFlowField
      ? "the exact mean PEG/TAIL/NOSE/STRING velocity gives arclength-time, and their centered positions/velocities give one least-squares affine velocity gradient; the raw first endpoint stays fixed while later vertices follow exp(A*s/|meanVelocity|)"
      : fullSledWindowedRedirectionField
      ? "the exact mean PEG/TAIL/NOSE/STRING velocity defines the six-frame physical response distance; each non-template raw post curve retains its existing signed total turn but completes it by that distance"
      : fullSledGravityTimeField
      ? "the exact mean velocity of PEG/TAIL/NOSE/STRING and gravity define a continuous clock for each raw post-contact curve; its existing tangent field is sampled at physical time fraction rather than arclength fraction"
      : coRotatingContactField
      ? "four native PEG/TAIL/NOSE/STRING positions and velocities define one least-squares rigid translation-plus-rotation field; every non-template raw post-contact segment retains its length and receives its unique angular transport at its gravity-time start"
      : zeroFrictionAverage
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
  const frame = coRotatingContactField || fullSledGravityTimeField || fullSledWindowedRedirectionField || fullSledAffineContactFlowField ? null : readContactFrame(captured.node.search.prefixEngine, gap, setup.ctx);
  const coRotating = coRotatingContactField
    ? sampleCoRotatingContactFieldArm(captured.node, gap, setup.ctx, setup.gaps, count, rngSeed)
    : null;
  const gravityTime = fullSledGravityTimeField
    ? sampleFullSledGravityTimeFieldArm(captured.node, gap, setup.ctx, setup.gaps, count, rngSeed)
    : null;
  const windowedRedirection = fullSledWindowedRedirectionField
    ? sampleFullSledWindowedRedirectionFieldArm(captured.node, gap, setup.ctx, setup.gaps, count, rngSeed)
    : null;
  const affineContactFlow = fullSledAffineContactFlowField
    ? sampleFullSledAffineContactFlowFieldArm(captured.node, gap, setup.ctx, setup.gaps, count, rngSeed)
    : null;
  const contactPoint = coRotating === null && gravityTime === null && windowedRedirection === null && affineContactFlow === null
    ? sampleContactPointArm(captured.node, gap, setup.ctx, setup.gaps, count, rngSeed, frame!.targetState)
    : coRotating?.arm ?? gravityTime?.arm ?? windowedRedirection?.arm ?? affineContactFlow!.arm;
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
    contactFrame: frame === null ? null : { anchor: frame.anchor, velocitySource: frame.velocitySource, frameShiftDeg: frame.frameShiftDeg },
    coRotatingContactField: coRotating?.telemetry ?? null,
    fullSledGravityTimeField: gravityTime?.telemetry ?? null,
    fullSledWindowedRedirectionField: windowedRedirection?.telemetry ?? null,
    fullSledAffineContactFlowField: affineContactFlow?.telemetry ?? null,
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
    coRotatingContactField: null,
    fullSledGravityTimeField: null,
    fullSledWindowedRedirectionField: null,
    fullSledAffineContactFlowField: null,
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

function sampleCoRotatingContactFieldArm(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): { arm: ArmSummary; telemetry: CoRotatingFieldTelemetry } {
  const state = extractPlanningState(node.search.prefixEngine, gap.endFrame);
  const unavailable: Record<string, number> = {};
  let templatesSkipped = 0;
  let transformed = 0;
  const rotations: number[] = [];
  const rng = makeRng(seed);
  const candidates: CandidateDigest[] = [];
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  for (let attempt = 0; attempt < count; attempt++) {
    const raw = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    let geometry = raw;
    if (wasLastGeometryImpactTemplate()) {
      templatesSkipped++;
    } else if (state === null) {
      unavailable.missing_planning_state = (unavailable.missing_planning_state ?? 0) + 1;
    } else {
      const transported = realizeCoRotatingContactField(raw.lines, state, {
        x: probe.targetState.sledX,
        y: probe.targetState.sledY,
      });
      if (transported.status !== "ready") {
        unavailable[transported.reason] = (unavailable[transported.reason] ?? 0) + 1;
      } else {
        geometry = { ...raw, lines: transported.lines };
        transformed++;
        rotations.push(Math.abs(transported.travel.terminalRotationDeg));
      }
    }
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digestCandidate(fit, node, gap, gaps, ctx));
    }
  }
  return {
    arm: summarizeArm(count, candidates),
    telemetry: {
      stateAvailable: state !== null,
      templatesSkipped,
      transformed,
      unavailable,
      meanAbsTerminalRotationDeg: mean(rotations),
      maxAbsTerminalRotationDeg: rotations.length === 0 ? null : round(Math.max(...rotations)),
    },
  };
}

function sampleFullSledGravityTimeFieldArm(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): { arm: ArmSummary; telemetry: FullSledGravityTimeFieldTelemetry } {
  const state = extractPlanningState(node.search.prefixEngine, gap.endFrame);
  const unavailable: Record<string, number> = {};
  let templatesSkipped = 0;
  let transformed = 0;
  const shifts: number[] = [];
  const maxShifts: number[] = [];
  const rng = makeRng(seed);
  const candidates: CandidateDigest[] = [];
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  for (let attempt = 0; attempt < count; attempt++) {
    const raw = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    let geometry = raw;
    if (wasLastGeometryImpactTemplate()) {
      templatesSkipped++;
    } else if (state === null) {
      unavailable.missing_planning_state = (unavailable.missing_planning_state ?? 0) + 1;
    } else {
      const reparameterized = realizeFullSledGravityTimeField(raw.lines, state, {
        x: probe.targetState.sledX,
        y: probe.targetState.sledY,
      });
      if (reparameterized.status !== "ready") {
        unavailable[reparameterized.reason] = (unavailable[reparameterized.reason] ?? 0) + 1;
      } else {
        geometry = { ...raw, lines: reparameterized.lines };
        transformed++;
        shifts.push(reparameterized.travel.meanAbsTangentShiftDeg);
        maxShifts.push(reparameterized.travel.maxAbsTangentShiftDeg);
      }
    }
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digestCandidate(fit, node, gap, gaps, ctx));
    }
  }
  return {
    arm: summarizeArm(count, candidates),
    telemetry: {
      stateAvailable: state !== null,
      templatesSkipped,
      transformed,
      unavailable,
      meanAbsTangentShiftDeg: mean(shifts),
      maxAbsTangentShiftDeg: maxShifts.length === 0 ? null : round(Math.max(...maxShifts)),
    },
  };
}

function sampleFullSledWindowedRedirectionFieldArm(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): { arm: ArmSummary; telemetry: FullSledWindowedRedirectionFieldTelemetry } {
  const state = extractPlanningState(node.search.prefixEngine, gap.endFrame);
  const unavailable: Record<string, number> = {};
  let templatesSkipped = 0;
  let transformed = 0;
  const shifts: number[] = [];
  const maxShifts: number[] = [];
  const turns: number[] = [];
  const rng = makeRng(seed);
  const candidates: CandidateDigest[] = [];
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  for (let attempt = 0; attempt < count; attempt++) {
    const raw = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    let geometry = raw;
    if (wasLastGeometryImpactTemplate()) {
      templatesSkipped++;
    } else if (state === null) {
      unavailable.missing_planning_state = (unavailable.missing_planning_state ?? 0) + 1;
    } else {
      const redirection = realizeFullSledWindowedRedirectionField(raw.lines, state, {
        x: probe.targetState.sledX,
        y: probe.targetState.sledY,
      });
      if (redirection.status !== "ready") {
        unavailable[redirection.reason] = (unavailable[redirection.reason] ?? 0) + 1;
      } else {
        geometry = { ...raw, lines: redirection.lines };
        transformed++;
        shifts.push(redirection.field.meanAbsTangentShiftDeg);
        maxShifts.push(redirection.field.maxAbsTangentShiftDeg);
        turns.push(Math.abs(redirection.field.rawTurnDeg));
      }
    }
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digestCandidate(fit, node, gap, gaps, ctx));
    }
  }
  return {
    arm: summarizeArm(count, candidates),
    telemetry: {
      stateAvailable: state !== null,
      templatesSkipped,
      transformed,
      unavailable,
      meanAbsTangentShiftDeg: mean(shifts),
      maxAbsTangentShiftDeg: maxShifts.length === 0 ? null : round(Math.max(...maxShifts)),
      meanAbsRawTurnDeg: mean(turns),
    },
  };
}

function sampleFullSledAffineContactFlowFieldArm(
  node: HandoffNode,
  gap: Gap,
  ctx: SpecContext,
  gaps: Gap[],
  count: number,
  seed: number,
): { arm: ArmSummary; telemetry: FullSledAffineContactFlowFieldTelemetry } {
  const state = extractPlanningState(node.search.prefixEngine, gap.endFrame);
  const points = state === null ? null : affineContactFlowPoints(state);
  const unavailable: Record<string, number> = {};
  let templatesSkipped = 0;
  let transformed = 0;
  const terminalDisplacements: number[] = [];
  const rng = makeRng(seed);
  const candidates: CandidateDigest[] = [];
  const probe = getCandidateProbe(node.search.prefixEngine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  for (let attempt = 0; attempt < count; attempt++) {
    const raw = sampleArcPlacementGeometry(
      rng, probe.refX, probe.refY, gap.targets, probe.targetState, attempt, gap,
      node.search.prefixNextLineId, "normal", ctx.allContactFrames,
    );
    let geometry = raw;
    if (wasLastGeometryImpactTemplate()) {
      templatesSkipped++;
    } else if (points === null) {
      unavailable.missing_full_sled_state = (unavailable.missing_full_sled_state ?? 0) + 1;
    } else {
      const flowed = realizeAffineContactFlowField(raw.lines, points);
      if (flowed.status !== "ready") {
        unavailable[flowed.reason] = (unavailable[flowed.reason] ?? 0) + 1;
      } else {
        geometry = { ...raw, lines: flowed.lines };
        transformed++;
        terminalDisplacements.push(flowed.terminalDisplacementPx);
      }
    }
    const fit = tryCandidateGeometry(
      node.search.prefixEngine, gap, geometry, node.search.prefixNextLineId,
      ctx.allContactFrames, axisMeasureEnd, gap.targets, true, "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit !== null) {
      fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      fit.sampleAttempt = attempt;
      candidates.push(digestCandidate(fit, node, gap, gaps, ctx));
    }
  }
  return {
    arm: summarizeArm(count, candidates),
    telemetry: {
      stateAvailable: points !== null,
      templatesSkipped,
      transformed,
      unavailable,
      meanTerminalDisplacementPx: mean(terminalDisplacements),
      maxTerminalDisplacementPx: terminalDisplacements.length === 0 ? null : round(Math.max(...terminalDisplacements)),
    },
  };
}

function affineContactFlowPoints(state: PlanningState): AffineContactFlowPoint[] | null {
  const points = SLED_POINT_ORDER.map((name) => state.points[name]);
  if (points.some((point) => point === undefined || point.velocity === null)) return null;
  return points.map((point) => ({
    position: { ...point!.position },
    velocity: { ...point!.velocity! },
  }));
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
    row.replayEquivalent === true && row.deltas !== null && (
      fullSledAffineContactFlowField
        ? (row.fullSledAffineContactFlowField?.transformed ?? 0) > 0
        : fullSledWindowedRedirectionField
        ? (row.fullSledWindowedRedirectionField?.transformed ?? 0) > 0
        : fullSledGravityTimeField
        ? (row.fullSledGravityTimeField?.transformed ?? 0) > 0
        : coRotatingContactField
        ? (row.coRotatingContactField?.transformed ?? 0) > 0
        : row.contactFrame?.velocitySource === (zeroFrictionAverage ? "zero_friction_average" : "contact_point_velocity")
    )
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
    coRotatingStateRows: rows.filter((row) => row.coRotatingContactField?.stateAvailable === true).length,
    coRotatingTransformedGeometries: rows.reduce((sum, row) => sum + (row.coRotatingContactField?.transformed ?? 0), 0),
    coRotatingTemplateSkips: rows.reduce((sum, row) => sum + (row.coRotatingContactField?.templatesSkipped ?? 0), 0),
    fullSledGravityTimeStateRows: rows.filter((row) => row.fullSledGravityTimeField?.stateAvailable === true).length,
    fullSledGravityTimeTransformedGeometries: rows.reduce((sum, row) => sum + (row.fullSledGravityTimeField?.transformed ?? 0), 0),
    fullSledGravityTimeTemplateSkips: rows.reduce((sum, row) => sum + (row.fullSledGravityTimeField?.templatesSkipped ?? 0), 0),
    fullSledWindowedRedirectionStateRows: rows.filter((row) => row.fullSledWindowedRedirectionField?.stateAvailable === true).length,
    fullSledWindowedRedirectionTransformedGeometries: rows.reduce((sum, row) => sum + (row.fullSledWindowedRedirectionField?.transformed ?? 0), 0),
    fullSledWindowedRedirectionTemplateSkips: rows.reduce((sum, row) => sum + (row.fullSledWindowedRedirectionField?.templatesSkipped ?? 0), 0),
    fullSledAffineContactFlowStateRows: rows.filter((row) => row.fullSledAffineContactFlowField?.stateAvailable === true).length,
    fullSledAffineContactFlowTransformedGeometries: rows.reduce((sum, row) => sum + (row.fullSledAffineContactFlowField?.transformed ?? 0), 0),
    fullSledAffineContactFlowTemplateSkips: rows.reduce((sum, row) => sum + (row.fullSledAffineContactFlowField?.templatesSkipped ?? 0), 0),
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
