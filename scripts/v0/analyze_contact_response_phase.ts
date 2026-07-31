/**
 * Calibration-only measurement of the physical contact phase exposed by the
 * current raw-normal generator.  This does not fit a control or emit terrain:
 * it replays an already-recorded raw proposal stream, verifies its hashes, and
 * measures the relation between a detector-attributed carrier, incoming CoM
 * state, and the scorer's six-frame redirection response.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { clearImpactTemplateMarker, hasPreTargetSledProximityFromTrace, sampleArcPlacementGeometry } from "./arc_placement.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import { detectWindow } from "./core/candidate.ts";
import { contactRedirArcPxAtLanding, engineLineFromTrackLine, velocityAt } from "./core/substrate.ts";
import { makeRng } from "../lib/rng.ts";
import { IMPACT_WINDOW, normImpact, type TrackLine } from "./types.ts";
import {
  contactKinematicFrameFromPlanningState,
  normalizeContactAngleDeg,
  surfaceIncidence,
} from "./trajectory/contact_kinematic_frame.ts";
import { observeOwnedContactTransition } from "./trajectory/contact_observation.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { profileOwnedContactLines } from "./trajectory/owned_contact_profile.ts";
import { prepareComparableTrajectoryFixture } from "./trajectory/study_context.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: analyze_contact_response_phase.ts --study=FILE [--out=FILE]",
    "",
    "Replays a completed calibration local-contact study and measures the",
    "detector-attributed raw carrier's incidence and scored six-frame response.",
  ].join("\n") + "\n");
  process.exit(0);
}

const STUDY_SOURCE_FILES = [
  "scripts/v0/analyze_contact_response_phase.ts",
  "scripts/v0/trajectory/contact_kinematic_frame.ts",
  "scripts/v0/trajectory/contact_observation.ts",
  "scripts/v0/trajectory/owned_contact_profile.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/panel.ts",
  "scripts/v0/trajectory/state.ts",
  "scripts/v0/trajectory/target_frame.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/types.ts",
] as const;

const studyPath = argument("study");
if (studyPath === undefined) throw new Error("--study=FILE is required");
const study = JSON.parse(readFileSync(studyPath, "utf8")) as LocalClosureStudy;
if (study.schema !== "line.study-local-contact-closure.v4") {
  throw new Error(
    `${studyPath}: requires local contact-closure v4; v1-v3 did not require a complete scorer response window and are archival only`,
  );
}
const fixture = readFrozenTrajectoryFixture(study.provenance.fixturePath);
if (fixture.fixtureFingerprint !== study.provenance.fixtureFingerprint) {
  throw new Error("study fixture fingerprint does not match its referenced fixture");
}
const prepared = prepareComparableTrajectoryFixture(fixture);
if (prepared.panel.id !== study.panel.id || prepared.panel.cohort !== "calibration") {
  throw new Error("contact response analysis accepts only an active calibration fixture");
}
if (!Number.isSafeInteger(study.rawNormal.streamSeed)) throw new Error("study raw-normal stream seed is invalid");

const started = performance.now();
const kinematic = contactKinematicFrameFromPlanningState(
  prepared.state,
  prepared.frame,
  prepared.current.targets,
);
const rng = makeRng(study.rawNormal.streamSeed);
const records = study.rawRecords.map((record, attempt) => replayRawRecord(record, attempt, rng));
const observed = records.flatMap((record) => record.observations);
const output = {
  schema: "line.contact-response-phase-analysis.v1",
  purpose: [
    "Verify deterministic raw-normal replay against a completed calibration local-contact study.",
    "Describe the geometric incidence and exact scored response of detector-attributed raw carrier lines.",
    "Inform a later representation choice without fitting, selecting, or promoting a compiler control.",
  ],
  contract: {
    cohortPolicy: "calibration only",
    rawNormalMeaning: "Operational comparator and observed source of successful contact topology; not an independent treatment sample.",
    responseWindowFrames: IMPACT_WINDOW,
    scorerDefinition: "incoming CoM speed times net CoM heading change over the response window",
    forbiddenInference: "No incidence share, surface angle, length, or response value may become a production constant from this analysis.",
  },
  study: {
    path: studyPath,
    fixturePath: study.provenance.fixturePath,
    fixtureFingerprint: fixture.fixtureFingerprint,
    rawStreamSeed: study.rawNormal.streamSeed,
    rawAttemptCount: study.rawRecords.length,
  },
  fixture: {
    captureBudget: prepared.fixture.captureBudget,
    captureEngine: prepared.fixture.captureEngine,
    captureEnvironment: prepared.fixture.captureEnvironment,
    baselineContractPassed: prepared.fixture.baselineContractPassed,
    baselineScore: prepared.fixture.baselineScore,
    baselineDeepestGap: prepared.fixture.baselineDeepestGap,
    interpretation: prepared.fixture.baselineContractPassed
      ? "Conditional physical-prefix observation; not a representative compiler-in-loop sample."
      : "Capability/failure-state observation only; it must not be pooled as representative evidence.",
  },
  predictedInput: {
    geometricAnchor: {
      reference: roundPoint(kinematic.anchor.reference),
      headingDeg: round(kinematic.anchor.headingDeg),
      speedPxPerFrame: round(kinematic.anchor.speedPxPerFrame),
      sledSpanPx: round(kinematic.anchor.sledSpanPx),
      anchorPoint: kinematic.anchor.anchorPoint,
      headingSource: kinematic.anchor.headingSource,
    },
    scoredCom: {
      headingDeg: round(kinematic.com.headingDeg),
      speedPxPerFrame: round(kinematic.com.speedPxPerFrame),
    },
    authoredImpact: kinematic.impact === null ? null : roundRecord(kinematic.impact),
  },
  records,
  summary: {
    attempts: records.length,
    locallyClosed: records.filter((record) => record.localStatus === "closed").length,
    replayHashesMatched: records.every((record) => record.replayHashMatches),
    responseReplayMatched: records.every((record) => record.responseReplayMatches),
    attributedCarrierObservations: observed.length,
    metrics: {
      signedIncidenceDeg: summarize(observed.map((record) => record.incidence.signedIncidenceDeg)),
      normalClosingSpeedPxPerFrame: summarize(observed.map((record) => record.incidence.normalClosingSpeedPxPerFrame)),
      incidenceShareOfRequestedTurn: summarize(observed.flatMap((record) =>
        record.incidence.shareOfRequestedTurn === null ? [] : [record.incidence.shareOfRequestedTurn],
      )),
      carrierLengthPx: summarize(observed.map((record) => record.carrier.lengthPx)),
      scorerRedirArcPx: summarize(observed.map((record) => record.response.redirArcPx)),
      scorerImpact: summarize(observed.map((record) => record.response.normalizedImpact)),
      responseShareOfRequestedArc: summarize(observed.flatMap((record) =>
        record.response.shareOfRequestedArc === null ? [] : [record.response.shareOfRequestedArc],
      )),
      responseTurnDeg: summarize(observed.map((record) => record.response.netTurnDeg)),
    },
  },
  provenance: {
    runtime: { node: process.version, engine: process.env.LR_ENGINE ?? "js" },
    sourceFingerprint: fingerprintFiles(STUDY_SOURCE_FILES),
    elapsedMs: round(performance.now() - started),
  },
  caveats: [
    "A raw proposal can have several possible contact lines; this report includes only detector-attributed owned lines from on-time locally closed rows.",
    "The terrain tangent is oriented toward the incoming CoM heading for an undirected line before incidence is reported.",
    "The response is exact simulation of the replayed proposal, but it is a local observation and not a full downstream admission or benchmark score.",
    "Repeated rows share one frozen prefix and generator stream. Summary statistics describe this calibration panel; they are not confidence intervals or generalization evidence.",
  ],
};

const outPath = argument("out") ?? `${studyPath.replace(/\.json$/, "")}.response-phase.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stderr.write(
  `contact response ${prepared.panel.id}: ${output.summary.locallyClosed}/${output.summary.attempts} raw closures, ` +
  `${output.summary.attributedCarrierObservations} attributed carriers -> ${outPath}\n`,
);

function replayRawRecord(
  record: LocalClosureStudy["rawRecords"][number],
  attempt: number,
  rng: () => number,
) {
  clearImpactTemplateMarker();
  const geometry = sampleArcPlacementGeometry(
    rng,
    prepared.probe.refX,
    prepared.probe.refY,
    prepared.current.targets,
    prepared.probe.targetState,
    attempt,
    prepared.current,
    prepared.lineIdStart,
    "normal",
    prepared.ctx.allContactFrames,
  );
  const lineHash = sha256(stableJson(geometry.lines));
  const expectedHash = record.proposal?.lineHash ?? null;
  if (expectedHash === null) throw new Error(`raw record ${record.label} lacks a proposal hash`);
  if (lineHash !== expectedHash) {
    throw new Error(`raw record ${record.label} does not reproduce its stored geometry hash`);
  }
  if (record.local.status !== "closed") {
    return {
      label: record.label,
      index: record.index,
      localStatus: record.local.status,
      replayHash: lineHash,
      replayHashMatches: true,
      responseReplayMatches: true,
      observations: [],
    };
  }
  if (hasPreTargetSledProximityFromTrace(prepared.probe.preTargetSledTrace(), geometry.lines)) {
    throw new Error(`raw record ${record.label}: locally closed source replayed as a preclear collision`);
  }
  const observed = observeLocalResponse(geometry.lines);
  const expectedEvent = record.local.endpoint?.observation?.selectedOwnedEvent ?? null;
  if (expectedEvent === null || observed.selected === null) {
    throw new Error(`raw record ${record.label}: locally closed source lacks a replayed selected contact`);
  }
  const responseReplayMatches = expectedEvent.frame === observed.selected.frame &&
    sameIds(expectedEvent.ownedLineIds, observed.selected.ownedLineIds);
  if (!responseReplayMatches) {
    throw new Error(`raw record ${record.label}: selected owned contact no longer matches its stored local observation`);
  }
  const observedLines = profileOwnedContactLines(prepared.frame, geometry.lines, observed.selected.ownedLineIds);
  if (observedLines.missingLineIds.length > 0) {
    throw new Error(`raw record ${record.label}: detector owned unknown line IDs`);
  }
  const preVelocity = velocityAt(observed.detection, observed.selected.frame - 1) ??
    velocityAt(observed.detection, observed.selected.frame);
  if (preVelocity === undefined) throw new Error(`raw record ${record.label}: missing incoming CoM velocity`);
  const preSpeed = Math.hypot(preVelocity.x, preVelocity.y);
  if (!(preSpeed > 0)) throw new Error(`raw record ${record.label}: non-positive incoming CoM speed`);
  const preHeadingDeg = Math.atan2(preVelocity.y, preVelocity.x) * 180 / Math.PI;
  const targetArc = kinematic.impact?.requestedRedirArcPx ?? null;
  const requestedTurnDeg = targetArc === null ? null : targetArc / preSpeed * 180 / Math.PI;
  // Field name `redirArcPx` is historical: it now carries the scored accumulated
  // redirection impulse (contactRedirArcPxAtLanding), not the legacy net v·Δθ arc.
  const redirArcPx = contactRedirArcPxAtLanding(observed.detection, observed.selected.frame, IMPACT_WINDOW);
  if (redirArcPx === undefined) throw new Error(`raw record ${record.label}: scorer response is unreadable`);
  const responseFrame = Math.min(
    observed.responseEndFrame,
    observed.selected.frame + IMPACT_WINDOW,
  );
  const responseVelocity = velocityAt(observed.detection, responseFrame);
  if (responseVelocity === undefined) throw new Error(`raw record ${record.label}: missing response velocity`);
  const responseHeadingDeg = Math.atan2(responseVelocity.y, responseVelocity.x) * 180 / Math.PI;
  const netTurnDeg = Math.abs(normalizeContactAngleDeg(responseHeadingDeg - preHeadingDeg));
  const observedKinematic = {
    ...kinematic,
    com: { headingDeg: preHeadingDeg, speedPxPerFrame: preSpeed },
  };
  const observations = observedLines.lines.map((line) => {
    const rawSurfaceAngleDeg = lineAngleDeg(geometry.lines[line.lineIndex]!);
    const surfaceAngleDeg = orientTowardHeading(rawSurfaceAngleDeg, preHeadingDeg);
    const incidence = surfaceIncidence(observedKinematic, surfaceAngleDeg);
    return {
      ownedLineId: line.id,
      carrier: {
        lineIndex: line.lineIndex,
        lengthPx: round(line.lengthPx),
        rawSurfaceAngleDeg: round(rawSurfaceAngleDeg),
        surfaceAngleDeg: round(surfaceAngleDeg),
        reorientedForForwardHeading: surfaceAngleDeg !== rawSurfaceAngleDeg,
        closestPointToTarget: roundRecord(line.closestPointToTarget),
        adjacentTurnsDeg: roundRecord(line.adjacentTurnsDeg),
      },
      incoming: {
        frame: observed.selected!.frame - 1,
        headingDeg: round(preHeadingDeg),
        speedPxPerFrame: round(preSpeed),
      },
      incidence: {
        signedIncidenceDeg: round(incidence.signedIncidenceDeg),
        normalClosingSpeedPxPerFrame: round(incidence.normalClosingSpeedPxPerFrame),
        requestedTurnDeg: requestedTurnDeg === null ? null : round(requestedTurnDeg),
        shareOfRequestedTurn: requestedTurnDeg === null || requestedTurnDeg <= 1e-9
          ? null
          : round(Math.abs(incidence.signedIncidenceDeg) / requestedTurnDeg),
      },
      response: {
        frame: responseFrame,
        headingDeg: round(responseHeadingDeg),
        netTurnDeg: round(netTurnDeg),
        redirArcPx: round(redirArcPx),
        normalizedImpact: round(normImpact(redirArcPx)),
        requestedRedirArcPx: targetArc === null ? null : round(targetArc),
        shareOfRequestedArc: targetArc === null || targetArc <= 1e-9 ? null : round(redirArcPx / targetArc),
      },
    };
  });
  return {
    label: record.label,
    index: record.index,
    localStatus: record.local.status,
    replayHash: lineHash,
    replayHashMatches: true,
    responseReplayMatches,
    selectedOwnedEvent: observed.selected,
    observations,
  };
}

function observeLocalResponse(lines: TrackLine[]) {
  const responseEndFrame = Math.max(
    prepared.current.endFrame,
    Math.min(prepared.outgoing.endFrame - 1, prepared.current.endFrame + IMPACT_WINDOW + 1),
  );
  const engine = prepared.engine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  const detection = detectWindow(engine, prepared.current.startFrame, responseEndFrame);
  const observation = observeOwnedContactTransition(detection, {
    targetFrame: prepared.current.endFrame,
    gapFrames: prepared.current.endFrame - prepared.current.startFrame,
    observationEndFrame: responseEndFrame,
    ownedLineIds: new Set(lines.map((line) => line.id)),
    requiredLineRoles: ["raw_proposal"],
    lineRoles: new Map(lines.map((line) => [line.id, "raw_proposal"])),
  });
  return { detection, selected: observation.selectedOwnedEvent, responseEndFrame };
}

function orientTowardHeading(surfaceAngleDeg: number, headingDeg: number): number {
  const forward = normalizeContactAngleDeg(surfaceAngleDeg);
  const reverse = normalizeContactAngleDeg(surfaceAngleDeg + 180);
  return Math.abs(normalizeContactAngleDeg(headingDeg - reverse)) <
      Math.abs(normalizeContactAngleDeg(headingDeg - forward))
    ? reverse
    : forward;
}

function lineAngleDeg(line: TrackLine): number {
  return Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
}

function sameIds(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function summarize(values: readonly number[]) {
  if (values.length === 0) return { count: 0, min: null, median: null, mean: null, max: null };
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: values.length,
    min: round(sorted[0]!),
    median: round(sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    max: round(sorted[sorted.length - 1]!),
  };
}

function roundPoint(point: { x: number; y: number }) {
  return { x: round(point.x), y: round(point.y) };
}

function roundRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [
    key,
    typeof value === "number" ? round(value) : value,
  ])) as T;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

type LocalStatus =
  | "closed"
  | "preclear"
  | "survival"
  | "landing"
  | "persistence_unavailable"
  | "response_unavailable"
  | "offbeat"
  | "error";
type SelectedOwnedEvent = { frame: number; ownedLineIds: number[] };
type LocalClosureStudy = {
  schema: "line.study-local-contact-closure.v4";
  provenance: { fixturePath: string; fixtureFingerprint: string };
  panel: { id: string };
  rawNormal: { streamSeed: number };
  rawRecords: Array<{
    label: string;
    index: number;
    proposal: { lineHash: string } | null;
    local: {
      status: LocalStatus;
      endpoint: { observation: { selectedOwnedEvent: SelectedOwnedEvent | null } | null } | null;
    };
  }>;
};
