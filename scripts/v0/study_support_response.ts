import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { setFlagsFromString } from "node:v8";
import frontier5 from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import frontier7 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import denseRecovery from "../../benchmark/v2/cases/normative/capability/frontier_dense_recovery.ts";
import denseRecovery240 from "../../benchmark/v2/cases/variants/capability/frontier_dense_recovery_240ms_figures.ts";
import pickup from "../../benchmark/v2/cases/normative/capability/frontier_pickup_progression.ts";
import pickupShifted from "../../benchmark/v2/cases/variants/capability/frontier_pickup_progression_shifted.ts";
import sparseLowline from "../../benchmark/v2/cases/normative/representative/sparse_lowline.ts";
import denseDialogue from "../../benchmark/v2/cases/normative/representative/dense_dialogue.ts";
import highAirDrive from "../../benchmark/v2/cases/normative/representative/high_air_drive.ts";
import meterExchange from "../../benchmark/v2/cases/normative/representative/meter_exchange.ts";
import risingSwitch from "../../benchmark/v2/cases/normative/representative/rising_switch.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  setSupportGeometryProbeHook,
  type SupportGeometryProbeRecord,
} from "./arc_placement.ts";
import {
  setLandingProbeHook,
  type LandingProbeCostSink,
} from "./core/candidate.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import type { DetectorRunwayStats } from "./optimizer/contact_phase.ts";
import {
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
  type HandoffPoolProbeRecord,
  type HandoffRankTraceEntry,
} from "./optimizer/handoff.ts";
import { effectiveAirAsk, OBJECTIVE_AIR_DEADBAND } from "./optimizer/objective.ts";
import {
  contactLineIdsAt,
  frameOffset,
  isAuthoredContactEvent,
  measurementLastFrame,
} from "./core/substrate.ts";
import { AXIS_QUALITY_TOLERANCE, axisDetails, scoreDriftReport } from "./score.ts";
import { FPS, type Spec, type TrackLine } from "./types.ts";
import type { Detection, DetEvent } from "../lib/detector.ts";

type StudyMode =
  | "production"
  | "shape"
  | "time"
  | "log"
  | "deficit"
  | "refined"
  | "adaptive";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const budget = Number(argument("budget") ?? "250000");
const joltMs = Number(argument("jolt-ms") ?? benchmarkPolicy.transform.joltMs);
const seeds = (argument("seeds") ?? "27").split(",").map(Number);
const modes = (argument("modes") ?? "production").split(",") as StudyMode[];
const requestedCases = new Set((argument("cases") ?? "frontier5,frontier7,dense,dense240,pickup,pickup-shifted,sparse,dense-dialogue,high-air,meter,rising").split(","));
const outPath = argument("out");
const generatedAt = new Date().toISOString();

if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`invalid budget ${budget}`);
if (!Number.isFinite(joltMs)) throw new Error(`invalid jolt-ms ${joltMs}`);
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error(`invalid seeds`);
if (
  modes.some((mode) =>
    ![
      "production",
      "shape",
      "time",
      "log",
      "deficit",
      "refined",
      "adaptive",
    ].includes(mode)
  )
) {
  throw new Error(
    `modes must be production,shape,time,log,deficit,refined,adaptive`,
  );
}

const catalog: Array<{ id: string; spec: Spec }> = [
  { id: "frontier5", spec: frontier5 },
  { id: "frontier7", spec: frontier7 },
  { id: "dense", spec: denseRecovery },
  { id: "dense240", spec: denseRecovery240 },
  { id: "pickup", spec: pickup },
  { id: "pickup-shifted", spec: pickupShifted },
  { id: "sparse", spec: sparseLowline },
  { id: "dense-dialogue", spec: denseDialogue },
  { id: "high-air", spec: highAirDrive },
  { id: "meter", spec: meterExchange },
  { id: "rising", spec: risingSwitch },
];
const cases = catalog
  .filter((entry) => requestedCases.has(entry.id))
  .map((entry) => ({ ...entry, spec: applyJolt(entry.spec, joltMs) }));
if (cases.length !== requestedCases.size) {
  throw new Error(`unknown case in --cases=${[...requestedCases].join(",")}`);
}

setFlagsFromString("--expose_gc");
const collectGarbage = runInNewContext("gc") as () => void;
process.env.LR_AIM_STUDY_STATS = "1";

const rows = [];
for (const mode of modes) {
  configureMode(mode);
  for (const testCase of cases) {
    for (const seed of seeds) {
      const geometry = new Map<number, SupportGeometryProbeRecord[]>();
      const pools = new Map<number, HandoffPoolProbeRecord[]>();
      const gates = new Map<number, GateAccumulator>();
      const candidateGateRecords = new WeakMap<object, GateRecord>();
      let selectedTrace: HandoffRankTraceEntry[] = [];
      setSupportGeometryProbeHook((record) => appendMap(geometry, record.gapIndex, record));
      setHandoffPoolProbeHook((record) => appendMap(pools, record.gapIndex, record));
      setLandingProbeHook({
        onSurvivalFailure(gap) {
          gateFor(gates, gap.index).survivalFailed++;
        },
        onLandingWindow(_det, gap, lines) {
          const gate = gateFor(gates, gap.index);
          gate.survivalPassed++;
          const record: GateRecord = {
            cost: null,
            ranked: false,
            contact: diagnoseContact(_det, gap.startFrame, gap.endFrame, lines),
          };
          gate.records.push(record);
          candidateGateRecords.set(lines, record);
          return record;
        },
        onHandoffScore(lines) {
          const record = candidateGateRecords.get(lines);
          if (record !== undefined) record.ranked = true;
        },
      });

      const started = performance.now();
      const checkpoint = compileHandoff(testCase.spec, seed, {
        budget,
        onNode(node, _key, event) {
          if (event.improved) selectedTrace = node.rankTrace.map((entry) => ({ ...entry }));
        },
      });
      const elapsedMs = performance.now() - started;
      setSupportGeometryProbeHook(null);
      setHandoffPoolProbeHook(null);
      setLandingProbeHook(null);
      const score = scoreDriftReport(checkpoint.report, {
        totalFrames: Math.round(testCase.spec.duration * FPS),
      });
      const gapResponses = summarizeGaps(geometry, pools, gates);
      const row = {
        mode,
        caseId: testCase.id,
        seed,
        budget,
        elapsedMs: round(elapsedMs),
        valid: score.contract_passed,
        score: round(score.score),
        trackHash: createHash("sha256")
          .update(JSON.stringify(checkpoint.track))
          .digest("hex"),
        axisResponse: summarizeAxes(checkpoint.report),
        deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
        firstCompletionFrame: checkpoint.stats.first_completion_frame ?? null,
        searchNodesExpanded: checkpoint.stats.search_nodes_expanded ?? null,
        policyCandidateCount: {
          min: checkpoint.stats.handoff_policy_candidate_count_min ?? null,
          mean: checkpoint.stats.handoff_policy_candidate_count_mean ?? null,
          max: checkpoint.stats.handoff_policy_candidate_count_max ?? null,
        },
        contactPhase: (checkpoint.stats as typeof checkpoint.stats & {
          contact_phase?: DetectorRunwayStats;
        }).contact_phase ?? null,
        terminus: checkpoint.report.terminus,
        simFrames: checkpoint.stats.sim_frames,
        candidatesSampled: checkpoint.stats.candidates_sampled,
        candidatesViable: checkpoint.stats.candidates_viable,
        selectedTrace,
        airMatchedProposal: checkpoint.stats.aim?.study === undefined
          ? null
          : {
            considered: checkpoint.stats.aim.study.enum_air_considered,
            gateFailed: checkpoint.stats.aim.study.enum_air_gate_fail,
            emitted: checkpoint.stats.aim.study.enum_air_emitted,
            rankedPools: checkpoint.stats.aim.study.rank_air_pools,
            deliverablePools: checkpoint.stats.aim.study.rank_air_deliverable_pools,
          },
        gapResponses,
      };
      rows.push(row);
      writeCheckpoint(false);
      disposeAllWasmEnginesForStudy();
      collectGarbage();
      const worst = [...gapResponses].sort((a, b) => b.coverageDeficit - a.coverageDeficit)[0];
      console.error(
        `${mode.padEnd(8)} ${testCase.id.padEnd(16)} seed=${seed} ` +
          `valid=${row.valid} score=${row.score} ` +
          `worst=${worst === undefined ? "n/a" : `${worst.gapIndex}:${worst.coverageDeficit}`} ` +
          `${(elapsedMs / 1000).toFixed(1)}s`,
      );
    }
  }
}
delete process.env.LR_SUPPORT_GEOMETRY;
delete process.env.LR_SUPPORT_COVERAGE_LANE;
delete process.env.LR_AIM_STUDY_STATS;

if (outPath === undefined) process.stdout.write(studyJson(true));
else {
  writeCheckpoint(true);
  console.error(`wrote ${outPath}`);
}

function configureMode(mode: StudyMode): void {
  if (mode === "production") {
    delete process.env.LR_SUPPORT_GEOMETRY;
    delete process.env.LR_SUPPORT_COVERAGE_LANE;
    return;
  }
  process.env.LR_SUPPORT_GEOMETRY = mode === "time"
    ? "time"
    : mode === "log"
    ? "shape-time-log"
    : mode === "deficit"
    ? "shape-time-deficit"
    : mode === "refined"
    ? "shape-time-deficit"
    : "off";
  process.env.LR_SUPPORT_COVERAGE_LANE = mode === "adaptive" || mode === "refined" ? "1" : "0";
}

function summarizeGaps(
  geometry: Map<number, SupportGeometryProbeRecord[]>,
  pools: Map<number, HandoffPoolProbeRecord[]>,
  gates: Map<number, GateAccumulator>,
) {
  const indices = new Set([...geometry.keys(), ...pools.keys(), ...gates.keys()]);
  return [...indices].sort((a, b) => a - b).flatMap((gapIndex) => {
    const geometryRows = geometry.get(gapIndex) ?? [];
    const poolRows = pools.get(gapIndex) ?? [];
    const candidates = poolRows.flatMap((record) => record.candidates);
    const nextTargets = poolRows.find((record) => record.nextTargets !== null)?.nextTargets ?? null;
    const supportGapFrames = firstFinite(geometryRows.map((record) => record.gapFrames));
    const arrivalGapFrames = firstFinite(candidates.map((candidate) => candidate.arrivalGapFrames));
    const gapFrames = arrivalGapFrames ?? supportGapFrames;
    const airAsk = nextTargets?.air;
    if (airAsk === undefined || gapFrames === null) return [];
    const effectiveAsk = effectiveAirAsk(airAsk, gapFrames);
    const desiredGroundFrames = gapFrames * (1 - effectiveAsk);
    const predictedAir = candidates.map((candidate) => candidate.arrivalAir)
      .filter((value): value is number => value !== null);
    const observedGround = predictedAir.map((air) => gapFrames * (1 - air));
    const displacementSpeed = candidates.flatMap((candidate) =>
      candidate.releaseDisplacement === null || candidate.releaseElapsedFrames === null ||
        candidate.releaseElapsedFrames <= 0
        ? []
        : [candidate.releaseDisplacement / candidate.releaseElapsedFrames]
    );
    const bestAirError = predictedAir.length === 0
      ? null
      : Math.min(...predictedAir.map((air) => Math.abs(air - effectiveAsk)));
    const coverageDeficit = predictedAir.length === 0
      ? 1
      : Math.max(0, Math.min(...predictedAir) - effectiveAsk - OBJECTIVE_AIR_DEADBAND);
    const gate = gates.get(gapIndex) ?? emptyGate();
    const scoredCandidates = candidates.filter(
      (candidate): candidate is HandoffPoolProbeCandidate & { handoffScore: number } =>
        candidate.handoffScore !== undefined,
    );
    const qualityCandidates = candidates.filter(
      (candidate): candidate is HandoffPoolProbeCandidate & { qualityObjective: number } =>
        candidate.qualityObjective !== null,
    );
    const entrySpeed = mean(poolRows.map((record) => record.entrySpeed));
    const bestQuality = qualityCandidates.length === 0
      ? null
      : qualityCandidates.reduce((best, candidate) =>
        candidate.qualityObjective > best.qualityObjective ? candidate : best
      );
    const bestHandoff = scoredCandidates.length === 0
      ? null
      : scoredCandidates.reduce((best, candidate) =>
        candidate.handoffScore < best.handoffScore ? candidate : best
      );
    return [{
      gapIndex,
      pools: poolRows.length,
      entrySpeed: summary(poolRows.map((record) => record.entrySpeed)),
      gapFrames,
      supportGapFrames,
      arrivalGapFrames,
      airAsk: round(airAsk),
      effectiveAirAsk: round(effectiveAsk),
      desiredGroundFrames: round(desiredGroundFrames),
      kinematicLength: round(entrySpeed * desiredGroundFrames),
      coverageDeficit: round(coverageDeficit),
      bestAirError: nullableRound(bestAirError),
      predictedAir: summary(predictedAir),
      observedGroundFrames: summary(observedGround),
      releaseDisplacementSpeed: summary(displacementSpeed),
      generatedGeometry: {
        count: geometryRows.length,
        modes: [...new Set(geometryRows.map((record) => record.mode))],
        postLength: summary(geometryRows.map((record) => record.postLength)),
        postSegments: summary(geometryRows.map((record) => record.postSegments)),
        targetAir: summary(geometryRows.flatMap((record) =>
          record.targetAir === null ? [] : [record.targetAir]
        )),
        targetLength: nullableRound(firstFinite(geometryRows.map((record) => record.targetLength))),
        extensionPressure: summary(geometryRows.flatMap((record) =>
          record.extensionPressure === null ? [] : [record.extensionPressure]
        )),
      },
      gates: {
        survivalFailed: gate.survivalFailed,
        survivalPassed: gate.survivalPassed,
        viable: gate.records.filter((record) => record.cost !== null).length,
        ranked: gate.records.filter((record) => record.ranked).length,
        contact: summarizeContactDiagnostics(gate.records),
      },
      pool: {
        candidates: candidates.length,
        admitted: candidates.filter((candidate) => candidate.admitted).length,
        scored: scoredCandidates.length,
        withinAirDeadband: predictedAir.filter(
          (air) => Math.abs(air - effectiveAsk) <= OBJECTIVE_AIR_DEADBAND,
        ).length,
        lineLength: summary(candidates.map((candidate) => candidate.lineLength)),
        meanSegmentLength: summary(candidates.map((candidate) => candidate.meanSegmentLength)),
        totalTurnDeg: summary(candidates.map((candidate) => candidate.totalTurnDeg)),
        lineLengthGroundTimeCorrelation: nullableRound(correlation(
          candidates.flatMap((candidate) => candidate.arrivalAir === null
            ? []
            : [[candidate.lineLength, gapFrames * (1 - candidate.arrivalAir)] as const]),
        )),
        bestQuality: summarizeCandidate(bestQuality, gapFrames, effectiveAsk, entrySpeed),
        bestHandoff: summarizeCandidate(bestHandoff, gapFrames, effectiveAsk, entrySpeed),
        bestHandoffScore: scoredCandidates.length === 0
          ? null
          : round(Math.min(...scoredCandidates.map((candidate) => candidate.handoffScore))),
      },
    }];
  });
}

function summarizeAxes(report: Parameters<typeof axisDetails>[0]) {
  const byAxis = new Map<string, number[]>();
  for (const detail of axisDetails(report)) {
    const values = byAxis.get(detail.axis);
    if (values === undefined) byAxis.set(detail.axis, [detail.error]);
    else values.push(detail.error);
  }
  return Object.fromEntries([...byAxis].map(([axis, errors]) => {
    const rms = Math.sqrt(mean(errors.map((error) => error * error)));
    return [axis, {
      observations: errors.length,
      rmsError: round(rms),
      quality: round(Math.exp(-rms / AXIS_QUALITY_TOLERANCE)),
    }];
  }));
}

function summarizeCandidate(
  candidate: HandoffPoolProbeCandidate | null,
  gapFrames: number,
  effectiveAsk: number,
  entrySpeed: number,
) {
  if (candidate === null) return null;
  const observedGroundFrames = candidate.arrivalAir === null
    ? null
    : gapFrames * (1 - candidate.arrivalAir);
  return {
    qualityRank: candidate.qualityRank,
    admitted: candidate.admitted,
    lineLength: round(candidate.lineLength),
    lineCount: candidate.lineCount,
    meanSegmentLength: round(candidate.meanSegmentLength),
    totalTurnDeg: round(candidate.totalTurnDeg),
    lengthInEntrySpeedFrames: round(candidate.lineLength / Math.max(1e-9, entrySpeed)),
    observedGroundFrames: nullableRound(observedGroundFrames),
    airError: candidate.arrivalAir === null
      ? null
      : round(candidate.arrivalAir - effectiveAsk),
    currentQuality: round(candidate.currentQuality),
    qualityObjective: nullableRound(candidate.qualityObjective),
    readiness: nullableRound(candidate.readiness),
    airFit: nullableRound(candidate.airFit),
    speedFit: nullableRound(candidate.speedFit),
    handoffScore: candidate.handoffScore === undefined ? null : round(candidate.handoffScore),
    releaseFrame: candidate.releaseFrame,
    releaseElapsedFrames: candidate.releaseElapsedFrames,
    catchWindowGroundedFrames: candidate.catchWindowGroundedFrames,
    releaseAirborne: candidate.releaseAirborne,
    arrivalGapFrames: candidate.arrivalGapFrames,
    arrivalAir: candidate.arrivalAir === null ? null : round(candidate.arrivalAir),
  };
}

type ContactDiagnostic = {
  authoredAtTargetAnyLine: boolean;
  authoredAtTargetOwnedLine: boolean;
  rawContactAtTargetOwnedLine: boolean;
  nearestAuthoredAnyLineOffset: number | null;
  nearestAuthoredOwnedLineOffset: number | null;
  nearestLandingOwnedLineOffset: number | null;
  nearestBounceOwnedLineOffset: number | null;
  nearestFlyThroughOwnedLineOffset: number | null;
  nearestRawContactOwnedLineOffset: number | null;
};

type GateRecord = LandingProbeCostSink & {
  ranked: boolean;
  contact: ContactDiagnostic;
};
type GateAccumulator = {
  survivalFailed: number;
  survivalPassed: number;
  records: GateRecord[];
};

function emptyGate(): GateAccumulator {
  return { survivalFailed: 0, survivalPassed: 0, records: [] };
}

function gateFor(map: Map<number, GateAccumulator>, gapIndex: number): GateAccumulator {
  const existing = map.get(gapIndex);
  if (existing !== undefined) return existing;
  const created = emptyGate();
  map.set(gapIndex, created);
  return created;
}

function diagnoseContact(
  det: Detection,
  gapStartFrame: number,
  targetFrame: number,
  lines: TrackLine[],
): ContactDiagnostic {
  const gapFrames = targetFrame - gapStartFrame;
  const owned = new Set(lines.map((line) => line.id));
  const authoredEvents = det.events.filter((event) => isAuthoredContactEvent(event, gapFrames));
  const ownedEvents = det.events.filter((event) =>
    contactLineIdsAt(det, event.frame).some((lineId) => owned.has(lineId))
  );
  const ownedAuthoredEvents = ownedEvents.filter((event) =>
    isAuthoredContactEvent(event, gapFrames)
  );
  const rawContactOffsets: number[] = [];
  for (let frame = frameOffset(det); frame <= measurementLastFrame(det); frame++) {
    if (contactLineIdsAt(det, frame).some((lineId) => owned.has(lineId))) {
      rawContactOffsets.push(frame - targetFrame);
    }
  }
  return {
    authoredAtTargetAnyLine: authoredEvents.some((event) =>
      Math.abs(event.frame - targetFrame) <= 1
    ),
    authoredAtTargetOwnedLine: ownedAuthoredEvents.some((event) =>
      Math.abs(event.frame - targetFrame) <= 1
    ),
    rawContactAtTargetOwnedLine: rawContactOffsets.some((offset) => Math.abs(offset) <= 1),
    nearestAuthoredAnyLineOffset: nearestEventOffset(authoredEvents, targetFrame),
    nearestAuthoredOwnedLineOffset: nearestEventOffset(ownedAuthoredEvents, targetFrame),
    nearestLandingOwnedLineOffset: nearestEventOffset(
      ownedEvents.filter((event) => event.type === "landing"),
      targetFrame,
    ),
    nearestBounceOwnedLineOffset: nearestEventOffset(
      ownedEvents.filter((event) => event.type === "bounce"),
      targetFrame,
    ),
    nearestFlyThroughOwnedLineOffset: nearestEventOffset(
      ownedEvents.filter((event) => event.type === "flyThrough"),
      targetFrame,
    ),
    nearestRawContactOwnedLineOffset: nearestOffset(rawContactOffsets),
  };
}

function nearestEventOffset(events: DetEvent[], targetFrame: number): number | null {
  return nearestOffset(events.map((event) => event.frame - targetFrame));
}

function nearestOffset(offsets: number[]): number | null {
  if (offsets.length === 0) return null;
  return offsets.reduce((nearest, offset) =>
    Math.abs(offset) < Math.abs(nearest) ? offset : nearest
  );
}

function summarizeContactDiagnostics(records: GateRecord[]) {
  const diagnostics = records.map((record) => record.contact);
  return {
    authoredAtTargetAnyLine: diagnostics.filter((item) => item.authoredAtTargetAnyLine).length,
    authoredAtTargetOwnedLine: diagnostics.filter((item) => item.authoredAtTargetOwnedLine).length,
    rawContactAtTargetOwnedLine: diagnostics.filter((item) => item.rawContactAtTargetOwnedLine).length,
    nearestAuthoredAnyLineOffset: nullableSummary(
      diagnostics.map((item) => item.nearestAuthoredAnyLineOffset),
    ),
    nearestAuthoredOwnedLineOffset: nullableSummary(
      diagnostics.map((item) => item.nearestAuthoredOwnedLineOffset),
    ),
    nearestLandingOwnedLineOffset: nullableSummary(
      diagnostics.map((item) => item.nearestLandingOwnedLineOffset),
    ),
    nearestBounceOwnedLineOffset: nullableSummary(
      diagnostics.map((item) => item.nearestBounceOwnedLineOffset),
    ),
    nearestFlyThroughOwnedLineOffset: nullableSummary(
      diagnostics.map((item) => item.nearestFlyThroughOwnedLineOffset),
    ),
    nearestRawContactOwnedLineOffset: nullableSummary(
      diagnostics.map((item) => item.nearestRawContactOwnedLineOffset),
    ),
  };
}

function nullableSummary(values: Array<number | null>) {
  return summary(values.filter((value): value is number => value !== null));
}

function appendMap<T>(map: Map<number, T[]>, key: number, value: T): void {
  const values = map.get(key);
  if (values === undefined) map.set(key, [value]);
  else values.push(value);
}

function summary(values: number[]) {
  if (values.length === 0) return { count: 0, min: null, mean: null, max: null };
  return {
    count: values.length,
    min: round(Math.min(...values)),
    mean: round(mean(values)),
    max: round(Math.max(...values)),
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function correlation(pairs: ReadonlyArray<readonly [number, number]>): number | null {
  if (pairs.length < 2) return null;
  const meanX = mean(pairs.map(([x]) => x));
  const meanY = mean(pairs.map(([, y]) => y));
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (const [x, y] of pairs) {
    covariance += (x - meanX) * (y - meanY);
    varianceX += (x - meanX) ** 2;
    varianceY += (y - meanY) ** 2;
  }
  const denominator = Math.sqrt(varianceX * varianceY);
  return denominator <= 1e-12 ? null : covariance / denominator;
}

function firstFinite(values: Array<number | null | undefined>): number | null {
  return values.find((value): value is number => value !== null && value !== undefined && Number.isFinite(value)) ?? null;
}

function nullableRound(value: number | null): number | null {
  return value === null ? null : round(value);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function studyJson(complete: boolean): string {
  return `${JSON.stringify({
    schema: "line.study-support-response.v1",
    generatedAt,
    complete,
    hypothesis: "A continuous support family can be centered and scaled from measured grounded-time response across short, ordinary, and long gaps.",
    budget,
    joltMs,
    seeds,
    modes,
    cases: cases.map((entry) => entry.id),
    rows,
  }, null, 2)}\n`;
}

function writeCheckpoint(complete: boolean): void {
  if (outPath === undefined) return;
  const absolute = resolve(outPath);
  const temporary = `${absolute}.tmp`;
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(temporary, studyJson(complete));
  renameSync(temporary, absolute);
}
