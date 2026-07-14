/**
 * Isolated V3 snapshot validation and post-impact input adapters.
 *
 * This module intentionally owns a small structural view of a frozen V3
 * snapshot instead of importing the wider trajectory-study fixture model. That
 * keeps a post-impact runner's static source closure free of panel/source
 * materialization code while still validating the same serialized evidence.
 *
 * The current-contact and outgoing-observation readers are private. Callers
 * reach them only through the sealed boundary in `postimpact_fixture.ts`:
 * construction receives the current contact, and observation is produced only
 * after that construction callback has returned.
 */
import { createHash } from "node:crypto";
import type { PlanningState } from "./state.ts";

export type PostimpactAxisValues = Partial<Record<
  "air" | "speed" | "amplitude" | "elevation" | "impact",
  number
>>;

export type PostimpactTrackLine = {
  id: number;
  type: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flipped: boolean;
  leftExtended: boolean;
  rightExtended: boolean;
};

export type PostimpactPlanningState = PlanningState;

export type PostimpactFrozenTrajectoryFixtureV3 = {
  schema: "line.frozen-trajectory-prefix.v3";
  fixtureFingerprint: string;
  purpose: string;
  capture: {
    argv: string[];
    runtime: { node: string; engine: string; relevantEnvironment: Record<string, string> };
    elapsedMs: number;
    captureBudget: number;
    studySourceFingerprint: string;
    studySourceFiles: string[];
    captureIdentity: PostimpactCaptureArtifactIdentity;
    identityCheck: PostimpactCaptureIdentityCheck;
    captureCompilerAtEnd: unknown;
  };
  panel: {
    id: string;
    cohort: string;
    category: string;
    sourcePath: string;
    sourceFingerprint: string;
    publicSeed: number;
    requestedTargetGap: number;
    selectionRationale: string;
    selectedTargetGap: number;
    outgoingGap: number;
    currentFrame: number;
    outgoingFrame: number;
    outgoingIntervalFrames: number;
    expectedOutgoingFrames: number | null;
    studyScope?: string | null;
  };
  transform: { value: unknown; fingerprint: string };
  materialized: {
    contactFrames: number[];
    durationFrames: number;
    gaps: PostimpactMaterializedGap[];
    gapAxisTargets: PostimpactAxisValues[];
  };
  materializedFingerprint: string;
  physicalPrefix: {
    schema: "line.trajectory-physical-prefix.v1";
    gapIndex: number;
    prefixNextLineId: number;
    cumulativeCost: number;
    searchSeed: number;
    startState: {
      position: { x: number; y: number };
      velocity: { x: number; y: number };
    };
    startLines: PostimpactTrackLine[];
    prefixFitLines: Array<PostimpactTrackLine[] | null>;
  };
  physicalPrefixFingerprint: string;
  checkpoints: {
    targetPlanningState: PostimpactPlanningState;
    targetProbeState: unknown;
    preTargetSledTrace: number[];
    targetPlanningStateFingerprint: string;
    targetProbeStateFingerprint: string;
    preTargetSledTraceFingerprint: string;
  };
  captureCompiler: unknown;
  baseline: {
    contractPassed: boolean;
    score: number;
    deepestGap: number | null;
    targetPrefixSimFrames: number;
  };
};

export type PostimpactCaptureArtifactIdentity = {
  schema: "line.frozen-trajectory-prefix-capture.v1";
  panelId: string;
  panelSourceFingerprint: string;
  captureBudget: number;
  engine: string;
  relevantEnvironment: Record<string, string>;
  studySourceFingerprint: string;
  captureCandidateFingerprint: string;
  protocolFingerprint: string;
  fingerprint: string;
};

export type PostimpactCaptureIdentityCheck = {
  stable: boolean;
  panelSourceFingerprintAtStart: string;
  panelSourceFingerprintAtEnd: string;
  studySourceFingerprintAtStart: string;
  studySourceFingerprintAtEnd: string;
  captureCandidateFingerprintAtStart: string;
  captureCandidateFingerprintAtEnd: string;
};

export type PostimpactMaterializedGap = {
  index: number;
  startFrame: number;
  endFrame: number;
  endsWithContact: boolean;
  targets: PostimpactAxisValues;
  nextImpact: unknown;
};

export type PostimpactCurrentContactInput = {
  gapIndex: number;
  startFrame: number;
  endFrame: number;
  intervalFrames: number;
  /** The current contact event only; no outgoing interval axes leak through. */
  impact: number;
};

export type PostimpactObservationInput = {
  outgoing: {
    gapIndex: number;
    startFrame: number;
    endFrame: number;
    intervalFrames: number;
    /** Reporting-only post-construction axes; the next event impact is omitted. */
    axes: PostimpactNonEventAxes;
  };
  /** Measurement metadata made available only after construction completes. */
  authoredContactFrames: readonly number[];
};

export type PostimpactNonEventAxes = Pick<PostimpactAxisValues, "air" | "speed" | "amplitude" | "elevation">;

/**
 * The sole duration signal intentionally released after target-blind capture
 * construction has completed. It is not a target-free value: together with
 * the known current end frame it reveals the outgoing interval duration.
 * Outgoing axes, next impact, contact identity, and panel provenance remain
 * sealed until the final observation stage.
 */
export type PostimpactOutgoingEndFrameInput = Readonly<{
  outgoingEndFrame: number;
}>;

/**
 * Validate the serialized V3 snapshot without importing panel declarations,
 * source materialization, or optimizer/study policy. This is intentionally
 * stricter than a root-only checksum: each independently declared immutable
 * payload is checked before any adapter reads authored data.
 */
export function assertPostimpactV3FixtureIntegrity(
  value: unknown,
  label = "post-impact fixture",
): asserts value is PostimpactFrozenTrajectoryFixtureV3 {
  if (!isRecord(value) || value.schema !== "line.frozen-trajectory-prefix.v3") {
    throw new Error(`${label}: requires a frozen V3 provenance artifact`);
  }
  const fixture = value as PostimpactFrozenTrajectoryFixtureV3;
  if (!isRecord(fixture.capture) || !isRecord(fixture.panel) || !isRecord(fixture.transform) ||
      !isRecord(fixture.materialized) || !isRecord(fixture.physicalPrefix) || !isRecord(fixture.checkpoints)) {
    throw new Error(`${label}: malformed V3 snapshot payload`);
  }
  if (typeof fixture.fixtureFingerprint !== "string" || fixture.fixtureFingerprint.length !== 64) {
    throw new Error(`${label}: missing fixture fingerprint`);
  }
  const { fixtureFingerprint, ...payload } = fixture;
  if (sha256(stableJson(payload)) !== fixtureFingerprint) {
    throw new Error(`${label}: fixture fingerprint does not match its payload`);
  }
  assertV3CaptureIdentity(fixture, label);
  if (!fixture.capture.identityCheck.stable) {
    throw new Error(`${label}: requires a stable V3 capture identity`);
  }
  assertDeclaredPayloadFingerprint(label, "transform", fixture.transform?.value, fixture.transform?.fingerprint);
  assertDeclaredPayloadFingerprint(label, "materialized", fixture.materialized, fixture.materializedFingerprint);
  assertDeclaredPayloadFingerprint(label, "physical-prefix", fixture.physicalPrefix, fixture.physicalPrefixFingerprint);
  assertDeclaredPayloadFingerprint(
    label,
    "target planning-state",
    fixture.checkpoints?.targetPlanningState,
    fixture.checkpoints?.targetPlanningStateFingerprint,
  );
  assertDeclaredPayloadFingerprint(
    label,
    "target probe-state",
    fixture.checkpoints?.targetProbeState,
    fixture.checkpoints?.targetProbeStateFingerprint,
  );
  assertDeclaredPayloadFingerprint(
    label,
    "pre-target sled trace",
    fixture.checkpoints?.preTargetSledTrace,
    fixture.checkpoints?.preTargetSledTraceFingerprint,
  );
  assertMaterializedStructure(fixture, label);
}

/** Same canonical JSON/hash representation used by the frozen V3 artifact. */
export function stableJson(value: unknown): string {
  const serialized = JSON.stringify(sortKeys(value));
  if (serialized === undefined) throw new Error("cannot canonicalize an undefined snapshot payload");
  return serialized;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Composition point for the sealed boundary. It validates the snapshot itself
 * so direct use cannot silently bypass provenance checks. The observation is
 * deliberately created only after `construct` returns synchronously.
 */
export function withValidatedPostimpactStudyInputs<T>(
  fixture: unknown,
  construct: (current: Readonly<PostimpactCurrentContactInput>) => T,
): { constructionResult: T; observation: PostimpactObservationInput } {
  assertPostimpactV3FixtureIntegrity(fixture, "post-impact study inputs");
  const current = Object.freeze(currentContactForValidatedFixture(fixture));
  const constructionResult = construct(current);
  if (isThenable(constructionResult)) {
    throw new Error("post-impact construction callback must complete synchronously before observation");
  }
  return {
    constructionResult,
    observation: postimpactObservationForValidatedFixture(fixture),
  };
}

/**
 * Staged composition for a duration-aware post-impact assay. Capture selection
 * receives the same target-blind current-contact input as the one-stage API.
 * Only after that synchronous callback returns does the boundary reveal the
 * scalar outgoing endpoint to a second construction stage. Full observation
 * remains unavailable until both stages have completed synchronously.
 */
export function withValidatedPostimpactCaptureThenDurationInputs<C, D>(
  fixture: unknown,
  selectCapture: (current: Readonly<PostimpactCurrentContactInput>) => C,
  constructDuration: (captureResult: C, availability: PostimpactOutgoingEndFrameInput) => D,
): { captureResult: C; durationResult: D; observation: PostimpactObservationInput } {
  assertPostimpactV3FixtureIntegrity(fixture, "post-impact study inputs");
  const current = Object.freeze(currentContactForValidatedFixture(fixture));
  const captureResult = selectCapture(current);
  assertSynchronousPostimpactCallback(captureResult, "capture selection");

  // Deliberately read only this scalar before duration construction. Do not
  // call postimpactObservationForValidatedFixture here: that would materialize
  // authored axes and contact metadata before the phase certificate is closed.
  const availability = Object.freeze({
    outgoingEndFrame: outgoingEndFrameForValidatedFixture(fixture),
  });
  const durationResult = constructDuration(captureResult, availability);
  assertSynchronousPostimpactCallback(durationResult, "duration construction");

  return {
    captureResult,
    durationResult,
    observation: postimpactObservationForValidatedFixture(fixture),
  };
}

function currentContactForValidatedFixture(
  fixture: PostimpactFrozenTrajectoryFixtureV3,
): PostimpactCurrentContactInput {
  const current = materializedGap(fixture, fixture.panel.selectedTargetGap, "current");
  if (!current.endsWithContact || current.endFrame !== fixture.panel.currentFrame) {
    throw new Error("post-impact current contact does not match the frozen panel frame");
  }
  const intervalFrames = interval(current.startFrame, current.endFrame, "current contact");
  const impact = current.targets.impact;
  if (typeof impact !== "number" || !Number.isFinite(impact) || !(impact > 0) || impact > 1) {
    throw new Error("post-impact capture requires a finite positive current impact target in [0, 1]");
  }
  const positiveImpact = impact;
  return {
    gapIndex: current.index,
    startFrame: current.startFrame,
    endFrame: current.endFrame,
    intervalFrames,
    impact: positiveImpact,
  };
}

function postimpactObservationForValidatedFixture(
  fixture: PostimpactFrozenTrajectoryFixtureV3,
): PostimpactObservationInput {
  const current = materializedGap(fixture, fixture.panel.selectedTargetGap, "current");
  const outgoing = materializedGap(fixture, fixture.panel.outgoingGap, "outgoing");
  const intervalFrames = assertValidatedOutgoingObservation(current, outgoing, fixture);
  return {
    outgoing: {
      gapIndex: outgoing.index,
      startFrame: outgoing.startFrame,
      endFrame: outgoing.endFrame,
      intervalFrames,
      axes: nonEventAxes(outgoing.targets),
    },
    authoredContactFrames: checkedContactFrames(fixture.materialized.contactFrames),
  };
}

function outgoingEndFrameForValidatedFixture(fixture: PostimpactFrozenTrajectoryFixtureV3): number {
  const current = materializedGap(fixture, fixture.panel.selectedTargetGap, "current");
  const outgoing = materializedGap(fixture, fixture.panel.outgoingGap, "outgoing");
  assertValidatedOutgoingObservation(current, outgoing, fixture);
  return outgoing.endFrame;
}

function assertValidatedOutgoingObservation(
  current: PostimpactMaterializedGap,
  outgoing: PostimpactMaterializedGap,
  fixture: PostimpactFrozenTrajectoryFixtureV3,
): number {
  if (!current.endsWithContact || !outgoing.endsWithContact || outgoing.startFrame !== current.endFrame) {
    throw new Error("post-impact outgoing observation gap must be contiguous after the current contact");
  }
  if (outgoing.endFrame !== fixture.panel.outgoingFrame) {
    throw new Error("post-impact outgoing observation frame does not match the frozen panel");
  }
  const intervalFrames = interval(outgoing.startFrame, outgoing.endFrame, "outgoing observation");
  if (intervalFrames !== fixture.panel.outgoingIntervalFrames) {
    throw new Error("post-impact outgoing observation interval does not match the frozen panel");
  }
  return intervalFrames;
}

function assertV3CaptureIdentity(fixture: PostimpactFrozenTrajectoryFixtureV3, label: string): void {
  if (!isRecord(fixture.capture) || !isRecord(fixture.capture.captureIdentity) || !isRecord(fixture.capture.identityCheck) ||
      !isRecord(fixture.panel) || !isRecord(fixture.capture.runtime) ||
      !isRecord(fixture.capture.captureIdentity.relevantEnvironment) ||
      !isRecord(fixture.capture.runtime.relevantEnvironment)) {
    throw new Error(`${label}: malformed V3 capture provenance`);
  }
  const identity = fixture.capture.captureIdentity;
  const { fingerprint, ...identityPayload } = identity;
  if (identity.schema !== "line.frozen-trajectory-prefix-capture.v1" ||
      typeof fingerprint !== "string" ||
      fingerprint !== sha256(stableJson(identityPayload))) {
    throw new Error(`${label}: invalid V3 capture artifact identity`);
  }
  const check = fixture.capture.identityCheck;
  if (typeof check.stable !== "boolean" ||
      typeof check.panelSourceFingerprintAtStart !== "string" ||
      typeof check.panelSourceFingerprintAtEnd !== "string" ||
      typeof check.studySourceFingerprintAtStart !== "string" ||
      typeof check.studySourceFingerprintAtEnd !== "string" ||
      typeof check.captureCandidateFingerprintAtStart !== "string" ||
      typeof check.captureCandidateFingerprintAtEnd !== "string" ||
      fixture.capture.captureCompilerAtEnd === undefined) {
    throw new Error(`${label}: V3 capture is missing its end-provenance check`);
  }
  if (identity.studySourceFingerprint !== fixture.capture.studySourceFingerprint ||
      identity.captureCandidateFingerprint !== check.captureCandidateFingerprintAtStart ||
      identity.studySourceFingerprint !== check.studySourceFingerprintAtStart ||
      identity.panelSourceFingerprint !== check.panelSourceFingerprintAtStart) {
    throw new Error(`${label}: V3 capture artifact identity does not bind its start provenance`);
  }
  if (identity.panelId !== fixture.panel.id ||
      identity.panelSourceFingerprint !== fixture.panel.sourceFingerprint ||
      identity.captureBudget !== fixture.capture.captureBudget ||
      identity.engine !== fixture.capture.runtime.engine ||
      stableJson(identity.relevantEnvironment) !== stableJson(fixture.capture.runtime.relevantEnvironment)) {
    throw new Error(`${label}: V3 capture artifact identity does not bind its declared panel or runtime`);
  }
  if (!Array.isArray(fixture.capture.studySourceFiles) || fixture.capture.studySourceFiles.length === 0) {
    throw new Error(`${label}: V3 capture is missing its static source closure`);
  }
  const endpointPairsEqual =
    check.panelSourceFingerprintAtStart === check.panelSourceFingerprintAtEnd &&
    check.studySourceFingerprintAtStart === check.studySourceFingerprintAtEnd &&
    check.captureCandidateFingerprintAtStart === check.captureCandidateFingerprintAtEnd;
  if (check.stable !== endpointPairsEqual) {
    throw new Error(`${label}: V3 capture stability does not match its endpoint identities`);
  }
  if (candidateFingerprintOf(fixture.captureCompiler) !== check.captureCandidateFingerprintAtStart ||
      candidateFingerprintOf(fixture.capture.captureCompilerAtEnd) !== check.captureCandidateFingerprintAtEnd) {
    throw new Error(`${label}: V3 capture compiler identities do not match their declared fingerprints`);
  }
}

function assertMaterializedStructure(fixture: PostimpactFrozenTrajectoryFixtureV3, label: string): void {
  const materialized = fixture.materialized;
  if (!isRecord(materialized) || !Array.isArray(materialized.contactFrames) || !Array.isArray(materialized.gaps) ||
      !Array.isArray(materialized.gapAxisTargets) || !Number.isSafeInteger(materialized.durationFrames) ||
      materialized.durationFrames < 0) {
    throw new Error(`${label}: malformed materialized trajectory payload`);
  }
  checkedContactFrames(materialized.contactFrames);
  for (const [index, gap] of materialized.gaps.entries()) {
    if (!isRecord(gap) || gap.index !== index || !isRecord(gap.targets) || typeof gap.endsWithContact !== "boolean") {
      throw new Error(`${label}: materialized gap ${index} is malformed or misindexed`);
    }
    interval(gap.startFrame, gap.endFrame, `materialized gap ${index}`);
    assertAxisValues(gap.targets, `${label}: materialized gap ${index}`);
  }
}

function materializedGap(
  fixture: PostimpactFrozenTrajectoryFixtureV3,
  index: number,
  role: "current" | "outgoing",
): PostimpactMaterializedGap {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error(`post-impact ${role} gap index must be a non-negative safe integer`);
  }
  const gap = fixture.materialized.gaps[index];
  if (gap === undefined || gap.index !== index) {
    throw new Error(`post-impact ${role} materialized gap is missing or misindexed`);
  }
  return gap;
}

function nonEventAxes(targets: PostimpactAxisValues): PostimpactNonEventAxes {
  const { air, speed, amplitude, elevation } = targets;
  return {
    ...(air === undefined ? {} : { air }),
    ...(speed === undefined ? {} : { speed }),
    ...(amplitude === undefined ? {} : { amplitude }),
    ...(elevation === undefined ? {} : { elevation }),
  };
}

function assertAxisValues(values: PostimpactAxisValues, label: string): void {
  const maxima = { air: 0.99, speed: 1, amplitude: 1, elevation: 1, impact: 1 } as const;
  for (const [name, maximum] of Object.entries(maxima) as Array<[keyof typeof maxima, number]>) {
    const value = values[name];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > maximum)) {
      throw new Error(`${label}: ${name} target must be finite and in [0, ${maximum}]`);
    }
  }
}

function interval(startFrame: number, endFrame: number, label: string): number {
  if (!Number.isSafeInteger(startFrame) || !Number.isSafeInteger(endFrame) || startFrame < 0 || endFrame <= startFrame) {
    throw new Error(`post-impact ${label} frames must be ordered non-negative safe integers`);
  }
  return endFrame - startFrame;
}

function checkedContactFrames(values: readonly number[]): readonly number[] {
  let previous = -1;
  const copied: number[] = [];
  for (const frame of values) {
    if (!Number.isSafeInteger(frame) || frame < 0 || frame <= previous) {
      throw new Error("post-impact authored contact frames must be strictly increasing non-negative safe integers");
    }
    copied.push(frame);
    previous = frame;
  }
  return copied;
}

function assertDeclaredPayloadFingerprint(
  label: string,
  name: string,
  payload: unknown,
  fingerprint: unknown,
): void {
  if (payload === undefined || typeof fingerprint !== "string" || fingerprint !== sha256(stableJson(payload))) {
    throw new Error(`${label}: ${name} fingerprint does not match its payload`);
  }
}

function candidateFingerprintOf(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.candidateFingerprint === "string" ? value.candidateFingerprint : null;
}

function assertSynchronousPostimpactCallback(value: unknown, name: string): void {
  if (isThenable(value)) {
    throw new Error(`post-impact ${name} callback must complete synchronously before observation`);
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortKeys(child)]));
  }
  return value;
}
