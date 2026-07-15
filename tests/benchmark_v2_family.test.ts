import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  allocateExplorationSeedEpoch,
  assertExplorationDecisionSemantics,
  buildFamilyReport,
  readBenchmarkFamily,
  runFamilyCommand,
  type BenchmarkFamily,
  type FamilyRound,
} from "../scripts/v0/benchmark_v2/family.ts";
import { loadSourceManifest, resolveSources } from "../scripts/v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  loadSuiteManifest,
  suiteIdentity,
} from "../scripts/v0/benchmark_v2/suite_model.ts";
import type { BaselineContract } from "../scripts/v0/benchmark_v2/confirmation.ts";

const temporaryRoots: string[] = [];
const originalFamilyEnv = process.env.LR_FAMILY_TEST;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalFamilyEnv === undefined) delete process.env.LR_FAMILY_TEST;
  else process.env.LR_FAMILY_TEST = originalFamilyEnv;
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Benchmark V2 family exploration", () => {
  test("allocates idempotent, disjoint epochs under concurrent callers", async () => {
    const root = temporaryRoot();
    const allocations = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        allocateExplorationSeedEpoch(root, `family-${index}`, 1, 12)
      ),
    );
    expect(new Set(allocations.map((entry) => entry.seedBase)).size).toBe(12);
    const sorted = allocations.map((entry) => entry.seedBase).sort((a, b) => a - b);
    for (let index = 1; index < sorted.length; index++) expect(sorted[index] - sorted[index - 1]).toBeGreaterThanOrEqual(12);
    await expect(allocateExplorationSeedEpoch(root, "family-0", 1, 24))
      .rejects.toThrow(/different depth/);
    expect(await allocateExplorationSeedEpoch(root, "family-0", 1, 12)).toEqual(allocations[0]);
    const ledger = JSON.parse(readFileSync(join(root, "seed-ledger.json"), "utf8"));
    expect(ledger.allocations).toHaveLength(12);
  });

  test("fails closed on ambiguous or misspelled family arguments", async () => {
    await expect(runFamilyCommand(["capture", "demo", "extra", "--variant=a"]))
      .rejects.toThrow(/exactly NAME/);
    await expect(runFamilyCommand(["capture", "demo", "--varaint=a"]))
      .rejects.toThrow(/unknown family capture option/);
    await expect(runFamilyCommand(["run", "demo", "--seeds", "2"]))
      .rejects.toThrow(/exactly NAME|--name=value/);
  });

  test("allows protocol-only repairs but refuses changed inference or calibration", () => {
    const baseline = {
      inferenceFingerprint: "a".repeat(64),
      calibrationFingerprint: "b".repeat(64),
    } as BaselineContract;
    expect(() => assertExplorationDecisionSemantics(baseline, {
      inferenceFingerprint: "a".repeat(64),
      protocolFingerprint: "c".repeat(64),
      calibrationFingerprint: "b".repeat(64),
    })).not.toThrow();
    expect(() => assertExplorationDecisionSemantics(baseline, {
      inferenceFingerprint: "d".repeat(64),
      protocolFingerprint: "c".repeat(64),
      calibrationFingerprint: "b".repeat(64),
    })).toThrow(/inference or calibration changed/);
  });

  test("captures arbitrary source states and permits only a source-baked exact selection", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const root = temporaryRoot();
    delete process.env.LR_FAMILY_TEST;
    await runFamilyCommand(["capture", "mechanism", "--variant=source", `--family-root=${root}`]);
    process.env.LR_FAMILY_TEST = "exploration-only";
    await runFamilyCommand(["capture", "mechanism", "--variant=env", `--family-root=${root}`]);

    const path = join(root, "mechanism", "family.json");
    const family = readBenchmarkFamily(path);
    expect(family.rounds[0].variants.map((variant) => variant.id)).toEqual(["source", "env"]);
    const round = family.rounds[0];
    round.status = "completed";
    round.frozenAt = new Date().toISOString();
    round.seedBase = 3_300_000_000;
    round.seedsPerBudget = 2;
    round.observedChampionId = "env";
    round.reportPath = join(root, "report.json");
    const reference = (candidateFingerprint: string) => ({
      archive: join(root, `${candidateFingerprint}.json`),
      archiveSha256: "a".repeat(64),
      compressedArchiveSha256: "b".repeat(64),
      candidateFingerprint,
      headline: 1,
    });
    round.baselineRun = reference(family.baseline.candidateFingerprint);
    round.variantRuns = Object.fromEntries(round.variants.map((variant) => [variant.id, reference(variant.candidateFingerprint)]));
    writeFileSync(round.reportPath, "{}\n");
    writeFileSync(path, `${JSON.stringify(family, null, 2)}\n`);

    await expect(runFamilyCommand(["select", "mechanism", "--variant=env", `--family-root=${root}`]))
      .rejects.toThrow(/exploration-only LR_ overrides/);
    delete process.env.LR_FAMILY_TEST;
    await expect(runFamilyCommand([
      "select", "mechanism", "--variant=source", "--reason=prefer-source-default", `--family-root=${root}`,
    ])).resolves.toBe(0);
    expect(readBenchmarkFamily(path).rounds[0].selectedVariantId).toBe("source");
  });

  test("reports shared-seed rankings, pairwise evidence, and early ranking reversals without authority", () => {
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
    const identity = suiteIdentity(
      "benchmark/v2/compat/suite-manifest.json",
      "benchmark/v2/compat/source-manifest.json",
      sources,
    );
    const seedBase = 3_200_000_000;
    const baselineRuns = syntheticRuns(suite.profiles.probe.budgets, canonicalMembers(suite), seedBase, () => 500);
    const steadyRuns = syntheticRuns(suite.profiles.probe.budgets, canonicalMembers(suite), seedBase, () => 508);
    const earlyRuns = syntheticRuns(
      suite.profiles.probe.budgets,
      canonicalMembers(suite),
      seedBase,
      (slot) => slot < 2 ? 514 : 498,
    );
    const family = syntheticFamily(identity.suiteFingerprint);
    const round = family.rounds[0];
    const archives: Record<string, any> = {
      baseline: { exploration: { authority: "exploration-only" }, runs: baselineRuns },
      steady: { exploration: { authority: "exploration-only" }, runs: steadyRuns },
      early: { exploration: { authority: "exploration-only" }, runs: earlyRuns },
    };
    const report = buildFamilyReport(family, round, (path) => archives[path]);

    expect(report.authority).toBe("exploration-only");
    expect(report.statement).toMatch(/not promotion decisions/);
    expect(report.observedChampionId).toBe("steady");
    expect(report.championStableAcrossPrefixes).toBe(false);
    expect(report.prefixRankings.find((entry) => entry.seedsPerBudget === 2)?.ranking[0].variantId).toBe("early");
    expect(report.rankingReversals).toEqual(expect.arrayContaining([
      expect.objectContaining({ seedsPerBudget: 2, observedLeaderId: "early", finalChampionId: "steady" }),
    ]));
    expect(report.pairwise).toHaveLength(1);
    expect(report.pairwise[0].deltaRightMinusLeft).toBeLessThan(0);
    expect(report.ranking[0]).toEqual(expect.objectContaining({
      variantId: "steady",
      delta: expect.any(Number),
      standardError: expect.any(Number),
      oneSidedCriticalLevel: expect.any(Number),
      validityGained: 0,
      validityLost: 0,
    }));
  });
});

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "v2-family-"));
  temporaryRoots.push(root);
  return root;
}

function syntheticRuns(
  budgets: readonly number[],
  members: string[],
  seedBase: number,
  score: (slot: number) => number,
): any[] {
  return budgets.flatMap((budget, budgetIndex) =>
    Array.from({ length: 4 }, (_, seedSlot) => members.map((sourceId) => ({
      task: {
        sourceId,
        budget,
        seedSlot,
        actualSeed: seedBase + budgetIndex * 4 + seedSlot,
      },
      score: { score: score(seedSlot), valid: true },
    }))).flat()
  );
}

function syntheticFamily(suiteFingerprint: string): BenchmarkFamily {
  const hash = "f".repeat(64);
  const snapshot = {
    schema: "line.benchmark-v2.compiler-snapshot.v1" as const,
    archive: "unused",
    archiveSha256: hash,
    candidateFingerprint: hash,
    compilerSourceFingerprint: hash,
    compilerEnvironment: {},
    engineArtifactFingerprint: hash,
  };
  const reference = (archive: string) => ({
    archive,
    archiveSha256: hash,
    compressedArchiveSha256: hash,
    candidateFingerprint: hash,
    headline: 0,
  });
  const round: FamilyRound = {
    number: 1,
    status: "running",
    createdAt: new Date(0).toISOString(),
    frozenAt: new Date(0).toISOString(),
    variants: [
      { id: "steady", capturedAt: new Date(0).toISOString(), note: null, candidateFingerprint: hash, snapshot, carriedFromRound: null },
      { id: "early", capturedAt: new Date(0).toISOString(), note: null, candidateFingerprint: hash, snapshot, carriedFromRound: null },
    ],
    seedBase: 3_200_000_000,
    seedsPerBudget: 4,
    baselineRun: reference("baseline"),
    variantRuns: { steady: reference("steady"), early: reference("early") },
    reportPath: null,
    observedChampionId: null,
    selectedVariantId: null,
    selectedAt: null,
    selectionReason: null,
  };
  return {
    schema: "line.benchmark-v2.family.v1",
    protocol: "line.benchmark-v2.family-protocol.v1",
    name: "synthetic",
    createdAt: new Date(0).toISOString(),
    baseline: {
      label: "baseline",
      suiteFingerprint,
      candidateFingerprint: hash,
      inferenceFingerprint: hash,
      protocolFingerprint: hash,
      calibrationFingerprint: hash,
      snapshot,
    },
    rounds: [round],
  };
}
