/**
 * Append-only attempt ledger and era-state projection (RFC C.2 item 8).
 *
 * The ledger (`benchmark/v2/attempts.jsonl`) is an event log: one JSON event
 * per line, never rewritten. The era-state projection
 * (`benchmark/v2/era-state.json`) is a pure fold of that log, rewritten
 * atomically after every append. The ledger is the single source of truth for
 * alpha-budget accounting and the never-reuse seed guarantee; reads repair a
 * missing or stale projection after an interrupted projection update.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { benchmarkEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import {
  EVAL_DECLARATION_SCHEMA,
  readBaselineContract,
  type SeedLedgerEntry,
} from "./confirmation.ts";

export const ATTEMPT_EVENT_SCHEMA = "line.benchmark-v2.attempt-event.v1" as const;
export const ERA_STATE_SCHEMA = "line.benchmark-v2.era-state.v1" as const;
export const DEFAULT_ATTEMPTS_LEDGER_PATH = "benchmark/v2/attempts.jsonl";
export const DEFAULT_ERA_STATE_PATH = "benchmark/v2/era-state.json";

export type AttemptMode = "improvement" | "simplification";
export type EraStartCause = "bootstrap" | "rebaseline-accept" | "suite-rollover";

type EventEnvelope = {
  schema: typeof ATTEMPT_EVENT_SCHEMA;
  at: string;
};

export type EraStartEvent = EventEnvelope & {
  type: "era-start";
  eraId: string;
  cause: EraStartCause;
  baselineLabel: string;
  budgetCap: number;
  /** Bootstrap only: the legacy confirmation seedLedger, carried verbatim so
   *  no canonical seed epoch is ever double-allocated across the two systems. */
  importedSeedLedger?: SeedLedgerEntry[];
};

export type DeclareEvent = EventEnvelope & {
  type: "declare";
  eraId: string;
  attemptId: string;
  declarationPath: string;
  declarationSha256: string;
  candidateFingerprint: string;
  operatingPointId: string;
  mode: AttemptMode;
  margin: number | null;
  depth: number;
  spend: number;
  certificationFingerprint: string;
  canonicalSeedBase: number;
  seedCount: number;
  seedScheduleFingerprint: string;
  retryAcknowledged: boolean;
};

export type LookEvent = EventEnvelope & {
  type: "look";
  attemptId: string;
  k: number;
  delta: number;
  standardError: number;
  upperBound: number;
  fired: boolean;
};

export type FutilityEvent = EventEnvelope & {
  type: "futility";
  attemptId: string;
  k: number;
  upperBound: number;
  threshold: number;
};

export type VerdictEvent = EventEnvelope & {
  type: "verdict";
  attemptId: string;
  outcome: string;
  decisionArtifactPath: string;
  decisionArtifactSha256: string;
};

export type OverrideEvent = EventEnvelope & {
  type: "override";
  eraId: string;
  previousCap: number;
  newCap: number;
  reason: string;
  operator: string;
};

export type TransitionEvent = EventEnvelope & {
  type: "transition";
  reason: string;
  operator: string;
};

export type BaselineTransitionCompleteEvent = EventEnvelope & {
  type: "baseline-transition-complete";
  baselineLabel: string;
};

export type AbortEvent = EventEnvelope & {
  type: "abort";
  attemptId: string;
  reason: string;
};

export type AccountingCorrectionEvent = EventEnvelope & {
  type: "accounting-correction";
  reason: string;
  operator: string;
  adjustments: Array<{
    attemptId: string;
    previousSpend: number;
    correctedSpend: number;
  }>;
};

export type AttemptEvent =
  | EraStartEvent
  | DeclareEvent
  | LookEvent
  | FutilityEvent
  | VerdictEvent
  | OverrideEvent
  | TransitionEvent
  | BaselineTransitionCompleteEvent
  | AbortEvent
  | AccountingCorrectionEvent;

/** A caller-supplied event: the schema envelope and `at` are filled on append. */
export type AttemptEventInput = AttemptEvent extends infer T
  ? T extends AttemptEvent ? Omit<T, "schema" | "at"> & { at?: string } : never
  : never;

export type EraAttempt = {
  attemptId: string;
  eraId: string;
  candidateFingerprint: string;
  operatingPointId: string;
  spend: number;
  declaredAt: string;
  outcome: string | null;
  /** Formal interim looks recorded for this attempt; progress output is not a look. */
  lookCount: number;
};

export type EraState = {
  schema: typeof ERA_STATE_SCHEMA;
  eraId: string | null;
  eraStartedAt: string | null;
  eraCause: string | null;
  baselineLabel: string | null;
  budgetCap: number;
  budgetSpent: number;
  cumulativeExpectedFalseAccepts: number;
  attempts: EraAttempt[];
  inFlightAttemptId: string | null;
  transitionPending: boolean;
  seedLedger: SeedLedgerEntry[];
};

export type AttemptPaths = { ledger?: string; projection?: string };

export type AttemptLedgerTransaction = {
  readonly events: readonly AttemptEvent[];
  readonly state: EraState;
  assertAllowed(event: AttemptEventInput, at?: string): void;
  append(event: AttemptEventInput, at?: string): EraState;
};

type LedgerLockOwner = {
  pid: number;
  processStart: string | null;
  token: string;
  acquiredAt: string;
};

const LOCK_WAIT_MS = 10;
const LOCK_TIMEOUT_MS = 30_000;
const MALFORMED_LOCK_GRACE_MS = 1_000;
const sleepCell = new Int32Array(new SharedArrayBuffer(4));

const KNOWN_EVENT_TYPES = new Set<AttemptEvent["type"]>([
  "era-start",
  "declare",
  "look",
  "futility",
  "verdict",
  "override",
  "transition",
  "baseline-transition-complete",
  "abort",
  "accounting-correction",
]);

// ── Projection ────────────────────────────────────────────────────────────────

/**
 * Pure fold of the event log into the current era-state. Total over any
 * well-formed ledger; throws only on unknown/malformed events or on a
 * declare-while-in-flight, which cannot legitimately appear in a well-formed
 * ledger (the append gate refuses it).
 */
export function projectEraState(events: AttemptEvent[]): EraState {
  let eraId: string | null = null;
  let eraStartedAt: string | null = null;
  let eraCause: string | null = null;
  let baselineLabel: string | null = null;
  let budgetCap: number = benchmarkEvalPolicy.eraBudget.cap;
  let budgetSpent = 0;
  let cumulativeExpectedFalseAccepts = 0;
  let importedSeedLedger: SeedLedgerEntry[] = [];
  let inFlightAttemptId: string | null = null;
  let transitionPending = false;
  const attempts: EraAttempt[] = [];
  const declaredSeedLedger: SeedLedgerEntry[] = [];

  const settle = (attemptId: string, outcome: string): void => {
    for (let index = attempts.length - 1; index >= 0; index--) {
      if (attempts[index].attemptId === attemptId) {
        attempts[index] = { ...attempts[index], outcome };
        break;
      }
    }
    if (inFlightAttemptId === attemptId) inFlightAttemptId = null;
  };

  const currentState = (): EraState => ({
    schema: ERA_STATE_SCHEMA,
    eraId,
    eraStartedAt,
    eraCause,
    baselineLabel,
    budgetCap,
    budgetSpent,
    cumulativeExpectedFalseAccepts,
    attempts,
    inFlightAttemptId,
    transitionPending,
    seedLedger: [...importedSeedLedger, ...declaredSeedLedger],
  });

  for (const event of events) {
    assertAttemptEvent(event);
    assertEventAllowed(currentState(), event);
    switch (event.type) {
      case "era-start": {
        eraId = event.eraId;
        eraStartedAt = event.at;
        eraCause = event.cause;
        baselineLabel = event.baselineLabel;
        budgetCap = event.budgetCap;
        budgetSpent = 0;
        transitionPending = false;
        if (event.importedSeedLedger !== undefined) importedSeedLedger = event.importedSeedLedger;
        break;
      }
      case "declare": {
        if (inFlightAttemptId !== null) {
          throw new Error(
            `malformed attempts ledger: declare ${event.attemptId} recorded while ${inFlightAttemptId} is still in flight`,
          );
        }
        const spend = round4(event.spend);
        budgetSpent = round4(budgetSpent + spend);
        cumulativeExpectedFalseAccepts = round4(cumulativeExpectedFalseAccepts + spend);
        attempts.push({
          attemptId: event.attemptId,
          eraId: event.eraId,
          candidateFingerprint: event.candidateFingerprint,
          operatingPointId: event.operatingPointId,
          spend,
          declaredAt: event.at,
          outcome: null,
          lookCount: 0,
        });
        declaredSeedLedger.push({
          attemptId: event.attemptId,
          canonicalSeedBase: event.canonicalSeedBase,
          seedCount: event.seedCount,
          seedScheduleFingerprint: event.seedScheduleFingerprint,
        });
        inFlightAttemptId = event.attemptId;
        break;
      }
      case "look": {
        const index = attempts.findIndex((attempt) => attempt.attemptId === event.attemptId);
        if (index < 0) throw new Error(`malformed attempts ledger: look references unknown attempt ${event.attemptId}`);
        attempts[index] = { ...attempts[index], lookCount: attempts[index].lookCount + 1 };
        break;
      }
      case "futility":
        settle(event.attemptId, "futility-stop");
        break;
      case "verdict":
        settle(event.attemptId, event.outcome);
        break;
      case "abort":
        settle(event.attemptId, "aborted");
        break;
      case "override":
        budgetCap = event.newCap;
        break;
      case "transition":
        transitionPending = true;
        break;
      case "baseline-transition-complete":
        baselineLabel = event.baselineLabel;
        transitionPending = false;
        break;
      case "accounting-correction":
        for (const adjustment of event.adjustments) {
          const index = attempts.findIndex((attempt) => attempt.attemptId === adjustment.attemptId);
          if (index < 0) {
            throw new Error(`malformed attempts ledger: accounting correction references unknown attempt ${adjustment.attemptId}`);
          }
          const attempt = attempts[index];
          if (round4(attempt.spend) !== round4(adjustment.previousSpend)) {
            throw new Error(
              `malformed attempts ledger: accounting correction for ${adjustment.attemptId} expected spend ` +
              `${adjustment.previousSpend}, found ${attempt.spend}`,
            );
          }
          const delta = round4(adjustment.correctedSpend - adjustment.previousSpend);
          attempts[index] = { ...attempt, spend: round4(adjustment.correctedSpend) };
          cumulativeExpectedFalseAccepts = round4(cumulativeExpectedFalseAccepts + delta);
          if (attempt.eraId === eraId) budgetSpent = round4(budgetSpent + delta);
        }
        break;
    }
  }

  return {
    schema: ERA_STATE_SCHEMA,
    eraId,
    eraStartedAt,
    eraCause,
    baselineLabel,
    budgetCap,
    budgetSpent,
    cumulativeExpectedFalseAccepts,
    attempts,
    inFlightAttemptId,
    transitionPending,
    seedLedger: [...importedSeedLedger, ...declaredSeedLedger],
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

function readAttemptEventsUnlocked(paths?: AttemptPaths): AttemptEvent[] {
  const { ledger } = resolvePaths(paths);
  if (!existsSync(ledger)) return [];
  const text = readFileSync(ledger, "utf8");
  const events: AttemptEvent[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`attempts ledger line ${index + 1} is not valid JSON; restore the tracked ledger`);
    }
    assertAttemptEvent(parsed);
    events.push(parsed);
  }
  return events;
}

export function readAttemptEvents(paths?: AttemptPaths): AttemptEvent[] {
  const resolved = resolvePaths(paths);
  if (!existsSync(resolved.ledger)) return [];
  return withAttemptLedgerTransaction(paths, (transaction) => [...transaction.events]);
}

/**
 * Reads the authoritative ledger under its transaction lock and repairs a
 * missing, malformed, or stale derived projection before returning.
 */
export function readEraState(paths?: AttemptPaths): EraState {
  const { ledger, projection } = resolvePaths(paths);
  if (!existsSync(ledger)) {
    throw new Error(
      `era state is missing at ${projection}; bootstrap it with \`npm run benchmark -- eval\` ` +
      `(initializeLedgerFromBaseline)`,
    );
  }
  return withAttemptLedgerTransaction(paths, (transaction) => transaction.state);
}

// ── Append ────────────────────────────────────────────────────────────────────

/**
 * Validates the event against the current projection, appends its JSONL line,
 * atomically rewrites the projection, and returns the new era-state.
 */
export function appendAttemptEvent(event: AttemptEventInput, paths?: AttemptPaths, at?: string): EraState {
  return withAttemptLedgerTransaction(paths, (transaction) => transaction.append(event, at));
}

/** Revalidate the immutable declaration against its authoritative ledger row. */
export function assertAttemptDeclarationCurrent(attemptId: string, paths?: AttemptPaths): DeclareEvent {
  return withAttemptLedgerTransaction(paths, (transaction) => {
    const event = transaction.events.find((candidate): candidate is DeclareEvent =>
      candidate.type === "declare" && candidate.attemptId === attemptId
    );
    if (event === undefined) throw new Error(`attempt ${attemptId} has no declaration event`);
    const operatingPoint = benchmarkEvalPolicy.operatingPoints.find((point) => point.id === event.operatingPointId);
    if (operatingPoint === undefined) {
      throw new Error(`declare refused: operating point ${event.operatingPointId} is not on the certified menu`);
    }
    assertDeclareArtifact(event, operatingPoint);
    return event;
  });
}

/**
 * Runs one synchronous ledger transaction under a cross-process exclusive
 * lock. Callers that derive an event from current state (notably fresh seed
 * allocation) must do that work and append the event inside this callback.
 * The callback must not call another ledger API for the same paths.
 */
export function withAttemptLedgerTransaction<T>(
  paths: AttemptPaths | undefined,
  callback: (transaction: AttemptLedgerTransaction) => T,
): T {
  const resolved = resolvePaths(paths);
  mkdirSync(dirname(resolved.ledger), { recursive: true });
  const release = acquireLedgerLock(resolved.ledger);
  try {
    let events = readAttemptEventsUnlocked(resolved);
    let state = projectEraState(events);
    repairProjection(resolved.projection, state);

    const transaction: AttemptLedgerTransaction = {
      get events() {
        return events;
      },
      get state() {
        return state;
      },
      assertAllowed(event, at) {
        assertEventAllowed(state, withEnvelope(event, at));
      },
      append(event, at) {
        const normalized = withEnvelope(event, at);
        assertEventAllowed(state, normalized);
        const nextEvents = [...events, normalized];
        const next = projectEraState(nextEvents);
        appendLedgerLine(resolved.ledger, normalized);
        writeAtomic(resolved.projection, next);
        events = nextEvents;
        state = next;
        return state;
      },
    };
    return callback(transaction);
  } finally {
    release();
  }
}

// ── Guards / helpers exposed to the CLI ─────────────────────────────────────────

export function assertBudgetAllows(state: EraState, spend: number): void {
  assertPositiveFinite(spend, "attempt spend");
  const wouldSpend = round4(state.budgetSpent + spend);
  if (wouldSpend > state.budgetCap) {
    throw new Error(
      `era alpha-budget exhausted (spent ${state.budgetSpent} of cap ${state.budgetCap}; ` +
      `this attempt needs ${spend}): raise it with ` +
      `\`npm run benchmark -- eval --to-verdict --override-era-budget --reason=...\` ` +
      `or rebaseline after an accepted attempt`,
    );
  }
}

export function retryStatus(
  state: EraState,
  candidateFingerprint: string,
  criticalAlpha: number,
): { priorAttempts: number; compoundAlpha: number } {
  const priorAttempts = state.attempts.filter(
    (attempt) => attempt.candidateFingerprint === candidateFingerprint && attempt.spend > 0,
  ).length;
  const compoundAlpha = round6(1 - Math.pow(1 - criticalAlpha, priorAttempts + 1));
  return { priorAttempts, compoundAlpha };
}

/**
 * Bootstrap: open the first era against the frozen baseline of record.
 * Refuses if the ledger already exists. (The repo's tracked ledger was
 * originally bootstrapped from the retired one-shot confirmation state and
 * carries its seed ledger verbatim in the bootstrap era-start.)
 */
export function initializeLedgerFromBaseline(
  baselinePath?: string,
  paths?: AttemptPaths,
  at?: string,
): EraState {
  const baseline = readBaselineContract(baselinePath);
  const timestamp = at ?? new Date().toISOString();
  const event: EraStartEvent = {
    schema: ATTEMPT_EVENT_SCHEMA,
    type: "era-start",
    at: timestamp,
    eraId: `era-${timestamp.replaceAll(":", "-")}`,
    cause: "bootstrap",
    baselineLabel: baseline.label,
    budgetCap: benchmarkEvalPolicy.eraBudget.cap,
  };
  return withAttemptLedgerTransaction(paths, (transaction) => {
    if (transaction.events.length > 0) {
      const { ledger } = resolvePaths(paths);
      throw new Error(
        `attempts ledger already exists at ${ledger}; the eval ledger is bootstrapped once — ` +
        `remove it deliberately to re-bootstrap`,
      );
    }
    return transaction.append(event, timestamp);
  });
}

// ── Append-time refusals ────────────────────────────────────────────────────────

function assertEventAllowed(state: EraState, event: AttemptEvent): void {
  assertAttemptEvent(event);
  switch (event.type) {
    case "era-start":
      assertEraStartAllowed(state, event);
      return;
    case "declare":
      assertDeclareAllowed(state, event);
      return;
    case "look":
    case "futility":
    case "verdict":
    case "abort":
      if (state.inFlightAttemptId === null || event.attemptId !== state.inFlightAttemptId) {
        throw new Error(
          `no attempt ${event.attemptId} is in flight (in flight: ${state.inFlightAttemptId ?? "none"}); ` +
          `this ${event.type} references a stale or unknown attempt — resume the active attempt or record its verdict`,
        );
      }
      return;
    case "override":
      if (event.eraId !== state.eraId) {
        throw new Error(`override refused: eraId ${event.eraId} does not match current era ${state.eraId ?? "none"}`);
      }
      if (event.previousCap !== state.budgetCap) {
        throw new Error(
          `override refused: previousCap ${event.previousCap} does not match current era cap ${state.budgetCap}`,
        );
      }
      if (event.newCap <= state.budgetCap) {
        throw new Error(
          `override refused: newCap ${event.newCap} must exceed the current era cap ${state.budgetCap}`,
        );
      }
      return;
    case "transition":
      assertNoAttemptInFlight(state, "transition");
      return;
    case "baseline-transition-complete":
      assertNoAttemptInFlight(state, "baseline transition completion");
      if (!state.transitionPending) {
        throw new Error(
          `baseline transition completion refused: no operator transition is pending; record a transition event first`,
        );
      }
      return;
    case "accounting-correction":
      assertNoAttemptInFlight(state, "accounting correction");
      assertAccountingCorrection(state, event);
      return;
  }
}

function assertAccountingCorrection(state: EraState, event: AccountingCorrectionEvent): void {
  if (event.reason.trim() === "" || event.operator.trim() === "" || event.adjustments.length === 0) {
    throw new Error(`accounting correction requires a reason, operator, and at least one adjustment`);
  }
  const seen = new Set<string>();
  for (const adjustment of event.adjustments) {
    if (seen.has(adjustment.attemptId)) {
      throw new Error(`accounting correction repeats attempt ${adjustment.attemptId}`);
    }
    seen.add(adjustment.attemptId);
    const attempt = state.attempts.find((candidate) => candidate.attemptId === adjustment.attemptId);
    if (attempt === undefined) {
      throw new Error(`accounting correction references unknown attempt ${adjustment.attemptId}`);
    }
    if (
      !Number.isFinite(adjustment.previousSpend) || !Number.isFinite(adjustment.correctedSpend) ||
      adjustment.previousSpend < 0 || adjustment.correctedSpend < 0
    ) throw new Error(`accounting correction spends must be finite and non-negative`);
    if (
      adjustment.correctedSpend < adjustment.previousSpend &&
      !(adjustment.correctedSpend === 0 && attempt.outcome === "aborted" && attempt.lookCount === 0)
    ) {
      throw new Error(
        `spend may decrease only to zero for an aborted attempt with no formal look`,
      );
    }
    if (round4(attempt.spend) !== round4(adjustment.previousSpend)) {
      throw new Error(
        `accounting correction for ${adjustment.attemptId} expected spend ${adjustment.previousSpend}, ` +
        `found ${attempt.spend}`,
      );
    }
  }
}

function assertEraStartAllowed(state: EraState, event: EraStartEvent): void {
  assertNoAttemptInFlight(state, `${event.cause} era-start`);
  switch (event.cause) {
    case "bootstrap":
      if (state.eraId !== null) {
        throw new Error(
          `bootstrap era-start refused: era ${state.eraId} already exists; rebaseline after an ` +
          `accepted attempt or record a suite rollover instead`,
        );
      }
      return;
    case "rebaseline-accept": {
      const latest = latestAttemptInEra(state, state.eraId);
      if (latest === undefined || latest.outcome !== "accept") {
        throw new Error(
          `rebaseline-accept era-start refused: the current era's latest attempt must be accepted ` +
          `(latest outcome: ${latest?.outcome ?? "none"})`,
        );
      }
      return;
    }
    case "suite-rollover":
      return;
    default:
      throw new Error(`unknown era-start cause ${JSON.stringify((event as EraStartEvent).cause)}`);
  }
}

export function assertNoAttemptInFlight(state: EraState, action: string): void {
  if (state.inFlightAttemptId !== null) {
    throw new Error(
      `${action} refused while eval attempt ${state.inFlightAttemptId} is in flight; ` +
      `finish it with --resume or record an abort`,
    );
  }
}

function assertDeclareAllowed(state: EraState, event: DeclareEvent): void {
  if (state.inFlightAttemptId !== null) {
    throw new Error(
      `an eval attempt is already in flight (${state.inFlightAttemptId}); ` +
      `finish it with --resume or record an abort`,
    );
  }
  if (state.eraId === null || event.eraId !== state.eraId) {
    throw new Error(`declare refused: eraId ${event.eraId} does not match current era ${state.eraId ?? "none"}`);
  }
  if (state.attempts.some((attempt) => attempt.attemptId === event.attemptId)) {
    throw new Error(`declare refused: attemptId ${event.attemptId} already exists`);
  }
  const end = event.canonicalSeedBase + event.seedCount;
  if (!Number.isSafeInteger(end)) throw new Error(`declare seed interval exceeds the safe integer range`);
  const overlap = state.seedLedger.find((entry) =>
    event.canonicalSeedBase < entry.canonicalSeedBase + entry.seedCount &&
    entry.canonicalSeedBase < end
  );
  if (overlap !== undefined) {
    throw new Error(`declare seed interval overlaps prior attempt ${overlap.attemptId}`);
  }
  const operatingPoint = benchmarkEvalPolicy.operatingPoints.find(
    (point) => point.id === event.operatingPointId,
  );
  if (operatingPoint === undefined) {
    throw new Error(`declare refused: operating point ${event.operatingPointId} is not on the certified menu`);
  }
  if (
    operatingPoint.mode !== event.mode || operatingPoint.margin !== event.margin ||
    operatingPoint.depth !== event.depth
  ) {
    throw new Error(
      `declare refused: mode, margin, and depth do not match certified point ${event.operatingPointId}`,
    );
  }
  assertDeclareArtifact(event, operatingPoint);
  const criticalAlpha = operatingPoint.criticalAlpha;
  const { priorAttempts, compoundAlpha } = retryStatus(state, event.candidateFingerprint, criticalAlpha);
  if (priorAttempts > 0 && !event.retryAcknowledged) {
    throw new Error(
      `this candidate was already attempted ${priorAttempts} time(s); a retry compounds nominal alpha to ` +
      `${compoundAlpha} (certified spend is accounted separately) — pass --acknowledge-retry to proceed`,
    );
  }
  assertBudgetAllows(state, event.spend);
}

function assertDeclareArtifact(
  event: DeclareEvent,
  operatingPoint: (typeof benchmarkEvalPolicy.operatingPoints)[number],
): void {
  const absolute = resolve(event.declarationPath);
  let bytes: Buffer;
  try {
    bytes = readFileSync(absolute);
  } catch {
    throw new Error(`declare refused: declaration artifact ${event.declarationPath} is missing`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== event.declarationSha256) {
    throw new Error(`declare refused: declaration artifact checksum does not match the ledger event`);
  }
  let declaration: any;
  try {
    declaration = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`declare refused: declaration artifact is not valid JSON`);
  }
  const mismatches: string[] = [];
  const check = (field: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push(field);
  };
  check("schema", declaration.schema, EVAL_DECLARATION_SCHEMA);
  check("attemptId", declaration.attemptId, event.attemptId);
  check("candidateFingerprint", declaration.candidateFingerprint, event.candidateFingerprint);
  check("candidateSnapshot.candidateFingerprint", declaration.candidateSnapshot?.candidateFingerprint, event.candidateFingerprint);
  check("operatingPointId", declaration.operatingPointId, event.operatingPointId);
  check("mode", declaration.mode, event.mode);
  check("margin", declaration.margin, event.margin);
  check("depth", declaration.depth, event.depth);
  check("criticalAlpha", declaration.criticalAlpha, operatingPoint.criticalAlpha);
  check("futilitySchedule", declaration.futilitySchedule, [...operatingPoint.futilitySchedule]);
  check("futilityAlpha", declaration.futilityAlpha, operatingPoint.futilityAlpha);
  check("eraBudgetSpend", declaration.eraBudgetSpend, event.spend);
  check("certificationFingerprint", declaration.certificationFingerprint, event.certificationFingerprint);
  check("canonicalSeedBase", declaration.canonicalSeedBase, event.canonicalSeedBase);
  check("seedScheduleFingerprint", declaration.seedScheduleFingerprint, event.seedScheduleFingerprint);
  check("retryAcknowledged", declaration.retryAcknowledged, event.retryAcknowledged);
  if (mismatches.length > 0) {
    throw new Error(`declare refused: declaration artifact disagrees with ledger fields: ${mismatches.join(", ")}`);
  }
}

// ── Internal utilities ──────────────────────────────────────────────────────────

function latestAttemptInEra(state: EraState, eraId: string | null): EraAttempt | undefined {
  for (let index = state.attempts.length - 1; index >= 0; index--) {
    if (state.attempts[index].eraId === eraId) return state.attempts[index];
  }
  return undefined;
}

function withEnvelope(event: AttemptEventInput, at?: string): AttemptEvent {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    throw new Error(`malformed attempt event: expected an object, got ${JSON.stringify(event)}`);
  }
  const { schema: _schema, at: eventAt, ...body } = event as AttemptEvent & { at?: string };
  return {
    schema: ATTEMPT_EVENT_SCHEMA,
    at: eventAt ?? at ?? new Date().toISOString(),
    ...body,
  } as AttemptEvent;
}

function assertAttemptEvent(event: unknown): asserts event is AttemptEvent {
  if (event === null || typeof event !== "object") {
    throw new Error(`malformed attempt event: expected an object, got ${JSON.stringify(event)}`);
  }
  const candidate = event as Record<string, unknown>;
  if (candidate.schema !== ATTEMPT_EVENT_SCHEMA) {
    throw new Error(`malformed attempt event: unexpected schema ${JSON.stringify(candidate.schema)}`);
  }
  if (!KNOWN_EVENT_TYPES.has(candidate.type as AttemptEvent["type"])) {
    throw new Error(`unknown attempt event type ${JSON.stringify(candidate.type)}`);
  }
  assertTimestamp(candidate.at, "at");

  switch (candidate.type as AttemptEvent["type"]) {
    case "era-start": {
      assertNonEmptyString(candidate.eraId, "era-start.eraId");
      if (!new Set<EraStartCause>(["bootstrap", "rebaseline-accept", "suite-rollover"]).has(candidate.cause as EraStartCause)) {
        throw new Error(`era-start.cause is invalid: ${JSON.stringify(candidate.cause)}`);
      }
      assertNonEmptyString(candidate.baselineLabel, "era-start.baselineLabel");
      assertPositiveFinite(candidate.budgetCap, "era-start.budgetCap");
      if (candidate.importedSeedLedger !== undefined) {
        if (candidate.cause !== "bootstrap") throw new Error(`importedSeedLedger is bootstrap-only`);
        assertSeedLedger(candidate.importedSeedLedger, "era-start.importedSeedLedger");
      }
      return;
    }
    case "declare":
      assertNonEmptyString(candidate.eraId, "declare.eraId");
      assertNonEmptyString(candidate.attemptId, "declare.attemptId");
      assertNonEmptyString(candidate.declarationPath, "declare.declarationPath");
      assertSha256(candidate.declarationSha256, "declare.declarationSha256");
      assertSha256(candidate.candidateFingerprint, "declare.candidateFingerprint");
      assertNonEmptyString(candidate.operatingPointId, "declare.operatingPointId");
      if (candidate.mode !== "improvement" && candidate.mode !== "simplification") {
        throw new Error(`declare.mode must be improvement or simplification`);
      }
      if (candidate.mode === "improvement") {
        if (candidate.margin !== null) throw new Error(`improvement declare.margin must be null`);
      } else {
        assertNonNegativeFinite(candidate.margin, "simplification declare.margin");
      }
      assertPositiveSafeInteger(candidate.depth, "declare.depth");
      assertPositiveFinite(candidate.spend, "declare.spend");
      assertSha256(candidate.certificationFingerprint, "declare.certificationFingerprint");
      assertNonNegativeSafeInteger(candidate.canonicalSeedBase, "declare.canonicalSeedBase");
      assertPositiveSafeInteger(candidate.seedCount, "declare.seedCount");
      assertSha256(candidate.seedScheduleFingerprint, "declare.seedScheduleFingerprint");
      assertBoolean(candidate.retryAcknowledged, "declare.retryAcknowledged");
      return;
    case "look":
      assertNonEmptyString(candidate.attemptId, "look.attemptId");
      assertPositiveSafeInteger(candidate.k, "look.k");
      assertFinite(candidate.delta, "look.delta");
      assertNonNegativeFinite(candidate.standardError, "look.standardError");
      assertFinite(candidate.upperBound, "look.upperBound");
      assertBoolean(candidate.fired, "look.fired");
      return;
    case "futility":
      assertNonEmptyString(candidate.attemptId, "futility.attemptId");
      assertPositiveSafeInteger(candidate.k, "futility.k");
      assertFinite(candidate.upperBound, "futility.upperBound");
      assertFinite(candidate.threshold, "futility.threshold");
      return;
    case "verdict":
      assertNonEmptyString(candidate.attemptId, "verdict.attemptId");
      if (!new Set(["accept", "inconclusive", "unresolved", "reject"]).has(candidate.outcome as string)) {
        throw new Error(`verdict.outcome is invalid: ${JSON.stringify(candidate.outcome)}`);
      }
      assertNonEmptyString(candidate.decisionArtifactPath, "verdict.decisionArtifactPath");
      assertSha256(candidate.decisionArtifactSha256, "verdict.decisionArtifactSha256");
      return;
    case "override":
      assertNonEmptyString(candidate.eraId, "override.eraId");
      assertPositiveFinite(candidate.previousCap, "override.previousCap");
      assertPositiveFinite(candidate.newCap, "override.newCap");
      assertNonEmptyString(candidate.reason, "override.reason");
      assertNonEmptyString(candidate.operator, "override.operator");
      return;
    case "transition":
      assertNonEmptyString(candidate.reason, "transition.reason");
      assertNonEmptyString(candidate.operator, "transition.operator");
      return;
    case "baseline-transition-complete":
      assertNonEmptyString(candidate.baselineLabel, "baseline-transition-complete.baselineLabel");
      return;
    case "abort":
      assertNonEmptyString(candidate.attemptId, "abort.attemptId");
      assertNonEmptyString(candidate.reason, "abort.reason");
      return;
    case "accounting-correction":
      assertNonEmptyString(candidate.reason, "accounting-correction.reason");
      assertNonEmptyString(candidate.operator, "accounting-correction.operator");
      if (!Array.isArray(candidate.adjustments) || candidate.adjustments.length === 0) {
        throw new Error(`accounting-correction.adjustments must be a non-empty array`);
      }
      for (const [index, adjustment] of candidate.adjustments.entries()) {
        if (adjustment === null || typeof adjustment !== "object" || Array.isArray(adjustment)) {
          throw new Error(`accounting-correction.adjustments[${index}] must be an object`);
        }
        const value = adjustment as Record<string, unknown>;
        assertNonEmptyString(value.attemptId, `accounting-correction.adjustments[${index}].attemptId`);
        assertNonNegativeFinite(value.previousSpend, `accounting-correction.adjustments[${index}].previousSpend`);
        assertNonNegativeFinite(value.correctedSpend, `accounting-correction.adjustments[${index}].correctedSpend`);
      }
      return;
  }
}

function assertSeedLedger(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const intervals: Array<{ attemptId: string; start: number; end: number }> = [];
  for (const [index, entry] of value.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${label}[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    assertNonEmptyString(record.attemptId, `${label}[${index}].attemptId`);
    assertNonNegativeSafeInteger(record.canonicalSeedBase, `${label}[${index}].canonicalSeedBase`);
    assertPositiveSafeInteger(record.seedCount, `${label}[${index}].seedCount`);
    assertSha256(record.seedScheduleFingerprint, `${label}[${index}].seedScheduleFingerprint`);
    const end = record.canonicalSeedBase + record.seedCount;
    if (!Number.isSafeInteger(end)) throw new Error(`${label}[${index}] seed interval exceeds the safe integer range`);
    if (intervals.some((interval) => interval.attemptId === record.attemptId)) {
      throw new Error(`${label} repeats attemptId ${record.attemptId}`);
    }
    const overlap = intervals.find((interval) => record.canonicalSeedBase < interval.end && interval.start < end);
    if (overlap !== undefined) throw new Error(`${label}[${index}] seed interval overlaps ${overlap.attemptId}`);
    intervals.push({ attemptId: record.attemptId, start: record.canonicalSeedBase, end });
  }
}

function assertTimestamp(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 fingerprint`);
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`);
}

function assertFinite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function assertNonNegativeFinite(value: unknown, label: string): asserts value is number {
  assertFinite(value, label);
  if (value < 0) throw new Error(`${label} must be non-negative`);
}

function assertPositiveFinite(value: unknown, label: string): asserts value is number {
  assertFinite(value, label);
  if (value <= 0) throw new Error(`${label} must be positive`);
}

function assertNonNegativeSafeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function assertPositiveSafeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function resolvePaths(paths?: AttemptPaths): { ledger: string; projection: string } {
  return {
    ledger: resolve(paths?.ledger ?? DEFAULT_ATTEMPTS_LEDGER_PATH),
    projection: resolve(paths?.projection ?? DEFAULT_ERA_STATE_PATH),
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function writeAtomic(path: string, value: unknown): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${randomUUID()}`;
  try {
    const descriptor = openSync(temporary, "wx");
    try {
      writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, absolute);
    fsyncDirectory(dirname(absolute));
  } finally {
    rmSync(temporary, { force: true });
  }
}

function appendLedgerLine(path: string, event: AttemptEvent): void {
  const descriptor = openSync(path, "a");
  try {
    writeFileSync(descriptor, `${JSON.stringify(event)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(dirname(path));
}

function repairProjection(path: string, state: EraState): void {
  let matches = false;
  if (existsSync(path)) {
    try {
      matches = JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) === JSON.stringify(state);
    } catch {
      matches = false;
    }
  }
  if (!matches) writeAtomic(path, state);
}

function acquireLedgerLock(ledgerPath: string): () => void {
  const lockPath = `${ledgerPath}.lock`;
  const owner: LedgerLockOwner = {
    pid: process.pid,
    processStart: processStart(process.pid),
    token: randomUUID(),
    acquiredAt: new Date().toISOString(),
  };
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  for (;;) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for attempts ledger lock ${lockPath}`);
    }
    if (recoveryClaimActive(lockPath)) {
      sleep(LOCK_WAIT_MS);
      continue;
    }
    try {
      writeExclusiveLock(lockPath, owner);
      return () => releaseOwnedLock(lockPath, owner.token);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const observed = readLockOwner(lockPath);
    if (observed !== null && lockOwnerAlive(observed)) {
      sleep(LOCK_WAIT_MS);
      continue;
    }
    if (observed === null && lockRecentlyCreated(lockPath)) {
      sleep(LOCK_WAIT_MS);
      continue;
    }

    // A unique recovery claim blocks new conforming owners while this stale
    // inode is removed. Multiple contenders may claim concurrently, but none
    // creates the replacement until every live claim is gone. A crashed claim
    // is independently removable because its path/token is never reused.
    const claimOwner = { ...owner, token: randomUUID(), acquiredAt: new Date().toISOString() };
    const claimPath = `${lockPath}.claim-${process.pid}-${claimOwner.token}`;
    writeExclusiveLock(claimPath, claimOwner);
    try {
      const current = readLockOwner(lockPath);
      if (current !== null && lockOwnerAlive(current)) {
        continue;
      }
      if (current === null && lockRecentlyCreated(lockPath)) {
        sleep(LOCK_WAIT_MS);
        continue;
      }
      rmSync(lockPath, { force: true });
    } finally {
      releaseOwnedLock(claimPath, claimOwner.token);
    }
  }
}

function recoveryClaimActive(lockPath: string): boolean {
  const directory = dirname(lockPath);
  const prefix = `${basename(lockPath)}.claim-`;
  let active = false;
  for (const entry of readdirSync(directory)) {
    if (!entry.startsWith(prefix)) continue;
    const path = resolve(directory, entry);
    const owner = readLockOwner(path);
    if (owner !== null && lockOwnerAlive(owner)) {
      active = true;
    } else if (owner === null && lockRecentlyCreated(path)) {
      active = true;
    } else {
      rmSync(path, { force: true });
    }
  }
  return active;
}

function writeExclusiveLock(path: string, owner: LedgerLockOwner): void {
  const descriptor = openSync(path, "wx");
  try {
    writeFileSync(descriptor, `${JSON.stringify(owner)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function readLockOwner(path: string): LedgerLockOwner | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<LedgerLockOwner>;
    if (
      !Number.isSafeInteger(value.pid) || (value.pid ?? 0) <= 0 ||
      typeof value.token !== "string" || typeof value.acquiredAt !== "string" ||
      !(typeof value.processStart === "string" || value.processStart === null)
    ) return null;
    return value as LedgerLockOwner;
  } catch {
    return null;
  }
}

function lockRecentlyCreated(path: string): boolean {
  try {
    return Date.now() - statSync(path).mtimeMs < MALFORMED_LOCK_GRACE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function lockOwnerAlive(owner: LedgerLockOwner): boolean {
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
  const currentStart = processStart(owner.pid);
  return owner.processStart === null || currentStart === null || owner.processStart === currentStart;
}

function processStart(pid: number): string | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
    return fields[19] ?? null;
  } catch {
    return null;
  }
}

function releaseOwnedLock(path: string, token: string): void {
  const owner = readLockOwner(path);
  if (owner?.token === token) rmSync(path, { force: true });
}

function fsyncDirectory(path: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, "r");
    fsyncSync(descriptor);
  } catch {
    // Directory fsync is not available on every supported filesystem. The
    // file itself is still synced before rename.
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function sleep(milliseconds: number): void {
  Atomics.wait(sleepCell, 0, 0, milliseconds);
}
