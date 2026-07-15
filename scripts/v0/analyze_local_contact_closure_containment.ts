/**
 * Reconstruct and describe raw-normal geometry from a completed local-contact
 * calibration study. This is a containment analysis, not a control fitter.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { clearImpactTemplateMarker, sampleArcPlacementGeometry } from "./arc_placement.ts";
import { fingerprintFiles } from "./benchmark_v2/suite_model.ts";
import { makeRng } from "../lib/rng.ts";
import { readFrozenTrajectoryFixture, sha256, stableJson } from "./trajectory/frozen_fixture.ts";
import { profileOwnedContactLines } from "./trajectory/owned_contact_profile.ts";
import { prepareComparableTrajectoryFixture } from "./trajectory/study_context.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: analyze_local_contact_closure_containment.ts --study=FILE [--out=FILE]",
    "",
    "Replays the study's deterministic raw-normal stream and profiles only line",
    "IDs that an already-recorded local detector attributed to an on-time contact.",
  ].join("\n") + "\n");
  process.exit(0);
}

const STUDY_SOURCE_FILES = [
  "scripts/v0/analyze_local_contact_closure_containment.ts",
  "scripts/v0/trajectory/owned_contact_profile.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/panel.ts",
  "scripts/v0/trajectory/state.ts",
  "scripts/v0/trajectory/target_frame.ts",
  "scripts/v0/arc_placement.ts",
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
  throw new Error("study panel no longer matches an active calibration fixture");
}
if (!Number.isSafeInteger(study.rawNormal.streamSeed)) throw new Error("study raw-normal stream seed is invalid");
const started = performance.now();
const rng = makeRng(study.rawNormal.streamSeed);
const records = study.rawRecords.map((record, attempt) => replayRawRecord(record, attempt, rng));
const closedProfiles = records.flatMap((record) => record.ownedContact === null ? [] : record.ownedContact.lines);
const output = {
  schema: "line.study-local-contact-closure-containment.v1",
  purpose: [
    "Verify deterministic raw-normal replay against the completed local-contact study.",
    "Describe exact detector-attributed owned contact lines in target-frame coordinates.",
    "Provide evidence for a later representation decision without deriving or selecting a candidate control.",
  ],
  study: {
    path: studyPath,
    fixturePath: study.provenance.fixturePath,
    fixtureFingerprint: fixture.fixtureFingerprint,
    rawStreamSeed: study.rawNormal.streamSeed,
    rawAttemptCount: study.rawRecords.length,
  },
  provenance: {
    runtime: { node: process.version, engine: process.env.LR_ENGINE ?? "js" },
    sourceFingerprint: fingerprintFiles(STUDY_SOURCE_FILES),
    elapsedMs: round(performance.now() - started),
  },
  targetFrame: {
    reference: { x: round(prepared.frame.reference.x), y: round(prepared.frame.reference.y) },
    headingDeg: round(prepared.frame.headingDeg),
    speedPxPerFrame: round(prepared.frame.speedPxPerFrame),
    sledSpanPx: round(prepared.frame.sledSpanPx),
  },
  records,
  summary: {
    attempted: records.length,
    locallyClosed: records.filter((record) => record.localStatus === "closed").length,
    replayHashesMatched: records.every((record) => record.replayHashMatches),
    attributedOwnedLineCount: closedProfiles.length,
    attributedLineMetrics: {
      lengthPx: summary(closedProfiles.map((line) => line.lengthPx)),
      angleRelativeDeg: summary(closedProfiles.map((line) => line.angleRelativeDeg)),
      closestTangentOffsetPx: summary(closedProfiles.map((line) => line.closestPointToTarget.tangentOffsetPx)),
      closestNormalOffsetPx: summary(closedProfiles.map((line) => line.closestPointToTarget.normalOffsetPx)),
      closestDistancePx: summary(closedProfiles.map((line) => line.closestPointToTarget.distancePx)),
      fromPreviousTurnDeg: summary(closedProfiles.flatMap((line) => line.adjacentTurnsDeg.fromPrevious === null ? [] : [line.adjacentTurnsDeg.fromPrevious])),
      toNextTurnDeg: summary(closedProfiles.flatMap((line) => line.adjacentTurnsDeg.toNext === null ? [] : [line.adjacentTurnsDeg.toNext])),
    },
  },
  caveats: [
    "The detector-attributed line is a physical observation, not necessarily the nearest target-frame vertex.",
    "This report does not invert raw geometry into compiler parameters and cannot justify copying a witness or selecting a constant.",
    "The raw normal stream is an operational comparator; repeated successful rows are not independent statistical samples.",
  ],
};

const outPath = argument("out") ?? `${studyPath.replace(/\.json$/, "")}.containment.json`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
process.stderr.write(
  `contact containment ${prepared.panel.id}: ${output.summary.locallyClosed}/${output.summary.attempted} raw closures, ` +
  `${output.summary.attributedOwnedLineCount} attributed lines -> ${outPath}\n`,
);

function replayRawRecord(record: LocalClosureStudy["rawRecords"][number], attempt: number, rng: () => number) {
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
  const selected = record.local.endpoint?.observation?.selectedOwnedEvent ?? null;
  const ownedContact = record.local.status === "closed" && selected !== null
    ? profileOwnedContactLines(prepared.frame, geometry.lines, selected.ownedLineIds)
    : null;
  return {
    label: record.label,
    index: record.index,
    localStatus: record.local.status,
    replayHash: lineHash,
    replayHashMatches: true,
    selectedOwnedEvent: selected,
    ownedContact,
  };
}

function summary(values: readonly number[]) {
  if (values.length === 0) return { count: 0, min: null, mean: null, max: null };
  return {
    count: values.length,
    min: round(Math.min(...values)),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    max: round(Math.max(...values)),
  };
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
type SelectedOwnedEvent = {
  type: string;
  frame: number;
  timingErrorFrames: number;
  ownedLineIds: number[];
};
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

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
