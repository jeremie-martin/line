import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterAll, describe, expect, test } from "vitest";
import {
  DECISION_EXIT_CODES,
  nextCommandFor,
  outcomeExitCode,
  renderDecision,
  underPoweredHint,
  type DecisionArtifact,
} from "../scripts/v0/benchmark_v2/decide.ts";
import { studentTQuantile, type V2Decision } from "../scripts/v0/benchmark_v2/decision_model.ts";
import { acquireRunLock, archiveChunks, writeArchiveArtifacts } from "../scripts/v0/benchmark_v2/runner.ts";
import { canonicalArchiveRows, compareArchiveRows } from "../scripts/v0/benchmark_v2/runner_compatibility.ts";

const temporaries: string[] = [];
afterAll(() => {
  for (const dir of temporaries) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "line-v2-protocol-"));
  temporaries.push(dir);
  return dir;
}

function decision(overrides: Partial<V2Decision>): V2Decision {
  const bounds = {
    estimate: 1.2,
    standardError: 2,
    degreesOfFreedom: null,
    centralLevel: 0.95,
    centralCriticalLevel: 0.99,
    centralLo: -1.1,
    centralHi: 3.5,
    oneSidedLevel: 0.95,
    oneSidedCriticalLevel: 0.99,
    lowerBound: -0.8,
    upperBound: 3.2,
  };
  const sensitivity = {
    available: true,
    estimate: 1.2,
    bootstrapMedian: 1.2,
    standardError: 1.9,
    centralLevel: 0.95,
    centralLo: -1.0,
    centralHi: 3.4,
  };
  return {
    method: "paired-seed-block-jackknife",
    profile: "canonical",
    authority: "promotion",
    mode: "improvement",
    margin: null,
    threshold: 0,
    alpha: 0.05,
    criticalAlpha: 0.01,
    iterations: 0,
    bootstrapSeed: 0,
    baseHeadline: 650,
    candidateHeadline: 651.2,
    delta: 1.2,
    confidence: bounds,
    uncertainty: { seed: bounds, jointSensitivity: sensitivity, catalogSensitivity: sensitivity },
    outcome: "unresolved",
    promotable: false,
    validity: { baseValid: 120, candidateValid: 121, total: 126, gained: 2, lost: 1 },
    perBudget: [],
    perStratum: [],
    perCase: [],
    ...overrides,
  } as V2Decision;
}

describe("run lock", () => {
  test("acquires, refuses a live holder, and steals a stale lock", () => {
    const out = join(tempDir(), "archive.json");
    acquireRunLock(out);
    const holder = JSON.parse(readFileSync(`${out}.lock`, "utf8"));
    expect(holder.pid).toBe(process.pid);

    expect(() => acquireRunLock(out)).toThrow(/another benchmark run \(pid/);

    // A pid above the kernel's pid_max can never be alive: the lock is stale.
    writeFileSync(`${out}.lock`, `${JSON.stringify({ pid: 999_999_999, startedAt: "2026-01-01T00:00:00Z" })}\n`);
    expect(() => acquireRunLock(out)).not.toThrow();
    expect(JSON.parse(readFileSync(`${out}.lock`, "utf8")).pid).toBe(process.pid);
  });
});

describe("archive artifacts", () => {
  test("a clean run writes the archive with both checksum sidecars", async () => {
    const out = join(tempDir(), "run.json");
    const bytes = Buffer.from(`${JSON.stringify({ runs: [] }, null, 2)}\n`);
    const written = await writeArchiveArtifacts(out, [bytes], false);
    expect(written.archiveOut).toBe(out);
    expect(written.summaryPath).toBe(`${out}.summary.json`);
    expect(readFileSync(out)).toEqual(bytes);
    expect(gunzipSync(readFileSync(`${out}.gz`))).toEqual(bytes);
    expect(readFileSync(`${out}.sha256`, "utf8")).toContain(written.archiveSha256);
    expect(readFileSync(`${out}.gz.sha256`, "utf8")).toContain(written.compressedArchiveSha256);
  });

  test("a failed run lands at .failed with no checksum sidecars", async () => {
    const out = join(tempDir(), "run.json");
    const bytes = Buffer.from(`${JSON.stringify({ runs: [] }, null, 2)}\n`);
    const written = await writeArchiveArtifacts(out, [bytes], true);
    expect(written.archiveOut).toBe(`${out}.failed`);
    expect(written.summaryPath).toBe(`${out}.failed.summary.json`);
    expect(existsSync(`${out}.failed`)).toBe(true);
    expect(existsSync(`${out}.failed.gz`)).toBe(true);
    // The completed-run paths must not exist: decision loaders require the
    // sidecar, so a failed run can never be consumed as evidence.
    expect(existsSync(out)).toBe(false);
    expect(existsSync(`${out}.sha256`)).toBe(false);
    expect(existsSync(`${out}.gz.sha256`)).toBe(false);
    expect(existsSync(`${out}.failed.sha256`)).toBe(false);
  });

  test("chunked archive serialization round-trips and streams row-by-row", async () => {
    const archive = {
      schema: "line.benchmark-v2.run-archive.test",
      generatedAt: "2026-07-12T00:00:00.000Z",
      canonicalHeadline: 446.09,
      runs: [
        { task: { sourceId: "a", budget: 250_000, seedSlot: 0 }, score: { score: 0.8, valid: true } },
        { task: { sourceId: "b", budget: 500_000, seedSlot: 1 }, score: { score: 0.9, valid: false } },
      ],
    };
    const chunks = [...archiveChunks(archive)];
    expect(chunks.length).toBeGreaterThan(3);
    const text = chunks.join("");
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toEqual(archive);

    const out = join(tempDir(), "chunked.json");
    const written = await writeArchiveArtifacts(out, archiveChunks(archive), false);
    expect(readFileSync(out, "utf8")).toBe(text);
    expect(gunzipSync(readFileSync(`${out}.gz`)).toString("utf8")).toBe(text);
    expect(written.archiveSha256).toMatch(/^[a-f0-9]{64}$/);

    const empty = [...archiveChunks({ schema: "x", runs: [] })].join("");
    expect(JSON.parse(empty)).toEqual({ schema: "x", runs: [] });
  });
});

describe("decision exit codes", () => {
  test("the frozen outcome-to-exit-code table", () => {
    expect(Object.isFrozen(DECISION_EXIT_CODES)).toBe(true);
    expect(DECISION_EXIT_CODES).toEqual({
      favorable: 0,
      invalid: 1,
      unresolved: 2,
      unfavorable: 3,
      futilityStop: 4,
    });
    expect(outcomeExitCode("advance")).toBe(0);
    expect(outcomeExitCode("accept")).toBe(0);
    expect(outcomeExitCode("unresolved")).toBe(2);
    expect(outcomeExitCode("inconclusive")).toBe(2);
    expect(outcomeExitCode("stop")).toBe(3);
    expect(outcomeExitCode("reject")).toBe(3);
  });
});

describe("under-powered hint", () => {
  test("fires on a positive unresolved delta with the documented depth estimate", () => {
    const result = decision({ outcome: "unresolved", delta: 2, threshold: 0 });
    result.uncertainty.seed.standardError = 2;
    const hint = underPoweredHint(result, 12);
    // requiredSE = distance / (t(0.99, inf) + z(0.80)); depth scales with (SE/requiredSE)^2.
    const requiredSe = 2 / (studentTQuantile(0.99, Infinity) + 0.8416212335729143);
    const expectedDepth = Math.ceil(12 * (2 / requiredSe) ** 2);
    expect(hint).toContain(`under-powered at 12 seeds/budget`);
    expect(hint).toContain(`~${expectedDepth} seeds/budget`);
    expect(hint).toContain("indicative");
  });

  test("stays silent on resolved outcomes, non-positive distance, and already-sufficient depth", () => {
    expect(underPoweredHint(decision({ outcome: "advance", delta: 5 }), 12)).toBeNull();
    expect(underPoweredHint(decision({ outcome: "unresolved", delta: -0.5 }), 12)).toBeNull();
    const tight = decision({ outcome: "unresolved", delta: 8 });
    tight.uncertainty.seed.standardError = 0.1;
    expect(underPoweredHint(tight, 12)).toBeNull();
  });

  test("measures distance from the non-inferiority threshold in simplification mode", () => {
    const result = decision({
      outcome: "inconclusive",
      mode: "simplification",
      margin: 5,
      threshold: -5,
      delta: -1,
    });
    result.uncertainty.seed.standardError = 4;
    expect(underPoweredHint(result, 12)).toContain("delta -1.00 is positive but under-powered");
  });
});

describe("next command", () => {
  test("maps every outcome to a runnable follow-up", () => {
    expect(nextCommandFor(decision({ outcome: "advance", authority: "screening" })))
      .toBe("npm run benchmark -- canonical");
    expect(nextCommandFor(decision({
      outcome: "advance",
      authority: "screening",
      mode: "simplification",
      margin: 5,
      threshold: -5,
    }))).toBe("npm run benchmark -- canonical --decision-mode=simplification --margin=5");
    expect(nextCommandFor(decision({ outcome: "accept" }))).toContain("baseline --label=");
    expect(nextCommandFor(decision({ outcome: "unresolved", authority: "screening" })))
      .toContain("canonical");
    expect(nextCommandFor(decision({ outcome: "unresolved", authority: "promotion" })))
      .toContain("decide <fresh-canonical-archive>");
    expect(nextCommandFor(decision({ outcome: "stop", authority: "screening" }))).toContain("probe");
    expect(nextCommandFor(decision({ outcome: "reject" }))).toContain("probe");
  });
});

describe("decision rendering", () => {
  function artifact(overrides: Partial<DecisionArtifact>): DecisionArtifact {
    return {
      schema: "line.benchmark-v2.decision.v4",
      generatedAt: "2026-07-11T00:00:00.000Z",
      decisionInferenceFingerprint: "a".repeat(64),
      decisionProtocolFingerprint: "b".repeat(64),
      executionProtocol: 1,
      base: {} as DecisionArtifact["base"],
      candidate: {} as DecisionArtifact["candidate"],
      implementationFingerprintsMatch: true,
      runnerCompatibilityApproval: null,
      result: decision({}),
      hint: null,
      nextCommand: "npm run benchmark -- probe",
      ...overrides,
    } as DecisionArtifact;
  }

  test("renders the hint when set and always ends with nextCommand", () => {
    const withHint = renderDecision(
      artifact({ hint: "delta +1.20 is positive but under-powered at 12 seeds/budget" }),
      "out/decision.json",
    );
    expect(withHint).toContain("  hint: delta +1.20 is positive but under-powered");
    expect(withHint.split("\n").at(-1)).toBe("  nextCommand: npm run benchmark -- probe");

    const withoutHint = renderDecision(artifact({}), "out/decision.json");
    expect(withoutHint).not.toContain("  hint:");
  });

  test("places the runner-compatibility note above the outcome line", () => {
    const rendered = renderDecision(
      artifact({
        implementationFingerprintsMatch: false,
        runnerCompatibilityApproval: { reviewedBy: "jeremie" } as DecisionArtifact["runnerCompatibilityApproval"],
      }),
      "out/decision.json",
    );
    const lines = rendered.split("\n");
    const compatIndex = lines.findIndex((line) => line.startsWith("  runner compatibility:"));
    const outcomeIndex = lines.findIndex((line) => line.startsWith("  OUTCOME:"));
    expect(compatIndex).toBeGreaterThan(0);
    expect(compatIndex).toBe(outcomeIndex - 1);
  });
});

describe("runner-compatibility comparer", () => {
  function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      status: "ok",
      task: {
        mode: "development",
        sourceId: "case-a",
        budget: 250_000,
        seedSlot: 0,
        actualSeed: 17,
        joltMs: 50,
        sourceManifestPath: "/machine/local/manifest.json",
      },
      report: { air: 0.5 },
      score: { score: 0.8, valid: true },
      trackHash: "c".repeat(64),
      authoredContacts: 12,
      ...overrides,
    };
  }

  test("machine-local manifest paths are excluded from the canonical row", () => {
    const retained = { runs: [row()] };
    const replay = {
      runs: [row({
        task: { ...(row().task as Record<string, unknown>), sourceManifestPath: "/other/machine/manifest.json" },
      })],
    };
    expect(compareArchiveRows(retained, replay)).toEqual({ comparedRows: 1, mismatches: [] });
  });

  test("any semantic difference is a mismatch keyed by task identity", () => {
    const retained = { runs: [row()] };
    const replay = { runs: [row({ score: { score: 0.81, valid: true } })] };
    const outcome = compareArchiveRows(retained, replay);
    expect(outcome.mismatches).toEqual(["case-a/250000/0/17"]);
  });

  test("non-ok rows and row-count differences are fatal", () => {
    expect(() => canonicalArchiveRows({ runs: [row({ status: "failed" })] }, "retained"))
      .toThrow(/retained: non-ok run case-a/);
    expect(() => compareArchiveRows({ runs: [row()] }, { runs: [] }))
      .toThrow(/row counts differ/);
  });
});
