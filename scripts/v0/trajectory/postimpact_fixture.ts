/**
 * Sealed frozen-prefix boundary for post-impact trajectory studies.
 *
 * The construction callback receives only physical prefix state, a fresh line
 * id, and the current impact event. Authored outgoing information and panel
 * provenance stay inside this module until the callback has completed.
 */
import { readFileSync } from "node:fs";
import { engineLineFromTrackLine, makeBaseEngine } from "../core/substrate.ts";
import type { TrackLine } from "../types.ts";
import {
  assertPostimpactV3FixtureIntegrity,
  sha256,
  stableJson,
  withValidatedPostimpactStudyInputs,
  type PostimpactCurrentContactInput,
  type PostimpactFrozenTrajectoryFixtureV3,
  type PostimpactObservationInput,
  type PostimpactTrackLine,
} from "./postimpact_study_inputs.ts";
import { extractPlanningState, type PlanningState } from "./state.ts";

export const POSTIMPACT_MAX_LINE_ID = 0x7fffffff;

/** The only physical state available to pre-observation construction. */
export type PreparedPostimpactFixture = {
  // deno-lint-ignore no-explicit-any
  engine: any;
  targetPlanningState: PlanningState;
  nextLineId: number;
};

/** Provenance is returned only after construction, never passed to it. */
export type PostimpactFixtureAudit = {
  fixtureFingerprint: string;
  purpose: string;
  runtime: {
    engine: string;
    relevantEnvironment: Record<string, string>;
    captureBudget: number;
    studySourceFingerprint: string;
  };
  panel: {
    id: string;
    cohort: string;
    category: string;
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
};

export type PostimpactStudyConstructionContext = {
  readonly prepared: Readonly<PreparedPostimpactFixture>;
  readonly current: Readonly<PostimpactCurrentContactInput>;
};

export type PostimpactStudyInputBoundaryResult<T> = {
  constructionResult: T;
  observation: PostimpactObservationInput;
  /** Audit/provenance is intentionally released only with post-run observation. */
  audit: PostimpactFixtureAudit;
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
 * Validate and reconstruct the frozen physical prefix. The returned object is
 * deliberately target-blind: it contains no panel identity, source, seed,
 * category, outgoing frame, authored axes, or materialized schedule.
 */
export function preparePostimpactFixture(
  fixture: unknown,
  options: PreparePostimpactFixtureOptions = {},
): PreparedPostimpactFixture {
  assertPostimpactV3FixtureIntegrity(fixture, "post-impact fixture");
  return prepareValidatedPostimpactFixture(fixture, options);
}

/** Read, validate, and prepare a V3 post-impact fixture from disk. */
export function readPostimpactFixture(
  path: string,
  options: PreparePostimpactFixtureOptions = {},
): PreparedPostimpactFixture {
  return preparePostimpactFixture(JSON.parse(readFileSync(path, "utf8")) as unknown, options);
}

/**
 * The canonical post-impact study API. It owns the raw frozen snapshot, gives
 * `construct` only a narrow target-blind context, and does not disclose the
 * outgoing observation or provenance until that synchronous callback returns.
 */
export function withPostimpactStudyInputBoundary<T>(
  fixture: unknown,
  construct: (context: PostimpactStudyConstructionContext) => T,
  options: PreparePostimpactFixtureOptions = {},
): PostimpactStudyInputBoundaryResult<T> {
  assertPostimpactV3FixtureIntegrity(fixture, "post-impact fixture");
  // Do not let a caller holding the source object mutate post-construction
  // observation data from inside its callback. The boundary owns this clone.
  const sealedFixture = deepFreeze(structuredClone(fixture));
  const prepared = prepareValidatedPostimpactFixture(sealedFixture, options);
  const context = sealedConstructionContext(prepared);
  const result = withValidatedPostimpactStudyInputs(sealedFixture, (current) => construct(Object.freeze({
    prepared: context.prepared,
    current,
  })));
  return {
    ...result,
    audit: auditForFixture(sealedFixture),
  };
}

/** Path-owning variant so a runner need not import the broad frozen-fixture API. */
export function withPostimpactStudyInputBoundaryFromPath<T>(
  path: string,
  construct: (context: PostimpactStudyConstructionContext) => T,
  options: PreparePostimpactFixtureOptions = {},
): PostimpactStudyInputBoundaryResult<T> {
  return withPostimpactStudyInputBoundary(
    JSON.parse(readFileSync(path, "utf8")) as unknown,
    construct,
    options,
  );
}

function prepareValidatedPostimpactFixture(
  fixture: PostimpactFrozenTrajectoryFixtureV3,
  options: PreparePostimpactFixtureOptions,
): PreparedPostimpactFixture {
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
    engine,
    targetPlanningState,
    nextLineId: fixture.physicalPrefix.prefixNextLineId,
  };
}

function sealedConstructionContext(prepared: PreparedPostimpactFixture): {
  prepared: Readonly<PreparedPostimpactFixture>;
} {
  const targetPlanningState = deepFreeze(structuredClone(prepared.targetPlanningState));
  return {
    prepared: Object.freeze({
      engine: prepared.engine,
      targetPlanningState,
      nextLineId: prepared.nextLineId,
    }),
  };
}

function auditForFixture(fixture: PostimpactFrozenTrajectoryFixtureV3): PostimpactFixtureAudit {
  return Object.freeze({
    fixtureFingerprint: fixture.fixtureFingerprint,
    purpose: fixture.purpose,
    runtime: Object.freeze({
      engine: fixture.capture.runtime.engine,
      relevantEnvironment: Object.freeze({ ...fixture.capture.runtime.relevantEnvironment }),
      captureBudget: fixture.capture.captureBudget,
      studySourceFingerprint: fixture.capture.studySourceFingerprint,
    }),
    panel: Object.freeze({
      id: fixture.panel.id,
      cohort: fixture.panel.cohort,
      category: fixture.panel.category,
      sourcePath: fixture.panel.sourcePath,
      sourceFingerprint: fixture.panel.sourceFingerprint,
      publicSeed: fixture.panel.publicSeed,
      selectionRationale: fixture.panel.selectionRationale,
      currentGap: fixture.panel.selectedTargetGap,
      currentFrame: fixture.panel.currentFrame,
    }),
    physicalPrefix: Object.freeze({
      fingerprint: fixture.physicalPrefixFingerprint,
      nextLineId: fixture.physicalPrefix.prefixNextLineId,
    }),
  });
}

function assertFixtureShape(fixture: PostimpactFrozenTrajectoryFixtureV3): void {
  const prefix = fixture.physicalPrefix;
  if (prefix.schema !== "line.trajectory-physical-prefix.v1") {
    throw new Error("post-impact fixture has an unsupported physical-prefix schema");
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
  let maximumLineId = -1;
  for (const id of lineIds) maximumLineId = Math.max(maximumLineId, id);
  if (prefix.prefixNextLineId <= maximumLineId) {
    throw new Error("post-impact fixture nextLineId must be greater than every committed prefix line id");
  }
  postimpactLineIdRange(prefix.prefixNextLineId, 1);
}

function assertRuntimeMatchesFixture(fixture: PostimpactFrozenTrajectoryFixtureV3, environment: NodeJS.ProcessEnv): void {
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

// Keep reconstruction local so this module has no optimizer/study-context dependency.
// deno-lint-ignore no-explicit-any
function rebuildPhysicalPrefix(fixture: PostimpactFrozenTrajectoryFixtureV3): any {
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
function addLines(engine: any, lines: readonly PostimpactTrackLine[]): any {
  if (lines.length === 0) return engine;
  // Conversion caches mutate TrackLine with a symbol; do not attach that cache to
  // the parsed frozen artifact itself.
  return engine.addLine(lines.map((line) => engineLineFromTrackLine({ ...line } as TrackLine)));
}

function assertPhysicalLine(line: PostimpactTrackLine, lineIds: Set<number>): void {
  if (line === null || typeof line !== "object") {
    throw new Error("post-impact fixture physical-prefix line must be an object");
  }
  if (!Number.isSafeInteger(line.id) || line.id < 0 || line.id > POSTIMPACT_MAX_LINE_ID) {
    throw new Error("post-impact fixture physical-prefix line id must be a non-negative signed 32-bit integer");
  }
  if (lineIds.has(line.id)) throw new Error("post-impact fixture physical-prefix line ids must be unique");
  lineIds.add(line.id);
  if (line.type !== 0 && line.type !== 1 && line.type !== 2) {
    throw new Error("post-impact fixture physical-prefix line type is invalid");
  }
  for (const [name, value] of Object.entries({
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
  })) {
    if (!Number.isFinite(value)) throw new Error(`post-impact fixture physical-prefix line ${name} must be finite`);
  }
  if (Math.hypot(line.x2 - line.x1, line.y2 - line.y1) <= 1e-12) {
    throw new Error("post-impact fixture physical-prefix lines must have non-zero length");
  }
  if (typeof line.flipped !== "boolean" ||
      typeof line.leftExtended !== "boolean" ||
      typeof line.rightExtended !== "boolean") {
    throw new Error("post-impact fixture physical-prefix line flags must be boolean");
  }
}

function assertFiniteStartState(start: PostimpactFrozenTrajectoryFixtureV3["physicalPrefix"]["startState"]): void {
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

function assertDeclaredPlanningState(state: PostimpactFrozenTrajectoryFixtureV3["checkpoints"]["targetPlanningState"]): void {
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

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, seen);
  return value;
}
