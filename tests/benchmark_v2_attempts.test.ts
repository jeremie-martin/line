import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  appendAttemptEvent,
  initializeLedgerFromConfirmationState,
  projectEraState,
  readAttemptEvents,
  readEraState,
  retryStatus,
  type AttemptEventInput,
  type AttemptPaths,
} from "../scripts/v0/benchmark_v2/attempts.ts";

function tmpPaths(): AttemptPaths {
  const dir = mkdtempSync(join(tmpdir(), "attempts-"));
  return { ledger: join(dir, "attempts.jsonl"), projection: join(dir, "era-state.json") };
}

let clock = 0;
function nextAt(): string {
  clock += 1;
  const seconds = String(clock).padStart(2, "0");
  return `2026-07-11T00:00:${seconds}.000Z`;
}

function bootstrap(overrides: Record<string, unknown> = {}): AttemptEventInput {
  return {
    type: "era-start",
    eraId: "era-1",
    cause: "bootstrap",
    baselineLabel: "base-A",
    budgetCap: 0.05,
    ...overrides,
  } as AttemptEventInput;
}

function declare(overrides: Record<string, unknown> = {}): AttemptEventInput {
  return {
    type: "declare",
    eraId: "era-1",
    attemptId: "att-1",
    declarationPath: "benchmark/v2/confirmations/att-1.json",
    declarationSha256: "a".repeat(64),
    candidateFingerprint: "cand-1",
    operatingPointId: "improve-t0-d48",
    mode: "improvement",
    margin: null,
    depth: 48,
    spend: 0.0157,
    certificationFingerprint: "cert-1",
    canonicalSeedBase: 1_000_000,
    seedCount: 96,
    seedScheduleFingerprint: "sched-1",
    retryAcknowledged: false,
    ...overrides,
  } as AttemptEventInput;
}

function verdict(attemptId: string, outcome: string): AttemptEventInput {
  return {
    type: "verdict",
    attemptId,
    outcome,
    decisionArtifactPath: `benchmark/v2/decisions/${attemptId}.json`,
    decisionArtifactSha256: "c".repeat(64),
  } as AttemptEventInput;
}

function abort(attemptId: string): AttemptEventInput {
  return { type: "abort", attemptId, reason: "operator abort" } as AttemptEventInput;
}

describe("era-state projection round-trip", () => {
  test("budgetSpent resets per era while cumulative accumulates", () => {
    const paths = tmpPaths();
    appendAttemptEvent(
      bootstrap({
        importedSeedLedger: [
          { attemptId: "legacy-1", canonicalSeedBase: 500_000, seedCount: 96, seedScheduleFingerprint: "legacy-sched" },
        ],
      }),
      paths,
      nextAt(),
    );
    const afterDeclare = appendAttemptEvent(
      declare({ attemptId: "att-1", candidateFingerprint: "cand-1", spend: 0.0157, seedScheduleFingerprint: "sched-1" }),
      paths,
      nextAt(),
    );
    expect(afterDeclare.budgetSpent).toBe(0.0157);
    expect(afterDeclare.inFlightAttemptId).toBe("att-1");

    appendAttemptEvent(
      { type: "look", attemptId: "att-1", k: 2, delta: 3.1, standardError: 1.2, upperBound: 6.0, fired: false } as AttemptEventInput,
      paths,
      nextAt(),
    );
    const afterVerdict = appendAttemptEvent(verdict("att-1", "accept"), paths, nextAt());
    expect(afterVerdict.inFlightAttemptId).toBeNull();
    expect(afterVerdict.attempts[0].outcome).toBe("accept");
    expect(afterVerdict.budgetSpent).toBe(0.0157);

    const afterRebaseline = appendAttemptEvent(
      { type: "era-start", eraId: "era-2", cause: "rebaseline-accept", baselineLabel: "base-B", budgetCap: 0.05 } as AttemptEventInput,
      paths,
      nextAt(),
    );
    expect(afterRebaseline.eraId).toBe("era-2");
    expect(afterRebaseline.budgetSpent).toBe(0);
    expect(afterRebaseline.cumulativeExpectedFalseAccepts).toBe(0.0157);

    const final = appendAttemptEvent(
      declare({
        eraId: "era-2",
        attemptId: "att-2",
        candidateFingerprint: "cand-2",
        spend: 0.0157,
        canonicalSeedBase: 2_000_000,
        seedScheduleFingerprint: "sched-2",
      }),
      paths,
      nextAt(),
    );
    expect(final.budgetSpent).toBe(0.0157);
    expect(final.cumulativeExpectedFalseAccepts).toBe(0.0314);

    // The persisted projection recomputes byte-identically from the ledger.
    expect(readEraState(paths)).toEqual(final);
    // And the projection is a pure fold of the parsed events.
    expect(projectEraState(readAttemptEvents(paths))).toEqual(final);
  });
});

describe("tamper detection", () => {
  test("a hand-edited era-state.json no longer matches its ledger", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "t1", candidateFingerprint: "cT" }), paths, nextAt());

    const edited = JSON.parse(readFileSync(paths.projection!, "utf8"));
    edited.budgetSpent = 999;
    writeFileSync(paths.projection!, `${JSON.stringify(edited, null, 2)}\n`);

    expect(() => readEraState(paths)).toThrow(/does not match its ledger/);
  });
});

describe("era alpha-budget", () => {
  test("declares charge the cap; exhaustion refuses; override raises it", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap({ budgetCap: 0.05 }), paths, nextAt());

    for (const [attemptId, fingerprint] of [["a1", "cA"], ["a2", "cB"], ["a3", "cC"]]) {
      appendAttemptEvent(declare({ attemptId, candidateFingerprint: fingerprint, spend: 0.0157 }), paths, nextAt());
      appendAttemptEvent(verdict(attemptId, "reject"), paths, nextAt());
    }
    expect(readEraState(paths).budgetSpent).toBe(0.0471);

    expect(() =>
      appendAttemptEvent(declare({ attemptId: "a4", candidateFingerprint: "cD", spend: 0.0157 }), paths, nextAt()),
    ).toThrow(/--override-era-budget/);

    appendAttemptEvent(
      { type: "override", eraId: "era-1", previousCap: 0.05, newCap: 0.1, reason: "more headroom", operator: "jeremie" } as AttemptEventInput,
      paths,
      nextAt(),
    );
    const afterA4 = appendAttemptEvent(
      declare({ attemptId: "a4", candidateFingerprint: "cD", spend: 0.0157 }),
      paths,
      nextAt(),
    );
    expect(afterA4.budgetCap).toBe(0.1);
    expect(afterA4.budgetSpent).toBe(0.0628);

    expect(() =>
      appendAttemptEvent(
        { type: "override", eraId: "era-1", previousCap: 0.1, newCap: 0.08, reason: "x", operator: "y" } as AttemptEventInput,
        paths,
        nextAt(),
      ),
    ).toThrow(/must exceed/);
  });
});

describe("retry compounding", () => {
  test("a same-candidate retry refuses without acknowledgement", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "r1", candidateFingerprint: "cand-X" }), paths, nextAt());
    const afterAbort = appendAttemptEvent(abort("r1"), paths, nextAt());

    expect(retryStatus(afterAbort, "cand-X", 0.01)).toEqual({ priorAttempts: 1, compoundAlpha: 0.0199 });

    expect(() =>
      appendAttemptEvent(
        declare({ attemptId: "r2", candidateFingerprint: "cand-X", retryAcknowledged: false }),
        paths,
        nextAt(),
      ),
    ).toThrow(/acknowledge-retry/);

    const afterRetry = appendAttemptEvent(
      declare({ attemptId: "r2", candidateFingerprint: "cand-X", retryAcknowledged: true }),
      paths,
      nextAt(),
    );
    expect(afterRetry.inFlightAttemptId).toBe("r2");
    expect(retryStatus(afterRetry, "cand-X", 0.01).priorAttempts).toBe(2);
  });
});

describe("seed-ledger union", () => {
  test("bootstrap imports plus per-declare entries appear together", () => {
    const paths = tmpPaths();
    appendAttemptEvent(
      bootstrap({
        importedSeedLedger: [
          { attemptId: "legacy-1", canonicalSeedBase: 500_000, seedCount: 96, seedScheduleFingerprint: "legacy-sched" },
        ],
      }),
      paths,
      nextAt(),
    );
    const state = appendAttemptEvent(
      declare({
        attemptId: "att-1",
        canonicalSeedBase: 1_000_000,
        seedCount: 96,
        seedScheduleFingerprint: "sched-1",
      }),
      paths,
      nextAt(),
    );
    expect(state.seedLedger).toEqual([
      { attemptId: "legacy-1", canonicalSeedBase: 500_000, seedCount: 96, seedScheduleFingerprint: "legacy-sched" },
      { attemptId: "att-1", canonicalSeedBase: 1_000_000, seedCount: 96, seedScheduleFingerprint: "sched-1" },
    ]);
  });
});

describe("in-flight single-attempt invariant", () => {
  test("a second declare while one is in flight refuses until aborted", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "f1", candidateFingerprint: "cA" }), paths, nextAt());

    expect(() =>
      appendAttemptEvent(declare({ attemptId: "f2", candidateFingerprint: "cB" }), paths, nextAt()),
    ).toThrow(/already in flight/);

    appendAttemptEvent(abort("f1"), paths, nextAt());
    const state = appendAttemptEvent(declare({ attemptId: "f2", candidateFingerprint: "cB" }), paths, nextAt());
    expect(state.inFlightAttemptId).toBe("f2");

    expect(() =>
      appendAttemptEvent(
        { type: "look", attemptId: "f1", k: 2, delta: 1, standardError: 1, upperBound: 2, fired: false } as AttemptEventInput,
        paths,
        nextAt(),
      ),
    ).toThrow(/stale or unknown/);
  });
});

describe("era-start guards", () => {
  test("bootstrap-twice, rebaseline-after-reject refuse; transition then transition-rebaseline succeeds", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());

    expect(() =>
      appendAttemptEvent(bootstrap({ eraId: "era-x" }), paths, nextAt()),
    ).toThrow(/bootstrap era-start refused/);

    appendAttemptEvent(declare({ attemptId: "g1", candidateFingerprint: "cA" }), paths, nextAt());
    appendAttemptEvent(verdict("g1", "reject"), paths, nextAt());

    expect(() =>
      appendAttemptEvent(
        { type: "era-start", eraId: "era-2", cause: "rebaseline-accept", baselineLabel: "b", budgetCap: 0.05 } as AttemptEventInput,
        paths,
        nextAt(),
      ),
    ).toThrow(/rebaseline-accept era-start refused/);

    const afterTransition = appendAttemptEvent(
      { type: "transition", reason: "operator handoff", operator: "jeremie" } as AttemptEventInput,
      paths,
      nextAt(),
    );
    expect(afterTransition.transitionPending).toBe(true);

    const afterRebaseline = appendAttemptEvent(
      { type: "era-start", eraId: "era-2", cause: "transition-rebaseline", baselineLabel: "b2", budgetCap: 0.05 } as AttemptEventInput,
      paths,
      nextAt(),
    );
    expect(afterRebaseline.eraId).toBe("era-2");
    expect(afterRebaseline.eraCause).toBe("transition-rebaseline");
    expect(afterRebaseline.transitionPending).toBe(false);
  });
});

describe("bootstrap from confirmation state", () => {
  test("initializes ledger + projection without mutating the confirmation state", () => {
    const paths = tmpPaths();
    const confPath = join(mkdtempSync(join(tmpdir(), "attempts-conf-")), "confirmation-state.json");
    const confirmation = {
      schema: "line.benchmark-v2.confirmation-state.v4",
      status: "available",
      reason: null,
      baseline: {
        label: "v2-test-baseline",
        suiteFingerprint: "s".repeat(64),
        archiveSha256: "d".repeat(64),
        candidateFingerprint: "9".repeat(64),
        listeningReviewFingerprint: null,
        compilerSnapshot: null,
        inferenceFingerprint: null,
        protocolFingerprint: null,
        calibrationFingerprint: null,
      },
      seedLedger: [
        { attemptId: "legacy-1", canonicalSeedBase: 1_234_567, seedCount: 96, seedScheduleFingerprint: "legacy-fp" },
      ],
      attempt: null,
    };
    writeFileSync(confPath, `${JSON.stringify(confirmation, null, 2)}\n`);

    const state = initializeLedgerFromConfirmationState(confPath, paths, "2026-07-11T09:00:00.000Z");
    expect(existsSync(paths.ledger!)).toBe(true);
    expect(existsSync(paths.projection!)).toBe(true);
    expect(state.eraCause).toBe("bootstrap");
    expect(state.eraId).toBe("era-2026-07-11T09-00-00.000Z");
    expect(state.baselineLabel).toBe("v2-test-baseline");
    expect(state.budgetCap).toBe(0.05);
    expect(state.seedLedger).toEqual([
      { attemptId: "legacy-1", canonicalSeedBase: 1_234_567, seedCount: 96, seedScheduleFingerprint: "legacy-fp" },
    ]);

    // The confirmation state is read, never rewritten.
    expect(JSON.parse(readFileSync(confPath, "utf8"))).toEqual(confirmation);

    expect(() =>
      initializeLedgerFromConfirmationState(confPath, paths, "2026-07-11T10:00:00.000Z"),
    ).toThrow(/already exists/);
  });
});
