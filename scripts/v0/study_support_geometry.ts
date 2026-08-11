import { createHash } from "node:crypto";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { setFlagsFromString } from "node:v8";
import base5 from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import base4 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_4s.ts";
import base6 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_6s.ts";
import base7 from "../../benchmark/v2/cases/variants/capability/frontier_low_air_endurance_7s.ts";
import sparseLowline from "../../benchmark/v2/cases/normative/representative/sparse_lowline.ts";
import sparseLowlineLowerAir from "../../benchmark/v2/cases/variants/representative/sparse_lowline_air_minus_4.ts";
import denseDialogue from "../../benchmark/v2/cases/normative/representative/dense_dialogue.ts";
import highAirDrive from "../../benchmark/v2/cases/normative/representative/high_air_drive.ts";
import highAirDriveLowerAir from "../../benchmark/v2/cases/variants/representative/high_air_drive_air_minus_5.ts";
import meterExchange from "../../benchmark/v2/cases/normative/representative/meter_exchange.ts";
import risingSwitch from "../../benchmark/v2/cases/normative/representative/rising_switch.ts";
import offgridConversation from "../../benchmark/v2/cases/normative/representative/offgrid_conversation.ts";
import {
  setSupportGeometryProbeHook,
  type SupportGeometryProbeRecord,
} from "./arc_placement.ts";
import { setLandingProbeHook, type LandingProbeCostSink } from "./core/candidate.ts";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeCandidate,
} from "./optimizer/handoff.ts";
import type { SupportGeometryMode } from "./core/support_geometry.ts";
import { scoreDriftReport } from "./score.ts";
import { FPS, type Spec } from "./types.ts";

const SUPPORT_GAP_INDEX = 54;
const LANDING_GAP_INDEX = 55;
const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const budget = Number(argument("budget") ?? "250000");
const seeds = (argument("seeds") ?? "27").split(",").map(Number);
const durationArgument = argument("durations") ?? "4,5,6,7";
const requestedDurations = new Set(
  durationArgument === "none" ? [] : durationArgument.split(",").map(Number),
);
const requestedControls = new Set(
  (argument("controls") ?? "").split(",").filter((value) => value !== ""),
);
const modes = (argument("modes") ?? "off,time,time-shape-span").split(",") as SupportGeometryMode[];
const outPath = argument("out");
const generatedAt = new Date().toISOString();

// A study runs many complete compiler invocations in one process. WASM engine
// handles are released by FinalizationRegistry, whose scheduling is otherwise
// nondeterministic; forcing collection between rows prevents completed engines
// from accumulating until the isolate's WASM memory ceiling is reached.
setFlagsFromString("--expose_gc");
const collectGarbage = runInNewContext("gc") as () => void;

if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`invalid budget ${budget}`);
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error(`invalid seeds`);
if (
  modes.some((mode) =>
    !["off", "time", "time-shape-span", "shape-time-log", "shape-time-deficit"].includes(mode)
  )
) {
  throw new Error(`modes must be off,time,time-shape-span,shape-time-log,shape-time-deficit`);
}

const cases: Array<{ rideoutSeconds: number | null; id: string; spec: Spec }> = [
  ...[
    { rideoutSeconds: 4, id: "frontier_low_air_endurance_4s", spec: base4 },
    { rideoutSeconds: 5, id: "frontier_low_air_endurance", spec: base5 },
    { rideoutSeconds: 6, id: "frontier_low_air_endurance_6s", spec: base6 },
    { rideoutSeconds: 7, id: "frontier_low_air_endurance_7s", spec: base7 },
  ].filter((entry) => requestedDurations.has(entry.rideoutSeconds)),
  ...[
    { rideoutSeconds: null, id: "sparse_lowline", spec: sparseLowline },
    { rideoutSeconds: null, id: "sparse_lowline_air_minus_4", spec: sparseLowlineLowerAir },
    { rideoutSeconds: null, id: "dense_dialogue", spec: denseDialogue },
    { rideoutSeconds: null, id: "high_air_drive", spec: highAirDrive },
    { rideoutSeconds: null, id: "high_air_drive_air_minus_5", spec: highAirDriveLowerAir },
    { rideoutSeconds: null, id: "meter_exchange", spec: meterExchange },
    { rideoutSeconds: null, id: "rising_switch", spec: risingSwitch },
    { rideoutSeconds: null, id: "offgrid_conversation", spec: offgridConversation },
  ].filter((entry) => requestedControls.has(entry.id)),
];

const rows = [];
for (const mode of modes) {
  process.env.LR_SUPPORT_GEOMETRY = mode;
  for (const testCase of cases) {
    for (const seed of seeds) {
      const geometry = emptyGeometryProbe();
      const supportGates = emptyGateProbe();
      const landingGates = emptyGateProbe();
      const poolProbe = emptyPoolProbe();
      const candidateRecords = new WeakMap<object, GateCandidateRecord>();
      setSupportGeometryProbeHook((record) => recordGeometry(geometry, record));
      setHandoffPoolProbeHook((record) => {
        if (record.gapIndex !== SUPPORT_GAP_INDEX) return;
        poolProbe.pools++;
        poolProbe.candidates.push(...record.candidates);
      });
      setLandingProbeHook({
        onSurvivalFailure(gap, lines) {
          const gates = gateProbeForIndex(gap.index, supportGates, landingGates);
          if (gates === null) return;
          gates.survivalFailed++;
          recordGateGeometry(gates, lines, false);
        },
        onLandingWindow(_det, gap, lines) {
          const gates = gateProbeForIndex(gap.index, supportGates, landingGates);
          if (gates === null) return null;
          gates.survivalPassed++;
          recordGateGeometry(gates, lines, false);
          const sink: GateCandidateRecord = { cost: null, lines, gate: gates };
          candidateRecords.set(lines, sink);
          gates.candidates.push(sink);
          return sink;
        },
        onHandoffScore(lines) {
          const record = candidateRecords.get(lines);
          if (record === undefined) return;
          record.gate.admitted++;
          recordGateGeometry(record.gate, record.lines, true);
        },
      });
      const started = performance.now();
      const checkpoint = compileHandoff(testCase.spec, seed, { budget });
      const elapsedMs = performance.now() - started;
      setLandingProbeHook(null);
      setSupportGeometryProbeHook(null);
      setHandoffPoolProbeHook(null);
      const score = scoreDriftReport(checkpoint.report, {
        totalFrames: Math.round(testCase.spec.duration * FPS),
      });
      const boundaries = testCase.rideoutSeconds === null ? [] : [
        boundary(checkpoint.report, 2, 12.45),
        boundary(checkpoint.report, 3, 22.60),
        boundary(
          checkpoint.report,
          testCase.rideoutSeconds,
          34.15 + testCase.rideoutSeconds,
        ),
      ];
      const row = {
        mode,
        caseId: testCase.id,
        rideoutSeconds: testCase.rideoutSeconds,
        seed,
        budget,
        elapsedMs: round(elapsedMs),
        score: round(score.score),
        valid: score.contract_passed,
        hits: score.hits,
        missing: score.missing,
        terminus: checkpoint.report.terminus,
        boundaries,
        trackLines: trackLineCount(checkpoint.track),
        trackHash: createHash("sha256").update(JSON.stringify(checkpoint.track)).digest("hex"),
        simFrames: checkpoint.stats.sim_frames,
        actualCandidateSamples: checkpoint.stats.actual_candidate_samples,
        viableCandidateSamples: checkpoint.stats.viable_candidate_samples,
        deepestGap: checkpoint.stats.handoff_deepest_seen_gap ?? null,
        firstCompletionFrame: checkpoint.stats.first_completion_frame ?? null,
        supportGeometry: summarizeGeometryProbe(geometry),
        supportGates: summarizeGateProbe(supportGates),
        landingGates: summarizeGateProbe(landingGates),
        supportPool: summarizePoolProbe(poolProbe),
      };
      rows.push(row);
      writeCheckpoint(false);
      disposeAllWasmEnginesForStudy();
      collectGarbage();
      console.error(
        `${mode.padEnd(11)} ${testCase.id} seed=${seed} ` +
          `valid=${row.valid} score=${row.score} deepest=${row.deepestGap} ` +
          (boundaries.length === 0 ? "" :
            `frontier=${boundaries.at(-1)!.status} air=${boundaries.at(-1)!.achievedAir ?? "n/a"} `) +
          `${(elapsedMs / 1000).toFixed(1)}s`,
      );
    }
  }
}
delete process.env.LR_SUPPORT_GEOMETRY;
setLandingProbeHook(null);
setSupportGeometryProbeHook(null);
setHandoffPoolProbeHook(null);

if (outPath === undefined) process.stdout.write(studyJson(true));
else {
  writeCheckpoint(true);
  console.error(`wrote ${outPath}`);
}

function studyJson(complete: boolean): string {
  return `${JSON.stringify({
    schema: "line.study-support-geometry.v3",
    generatedAt,
    complete,
    hypothesis: "One continuous speed/gap/air support model can cover ordinary and frontier gaps without a duration threshold.",
    budget,
    seeds,
    modes,
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

function boundary(report: ReturnType<typeof compileHandoff>["report"], seconds: number, endTime: number) {
  const contact = report.contacts.find((entry) => Math.abs(entry.t_target - endTime) < 0.001);
  const gap = report.gaps.find((entry) => Math.abs(entry.t_end - endTime) < 0.001);
  const air = gap?.axes.air;
  return {
    seconds,
    endTime,
    status: contact?.status ?? "absent",
    frameError: contact?.frame_error ?? null,
    targetAir: air === undefined ? null : round(air.target),
    achievedAir: air === undefined ? null : round(air.achieved),
    airError: air === undefined ? null : round(air.error),
  };
}

function trackLineCount(track: unknown): number {
  if (track === null || typeof track !== "object") return 0;
  const value = track as { lines?: unknown[] };
  return Array.isArray(value.lines) ? value.lines.length : 0;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

type GeometryProbe = {
  generated: number;
  minLength: number;
  maxLength: number;
  minSegments: number;
  maxSegments: number;
  targetLength: number | null;
};

function emptyGeometryProbe(): GeometryProbe {
  return {
    generated: 0,
    minLength: Infinity,
    maxLength: -Infinity,
    minSegments: Infinity,
    maxSegments: -Infinity,
    targetLength: null,
  };
}

function recordGeometry(acc: GeometryProbe, record: SupportGeometryProbeRecord): void {
  if (record.gapIndex !== SUPPORT_GAP_INDEX) return;
  acc.generated++;
  acc.minLength = Math.min(acc.minLength, record.postLength);
  acc.maxLength = Math.max(acc.maxLength, record.postLength);
  acc.minSegments = Math.min(acc.minSegments, record.postSegments);
  acc.maxSegments = Math.max(acc.maxSegments, record.postSegments);
  if (record.targetLength !== null) acc.targetLength = record.targetLength;
}

function summarizeGeometryProbe(acc: GeometryProbe) {
  return {
    generated: acc.generated,
    minLength: finiteRound(acc.minLength),
    maxLength: finiteRound(acc.maxLength),
    minSegments: finiteRound(acc.minSegments),
    maxSegments: finiteRound(acc.maxSegments),
    targetLength: acc.targetLength === null ? null : round(acc.targetLength),
  };
}

type GateCandidateRecord = LandingProbeCostSink & { lines: object; gate: GateProbe };
type GateProbe = {
  survivalFailed: number;
  survivalPassed: number;
  admitted: number;
  maxEvaluatedLength: number;
  maxEvaluatedLines: number;
  maxAdmittedLength: number;
  maxAdmittedLines: number;
  candidates: GateCandidateRecord[];
};

function emptyGateProbe(): GateProbe {
  return {
    survivalFailed: 0,
    survivalPassed: 0,
    admitted: 0,
    maxEvaluatedLength: 0,
    maxEvaluatedLines: 0,
    maxAdmittedLength: 0,
    maxAdmittedLines: 0,
    candidates: [],
  };
}

function recordGateGeometry(acc: GateProbe, linesObject: object, admitted: boolean): void {
  const lines = linesObject as Array<{ x1: number; y1: number; x2: number; y2: number }>;
  const length = lines.reduce((sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1), 0);
  acc.maxEvaluatedLength = Math.max(acc.maxEvaluatedLength, length);
  acc.maxEvaluatedLines = Math.max(acc.maxEvaluatedLines, lines.length);
  if (admitted) {
    acc.maxAdmittedLength = Math.max(acc.maxAdmittedLength, length);
    acc.maxAdmittedLines = Math.max(acc.maxAdmittedLines, lines.length);
  }
}

function summarizeGateProbe(acc: GateProbe) {
  return {
    survivalFailed: acc.survivalFailed,
    survivalPassed: acc.survivalPassed,
    landingOrOffbeatPassed: acc.candidates.filter((record) => record.cost !== null).length,
    admitted: acc.admitted,
    maxEvaluatedLength: round(acc.maxEvaluatedLength),
    maxEvaluatedLines: acc.maxEvaluatedLines,
    maxAdmittedLength: round(acc.maxAdmittedLength),
    maxAdmittedLines: acc.maxAdmittedLines,
  };
}

function gateProbeForIndex(
  gapIndex: number,
  support: GateProbe,
  landing: GateProbe,
): GateProbe | null {
  if (gapIndex === SUPPORT_GAP_INDEX) return support;
  if (gapIndex === LANDING_GAP_INDEX) return landing;
  return null;
}

function finiteRound(value: number): number | null {
  return Number.isFinite(value) ? round(value) : null;
}

type PoolProbe = { pools: number; candidates: HandoffPoolProbeCandidate[] };

function emptyPoolProbe(): PoolProbe {
  return { pools: 0, candidates: [] };
}

function summarizePoolProbe(acc: PoolProbe) {
  const longest = [...acc.candidates].sort((a, b) => b.lineLength - a.lineLength)[0];
  const longestAdmitted = [...acc.candidates]
    .filter((candidate) => candidate.admitted)
    .sort((a, b) => b.lineLength - a.lineLength)[0];
  const buckets = [
    { id: "lt600", min: 0, max: 600 },
    { id: "600to1200", min: 600, max: 1_200 },
    { id: "1200to1800", min: 1_200, max: 1_800 },
    { id: "ge1800", min: 1_800, max: Infinity },
  ].map((bucket) => {
    const candidates = acc.candidates.filter(
      (candidate) => candidate.lineLength >= bucket.min && candidate.lineLength < bucket.max,
    );
    return {
      id: bucket.id,
      count: candidates.length,
      objectiveDefined: candidates.filter((candidate) => candidate.qualityObjective !== null).length,
      admitted: candidates.filter((candidate) => candidate.admitted).length,
      meanArrivalAir: meanOrNull(
        candidates.map((candidate) => candidate.arrivalAir).filter((value): value is number => value !== null),
      ),
    };
  });
  return {
    pools: acc.pools,
    candidates: acc.candidates.length,
    objectiveDefined: acc.candidates.filter((candidate) => candidate.qualityObjective !== null).length,
    admitted: acc.candidates.filter((candidate) => candidate.admitted).length,
    longest: summarizePoolCandidate(longest),
    longestAdmitted: summarizePoolCandidate(longestAdmitted),
    buckets,
  };
}

function summarizePoolCandidate(candidate: HandoffPoolProbeCandidate | undefined) {
  if (candidate === undefined) return null;
  return {
    lineLength: round(candidate.lineLength),
    lineCount: candidate.lineCount,
    qualityRank: candidate.qualityRank,
    qualityObjective: candidate.qualityObjective === null ? null : round(candidate.qualityObjective),
    readiness: candidate.readiness === null ? null : round(candidate.readiness),
    airFit: candidate.airFit === null ? null : round(candidate.airFit),
    releaseFrame: candidate.releaseFrame,
    releaseAirborne: candidate.releaseAirborne,
    arrivalAir: candidate.arrivalAir === null ? null : round(candidate.arrivalAir),
    achieved: roundedAxes(candidate.achieved),
    admitted: candidate.admitted,
  };
}

function meanOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function roundedAxes(axes: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(axes).map(([axis, value]) => [axis, round(value)]));
}
