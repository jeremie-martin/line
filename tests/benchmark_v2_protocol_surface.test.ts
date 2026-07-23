import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { afterAll, describe, expect, test } from "vitest";
import {
  assertComparisonRequestLink,
  DECISION_EXIT_CODES,
  nextCommandFor,
  outcomeExitCode,
  renderDecision,
  underPoweredHint,
  loadVerifiedArchive,
  type DecisionArtifact,
} from "../scripts/v0/benchmark_v2/decide.ts";
import { createHash } from "node:crypto";
import { studentTQuantile, type V2Decision } from "../scripts/v0/benchmark_v2/decision_model.ts";
import {
  acquireRunLock,
  archiveChunks,
  bindDecisionIndexArchive,
  checkpointArchiveChunks,
  checkpointPlanFingerprint,
  invalidatePublishedRunArtifacts,
  latestCheckpointResults,
  loadCheckpointResultIndex,
  loadOrInitializeCheckpoint,
  writeArchiveArtifacts,
  writeDecisionIndexArtifacts,
  validateDecisionIndexAgainstArchive,
  type WorkerResult,
} from "../scripts/v0/benchmark_v2/runner.ts";
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

  test("only one concurrent contender can reclaim a stale lock", async () => {
    const dir = tempDir();
    const out = join(dir, "run.json");
    const barrier = join(dir, "start");
    writeFileSync(`${out}.lock`, `${JSON.stringify({ pid: 999_999_999, startedAt: "2026-01-01T00:00:00Z" })}\n`);
    const source = `
      import { existsSync, writeFileSync } from "node:fs";
      import { setTimeout as sleep } from "node:timers/promises";
      import { acquireRunLock } from "./scripts/v0/benchmark_v2/runner.ts";
      writeFileSync(process.env.READY, "ready\\n");
      while (!existsSync(process.env.BARRIER)) await sleep(5);
      try {
        acquireRunLock(process.env.OUT);
        console.log("acquired");
        await sleep(500);
      } catch {
        console.log("refused");
      }
    `;
    const readyPaths = [join(dir, "ready-0"), join(dir, "ready-1")];
    const contenders = readyPaths.map((ready) => spawn(process.execPath, [
      "--import", "tsx", "--input-type=module", "--eval", source,
    ], {
      cwd: process.cwd(),
      env: { ...process.env, OUT: out, BARRIER: barrier, READY: ready },
      stdio: ["ignore", "pipe", "pipe"],
    }));
    const outputs = contenders.map((child) => new Promise<string>((resolveOutput, rejectOutput) => {
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", rejectOutput);
      child.on("exit", (code) => code === 0 ? resolveOutput(stdout.trim()) : rejectOutput(new Error(stderr)));
    }));
    while (!readyPaths.every((path) => existsSync(path))) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
    writeFileSync(barrier, "go\n");
    expect((await Promise.all(outputs)).sort()).toEqual(["acquired", "refused"]);
  }, 5_000);
});

describe("archive artifacts", () => {
  test("failed rows bind an absent raw report as JSON null", () => {
    const archive = bindDecisionIndexArchive({
      marker: "failed-audit-source",
      runs: [{
        status: "error",
        task: { sourceId: "case", budget: 1, seedSlot: 0, actualSeed: 1 },
        source: { id: "case" },
        authoredContacts: 0,
        score: { score: 0, valid: false },
        report: undefined,
      }],
    });

    expect(archive.decisionIndexPayloadSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test("a checksummed decision index is bound to both archive hashes", () => {
    const dir = tempDir();
    const out = join(dir, "run.json");
    const archive = bindDecisionIndexArchive({
      marker: "raw-audit-source",
      runs: [{
        status: "ok",
        task: { sourceId: "case", budget: 1, seedSlot: 0, actualSeed: 1 },
        source: { id: "case" },
        authoredContacts: 2,
        score: { score: 3, valid: true },
        report: { raw: "report" },
      }],
    });
    const bytes = Buffer.from(`${JSON.stringify(archive)}\n`);
    const compressed = gzipSync(bytes);
    writeFileSync(out, bytes);
    writeFileSync(`${out}.gz`, compressed);
    const archiveSha = createHash("sha256").update(bytes).digest("hex");
    const compressedSha = createHash("sha256").update(compressed).digest("hex");
    writeFileSync(`${out}.sha256`, `${archiveSha}  ${out}\n`);
    const indexPath = writeDecisionIndexArtifacts(out, archive, archiveSha, compressedSha);

    const loaded = loadVerifiedArchive(out);
    expect(loaded.indexed).toBe(true);
    expect(loaded.archiveSha256).toBe(archiveSha);
    expect(loaded.archive.runs[0]).not.toHaveProperty("report");
    expect(loaded.archive.runs[0].rawReportSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateDecisionIndexAgainstArchive(indexPath, archive)).toBe(1);

    const detached = JSON.parse(readFileSync(indexPath, "utf8"));
    detached.archive.runs[0].score.score = 4;
    const detachedBytes = `${JSON.stringify(detached)}\n`;
    writeFileSync(indexPath, detachedBytes);
    writeFileSync(`${indexPath}.sha256`, `${createHash("sha256").update(detachedBytes).digest("hex")}  ${indexPath}\n`);
    expect(() => loadVerifiedArchive(out)).toThrow(/detached from its raw archive/);

    writeFileSync(indexPath, `${readFileSync(indexPath, "utf8")} `);
    expect(() => loadVerifiedArchive(out)).toThrow(/decision-index checksum mismatch/);
  });

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

  test("archive assembly accepts an async chunk stream", async () => {
    const out = join(tempDir(), "async-run.json");
    async function* chunks(): AsyncGenerator<string> {
      yield "{\n";
      yield '  "runs": []\n';
      yield "}\n";
    }
    const written = await writeArchiveArtifacts(out, chunks(), false);
    expect(readFileSync(out, "utf8")).toBe('{\n  "runs": []\n}\n');
    expect(written.archiveSha256).toMatch(/^[a-f0-9]{64}$/);
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

  test("a failed same-path rerun cannot leave an earlier success eligible", async () => {
    const out = join(tempDir(), "run.json");
    const success = Buffer.from(`${JSON.stringify({ generation: "old-success", runs: [] })}\n`);
    await writeArchiveArtifacts(out, [success], false);
    writeFileSync(`${out}.summary.json`, `${JSON.stringify({ generation: "old-success" })}\n`);

    // runBenchmarkV2 performs this after acquiring its lock and validating the
    // checkpoint, immediately before the new execution starts.
    invalidatePublishedRunArtifacts(out);
    await writeArchiveArtifacts(
      out,
      [Buffer.from(`${JSON.stringify({ generation: "new-failure", runs: [] })}\n`)],
      true,
    );

    expect(existsSync(`${out}.failed`)).toBe(true);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(`${out}.gz`)).toBe(false);
    expect(existsSync(`${out}.sha256`)).toBe(false);
    expect(existsSync(`${out}.gz.sha256`)).toBe(false);
    expect(existsSync(`${out}.summary.json`)).toBe(false);
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

  test("deep checkpoint assembly keeps only the final row for each task and rechecks its plan", async () => {
    const checkpoint = join(tempDir(), "deep.checkpoint.jsonl");
    const plan = "a".repeat(64);
    const task = (seedSlot: number) => ({
      mode: "development" as const,
      sourceId: "source",
      budget: 250_000,
      seedSlot,
      actualSeed: seedSlot,
      joltMs: 0,
      sourceManifestPath: "source.json",
      heldoutManifestPath: "heldout.json",
    });
    const failure = (status: "error" | "timeout", seedSlot: number): WorkerResult => ({
      status,
      task: task(seedSlot),
      elapsedMs: 1,
      error: status,
      authoredContacts: 0,
    });
    const rows = [failure("error", 0), failure("timeout", 0), failure("error", 1)];
    writeFileSync(checkpoint, [
      JSON.stringify({ schema: "line.benchmark-v2.checkpoint.v1", runPlanFingerprint: plan }),
      ...rows.map((result) => JSON.stringify({ type: "result", result })),
      "",
    ].join("\n"));

    const index = await loadCheckpointResultIndex(checkpoint, plan, true);
    const retained: WorkerResult[] = [];
    for await (const result of latestCheckpointResults(checkpoint, index, plan)) retained.push(result);
    expect(retained.map((result) => result.status)).toEqual(["timeout", "error"]);

    const archive = join(tempDir(), "deep.json");
    await writeArchiveArtifacts(
      archive,
      checkpointArchiveChunks(
        { schema: "test" },
        checkpoint,
        index,
        plan,
        (result) => ({ status: result.status, task: result.task }),
      ),
      false,
    );
    expect(JSON.parse(readFileSync(archive, "utf8")).runs.map((row: any) => row.status))
      .toEqual(["timeout", "error"]);

    const wrongPlanRows = latestCheckpointResults(checkpoint, index, "b".repeat(64));
    await expect(wrongPlanRows.next()).rejects.toThrow(/does not match the current run plan/);
  });
});

describe("checkpoint candidate identity", () => {
  test("refuses resume after source, environment, artifact, or aggregate identity changes", () => {
    const checkpoint = join(tempDir(), "run.checkpoint.jsonl");
    const candidateIdentity = {
      candidateFingerprint: "a".repeat(64),
      compilerSourceFingerprint: "b".repeat(64),
      compilerEnvironment: { LR_EXAMPLE: "1" },
      engineArtifactFingerprint: "c".repeat(64),
    };
    const plan = (identity: typeof candidateIdentity) => checkpointPlanFingerprint({
      executionPolicyFingerprint: "d".repeat(64),
      implementationFingerprint: "e".repeat(64),
      candidateIdentity: identity,
    });
    const original = plan(candidateIdentity);
    expect(loadOrInitializeCheckpoint(checkpoint, original, false)).toEqual([]);

    const mutations = [
      { ...candidateIdentity, candidateFingerprint: "f".repeat(64) },
      { ...candidateIdentity, compilerSourceFingerprint: "0".repeat(64) },
      { ...candidateIdentity, compilerEnvironment: { LR_EXAMPLE: "2" } },
      { ...candidateIdentity, engineArtifactFingerprint: "1".repeat(64) },
    ];
    for (const identity of mutations) {
      expect(plan(identity)).not.toBe(original);
      expect(() => loadOrInitializeCheckpoint(checkpoint, plan(identity), true))
        .toThrow(/checkpoint does not match the current run plan/);
    }
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
  test("fires on a positive unresolved delta with an ordinary larger-N estimate", () => {
    const result = decision({ outcome: "unresolved", delta: 2, threshold: 0 });
    result.uncertainty.seed.standardError = 2;
    const hint = underPoweredHint(result, 12);
    // requiredSE = distance / (t(0.99, inf) + z(0.80)); depth scales with (SE/requiredSE)^2.
    const requiredSe = 2 / (studentTQuantile(0.99, Infinity) + 0.8416212335729143);
    const expectedDepth = Math.ceil(12 * (2 / requiredSe) ** 2);
    expect(hint).toContain(`under-powered at 12 seeds/budget`);
    expect(hint).toContain(`around ${expectedDepth} seeds/budget`);
    expect(hint).toContain("baseline cache covers that prefix");
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

describe("comparison request linkage", () => {
  test("validates linkage on the already-parsed archive", () => {
    const schedule = { seedsPerBudget: 48, seedBase: 123 };
    const expected = {
      label: "candidate arm",
      candidateFingerprint: "a".repeat(64),
      requestPath: "/tmp/comparison-request.json",
      requestSha256: "b".repeat(64),
      seedScheduleFingerprint: createHash("sha256").update(JSON.stringify(schedule)).digest("hex"),
      depth: 48,
    };
    const archive = {
      git: { candidateFingerprint: expected.candidateFingerprint },
      comparisonRequest: { path: expected.requestPath, sha256: expected.requestSha256 },
      identity: { seedSchedule: schedule },
    };
    expect(() => assertComparisonRequestLink(archive, expected)).not.toThrow();
    expect(() => assertComparisonRequestLink({
      ...archive,
      comparisonRequest: { ...archive.comparisonRequest, sha256: "c".repeat(64) },
    }, expected)).toThrow(/immutable comparison request/);
  });
});

describe("next command", () => {
  test("maps every outcome to a runnable follow-up", () => {
    expect(nextCommandFor(decision({ outcome: "advance", authority: "screening" })))
      .toBe("npm run benchmark -- eval --seeds=100");
    expect(nextCommandFor(decision({
      outcome: "advance",
      authority: "screening",
      mode: "simplification",
      margin: 5,
      threshold: -5,
    }))).toBe("npm run benchmark -- eval --seeds=100 --mode=simplify --margin=5");
    expect(nextCommandFor(decision({ outcome: "accept" })))
      .toBe("npm run benchmark -- rebaseline --from=COMPARISON --label=accepted-candidate");
    expect(nextCommandFor(decision({ outcome: "unresolved", authority: "screening" })))
      .toContain("eval --seeds=100");
    expect(nextCommandFor(decision({ outcome: "unresolved", authority: "promotion" })))
      .toContain("choose a larger N if needed");
    expect(nextCommandFor(decision({ outcome: "stop", authority: "screening" }))).toBe("npm run benchmark -- eval");
    expect(nextCommandFor(decision({ outcome: "reject" }))).toBe("npm run benchmark -- eval");
  });
});

describe("JSON CLI surface", () => {
  test("help lists the lean cached-comparison workflow", () => {
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/cli.ts", "help",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("eval --seeds=N");
    expect(result.stdout).toContain("baseline-cache extend --seeds=N");
    expect(result.stdout).toContain("rebaseline --from=COMPARISON");
    expect(result.stdout).toContain("--no-resource-stats");
    expect(result.stdout).not.toContain("--abort-in-flight");
    expect(result.stdout).not.toContain("--override-era-budget");
  });

  test("writes exactly one structured JSON object to stdout on success", () => {
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/cli.ts", "help", "--json",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: "line.benchmark-v2.cli-result.v1",
      ok: true,
      exitCode: 0,
      status: "completed",
    });
    expect(result.stderr).toContain("Benchmark V2");
  });

  test("writes exactly one structured JSON object to stdout on invalid input", () => {
    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/benchmark/cli.ts",
      "canonical",
      "--json",
      "--no-resource-stats",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, LR_ENGINE: "wasm" },
    });
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      schema: "line.benchmark-v2.cli-result.v1",
      ok: false,
      exitCode: 1,
      status: "invalid",
    });
    expect(parsed.error.message).toMatch(/canonical is no longer a separate workflow/);
    expect(result.stderr).toContain("Prepared ");
  }, 15_000);

  test("rejects unsupported JSON commands without leaking child stdout", () => {
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/cli.ts", "explain", "missing.json", "--json",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).error.message).toMatch(/explain does not support --json/);
    expect(result.stderr).toBe("");
  });

  test("accepts global resource flags on strict decide commands", () => {
    const result = spawnSync(process.execPath, [
      "--import", "tsx", "scripts/benchmark/cli.ts", "decide", "missing.json", "--json", "--no-resource-stats",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.error.message).not.toMatch(/unexpected argument.*no-resource-stats/);
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
      nextCommand: "npm run benchmark -- eval",
      ...overrides,
    } as DecisionArtifact;
  }

  test("renders the hint when set and always ends with nextCommand", () => {
    const withHint = renderDecision(
      artifact({ hint: "delta +1.20 is positive but under-powered at 12 seeds/budget" }),
      "out/decision.json",
    );
    expect(withHint).toContain("  hint: delta +1.20 is positive but under-powered");
    expect(withHint.split("\n").at(-1)).toBe("  nextCommand: npm run benchmark -- eval");

    const withoutHint = renderDecision(artifact({}), "out/decision.json");
    expect(withoutHint).not.toContain("  hint:");
  });

  test("legacy probe output is explicitly diagnostic", () => {
    const rendered = renderDecision(
      artifact({ result: decision({ profile: "probe", authority: "screening" }) }),
      "out/decision.json",
    );
    expect(rendered).toContain("legacy probe-archive diagnostic");
    expect(rendered).not.toContain("confirmation is required");
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
