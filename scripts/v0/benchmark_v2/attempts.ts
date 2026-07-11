/**
 * Append-only attempt ledger and era-state projection (RFC C.2 item 8).
 *
 * The ledger (`benchmark/v2/attempts.jsonl`) is an event log: one JSON event
 * per line, never rewritten. The era-state projection
 * (`benchmark/v2/era-state.json`) is a pure fold of that log, rewritten
 * atomically after every append. Because the projection is derivable, a
 * hand-edit to either file is detectable (`readEraState` recomputes and
 * compares) — the ledger is the single source of truth for the era's
 * alpha-budget accounting and the never-reuse seed guarantee.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { benchmarkEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import {
  DEFAULT_CONFIRMATION_STATE_PATH,
  readConfirmationState,
  type SeedLedgerEntry,
} from "./confirmation.ts";

export const ATTEMPT_EVENT_SCHEMA = "line.benchmark-v2.attempt-event.v1" as const;
export const ERA_STATE_SCHEMA = "line.benchmark-v2.era-state.v1" as const;
export const DEFAULT_ATTEMPTS_LEDGER_PATH = "benchmark/v2/attempts.jsonl";
export const DEFAULT_ERA_STATE_PATH = "benchmark/v2/era-state.json";

export type AttemptMode = "improvement" | "simplification";
export type EraStartCause = "bootstrap" | "rebaseline-accept" | "suite-rollover" | "transition-rebaseline";

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

export type AbortEvent = EventEnvelope & {
  type: "abort";
  attemptId: string;
  reason: string;
};

export type AttemptEvent =
  | EraStartEvent
  | DeclareEvent
  | LookEvent
  | FutilityEvent
  | VerdictEvent
  | OverrideEvent
  | TransitionEvent
  | AbortEvent;

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

const KNOWN_EVENT_TYPES = new Set<AttemptEvent["type"]>([
  "era-start",
  "declare",
  "look",
  "futility",
  "verdict",
  "override",
  "transition",
  "abort",
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

  for (const event of events) {
    assertKnownEvent(event);
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
      case "look":
        break;
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

export function readAttemptEvents(paths?: AttemptPaths): AttemptEvent[] {
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
    assertKnownEvent(parsed);
    events.push(parsed);
  }
  return events;
}

/**
 * Reads the persisted projection and recomputes it from the ledger; a
 * mismatch means one of the two files was hand-edited (tamper detection).
 */
export function readEraState(paths?: AttemptPaths): EraState {
  const { projection } = resolvePaths(paths);
  if (!existsSync(projection)) {
    throw new Error(
      `era state is missing at ${projection}; bootstrap it with \`npm run benchmark -- eval\` ` +
      `(initializeLedgerFromConfirmationState)`,
    );
  }
  const onDisk = JSON.parse(readFileSync(projection, "utf8"));
  const recomputed = projectEraState(readAttemptEvents(paths));
  if (JSON.stringify(onDisk) !== JSON.stringify(recomputed)) {
    throw new Error(`era state does not match its ledger; the projection or ledger was edited by hand`);
  }
  return recomputed;
}

// ── Append ────────────────────────────────────────────────────────────────────

/**
 * Validates the event against the current projection, appends its JSONL line,
 * atomically rewrites the projection, and returns the new era-state.
 */
export function appendAttemptEvent(event: AttemptEventInput, paths?: AttemptPaths, at?: string): EraState {
  const { ledger, projection } = resolvePaths(paths);
  const normalized = withEnvelope(event, at);
  const existing = readAttemptEvents(paths);
  const current = projectEraState(existing);
  assertEventAllowed(current, normalized);
  const next = projectEraState([...existing, normalized]);
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, `${JSON.stringify(normalized)}\n`);
  writeAtomic(projection, next);
  return next;
}

// ── Guards / helpers exposed to the CLI ─────────────────────────────────────────

export function assertBudgetAllows(state: EraState, spend: number): void {
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
    (attempt) => attempt.candidateFingerprint === candidateFingerprint,
  ).length;
  const compoundAlpha = round6(1 - Math.pow(1 - criticalAlpha, priorAttempts + 1));
  return { priorAttempts, compoundAlpha };
}

/**
 * Bootstrap: seed a fresh eval ledger from an existing v4 confirmation state
 * WITHOUT modifying it. The bootstrap era-start carries the legacy seedLedger
 * verbatim (importedSeedLedger) so the never-reuse guarantee spans both
 * systems. Refuses if the ledger already exists.
 */
export function initializeLedgerFromConfirmationState(
  confirmationStatePath?: string,
  paths?: AttemptPaths,
  at?: string,
): EraState {
  const { ledger } = resolvePaths(paths);
  if (existsSync(ledger)) {
    throw new Error(
      `attempts ledger already exists at ${ledger}; the eval ledger is bootstrapped once — ` +
      `remove it deliberately to re-bootstrap`,
    );
  }
  const state = readConfirmationState(confirmationStatePath ?? DEFAULT_CONFIRMATION_STATE_PATH);
  const timestamp = at ?? new Date().toISOString();
  const event: EraStartEvent = {
    schema: ATTEMPT_EVENT_SCHEMA,
    type: "era-start",
    at: timestamp,
    eraId: `era-${timestamp.replaceAll(":", "-")}`,
    cause: "bootstrap",
    baselineLabel: state.baseline.label,
    budgetCap: benchmarkEvalPolicy.eraBudget.cap,
    importedSeedLedger: state.seedLedger,
  };
  return appendAttemptEvent(event, paths, timestamp);
}

// ── Append-time refusals ────────────────────────────────────────────────────────

function assertEventAllowed(state: EraState, event: AttemptEvent): void {
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
      if (event.newCap <= state.budgetCap) {
        throw new Error(
          `override refused: newCap ${event.newCap} must exceed the current era cap ${state.budgetCap}`,
        );
      }
      return;
    case "transition":
      return;
  }
}

function assertEraStartAllowed(state: EraState, event: EraStartEvent): void {
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
    case "transition-rebaseline":
      if (!state.transitionPending) {
        throw new Error(
          `transition-rebaseline era-start refused: no operator transition is pending; ` +
          `record a transition event first`,
        );
      }
      return;
    default:
      throw new Error(`unknown era-start cause ${JSON.stringify((event as EraStartEvent).cause)}`);
  }
}

function assertDeclareAllowed(state: EraState, event: DeclareEvent): void {
  if (state.inFlightAttemptId !== null) {
    throw new Error(
      `an eval attempt is already in flight (${state.inFlightAttemptId}); ` +
      `finish it with --resume or record an abort`,
    );
  }
  const operatingPoint = benchmarkEvalPolicy.operatingPoints.find(
    (point) => point.id === event.operatingPointId,
  );
  const criticalAlpha = operatingPoint?.criticalAlpha ?? 0.01;
  const { priorAttempts, compoundAlpha } = retryStatus(state, event.candidateFingerprint, criticalAlpha);
  if (priorAttempts > 0 && !event.retryAcknowledged) {
    throw new Error(
      `this candidate was already attempted ${priorAttempts} time(s); a retry compounds alpha to ` +
      `${compoundAlpha} — pass --acknowledge-retry to proceed`,
    );
  }
  assertBudgetAllows(state, event.spend);
}

// ── Internal utilities ──────────────────────────────────────────────────────────

function latestAttemptInEra(state: EraState, eraId: string | null): EraAttempt | undefined {
  for (let index = state.attempts.length - 1; index >= 0; index--) {
    if (state.attempts[index].eraId === eraId) return state.attempts[index];
  }
  return undefined;
}

function withEnvelope(event: AttemptEventInput, at?: string): AttemptEvent {
  const { schema: _schema, at: eventAt, ...body } = event as AttemptEvent & { at?: string };
  return {
    schema: ATTEMPT_EVENT_SCHEMA,
    at: eventAt ?? at ?? new Date().toISOString(),
    ...body,
  } as AttemptEvent;
}

function assertKnownEvent(event: unknown): asserts event is AttemptEvent {
  if (event === null || typeof event !== "object") {
    throw new Error(`malformed attempt event: expected an object, got ${JSON.stringify(event)}`);
  }
  const candidate = event as { schema?: unknown; type?: unknown };
  if (candidate.schema !== ATTEMPT_EVENT_SCHEMA) {
    throw new Error(`malformed attempt event: unexpected schema ${JSON.stringify(candidate.schema)}`);
  }
  if (!KNOWN_EVENT_TYPES.has(candidate.type as AttemptEvent["type"])) {
    throw new Error(`unknown attempt event type ${JSON.stringify(candidate.type)}`);
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
  const temporary = `${absolute}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, absolute);
}
