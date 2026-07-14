/**
 * Minimal frozen-prefix replayer for post-impact trajectory studies.
 *
 * This boundary deliberately reconstructs only the committed physical prefix
 * and its declared target planning state. It neither materializes a spec nor
 * exposes authored axes, outgoing-contact data, candidate probes, rankers, or
 * optimizer policy. A later assay must pass any post-target observation input
 * through a separate, explicitly timed boundary.
 */
import { engineLineFromTrackLine, makeBaseEngine } from "../core/substrate.ts";
import type { TrackLine } from "../types.ts";
import {
  assertFrozenTrajectoryFixtureIntegrity,
  readFrozenTrajectoryFixture,
  sha256,
  stableJson,
  type FrozenTrajectoryFixture,
  type FrozenTrajectoryFixtureV3,
} from "./frozen_fixture.ts";
import { extractPlanningState, type PlanningState } from "./state.ts";

export const POSTIMPACT_MAX_LINE_ID = 0x7fffffff;

export type PostimpactFixtureRuntime = {
  engine: string;
  relevantEnvironment: Record<string, string>;
  captureBudget: number;
  studySourceFingerprint: string;
};

/**
 * The deliberately small data surface available before post-impact construction.
 * In particular, it excludes outgoing frames, authored axes, materialized specs,
 * and capture candidate/ranking data.
 */
export type PreparedPostimpactFixture = {
  fixtureFingerprint: string;
  purpose: string;
  runtime: PostimpactFixtureRuntime;
  panel: {
    id: FrozenTrajectoryFixtureV3["panel"]["id"];
    cohort: FrozenTrajectoryFixtureV3["panel"]["cohort"];
    category: FrozenTrajectoryFixtureV3["panel"]["category"];
    sourcePath: string;
    sourceFingerprint: string;
    publicSeed: number;
    selectionRationale: string;
    currentGap: number;
    currentFrame: number;
  };
  physicalPrefix: {
    fingerprint: string;
    nextLineId: number;
  };
  // deno-lint-ignore no-explicit-any
  engine: any;
  targetPlanningState: PlanningState;
};

export type PreparePostimpactFixtureOptions = {
  /** Injectable only for deterministic runtime-identity tests. */
  environment?: NodeJS.ProcessEnv;
};

/**
 * Validate a future static-line allocation without mutating the frozen prefix.
 * Callers must reserve every line in one primitive atomically before replay.
 */
export function postimpactLineIdRange(
  nextLineId: number,
  lineCount: number,
): { start: number; end: number } {
  assertNonNegativeSigned32Integer("nextLineId", nextLineId);
  if (!Number.isSafeInteger(lineCount) || lineCount < 1) {
    throw new Error("post-impact lineCount must be a positive safe integer");
  }
  const end = nextLineId + lineCount - 1;
  if (!Number.isSafeInteger(end) || end > POSTIMPACT_MAX_LINE_ID) {
    throw new Error("post-impact line-id allocation overflows signed 32-bit engine ids");
  }
  return { start: nextLineId, end };
}

/**
 * Validate a stable V3 artifact, reconstruct its physical prefix, and prove the
 * resulting target planning state still matches the frozen checkpoint.
 */
export function preparePostimpactFixture(
  fixture: FrozenTrajectoryFixture,
  options: PreparePostimpactFixtureOptions = {},
): PreparedPostimpactFixture {
  assertFrozenTrajectoryFixtureIntegrity(fixture, "post-impact fixture");
  if (fixture.schema !== "line.frozen-trajectory-prefix.v3") {
    throw new Error("post-impact fixture requires a frozen V3 provenance artifact");
  }
  assertStableV3Capture(fixture);
  assertFixtureShape(fixture);
  assertRuntimeMatchesFixture(fixture, options.environment ?? process.env);

  const engine = rebuildPhysicalPrefix(fixture);
  const targetPlanningState = extractPlanningState(engine, fixture.panel.currentFrame);
  if (targetPlanningState === null) {
    throw new Error("post-impact fixture physical prefix cannot read the declared target planning state");
  }
  if (sha256(stableJson(targetPlanningState)) !== fixture.checkpoints.targetPlanningStateFingerprint) {
    throw new Error("post-impact fixture physical prefix does not replay the declared target planning state");
  }

  return {
    fixtureFingerprint: fixture.fixtureFingerprint,
    purpose: fixture.purpose,
    runtime: {
      engine: fixture.capture.runtime.engine,
      relevantEnvironment: { ...fixture.capture.runtime.relevantEnvironment },
      captureBudget: fixture.capture.captureBudget,
      studySourceFingerprint: fixture.capture.studySourceFingerprint,
    },
    panel: {
      id: fixture.panel.id,
      cohort: fixture.panel.cohort,
      category: fixture.panel.category,
      sourcePath: fixture.panel.sourcePath,
      sourceFingerprint: fixture.panel.sourceFingerprint,
      publicSeed: fixture.panel.publicSeed,
      selectionRationale: fixture.panel.selectionRationale,
      currentGap: fixture.panel.selectedTargetGap,
      currentFrame: fixture.panel.currentFrame,
    },
    physicalPrefix: {
      fingerprint: fixture.physicalPrefixFingerprint,
      nextLineId: fixture.physicalPrefix.prefixNextLineId,
    },
    engine,
    targetPlanningState,
  };
}

/** Read, validate, and prepare a V3 post-impact fixture from disk. */
export function readPostimpactFixture(
  path: string,
  options: PreparePostimpactFixtureOptions = {},
): PreparedPostimpactFixture {
  return preparePostimpactFixture(readFrozenTrajectoryFixture(path), options);
}

function assertStableV3Capture(fixture: FrozenTrajectoryFixtureV3): void {
  if (!fixture.capture.identityCheck.stable) {
    throw new Error("post-impact fixture requires a stable V3 capture identity");
  }
}

function assertFixtureShape(fixture: FrozenTrajectoryFixtureV3): void {
  const prefix = fixture.physicalPrefix;
  if (prefix.schema !== "line.trajectory-physical-prefix.v1") {
    throw new Error("post-impact fixture has an unsupported physical-prefix schema");
  }
  if (sha256(stableJson(prefix)) !== fixture.physicalPrefixFingerprint) {
    throw new Error("post-impact fixture physical-prefix fingerprint does not match its payload");
  }
  if (prefix.gapIndex !== fixture.panel.selectedTargetGap ||
      fixture.panel.requestedTargetGap !== fixture.panel.selectedTargetGap ||
      fixture.panel.outgoingGap !== fixture.panel.selectedTargetGap + 1) {
    throw new Error("post-impact fixture target/prefix declaration is internally inconsistent");
  }
  assertNonNegativeSafeInteger("panel currentFrame", fixture.panel.currentFrame);
  assertNonNegativeSafeInteger("physical-prefix gapIndex", prefix.gapIndex);
  assertNonNegativeSigned32Integer("physical-prefix nextLineId", prefix.prefixNextLineId);
  assertDeclaredPlanningState(fixture.checkpoints.targetPlanningState);
  if (fixture.checkpoints.targetPlanningState.frame !== fixture.panel.currentFrame) {
    throw new Error("post-impact fixture declared target planning-state frame does not match the panel");
  }
  if (sha256(stableJson(fixture.checkpoints.targetPlanningState)) !== fixture.checkpoints.targetPlanningStateFingerprint) {
    throw new Error("post-impact fixture declared target planning-state fingerprint does not match its payload");
  }
  assertFiniteStartState(prefix.startState);
  if (!Array.isArray(prefix.startLines) || !Array.isArray(prefix.prefixFitLines)) {
    throw new Error("post-impact fixture physical-prefix line collections must be arrays");
  }
  const lineIds = new Set<number>();
  for (const line of prefix.startLines) assertPhysicalLine(line, lineIds);
  for (const group of prefix.prefixFitLines) {
    if (group === null) continue;
    if (!Array.isArray(group)) throw new Error("post-impact fixture physical-prefix line group must be an array or null");
    for (const line of group) assertPhysicalLine(line, lineIds);
  }
  const maximumLineId = lineIds.size === 0 ? -1 : Math.max(...lineIds);
  if (prefix.prefixNextLineId <= maximumLineId) {
    throw new Error("post-impact fixture nextLineId must be greater than every committed prefix line id");
  }
  postimpactLineIdRange(prefix.prefixNextLineId, 1);
}

function assertRuntimeMatchesFixture(fixture: FrozenTrajectoryFixtureV3, environment: NodeJS.ProcessEnv): void {
  const activeEngine = environment.LR_ENGINE ?? "wasm";
  if (fixture.capture.runtime.engine !== activeEngine) {
    throw new Error(
      `post-impact fixture requires LR_ENGINE=${fixture.capture.runtime.engine}; received ${activeEngine}`,
    );
  }
  const activeRelevantEnvironment = relevantEnvironment(environment);
  if (stableJson(activeRelevantEnvironment) !== stableJson(fixture.capture.runtime.relevantEnvironment)) {
    throw new Error("post-impact fixture LR_* environment does not match the frozen capture");
  }
}

// Keep the reconstruction local so this module has no optimizer/study-context dependency.
// deno-lint-ignore no-explicit-any
function rebuildPhysicalPrefix(fixture: FrozenTrajectoryFixtureV3): any {
  const prefix = fixture.physicalPrefix;
  let engine = makeBaseEngine({
    position: { ...prefix.startState.position },
    velocity: { ...prefix.startState.velocity },
  });
  engine = addLines(engine, prefix.startLines);
  for (const group of prefix.prefixFitLines) {
    if (group !== null) engine = addLines(engine, group);
  }
  return engine;
}

// deno-lint-ignore no-explicit-any
function addLines(engine: any, lines: readonly TrackLine[]): any {
  if (lines.length === 0) return engine;
  // Conversion caches mutate TrackLine with a symbol; do not attach that cache to
  // the parsed frozen artifact itself.
  return engine.addLine(lines.map((line) => engineLineFromTrackLine({ ...line })));
}

function assertPhysicalLine(line: unknown, lineIds: Set<number>): void {
  if (line === null || typeof line !== "object") {
    throw new Error("post-impact fixture physical-prefix line must be an object");
  }
  const candidate = line as TrackLine;
  if (!Number.isSafeInteger(candidate.id) || candidate.id < 0 || candidate.id > POSTIMPACT_MAX_LINE_ID) {
    throw new Error("post-impact fixture physical-prefix line id must be a non-negative signed 32-bit integer");
  }
  if (lineIds.has(candidate.id)) throw new Error("post-impact fixture physical-prefix line ids must be unique");
  lineIds.add(candidate.id);
  if (candidate.type !== 0 && candidate.type !== 1 && candidate.type !== 2) {
    throw new Error("post-impact fixture physical-prefix line type is invalid");
  }
  for (const [name, value] of Object.entries({
    x1: candidate.x1,
    y1: candidate.y1,
    x2: candidate.x2,
    y2: candidate.y2,
  })) {
    if (!Number.isFinite(value)) throw new Error(`post-impact fixture physical-prefix line ${name} must be finite`);
  }
  if (Math.hypot(candidate.x2 - candidate.x1, candidate.y2 - candidate.y1) <= 1e-12) {
    throw new Error("post-impact fixture physical-prefix lines must have non-zero length");
  }
  if (typeof candidate.flipped !== "boolean" ||
      typeof candidate.leftExtended !== "boolean" ||
      typeof candidate.rightExtended !== "boolean") {
    throw new Error("post-impact fixture physical-prefix line flags must be boolean");
  }
}

function assertFiniteStartState(start: FrozenTrajectoryFixtureV3["physicalPrefix"]["startState"]): void {
  if (start === null || typeof start !== "object" ||
      start.position === null || typeof start.position !== "object" ||
      start.velocity === null || typeof start.velocity !== "object") {
    throw new Error("post-impact fixture start state is malformed");
  }
  for (const [name, value] of Object.entries({
    startX: start.position.x,
    startY: start.position.y,
    startVx: start.velocity.x,
    startVy: start.velocity.y,
  })) {
    if (!Number.isFinite(value)) throw new Error(`post-impact fixture ${name} must be finite`);
  }
}

function assertDeclaredPlanningState(state: PlanningState): void {
  if (state === null || typeof state !== "object" || !Number.isSafeInteger(state.frame) || state.frame < 0) {
    throw new Error("post-impact fixture declared target planning state is malformed");
  }
}

function assertNonNegativeSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`post-impact fixture ${name} must be a non-negative safe integer`);
  }
}

function assertNonNegativeSigned32Integer(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > POSTIMPACT_MAX_LINE_ID) {
    throw new Error(`post-impact fixture ${name} must be a non-negative signed 32-bit integer`);
  }
}

function relevantEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment)
      .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
      .map(([name, value]) => [name, value!])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}
