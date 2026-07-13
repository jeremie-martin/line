import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  benchmarkEvalPolicy,
  cheapestOperatingPoint,
  evalOperatingPoint,
} from "../benchmark/v2/eval-policy.ts";
import { requireCertifiedOperatingPoint } from "../scripts/v0/benchmark_v2/calibration_guard.ts";
import { studentTQuantile } from "../scripts/v0/benchmark_v2/decision_model.ts";
import {
  evalFutilityUpperBound,
  evalRunsAtLook,
} from "../scripts/v0/benchmark_v2/eval_chain_inference.ts";
import {
  assertQualificationSucceeded,
  checkpointResultToDecisionRun,
  evalWorkerFailurePayload,
  evalVerdictJsonPayload,
  evalVerdictArtifactPath,
  recoverDurableFutilityStop,
  runEvalCommand,
} from "../scripts/v0/benchmark_v2/eval.ts";
import {
  appendAttemptEvent,
  readAttemptEvents,
  readEraState,
} from "../scripts/v0/benchmark_v2/attempts.ts";
import { suiteIdentity } from "../scripts/v0/benchmark_v2/suite_model.ts";
import { loadSourceManifest, resolveSources } from "../scripts/v0/benchmark_v2/model.ts";

const temporaries: string[] = [];
afterAll(() => {
  for (const dir of temporaries) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "line-v2-eval-policy-"));
  temporaries.push(dir);
  return dir;
}

function currentSuiteFingerprint(): string {
  const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
  return suiteIdentity(
    "benchmark/v2/compat/suite-manifest.json",
    "benchmark/v2/compat/source-manifest.json",
    sources,
  ).suiteFingerprint;
}

describe("eval policy menu", () => {
  test("offers exactly the two v1 rows and resolves lookups", () => {
    expect(benchmarkEvalPolicy.operatingPoints.map((point) => point.id))
      .toEqual(["improve-t0-d48", "simplify-m5-d48"]);
    expect(evalOperatingPoint("improvement", null, 48)?.id).toBe("improve-t0-d48");
    expect(evalOperatingPoint("simplification", 5, 48)?.id).toBe("simplify-m5-d48");
    expect(evalOperatingPoint("improvement", null, 32)).toBeUndefined();
    expect(evalOperatingPoint("simplification", 3, 48)).toBeUndefined();
    expect(cheapestOperatingPoint("improvement", null)?.depth).toBe(48);
  });

  test("simplification runs without interim looks in v1", () => {
    expect(evalOperatingPoint("simplification", 5, 48)?.futilitySchedule).toEqual([]);
    expect(evalOperatingPoint("improvement", null, 48)?.futilitySchedule).toEqual([2, 3, 4, 8, 16]);
  });

  test("per-mode exit-code contracts", () => {
    expect(benchmarkEvalPolicy.exitCodes.stage0).toEqual({ completed: 0, invalid: 1 });
    expect(benchmarkEvalPolicy.exitCodes.verdict).toEqual({
      accept: 0,
      invalid: 1,
      inconclusive: 2,
      reject: 3,
      futilityStop: 4,
    });
  });
});

describe("certified operating-point guard", () => {
  const suiteFingerprint = currentSuiteFingerprint();

  test("authorizes the improve row with numbers read from the artifacts", () => {
    const certified = requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint);
    expect(certified.point.id).toBe("improve-t0-d48");
    const menu = JSON.parse(readFileSync("benchmark/v2/studies/menu-certification.json", "utf8"));
    const holdout = JSON.parse(readFileSync("benchmark/v2/studies/holdout-validation.json", "utf8"));
    const futilityPower = menu.cells.find((cell: any) => cell.id === "futility_power_5");
    // Spend is the worst relevant null upper bound across both artifacts.
    expect(certified.spend).toBe(0.0209);
    expect(certified.spend).toBe(
      holdout.cells.find((cell: any) => cell.id === "futility_null").combined.netAccept.wilson95[1],
    );
    expect(certified.envelopeSe).toBe(futilityPower.combined.meanSeedBlockSe);
    expect(certified.mde80).toBe(5);
    expect(certified.certificationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test("authorizes the simplify row with the boundary cell as spend", () => {
    const certified = requireCertifiedOperatingPoint("simplification", 5, 48, suiteFingerprint);
    const menu = JSON.parse(readFileSync("benchmark/v2/studies/menu-certification.json", "utf8"));
    const boundary = menu.cells.find((cell: any) => cell.id === "simplify_m5_boundary");
    expect(certified.spend).toBe(boundary.combined.accept.wilson95[1]);
    expect(certified.certificationFingerprint)
      .not.toBe(requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint).certificationFingerprint);
  });

  test("refuses non-menu points naming the certified rows", () => {
    expect(() => requireCertifiedOperatingPoint("improvement", null, 32, suiteFingerprint))
      .toThrow(/not on the certified menu.*improve-t0-d48/);
    expect(() => requireCertifiedOperatingPoint("simplification", 3, 48, suiteFingerprint))
      .toThrow(/not on the certified menu/);
  });

  test("refuses stale artifacts: wrong suite, inference identities, or failed bars", () => {
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, "0".repeat(64)))
      .toThrow(/stale for the current suite or inference identity/);

    const dir = tempDir();
    const menu = JSON.parse(readFileSync("benchmark/v2/studies/menu-certification.json", "utf8"));
    const holdoutPath = "benchmark/v2/studies/holdout-validation.json";

    const wrongInference = { ...menu, decisionInferenceFingerprint: "1".repeat(64) };
    const wrongInferencePath = join(dir, "menu-wrong-inference.json");
    writeFileSync(wrongInferencePath, JSON.stringify(wrongInference));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: wrongInferencePath,
      holdoutValidation: holdoutPath,
    })).toThrow(/stale for the current suite or inference identity/);

    const wrongEvalChain = { ...menu, evalChainInferenceFingerprint: "2".repeat(64) };
    const wrongEvalChainPath = join(dir, "menu-wrong-eval-chain.json");
    writeFileSync(wrongEvalChainPath, JSON.stringify(wrongEvalChain));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: wrongEvalChainPath,
      holdoutValidation: holdoutPath,
    })).toThrow(/stale for the current eval-chain inference implementation/);

    const wrongGenerator = { ...menu, certificationGeneratorFingerprint: "4".repeat(64) };
    const wrongGeneratorPath = join(dir, "menu-wrong-generator.json");
    writeFileSync(wrongGeneratorPath, JSON.stringify(wrongGenerator));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: wrongGeneratorPath,
      holdoutValidation: holdoutPath,
    })).toThrow(/stale for the current certification generator or methodology/);

    const wrongReference = structuredClone(menu);
    wrongReference.independentReference.rawSha256 = "5".repeat(64);
    const wrongReferencePath = join(dir, "menu-wrong-reference.json");
    writeFileSync(wrongReferencePath, JSON.stringify(wrongReference));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: wrongReferencePath,
      holdoutValidation: holdoutPath,
    })).toThrow(/independent reference raw checksum mismatch/);

    const wrongUpstream = structuredClone(menu);
    wrongUpstream.upstream.powerGrid.sha256 = "3".repeat(64);
    const wrongUpstreamPath = join(dir, "menu-wrong-upstream.json");
    writeFileSync(wrongUpstreamPath, JSON.stringify(wrongUpstream));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: wrongUpstreamPath,
      holdoutValidation: holdoutPath,
    })).toThrow(/certification upstream powerGrid is missing or does not match/);

    const failedBars = { ...menu, allBarsMet: false };
    const failedBarsPath = join(dir, "menu-failed-bars.json");
    writeFileSync(failedBarsPath, JSON.stringify(failedBars));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: failedBarsPath,
      holdoutValidation: holdoutPath,
    })).toThrow(/did not meet its predeclared bars/);

    const missingPath = join(dir, "absent.json");
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: missingPath,
      holdoutValidation: holdoutPath,
    })).toThrow(/is missing; regenerate/);
  });

  test("refuses a cell edited below the bars", () => {
    const dir = tempDir();
    const menu = JSON.parse(readFileSync("benchmark/v2/studies/menu-certification.json", "utf8"));
    const tampered = structuredClone(menu);
    const cell = tampered.cells.find((entry: any) => entry.id === "futility_power_5");
    // A power collapse must fail the Wilson-lower bar even if allBarsMet was forged.
    cell.combined.netAccept = {
      count: 700,
      total: 1000,
      rate: 0.7,
      wilson95: [0.6709, 0.7276],
    };
    const tamperedPath = join(dir, "menu-tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(tampered));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: tamperedPath,
      holdoutValidation: "benchmark/v2/studies/holdout-validation.json",
    })).toThrow(/power lower bound/);
  });

  test("requires matching menu and holdout predeclarations", () => {
    const dir = tempDir();
    const holdout = JSON.parse(readFileSync("benchmark/v2/studies/holdout-validation.json", "utf8"));
    holdout.predeclared = structuredClone(holdout.predeclared);
    holdout.predeclared.futilitySchedule = [2, 4, 8];
    const path = join(dir, "holdout-wrong-schedule.json");
    writeFileSync(path, JSON.stringify(holdout));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: "benchmark/v2/studies/menu-certification.json",
      holdoutValidation: path,
    })).toThrow(/predeclarations differ/);
  });

  test("checks policy bars in both certification artifacts", () => {
    const dir = tempDir();
    const menu = JSON.parse(readFileSync("benchmark/v2/studies/menu-certification.json", "utf8"));
    const holdout = JSON.parse(readFileSync("benchmark/v2/studies/holdout-validation.json", "utf8"));
    for (const artifact of [menu, holdout]) {
      artifact.predeclared = structuredClone(artifact.predeclared);
      artifact.predeclared.bars.futilityNullFalseAcceptWilsonUpperMax = 0.1;
    }
    const menuPath = join(dir, "menu-wrong-bars.json");
    const holdoutPath = join(dir, "holdout-wrong-bars.json");
    writeFileSync(menuPath, JSON.stringify(menu));
    writeFileSync(holdoutPath, JSON.stringify(holdout));
    expect(() => requireCertifiedOperatingPoint("improvement", null, 48, suiteFingerprint, {
      menuCertification: menuPath,
      holdoutValidation: holdoutPath,
    })).toThrow(/certification bars.*do not match/);
  });
});

describe("futility bound", () => {
  test("matches the certified one-sided t rule", () => {
    const bound = evalFutilityUpperBound(-2.5, 1.2, 11, 0.05);
    expect(bound).toBeCloseTo(-2.5 + studentTQuantile(0.95, 11) * 1.2, 12);
    expect(evalFutilityUpperBound(-2.5, 0, null, 0.05)).toBe(-2.5);
    expect(evalFutilityUpperBound(1, 1, null, 0.05)).toBeCloseTo(1 + studentTQuantile(0.95, Infinity), 12);
  });

  test("uses the same seed-block prefix selector as live eval", () => {
    const runs = [{ seedSlot: 2 }, { seedSlot: 0 }, { seedSlot: 1 }, { seedSlot: 3 }];
    expect(evalRunsAtLook(runs, 2)).toEqual([{ seedSlot: 0 }, { seedSlot: 1 }]);
    expect(() => evalRunsAtLook(runs, 0)).toThrow(/positive integer/);
  });

  test("flattens nested runner checkpoint rows before selecting a live look", () => {
    const nested = [2, 0, 1, 3].map((seedSlot) => ({
      status: "ok",
      task: { sourceId: "case", budget: 250_000, seedSlot, actualSeed: 100 + seedSlot },
    }));
    const decisionRuns = nested.map((row) =>
      checkpointResultToDecisionRun(row, { score: 400 + row.task.seedSlot, valid: true })
    );
    expect(evalRunsAtLook(decisionRuns, 2).map((row) => row.seedSlot)).toEqual([0, 1]);
  });

  test("operator abort settles only the current attempt and keeps its spend charged", async () => {
    const dir = tempDir();
    const paths = { ledger: join(dir, "attempts.jsonl"), projection: join(dir, "era-state.json") };
    appendAttemptEvent({
      type: "era-start",
      eraId: "era-abort",
      cause: "bootstrap",
      baselineLabel: "base-test",
      budgetCap: 0.05,
    }, paths, "2026-07-12T00:00:00.000Z");
    const declare = {
      type: "declare",
      eraId: "era-abort",
      attemptId: "attempt-abort",
      candidateFingerprint: "b".repeat(64),
      operatingPointId: "improve-t0-d48",
      mode: "improvement",
      margin: null,
      depth: 48,
      spend: 0.0196,
      certificationFingerprint: "c".repeat(64),
      canonicalSeedBase: 100,
      seedCount: 144,
      seedScheduleFingerprint: "d".repeat(64),
      retryAcknowledged: false,
    } as const;
    const declarationPath = join(dir, "abort-declaration.json");
    const declarationBytes = `${JSON.stringify({
      schema: "line.benchmark-v2.eval-declaration.v6",
      ...declare,
      candidateSnapshot: { candidateFingerprint: declare.candidateFingerprint },
      criticalAlpha: 0.01,
      futilitySchedule: [2, 3, 4, 8, 16],
      futilityAlpha: 0.05,
      eraBudgetSpend: declare.spend,
    })}\n`;
    writeFileSync(declarationPath, declarationBytes);
    appendAttemptEvent({
      ...declare,
      declarationPath,
      declarationSha256: createHash("sha256").update(declarationBytes).digest("hex"),
    }, paths, "2026-07-12T00:00:01.000Z");

    await expect(runEvalCommand([
      "--abort-in-flight",
      "--reason=infrastructure failure",
      `--attempts-ledger=${paths.ledger}`,
      `--era-state=${paths.projection}`,
    ])).resolves.toBe(1);
    const state = readEraState(paths);
    expect(state.inFlightAttemptId).toBeNull();
    expect(state.budgetSpent).toBe(0.0196);
    expect(state.attempts.at(-1)?.outcome).toBe("aborted");
  });

  test("worker-failure JSON is actionable for automation", () => {
    expect(evalWorkerFailurePayload({
      stage: "confirmation",
      reason: "persistent worker failures",
      attemptId: "attempt-1",
      workerFailures: 2,
      spendCharged: 0.0196,
      evidencePaths: ["baseline.checkpoint.jsonl", "candidate.checkpoint.jsonl"],
      nextCommand: "npm run benchmark -- eval --to-verdict --acknowledge-retry",
    })).toEqual({
      schema: "line.benchmark-v2.eval-failure.v1",
      status: "aborted",
      stage: "confirmation",
      reason: "persistent worker failures",
      attemptId: "attempt-1",
      workerFailures: 2,
      spendCharged: 0.0196,
      evidencePaths: ["baseline.checkpoint.jsonl", "candidate.checkpoint.jsonl"],
      nextCommand: "npm run benchmark -- eval --to-verdict --acknowledge-retry",
    });
  });

  test("verdict JSON is a compact envelope over the complete artifact", () => {
    const result = {
      outcome: "inconclusive",
      promotable: false,
      baseHeadline: 450,
      candidateHeadline: 453,
      delta: 3,
      confidence: { lowerBound: -0.5, upperBound: 6.5 },
      uncertainty: { seed: { standardError: 1.5 } },
      validity: { baseValid: 100, candidateValid: 101, total: 120, gained: 2, lost: 1 },
      perBudget: [{
        budget: 250_000,
        delta: 8,
        confidence: { lowerBound: 1, upperBound: 15 },
        baseValid: 50,
        candidateValid: 52,
        total: 60,
      }],
      perStratum: [{
        stratum: "representative",
        delta: 4,
        confidence: { lowerBound: 0.5, upperBound: 7.5 },
        baseValid: 80,
        candidateValid: 81,
        total: 84,
      }],
      perCase: Array.from({ length: 42 }, (_, index) => ({ sourceId: `case-${index}` })),
    };
    const payload = evalVerdictJsonPayload({
      attemptId: "attempt-1",
      artifactPath: "verdict.json",
      artifact: {
        schema: "line.benchmark-v2.decision.v4",
        result,
        hint: "diagnostic only",
        nextCommand: "npm run benchmark -- eval --to-verdict --acknowledge-retry",
      },
      era: {
        eraId: "era-1",
        budgetSpent: 0.0392,
        budgetCap: 0.05,
        cumulativeExpectedFalseAccepts: 0.098,
        attempts: Array.from({ length: 100 }, () => ({})),
      } as any,
      baseArchive: "base.json.gz",
      candidateArchive: "candidate.json.gz",
      certified: {
        point: { id: "improve-t0-d48", depth: 48, criticalAlpha: 0.01 },
        mde80: 5,
      } as any,
      spendCharged: 0.0196,
    });
    expect(payload).toMatchObject({
      schema: "line.benchmark-v2.eval-result.v1",
      status: "inconclusive",
      artifact: { result: { delta: 3 }, nextCommand: expect.stringContaining("--acknowledge-retry") },
      era: { budgetSpent: 0.0392, spendCharged: 0.0196 },
    });
    expect(JSON.stringify(payload)).not.toContain("perCase");
    expect(JSON.stringify(payload)).not.toContain("attempts");
  });

  test("stores verdict artifacts with retained run evidence", () => {
    expect(evalVerdictArtifactPath("benchmark/v2/runs", "attempt-1", "inconclusive"))
      .toBe(join(process.cwd(), "benchmark/v2/runs/attempt-1-verdict-inconclusive.json"));
  });

  test("settles a fired look after a crash before the futility event", () => {
    const dir = tempDir();
    const paths = { ledger: join(dir, "attempts.jsonl"), projection: join(dir, "era-state.json") };
    appendAttemptEvent({
      type: "era-start",
      eraId: "era-test",
      cause: "bootstrap",
      baselineLabel: "base-test",
      budgetCap: 0.05,
    }, paths, "2026-07-12T00:00:00.000Z");
    const declare = {
      type: "declare",
      eraId: "era-test",
      attemptId: "attempt-fired",
      candidateFingerprint: "b".repeat(64),
      operatingPointId: "improve-t0-d48",
      mode: "improvement",
      margin: null,
      depth: 48,
      spend: 0.0196,
      certificationFingerprint: "c".repeat(64),
      canonicalSeedBase: 1_500_000,
      seedCount: 144,
      seedScheduleFingerprint: "d".repeat(64),
      retryAcknowledged: false,
    } as const;
    const declarationPath = join(dir, "declaration.json");
    const declarationBytes = `${JSON.stringify({
      schema: "line.benchmark-v2.eval-declaration.v6",
      ...declare,
      candidateSnapshot: { candidateFingerprint: declare.candidateFingerprint },
      criticalAlpha: 0.01,
      futilitySchedule: [2, 3, 4, 8, 16],
      futilityAlpha: 0.05,
      eraBudgetSpend: declare.spend,
    })}\n`;
    writeFileSync(declarationPath, declarationBytes);
    appendAttemptEvent({
      ...declare,
      declarationPath,
      declarationSha256: createHash("sha256").update(declarationBytes).digest("hex"),
    }, paths, "2026-07-12T00:00:01.000Z");
    appendAttemptEvent({
      type: "look",
      attemptId: "attempt-fired",
      k: 2,
      delta: -3,
      standardError: 0.5,
      upperBound: -2.1,
      fired: true,
    }, paths, "2026-07-12T00:00:02.000Z");

    expect(recoverDurableFutilityStop({
      attemptId: "attempt-fired",
      mode: "improvement",
      margin: null,
    }, paths)).toEqual({ k: 2, upperBound: -2.1, threshold: 0 });
    expect(readEraState(paths).attempts.at(-1)?.outcome).toBe("futility-stop");
    expect(readAttemptEvents(paths).filter((event) => event.type === "futility")).toHaveLength(1);

    // A second resume sees the existing settlement and cannot duplicate it.
    expect(recoverDurableFutilityStop({
      attemptId: "attempt-fired",
      mode: "improvement",
      margin: null,
    }, paths)).toEqual({ k: 2, upperBound: -2.1, threshold: 0 });
    expect(readAttemptEvents(paths).filter((event) => event.type === "futility")).toHaveLength(1);
  });
});

describe("acceptance qualification gate", () => {
  test("keeps a failed qualification from reaching the verdict append", () => {
    expect(() => assertQualificationSucceeded({ workerFailures: 1 }))
      .toThrow(/attempt remains in flight.*resumed/);
    expect(() => assertQualificationSucceeded({ workerFailures: 0 })).not.toThrow();
  });
});
