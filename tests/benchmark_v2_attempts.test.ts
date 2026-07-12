import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  appendAttemptEvent,
  assertAttemptDeclarationCurrent,
  initializeLedgerFromBaseline,
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
let declarationCounter = 0;
const testDeclarationDir = mkdtempSync(join(tmpdir(), "attempt-declarations-"));
function nextAt(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 6, 11) + clock * 1_000).toISOString();
}

function fp(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
  const event = {
    type: "declare",
    eraId: "era-1",
    attemptId: "att-1",
    candidateFingerprint: fp("cand-1"),
    operatingPointId: "improve-t0-d48",
    mode: "improvement",
    margin: null,
    depth: 48,
    spend: 0.0157,
    certificationFingerprint: fp("cert-1"),
    canonicalSeedBase: 1_000_000,
    seedCount: 96,
    seedScheduleFingerprint: fp("sched-1"),
    retryAcknowledged: false,
    ...overrides,
  } as any;
  const point = event.operatingPointId === "simplify-m5-d48"
    ? { criticalAlpha: 0.01, futilitySchedule: [], futilityAlpha: 0.05 }
    : { criticalAlpha: 0.01, futilitySchedule: [2, 3, 4, 8, 16], futilityAlpha: 0.05 };
  const declarationPath = join(testDeclarationDir, `${++declarationCounter}-${event.attemptId}.json`);
  const bytes = `${JSON.stringify({
    schema: "line.benchmark-v2.eval-declaration.v6",
    attemptId: event.attemptId,
    candidateFingerprint: event.candidateFingerprint,
    candidateSnapshot: { candidateFingerprint: event.candidateFingerprint },
    operatingPointId: event.operatingPointId,
    mode: event.mode,
    margin: event.margin,
    depth: event.depth,
    criticalAlpha: point.criticalAlpha,
    futilitySchedule: point.futilitySchedule,
    futilityAlpha: point.futilityAlpha,
    eraBudgetSpend: event.spend,
    certificationFingerprint: event.certificationFingerprint,
    canonicalSeedBase: event.canonicalSeedBase,
    seedScheduleFingerprint: event.seedScheduleFingerprint,
    retryAcknowledged: event.retryAcknowledged,
  })}\n`;
  writeFileSync(declarationPath, bytes);
  event.declarationPath = declarationPath;
  event.declarationSha256 = fp(bytes);
  return event as AttemptEventInput;
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
          { attemptId: "legacy-1", canonicalSeedBase: 500_000, seedCount: 96, seedScheduleFingerprint: fp("legacy-sched") },
        ],
      }),
      paths,
      nextAt(),
    );
    const afterDeclare = appendAttemptEvent(
      declare({ attemptId: "att-1", candidateFingerprint: fp("cand-1"), spend: 0.0157, seedScheduleFingerprint: fp("sched-1") }),
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
        candidateFingerprint: fp("cand-2"),
        spend: 0.0157,
        canonicalSeedBase: 2_000_000,
        seedScheduleFingerprint: fp("sched-2"),
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

describe("authoritative-ledger projection recovery", () => {
  test("repairs an edited or missing projection from the valid ledger", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "t1", candidateFingerprint: fp("cT") }), paths, nextAt());

    const edited = JSON.parse(readFileSync(paths.projection!, "utf8"));
    edited.budgetSpent = 999;
    writeFileSync(paths.projection!, `${JSON.stringify(edited, null, 2)}\n`);
    const recovered = readEraState(paths);
    expect(recovered.budgetSpent).toBe(0.0157);
    expect(JSON.parse(readFileSync(paths.projection!, "utf8"))).toEqual(recovered);

    rmSync(paths.projection!);
    expect(readEraState(paths)).toEqual(recovered);
    expect(existsSync(paths.projection!)).toBe(true);
  });

  test("repairs the append-before-projection crash window", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "crash-1", candidateFingerprint: fp("cT") }), paths, nextAt());
    const staleProjection = readFileSync(paths.projection!, "utf8");
    const event = {
      schema: "line.benchmark-v2.attempt-event.v1",
      type: "verdict",
      at: nextAt(),
      attemptId: "crash-1",
      outcome: "reject",
      decisionArtifactPath: "decision.json",
      decisionArtifactSha256: "d".repeat(64),
    };
    writeFileSync(paths.ledger!, `${readFileSync(paths.ledger!, "utf8")}${JSON.stringify(event)}\n`);
    expect(readFileSync(paths.projection!, "utf8")).toBe(staleProjection);

    const recovered = readEraState(paths);
    expect(recovered.inFlightAttemptId).toBeNull();
    expect(recovered.attempts.at(-1)?.outcome).toBe("reject");
    expect(JSON.parse(readFileSync(paths.projection!, "utf8"))).toEqual(recovered);
  });
});

describe("era alpha-budget", () => {
  test("declares charge the cap; exhaustion refuses; override raises it", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap({ budgetCap: 0.05 }), paths, nextAt());

    for (const [index, [attemptId, fingerprint]] of [["a1", "cA"], ["a2", "cB"], ["a3", "cC"]].entries()) {
      appendAttemptEvent(declare({
        attemptId,
        candidateFingerprint: fp(fingerprint),
        canonicalSeedBase: 1_000_000 + index * 1_000,
        spend: 0.0157,
      }), paths, nextAt());
      appendAttemptEvent(verdict(attemptId, "reject"), paths, nextAt());
    }
    expect(readEraState(paths).budgetSpent).toBe(0.0471);

    expect(() =>
      appendAttemptEvent(declare({ attemptId: "a4", candidateFingerprint: fp("cD"), canonicalSeedBase: 1_003_000, spend: 0.0157 }), paths, nextAt()),
    ).toThrow(/--override-era-budget/);

    appendAttemptEvent(
      { type: "override", eraId: "era-1", previousCap: 0.05, newCap: 0.1, reason: "more headroom", operator: "jeremie" } as AttemptEventInput,
      paths,
      nextAt(),
    );
    const afterA4 = appendAttemptEvent(
      declare({ attemptId: "a4", candidateFingerprint: fp("cD"), canonicalSeedBase: 1_003_000, spend: 0.0157 }),
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

  test("applies immutable spend corrections to the audited attempt and appropriate era totals", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap({ budgetCap: 0.05 }), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "undercharged", spend: 0.0157 }), paths, nextAt());
    appendAttemptEvent(verdict("undercharged", "accept"), paths, nextAt());
    appendAttemptEvent(
      { type: "era-start", eraId: "era-2", cause: "rebaseline-accept", baselineLabel: "b2", budgetCap: 0.05 } as AttemptEventInput,
      paths,
      nextAt(),
    );

    const corrected = appendAttemptEvent({
      type: "accounting-correction",
      reason: "fresh holdout established the conservative cross-artifact bound",
      operator: "benchmark-v2-audit",
      adjustments: [{ attemptId: "undercharged", previousSpend: 0.0157, correctedSpend: 0.0196 }],
    } as AttemptEventInput, paths, nextAt());
    expect(corrected.attempts[0].spend).toBe(0.0196);
    expect(corrected.cumulativeExpectedFalseAccepts).toBe(0.0196);
    expect(corrected.budgetSpent).toBe(0);

    expect(() => appendAttemptEvent({
      type: "accounting-correction",
      reason: "duplicate",
      operator: "test",
      adjustments: [{ attemptId: "undercharged", previousSpend: 0.0157, correctedSpend: 0.0196 }],
    } as AttemptEventInput, paths, nextAt())).toThrow(/expected spend 0.0157, found 0.0196/);
  });
});

describe("retry compounding", () => {
  test("a same-candidate retry refuses without acknowledgement", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "r1", candidateFingerprint: fp("cand-X") }), paths, nextAt());
    const afterAbort = appendAttemptEvent(abort("r1"), paths, nextAt());

    expect(retryStatus(afterAbort, fp("cand-X"), 0.01)).toEqual({ priorAttempts: 1, compoundAlpha: 0.0199 });

    expect(() =>
      appendAttemptEvent(
        declare({ attemptId: "r2", candidateFingerprint: fp("cand-X"), canonicalSeedBase: 2_000_000, retryAcknowledged: false }),
        paths,
        nextAt(),
      ),
    ).toThrow(/acknowledge-retry/);

    const afterRetry = appendAttemptEvent(
      declare({ attemptId: "r2", candidateFingerprint: fp("cand-X"), canonicalSeedBase: 2_000_000, retryAcknowledged: true }),
      paths,
      nextAt(),
    );
    expect(afterRetry.inFlightAttemptId).toBe("r2");
    expect(retryStatus(afterRetry, fp("cand-X"), 0.01).priorAttempts).toBe(2);
  });
});

describe("seed-ledger union", () => {
  test("bootstrap imports plus per-declare entries appear together", () => {
    const paths = tmpPaths();
    appendAttemptEvent(
      bootstrap({
        importedSeedLedger: [
          { attemptId: "legacy-1", canonicalSeedBase: 500_000, seedCount: 96, seedScheduleFingerprint: fp("legacy-sched") },
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
        seedScheduleFingerprint: fp("sched-1"),
      }),
      paths,
      nextAt(),
    );
    expect(state.seedLedger).toEqual([
      { attemptId: "legacy-1", canonicalSeedBase: 500_000, seedCount: 96, seedScheduleFingerprint: fp("legacy-sched") },
      { attemptId: "att-1", canonicalSeedBase: 1_000_000, seedCount: 96, seedScheduleFingerprint: fp("sched-1") },
    ]);
  });
});

describe("in-flight single-attempt invariant", () => {
  test("a second declare while one is in flight refuses until aborted", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "f1", candidateFingerprint: fp("cA") }), paths, nextAt());

    expect(() =>
      appendAttemptEvent(declare({ attemptId: "f2", candidateFingerprint: fp("cB"), canonicalSeedBase: 2_000_000 }), paths, nextAt()),
    ).toThrow(/already in flight/);

    appendAttemptEvent(abort("f1"), paths, nextAt());
    const state = appendAttemptEvent(declare({ attemptId: "f2", candidateFingerprint: fp("cB"), canonicalSeedBase: 2_000_000 }), paths, nextAt());
    expect(state.inFlightAttemptId).toBe("f2");

    expect(() =>
      appendAttemptEvent(
        { type: "look", attemptId: "f1", k: 2, delta: 1, standardError: 1, upperBound: 2, fired: false } as AttemptEventInput,
        paths,
        nextAt(),
      ),
    ).toThrow(/stale or unknown/);
  });

  test("serializes state-derived seed allocation across processes", async () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap({ budgetCap: 1 }), paths, nextAt());
    const startAt = Date.now() + 1_000;
    const source = `
      import { createHash } from "node:crypto";
      import { writeFileSync } from "node:fs";
      import { withAttemptLedgerTransaction } from "./scripts/v0/benchmark_v2/attempts.ts";
      import { allocateCanonicalSeedBase } from "./scripts/v0/benchmark_v2/confirmation.ts";
      const [ledger, projection, id, startAt] = process.argv.slice(1);
      while (Date.now() < Number(startAt)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
      try {
        withAttemptLedgerTransaction({ ledger, projection }, (transaction) => {
          const canonicalSeedBase = allocateCanonicalSeedBase(transaction.state.seedLedger, 96);
          const event = {
            type: "declare", eraId: "era-1", attemptId: "child-" + id,
            candidateFingerprint: String(id).padStart(64, "0"),
            operatingPointId: "improve-t0-d48", mode: "improvement", margin: null, depth: 48,
            spend: 0.0196, certificationFingerprint: "c".repeat(64), canonicalSeedBase, seedCount: 96,
            seedScheduleFingerprint: String(canonicalSeedBase).padStart(64, "0"), retryAcknowledged: false,
          };
          const declarationPath = ledger + ".declaration-" + id + ".json";
          const bytes = JSON.stringify({ schema: "line.benchmark-v2.eval-declaration.v6", ...event,
            candidateSnapshot: { candidateFingerprint: event.candidateFingerprint }, criticalAlpha: 0.01,
            futilitySchedule: [2,3,4,8,16], futilityAlpha: 0.05, eraBudgetSpend: event.spend }) + "\\n";
          writeFileSync(declarationPath, bytes);
          transaction.append({ ...event, declarationPath,
            declarationSha256: createHash("sha256").update(bytes).digest("hex") });
        });
        process.stdout.write("committed");
      } catch (error) {
        process.stdout.write("refused:" + error.message);
      }
    `;
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) => runChild(source, [paths.ledger!, paths.projection!, String(index), String(startAt)])),
    );
    expect(results.filter((result) => result.stdout === "committed")).toHaveLength(1);
    expect(results.filter((result) => result.stdout.includes("already in flight"))).toHaveLength(11);
    const events = readAttemptEvents(paths);
    expect(events.filter((event) => event.type === "declare")).toHaveLength(1);
    expect(readEraState(paths).seedLedger).toHaveLength(1);
    expect(existsSync(`${paths.ledger}.lock`)).toBe(false);
  }, 15_000);

  test("never reuses seed intervals when concurrent transactions all settle", async () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap({ budgetCap: 1 }), paths, nextAt());
    const startAt = Date.now() + 1_000;
    const source = `
      import { createHash } from "node:crypto";
      import { writeFileSync } from "node:fs";
      import { withAttemptLedgerTransaction } from "./scripts/v0/benchmark_v2/attempts.ts";
      import { allocateCanonicalSeedBase } from "./scripts/v0/benchmark_v2/confirmation.ts";
      const [ledger, projection, id, startAt] = process.argv.slice(1);
      while (Date.now() < Number(startAt)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
      const canonicalSeedBase = withAttemptLedgerTransaction({ ledger, projection }, (transaction) => {
        const seedBase = allocateCanonicalSeedBase(transaction.state.seedLedger, 96);
        const attemptId = "settled-" + id;
        const event = {
          type: "declare", eraId: "era-1", attemptId,
          candidateFingerprint: String(id).padStart(64, "0"),
          operatingPointId: "improve-t0-d48", mode: "improvement", margin: null, depth: 48,
          spend: 0.0196, certificationFingerprint: "c".repeat(64), canonicalSeedBase: seedBase, seedCount: 96,
          seedScheduleFingerprint: String(seedBase).padStart(64, "0"), retryAcknowledged: false,
        };
        const declarationPath = ledger + ".declaration-" + id + ".json";
        const bytes = JSON.stringify({ schema: "line.benchmark-v2.eval-declaration.v6", ...event,
          candidateSnapshot: { candidateFingerprint: event.candidateFingerprint }, criticalAlpha: 0.01,
          futilitySchedule: [2,3,4,8,16], futilityAlpha: 0.05, eraBudgetSpend: event.spend }) + "\\n";
        writeFileSync(declarationPath, bytes);
        transaction.append({ ...event, declarationPath,
          declarationSha256: createHash("sha256").update(bytes).digest("hex") });
        transaction.append({ type: "abort", attemptId, reason: "test settlement" });
        return seedBase;
      });
      process.stdout.write(String(canonicalSeedBase));
    `;
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        runChild(source, [paths.ledger!, paths.projection!, String(index), String(startAt)])),
    );
    expect(results.every((result) => result.code === 0)).toBe(true);
    const bases = results.map((result) => Number(result.stdout));
    expect(new Set(bases).size).toBe(12);
    const sorted = [...bases].sort((a, b) => a - b);
    for (let index = 1; index < sorted.length; index++) {
      expect(sorted[index] - sorted[index - 1]).toBeGreaterThanOrEqual(96);
    }
    const state = readEraState(paths);
    expect(state.seedLedger).toHaveLength(12);
    expect(state.inFlightAttemptId).toBeNull();
  }, 15_000);

  test("recovers a crashed lock holder before concurrent contenders proceed", async () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap({ budgetCap: 1 }), paths, nextAt());
    const holderSource = `
      import { withAttemptLedgerTransaction } from "./scripts/v0/benchmark_v2/attempts.ts";
      const [ledger, projection] = process.argv.slice(1);
      withAttemptLedgerTransaction({ ledger, projection }, () => {
        process.stdout.write("ready\\n");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000);
      });
    `;
    const holder = spawnNode(holderSource, [paths.ledger!, paths.projection!]);
    await waitForOutput(holder, "ready");
    holder.kill("SIGKILL");
    await waitForExit(holder);
    writeFileSync(`${paths.ledger}.lock.claim-dead-process`, `${JSON.stringify({
      pid: 999_999_999,
      processStart: "never",
      token: "dead-claim",
      acquiredAt: "2026-01-01T00:00:00.000Z",
    })}\n`);

    const contenderSource = `
      import { appendAttemptEvent } from "./scripts/v0/benchmark_v2/attempts.ts";
      const [ledger, projection, id] = process.argv.slice(1);
      appendAttemptEvent({ type: "transition", reason: "reason-" + id, operator: "test" }, { ledger, projection });
      process.stdout.write("committed");
    `;
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) => runChild(contenderSource, [paths.ledger!, paths.projection!, String(index)])),
    );
    expect(results.every((result) => result.stdout === "committed")).toBe(true);
    expect(readAttemptEvents(paths).filter((event) => event.type === "transition")).toHaveLength(8);
    expect(readEraState(paths).transitionPending).toBe(true);
    expect(existsSync(`${paths.ledger}.lock`)).toBe(false);
    expect(
      readFileNames(dirname(paths.ledger!)).some((name) => name.startsWith("attempts.jsonl.lock.claim-")),
    ).toBe(false);
  }, 15_000);
});

describe("era-start guards", () => {
  test("bootstrap-twice and rebaseline-after-reject refuse; transition completion preserves its era", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());

    expect(() =>
      appendAttemptEvent(bootstrap({ eraId: "era-x" }), paths, nextAt()),
    ).toThrow(/bootstrap era-start refused/);

    appendAttemptEvent(declare({ attemptId: "g1", candidateFingerprint: fp("cA") }), paths, nextAt());
    appendAttemptEvent(verdict("g1", "reject"), paths, nextAt());

    expect(() =>
      appendAttemptEvent(
        { type: "era-start", eraId: "era-2", cause: "rebaseline-accept", baselineLabel: "b", budgetCap: 0.05 } as AttemptEventInput,
        paths,
        nextAt(),
      ),
    ).toThrow(/rebaseline-accept era-start refused/);

    appendAttemptEvent({
      type: "override",
      eraId: "era-1",
      previousCap: 0.05,
      newCap: 0.1,
      reason: "preserve a non-default cap across the transition",
      operator: "test",
    } as AttemptEventInput, paths, nextAt());

    const afterTransition = appendAttemptEvent(
      { type: "transition", reason: "operator handoff", operator: "jeremie" } as AttemptEventInput,
      paths,
      nextAt(),
    );
    expect(afterTransition.transitionPending).toBe(true);

    const afterRebaseline = appendAttemptEvent(
      { type: "baseline-transition-complete", baselineLabel: "b2" } as AttemptEventInput,
      paths,
      nextAt(),
    );
    expect(afterRebaseline).toEqual({
      ...afterTransition,
      baselineLabel: "b2",
      transitionPending: false,
    });
    expect(() => appendAttemptEvent(
      { type: "baseline-transition-complete", baselineLabel: "b3" } as AttemptEventInput,
      paths,
      nextAt(),
    )).toThrow(/no operator transition is pending/);
  });

  test("refuses every transition and era-start mutation while an attempt is in flight", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    appendAttemptEvent(declare({ attemptId: "active", candidateFingerprint: fp("cA") }), paths, nextAt());

    for (const event of [
      { type: "transition", reason: "operator handoff", operator: "test" },
      { type: "era-start", eraId: "era-2", cause: "suite-rollover", baselineLabel: "b2", budgetCap: 0.05 },
      { type: "baseline-transition-complete", baselineLabel: "b2" },
      { type: "era-start", eraId: "era-2", cause: "rebaseline-accept", baselineLabel: "b2", budgetCap: 0.05 },
    ] as AttemptEventInput[]) {
      expect(() => appendAttemptEvent(event, paths, nextAt())).toThrow(/active is in flight/);
    }
    expect(readEraState(paths).eraId).toBe("era-1");
    expect(readAttemptEvents(paths)).toHaveLength(2);
  });
});

describe("runtime event validation", () => {
  test("refuses non-finite and contextually stale overrides before serialization", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());

    expect(() => appendAttemptEvent({
      type: "override",
      eraId: "era-1",
      previousCap: 0.05,
      newCap: Number.NaN,
      reason: "invalid",
      operator: "test",
    } as AttemptEventInput, paths, nextAt())).toThrow(/override.newCap must be finite/);
    expect(() => appendAttemptEvent({
      type: "override",
      eraId: "era-1",
      previousCap: 0.04,
      newCap: 0.1,
      reason: "stale read",
      operator: "test",
    } as AttemptEventInput, paths, nextAt())).toThrow(/previousCap 0.04 does not match current era cap 0.05/);
    expect(readAttemptEvents(paths)).toHaveLength(1);
  });

  test("refuses uncertified points and declaration-ledger undercharges", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    expect(() => appendAttemptEvent(declare({
      operatingPointId: "not-certified",
      depth: 1,
      spend: 0.0001,
    }), paths, nextAt())).toThrow(/not on the certified menu/);

    const undercharged = declare({ spend: 0.0196 }) as any;
    undercharged.spend = 0.0001;
    expect(() => appendAttemptEvent(undercharged, paths, nextAt()))
      .toThrow(/declaration artifact disagrees.*eraBudgetSpend/);
    expect(readAttemptEvents(paths)).toHaveLength(1);
  });

  test("refuses a declaration changed after its ledger append", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    const event = declare({ attemptId: "immutable-declaration", spend: 0.0196 }) as any;
    appendAttemptEvent(event, paths, nextAt());
    expect(assertAttemptDeclarationCurrent("immutable-declaration", paths).declarationSha256)
      .toBe(event.declarationSha256);
    writeFileSync(event.declarationPath, "{}\n");
    expect(() => assertAttemptDeclarationCurrent("immutable-declaration", paths))
      .toThrow(/checksum does not match/);
    expect(() => readEraState(paths)).toThrow(/checksum does not match/);
  });

  test("rejects malformed but valid-JSON ledger records at the read boundary", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    const malformed = {
      schema: "line.benchmark-v2.attempt-event.v1",
      type: "override",
      at: nextAt(),
      eraId: "era-1",
      previousCap: 0.05,
      newCap: null,
      reason: "garbage",
      operator: "test",
    };
    writeFileSync(paths.ledger!, `${readFileSync(paths.ledger!, "utf8")}${JSON.stringify(malformed)}\n`);

    expect(() => readAttemptEvents(paths)).toThrow(/override.newCap must be finite/);
    expect(() => readEraState(paths)).toThrow(/override.newCap must be finite/);

    const contextualPaths = tmpPaths();
    appendAttemptEvent(bootstrap(), contextualPaths, nextAt());
    const staleOverride = {
      ...malformed,
      at: nextAt(),
      previousCap: 0.04,
      newCap: 0.1,
    };
    writeFileSync(
      contextualPaths.ledger!,
      `${readFileSync(contextualPaths.ledger!, "utf8")}${JSON.stringify(staleOverride)}\n`,
    );
    expect(() => readEraState(contextualPaths)).toThrow(/previousCap 0.04 does not match current era cap 0.05/);
  });

  test("rejects malformed fingerprints, arrays, booleans, and numeric fields", () => {
    const paths = tmpPaths();
    appendAttemptEvent(bootstrap(), paths, nextAt());
    for (const invalid of [
      declare({ candidateFingerprint: "not-a-fingerprint" }),
      declare({ retryAcknowledged: null }),
      declare({ depth: 4.5 }),
      bootstrap({ at: "not-a-date" }),
      {
        type: "accounting-correction",
        reason: "bad array",
        operator: "test",
        adjustments: null,
      } as unknown as AttemptEventInput,
      null as unknown as AttemptEventInput,
    ]) {
      expect(() => appendAttemptEvent(invalid, paths, nextAt())).toThrow(/must be|fingerprint|expected an object/);
    }
    expect(readAttemptEvents(paths)).toHaveLength(1);
  });
});

describe("bootstrap from the baseline of record", () => {
  test("initializes ledger + projection read-only against the frozen baseline", () => {
    const paths = tmpPaths();
    const baselineBytesBefore = readFileSync("benchmark/v2/baseline.json", "utf8");
    const baselineLabel = JSON.parse(baselineBytesBefore).label;

    const state = initializeLedgerFromBaseline(undefined, paths, "2026-07-11T09:00:00.000Z");
    expect(existsSync(paths.ledger!)).toBe(true);
    expect(existsSync(paths.projection!)).toBe(true);
    expect(state.eraCause).toBe("bootstrap");
    expect(state.eraId).toBe("era-2026-07-11T09-00-00.000Z");
    expect(state.baselineLabel).toBe(baselineLabel);
    expect(state.budgetCap).toBe(0.05);
    expect(state.seedLedger).toEqual([]);

    // The baseline of record is read, never rewritten.
    expect(readFileSync("benchmark/v2/baseline.json", "utf8")).toBe(baselineBytesBefore);

    expect(() =>
      initializeLedgerFromBaseline(undefined, paths, "2026-07-11T10:00:00.000Z"),
    ).toThrow(/already exists/);
  });
});

function spawnNode(source: string, args: string[]): ChildProcess {
  return spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", source, ...args], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runChild(source: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawnNode(source, args);
  let stdout = "";
  let stderr = "";
  child.stdout!.on("data", (chunk) => stdout += chunk);
  child.stderr!.on("data", (chunk) => stderr += chunk);
  return new Promise((resolve) => child.on("close", (code) => resolve({ code, stdout, stderr })));
}

function waitForOutput(child: ChildProcess, expected: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    child.stdout!.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes(expected)) resolve();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!stdout.includes(expected)) reject(new Error(`child exited ${code} before emitting ${expected}`));
    });
  });
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", () => resolve()));
}

function readFileNames(path: string): string[] {
  return readdirSync(path);
}
