/**
 * Declarative arc-control configuration matrix (V2-native, read-only).
 *
 * This is a hypothesis-generating laboratory, not a compiler score or a
 * promotion mechanism.  It evaluates a direct Cartesian product of:
 *
 *   ordered knob sequence × model-training method × probe layout
 *
 * on frozen ordinary compiler states.  The generator does not name physical
 * knobs in a method: a sequential method simply trains the first knob in a
 * sequence, materializes that prefix, then trains the next.  Raw per-probe
 * outputs, geometry hashes, model forms, selected values, and exact admission
 * are retained in the JSON artifact so every summary can be re-derived.
 *
 * Usage (small smoke):
 *   npm run study:arc-control-matrix -- --specs=frontier_dense_recovery,frontier_pickup_progression \
 *     --seeds=0 --max-gaps=1 --out=generated/studies/arc-control-matrix-v1/smoke.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "./core/candidate.ts";
import { effectiveAxes, engineLineFromTrackLine, makeBaseEngine, sampleGapTargets, sliceTimeline } from "./core/substrate.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  fitJointArcResponseModel,
  jointArcCurrentScoreAxes,
  predictJointArcOutputs,
  predictJointArcScoreReadout,
  type ArcKnobs,
  type JointArcProbeRow,
  type JointArcResponseModel,
} from "./optimizer/arc_model.ts";
import {
  enumerateArcControlConfigurations,
  plannedArcControlProbeCount,
  type ArcControlConfiguration,
  type ArcTrainingMethod,
} from "./optimizer/arc_control.ts";
import {
  applyArcKnobSequence,
  arcKnobProbeSpan,
  arcKnobProposalSeparation,
  arcKnobScanStep,
  arcKnobSequenceNeedsContactPoint,
  getArcKnob,
  type ArcActuatorContext,
  type ArcKnobId,
} from "./optimizer/arc_actuator.ts";
import { evaluateJointArcLines, type JointArcProbeObservation } from "./optimizer/arc_probe.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { extendNodeCached, makeRootNode, type SearchNode } from "./optimizer/node.ts";
import { nextGapFrameCount, predictedNextGapAir, scoreGapObjectiveWithCurrentQuality } from "./optimizer/objective.ts";
import { isStrictlyBetter, type LeafKey } from "./optimizer/register.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./optimizer/sample.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type TrackLine } from "./types.ts";
import type { Spec } from "./optimizer/types.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg("specs") ?? "frontier_dense_recovery,frontier_dense_recovery_240ms_figures,frontier_pickup_progression,frontier_low_air_endurance,dense_dialogue,believer_56_6s")
  .split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "0,1").split(",").filter(Boolean).map(Number);
const budget = Number(arg("budget") ?? "300000");
const maxGaps = Number(arg("max-gaps") ?? "4");
const probeMode = arg("probe-mode") ?? "short";
const knobIds = (arg("knobs") ?? "whole_rotation,tail_pitch")
  .split(",").filter(Boolean) as ArcKnobId[];
const maxKnobs = Number(arg("max-knobs") ?? "2");
const requestedMethods = arg("methods")?.split(",").filter(Boolean) as ArcTrainingMethod[] | undefined;
const allowRepeated = arg("allow-repeated") === "1";
const outPath = arg("out");

if (!Number.isInteger(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
if (!Number.isInteger(maxGaps) || maxGaps <= 0) throw new Error(`invalid --max-gaps=${maxGaps}`);
if (!Number.isInteger(maxKnobs) || maxKnobs < 1 || maxKnobs > 2) {
  throw new Error(`this first generic matrix executor supports --max-knobs=1|2 (got ${maxKnobs})`);
}
if (probeMode !== "short" && probeMode !== "full") throw new Error(`invalid --probe-mode=${probeMode}`);
for (const id of knobIds) getArcKnob(id);
const cases = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const));
for (const id of ids) if (!cases.has(id)) throw new Error(`unknown V2 development case "${id}"`);
const configurations = enumerateArcControlConfigurations({
  knobs: knobIds,
  maxKnobs,
  ...(allowRepeated ? { allowRepeated: true } : {}),
  ...(requestedMethods === undefined ? {} : { trainingMethods: requestedMethods }),
});

type Setup = { gaps: Gap[]; ctx: SpecContext };
type VectorCandidate = { values: number[]; value: number };
type ProbeTrace = {
  stage: number;
  appliedSequence: ArcKnobId[];
  appliedValues: number[];
  geometryHash: string;
  gate: JointArcProbeObservation["gate"];
  outputs: Record<string, number>;
  latentOutputs?: Record<string, number>;
};
type StageTrace = {
  stage: number;
  knob: ArcKnobId;
  prefixValues: number[];
  modelFormCounts: Record<string, number>;
  probes: ProbeTrace[];
  selectedValue: number;
};
type MatrixRow = {
  configurationId: string;
  sourceId: string;
  seed: number;
  gapIndex: number;
  plannedProbeCount: number;
  actualProbeCount: number;
  stages: StageTrace[];
  offered: Array<{ values: number[]; geometryHash: string; predictedValue: number; admitted: boolean }>;
  emitted: number;
  invariantChecks: {
    selectedWithinDeclaredSpan: boolean;
    plannedProbeCountMatched: boolean;
  };
};

function prepare(userSpec: Spec, seed: number): Setup {
  const contacts = userSpec.contacts.filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING);
  const spec = { ...userSpec, preroll: undefined, contacts };
  const durationFrames = secToFrame(spec.duration);
  const frames = contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(frames, durationFrames);
  const targets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(targets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(contacts.flatMap((contact) => contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const]));
  for (const gap of gaps) {
    const impact = gap.endsWithContact ? impactByFrame.get(gap.endFrame) : undefined;
    if (impact !== undefined) { gap.targets.impact = impact; targets[gap.index].impact = impact; }
  }
  return { gaps, ctx: { allContactFrames: frames, durationFrames, gapAxisTargets: targets } };
}

function initialEntry(node: HandoffNode, gaps: Gap[]): SearchNode {
  let engine = makeBaseEngine(node.startState);
  if (node.startLines.length > 0) engine = engine.addLine(node.startLines.map(engineLineFromTrackLine));
  return { ...makeRootNode(engine, gaps.length), prefixNextLineId: 1 + node.startLines.length };
}

function geometryHash(lines: readonly TrackLine[]): string {
  return createHash("sha256").update(JSON.stringify(lines.map((line) => [line.x1, line.y1, line.x2, line.y2]))).digest("hex");
}

function toTwoCoordinate(values: readonly number[]): ArcKnobs {
  return { rotateDeg: values[0] ?? 0, pitchDeg: values[1] ?? 0 };
}

function toScalarCoordinate(value: number): ArcKnobs {
  return { pitchDeg: value, rotateDeg: 0 };
}

function modelRows(rows: readonly JointArcProbeObservation[], coordinate: (row: JointArcProbeObservation) => ArcKnobs): JointArcProbeRow[] {
  return rows.map((row) => ({
    knobs: coordinate(row),
    outputs: row.outputs,
    ...(row.latentOutputs === undefined ? {} : { latentOutputs: row.latentOutputs }),
  }));
}

function modelFormCounts(model: JointArcResponseModel): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const fitted of [...model.outputModels.values(), ...model.latentModels.values()]) {
    const form = fitted.model.form;
    counts[form] = (counts[form] ?? 0) + 1;
  }
  return counts;
}

function score(model: JointArcResponseModel, knobs: ArcKnobs, current: AxisValues, next: AxisValues, nextGap: Gap): number | null {
  const readout = predictJointArcScoreReadout(model, knobs, current, jointArcCurrentScoreAxes(current));
  if (Number.isFinite(readout.exitFrame) && readout.exitFrame > nextGap.endFrame) return null;
  if (readout.state === null) return null;
  const arrival = { ...readout.state };
  if (Number.isFinite(readout.exitSpeed) && Number.isFinite(readout.state.speed)) {
    arrival.meanSpeed = (readout.exitSpeed + readout.state.speed) / 2;
  }
  if (Number.isFinite(readout.exitFrame)) {
    arrival.nextAir = predictedNextGapAir(readout.exitFrame, nextGap);
    arrival.nextGapFrames = nextGapFrameCount(nextGap);
  }
  return scoreGapObjectiveWithCurrentQuality(readout.currentQuality, arrival, next)?.value ?? null;
}

function scanScalar(
  model: JointArcResponseModel,
  span: number,
  step: number,
  current: AxisValues,
  next: AxisValues,
  nextGap: Gap,
): VectorCandidate[] {
  const base = score(model, toScalarCoordinate(0), current, next, nextGap);
  if (base === null) return [];
  const out: VectorCandidate[] = [];
  for (let value = -span; value <= span + 1e-9; value += step) {
    if (Math.abs(value) < step / 2) continue;
    const predicted = score(model, toScalarCoordinate(value), current, next, nextGap);
    if (predicted !== null && predicted > base + 1e-4) out.push({ values: [value], value: predicted });
  }
  return out;
}

function scanTwo(
  model: JointArcResponseModel,
  configuration: ArcControlConfiguration,
  current: AxisValues,
  next: AxisValues,
  nextGap: Gap,
): VectorCandidate[] {
  const [first, second] = configuration.sequence;
  const firstSpan = arcKnobProbeSpan(first);
  const secondSpan = arcKnobProbeSpan(second);
  const firstStep = arcKnobScanStep(first);
  const secondStep = arcKnobScanStep(second);
  const base = score(model, toTwoCoordinate([0, 0]), current, next, nextGap);
  if (base === null) return [];
  const out: VectorCandidate[] = [];
  for (let firstValue = -firstSpan; firstValue <= firstSpan + 1e-9; firstValue += firstStep) {
    for (let secondValue = -secondSpan; secondValue <= secondSpan + 1e-9; secondValue += secondStep) {
      if (Math.abs(firstValue) < firstStep / 2 && Math.abs(secondValue) < secondStep / 2) continue;
      const predicted = score(model, toTwoCoordinate([firstValue, secondValue]), current, next, nextGap);
      if (predicted !== null && predicted > base + 1e-4) out.push({ values: [firstValue, secondValue], value: predicted });
    }
  }
  return out;
}

function choose(configuration: ArcControlConfiguration, candidates: VectorCandidate[]): VectorCandidate[] {
  const out: VectorCandidate[] = [];
  const sequence = configuration.sequence;
  for (const candidate of candidates.sort((a, b) => b.value - a.value || candidateMagnitude(a) - candidateMagnitude(b))) {
    const distinct = out.every((previous) => candidate.values.reduce((sum, value, index) => {
      const separation = arcKnobProposalSeparation(sequence[index]);
      return sum + ((value - previous.values[index]) / separation) ** 2;
    }, 0) >= 1);
    if (distinct) out.push(candidate);
    if (out.length === 2) break;
  }
  return out;
}

function candidateMagnitude(candidate: VectorCandidate): number {
  return candidate.values.reduce((sum, value) => sum + Math.abs(value), 0);
}

function traceProbe(
  stage: number,
  sequence: readonly ArcKnobId[],
  values: readonly number[],
  lines: TrackLine[],
  observation: JointArcProbeObservation,
): ProbeTrace {
  return {
    stage,
    appliedSequence: [...sequence],
    appliedValues: [...values],
    geometryHash: geometryHash(lines),
    gate: observation.gate,
    outputs: observation.outputs,
    ...(observation.latentOutputs === undefined ? {} : { latentOutputs: observation.latentOutputs }),
  };
}

function assertValuesWithinSpans(configuration: ArcControlConfiguration, values: readonly number[]): boolean {
  return values.every((value, index) => Math.abs(value) <= arcKnobProbeSpan(configuration.sequence[index]) + 1e-9);
}

function runConfiguration(
  configuration: ArcControlConfiguration,
  sourceId: string,
  seed: number,
  engine: any,
  gap: Gap,
  nextGap: Gap,
  ctx: SpecContext,
  source: Candidate,
  lineIdStart: number,
): MatrixRow {
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const current = ctx.gapAxisTargets?.[gap.index] ?? gap.targets;
  const next = ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets;
  const context: ArcActuatorContext | undefined = arcKnobSequenceNeedsContactPoint(configuration.sequence)
    ? (() => {
      const target = getCandidateProbe(engine, gap, ctx).targetState;
      return { contactPoint: { x: target.sledX, y: target.sledY } };
    })()
    : undefined;
  const stages: StageTrace[] = [];
  let actualProbeCount = 0;
  const observe = (stage: number, sequence: readonly ArcKnobId[], values: readonly number[], modelKnobs: ArcKnobs): JointArcProbeObservation => {
    const lines = applyArcKnobSequence(source.lines, sequence, values, context);
    const observation = evaluateJointArcLines(
      engine, lines, modelKnobs, gap, ctx.allContactFrames, axisMeasureEnd, nextGap.endFrame, { mode: probeMode },
    );
    actualProbeCount++;
    const trace = traceProbe(stage, sequence, values, lines, observation);
    const currentStage = stages.find((entry) => entry.stage === stage);
    if (currentStage === undefined) throw new Error(`matrix stage ${stage} was not initialized`);
    currentStage.probes.push(trace);
    return observation;
  };

  let offered: VectorCandidate[] = [];
  if (configuration.trainingMethod === "base_additive" || configuration.trainingMethod === "base_joint") {
    const dimension = configuration.sequence.length;
    const stage: StageTrace = {
      stage: 0,
      knob: configuration.sequence[0],
      prefixValues: [],
      modelFormCounts: {},
      probes: [],
      selectedValue: 0,
    };
    stages.push(stage);
    const firstSpan = arcKnobProbeSpan(configuration.sequence[0]);
    const secondSpan = dimension === 2 ? arcKnobProbeSpan(configuration.sequence[1]) : 0;
    const vectors: number[][] = configuration.trainingMethod === "base_joint" && dimension === 2
      ? [-firstSpan, 0, firstSpan].flatMap((first) => [-secondSpan, 0, secondSpan].map((second) => [first, second]))
      : [
        Array(dimension).fill(0),
        [-firstSpan, ...Array(Math.max(0, dimension - 1)).fill(0)],
        [firstSpan, ...Array(Math.max(0, dimension - 1)).fill(0)],
        ...(dimension === 2 ? [[0, -secondSpan], [0, secondSpan]] : []),
      ];
    const rows = vectors.map((values) => observe(0, configuration.sequence, values, toTwoCoordinate(values)));
    const design = dimension === 1 ? "pitch3" : configuration.trainingMethod === "base_joint" ? "grid9" : "cross5";
    const modelRowsForFit = modelRows(rows, (row) => dimension === 1
      ? toScalarCoordinate(row.knobs.rotateDeg)
      : row.knobs,
    );
    const model = fitJointArcResponseModel(modelRowsForFit, design, "hybrid", {
      context: { gap, axisMeasureEnd, nextFrame: nextGap.endFrame },
    });
    stage.modelFormCounts = modelFormCounts(model);
    offered = dimension === 1
      ? scanScalar(model, firstSpan, arcKnobScanStep(configuration.sequence[0]), current, next, nextGap)
      : scanTwo(model, configuration, current, next, nextGap);
  } else {
    const first = configuration.sequence[0];
    const firstSpan = arcKnobProbeSpan(first);
    const firstStage: StageTrace = {
      stage: 0,
      knob: first,
      prefixValues: [],
      modelFormCounts: {},
      probes: [],
      selectedValue: 0,
    };
    stages.push(firstStage);
    const firstRows = [0, -firstSpan, firstSpan].map((value) =>
      observe(0, [first], [value], toScalarCoordinate(value)));
    const firstModel = fitJointArcResponseModel(modelRows(firstRows, (row) => toScalarCoordinate(row.knobs.pitchDeg)), "pitch3", "hybrid", {
      context: { gap, axisMeasureEnd, nextFrame: nextGap.endFrame },
    });
    firstStage.modelFormCounts = modelFormCounts(firstModel);
    const firstCandidates = scanScalar(firstModel, firstSpan, arcKnobScanStep(first), current, next, nextGap);
    const firstValue = firstCandidates[0]?.values[0] ?? 0;
    firstStage.selectedValue = firstValue;
    if (configuration.sequence.length === 1) {
      offered = firstCandidates;
    } else {
      const second = configuration.sequence[1];
      const secondSpan = arcKnobProbeSpan(second);
      const secondStage: StageTrace = {
        stage: 1,
        knob: second,
        prefixValues: [firstValue],
        modelFormCounts: {},
        probes: [],
        selectedValue: 0,
      };
      stages.push(secondStage);
      const conditionalRows = [-secondSpan, 0, secondSpan].map((value) =>
        observe(1, [first, second], [firstValue, value], toScalarCoordinate(value)));
      const secondModel = fitJointArcResponseModel(
        modelRows(conditionalRows, (row) => toScalarCoordinate(row.knobs.pitchDeg)),
        "pitch3", "hybrid", {
        context: { gap, axisMeasureEnd, nextFrame: nextGap.endFrame },
        },
      );
      secondStage.modelFormCounts = modelFormCounts(secondModel);
      const secondCandidates = scanScalar(secondModel, secondSpan, arcKnobScanStep(second), current, next, nextGap)
        .map((candidate) => ({ values: [firstValue, candidate.values[0]], value: candidate.value }));
      const stageOneOffer = firstCandidates.slice(0, 1).map((candidate) => ({ values: [candidate.values[0], 0], value: candidate.value }));
      offered = [...stageOneOffer, ...secondCandidates];
    }
  }

  const selected = choose(configuration, offered);
  const candidateProbe = getCandidateProbe(engine, gap, ctx);
  const emitted = selected.map((candidate) => {
    const transformed = applyArcKnobSequence(source.lines, configuration.sequence, candidate.values, context);
    const lines = transformed
      .map((line, index) => ({ ...line, id: lineIdStart + index }));
    const admitted = tryCandidateLines(
      engine, gap, lines, lineIdStart, ctx.allContactFrames, axisMeasureEnd, gap.targets,
      true, "normal", candidateProbe.preTargetSledTrace,
    ) !== null;
    return {
      values: candidate.values,
      geometryHash: geometryHash(transformed),
      predictedValue: candidate.value,
      admitted,
    };
  });
  const selectedWithinDeclaredSpan = emitted.every((candidate) => assertValuesWithinSpans(configuration, candidate.values));
  const plannedProbeCount = plannedArcControlProbeCount(configuration);
  if (!selectedWithinDeclaredSpan) throw new Error(`matrix selection escaped declared knob span for ${configuration.id}`);
  if (actualProbeCount !== plannedProbeCount) {
    throw new Error(`matrix probe count mismatch for ${configuration.id}: planned ${plannedProbeCount}, ran ${actualProbeCount}`);
  }
  return {
    configurationId: configuration.id,
    sourceId,
    seed,
    gapIndex: gap.index,
    plannedProbeCount,
    actualProbeCount,
    stages,
    offered: emitted,
    emitted: emitted.filter((candidate) => candidate.admitted).length,
    invariantChecks: { selectedWithinDeclaredSpan, plannedProbeCountMatched: true },
  };
}

type Summary = Record<string, {
  configuration: ArcControlConfiguration;
  plannedProbeCount: number;
  states: number;
  probeCalls: number;
  selected: number;
  admitted: number;
  viableStates: number;
  gateRows: number;
  gatePasses: number;
  modelForms: Record<string, number>;
}>;

const rows: MatrixRow[] = [];
for (const id of ids) for (const seed of seeds) {
  const userSpec = applyJolt(cases.get(id)!, benchmarkPolicy.transform.joltMs);
  let winner: HandoffNode | null = null;
  let winnerKey: LeafKey | null = null;
  const started = Date.now();
  compileHandoff(userSpec, seed, { budget, onNode: (node, key, event) => {
    if (event.fullDuration && (winnerKey === null || isStrictlyBetter(key, winnerKey))) {
      winner = node;
      winnerKey = key;
    }
  }});
  if (winner === null) {
    console.error(`  ${id}/s${seed}: no full-duration frozen state`);
    continue;
  }
  const setup = prepare(userSpec, seed);
  let entry = initialEntry(winner, setup.gaps);
  let done = 0;
  for (let index = 0; index + 1 < setup.gaps.length; index++) {
    const gap = setup.gaps[index];
    const nextGap = setup.gaps[index + 1];
    const source = winner.search.prefixFits[index] as Candidate | null | undefined;
    if (source !== null && source !== undefined && gap.endsWithContact &&
      (nextGap.targets.speed !== undefined || nextGap.targets.impact !== undefined) && done < maxGaps) {
      for (const configuration of configurations) {
        rows.push(runConfiguration(
          configuration, id, seed, entry.prefixEngine, gap, nextGap, setup.ctx, source, entry.prefixNextLineId,
        ));
      }
      done++;
    }
    entry = extendNodeCached(entry, source ?? null);
  }
  console.error(`  ${id}/s${seed}: ${done} frozen states × ${configurations.length} configurations, ${Date.now() - started} ms`);
}

const summary: Summary = {};
for (const configuration of configurations) {
  summary[configuration.id] = {
    configuration,
    plannedProbeCount: plannedArcControlProbeCount(configuration),
    states: 0,
    probeCalls: 0,
    selected: 0,
    admitted: 0,
    viableStates: 0,
    gateRows: 0,
    gatePasses: 0,
    modelForms: {},
  };
}
for (const row of rows) {
  const aggregate = summary[row.configurationId];
  aggregate.states++;
  aggregate.probeCalls += row.actualProbeCount;
  aggregate.selected += row.offered.length;
  aggregate.admitted += row.emitted;
  if (row.emitted > 0) aggregate.viableStates++;
  for (const stage of row.stages) {
    for (const probe of stage.probes) {
      aggregate.gateRows++;
      if (probe.gate.currentOk) aggregate.gatePasses++;
    }
    for (const [form, count] of Object.entries(stage.modelFormCounts)) {
      aggregate.modelForms[form] = (aggregate.modelForms[form] ?? 0) + count;
    }
  }
}

/** Audit only the relation promised by `observationEquivalenceKey`: raw
 * observations and final offered/exact outcomes.  Stage-selection bookkeeping
 * intentionally remains method-specific and is not compared here. */
function observationProposalProjection(row: MatrixRow): object {
  return {
    plannedProbeCount: row.plannedProbeCount,
    actualProbeCount: row.actualProbeCount,
    probes: row.stages.flatMap((stage) => stage.probes),
    offered: row.offered,
    emitted: row.emitted,
  };
}
const observationEquivalenceGroups = Object.values(configurations.reduce<Record<string, string[]>>((groups, configuration) => {
  (groups[configuration.observationEquivalenceKey] ??= []).push(configuration.id);
  return groups;
}, {}));
const observationEquivalenceAudit = observationEquivalenceGroups
  .filter((group) => group.length > 1)
  .map((configurationIds) => {
    const projected = configurationIds.map((id) => rows
      .filter((row) => row.configurationId === id)
      .map(observationProposalProjection));
    const reference = JSON.stringify(projected[0]);
    return {
      configurationIds,
      observationAndProposalEquivalent: projected.slice(1).every((candidate) => JSON.stringify(candidate) === reference),
    };
  });

const result = {
  study: "arc-control-matrix-v2-v1",
  purpose: "hypothesis-generating configuration matrix; not a compiler headline or promotion result",
  budget,
  ids,
  seeds,
  maxGaps,
  probeMode,
  matrix: {
    knobIds,
    maxKnobs,
    allowRepeated,
    configurationCount: configurations.length,
    configurations,
    observationEquivalenceGroups,
    observationEquivalenceAudit,
  },
  summary,
  rows,
};
console.log(JSON.stringify({
  study: result.study,
  configurationCount: configurations.length,
  observationEquivalenceGroups: result.matrix.observationEquivalenceGroups,
  observationEquivalenceAudit: result.matrix.observationEquivalenceAudit,
  rows: rows.length,
  summary: Object.fromEntries(Object.entries(summary).map(([id, value]) => [id, {
    states: value.states,
    plannedProbeCount: value.plannedProbeCount,
    admitted: value.admitted,
    viableStates: value.viableStates,
    gateRate: value.gateRows === 0 ? null : value.gatePasses / value.gateRows,
  }])),
}, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
}
