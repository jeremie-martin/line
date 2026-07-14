import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { LONG_CARRIER_REPLICATION_CAPTURE_CASES } from "../scripts/v0/trajectory/long_carrier_replication_input.ts";
import { longCarrierReplicationSourceIdentity } from "../scripts/v0/trajectory/long_carrier_replication_source.ts";
import { longCarrierReplicationCandidateIdentity } from "../scripts/v0/trajectory/long_carrier_replication_candidate.ts";
import { longCarrierReplicationChildEnvironment } from "../scripts/v0/trajectory/long_carrier_replication_runtime.ts";

const FORBIDDEN_PATHS = [
  "scripts/v0/trajectory/panel.ts",
  "scripts/v0/capture_trajectory_fixture.ts",
] as const;

describe("long-carrier replication isolation", () => {
  test("keeps every live replication entrypoint out of benchmark-v2 and the broad panel closure", () => {
    for (const entrypoint of [
      "scripts/v0/capture_long_carrier_replication_fixture.ts",
      "scripts/v0/run_long_carrier_replication.ts",
      "scripts/v0/verify_long_carrier_replication.ts",
      "scripts/v0/trajectory/long_carrier_replication_records.ts",
    ]) {
      const identity = longCarrierReplicationSourceIdentity(entrypoint);
      expect(identity.sourceFiles, entrypoint).not.toEqual(expect.arrayContaining(FORBIDDEN_PATHS));
      expect(identity.sourceFiles.some((path) => path.startsWith("benchmark/v2/") || path.startsWith("scripts/v0/benchmark_v2/")), entrypoint)
        .toBe(false);
    }
  });

  test("uses a study-local compiler identity with no benchmark source files", () => {
    const identity = longCarrierReplicationCandidateIdentity("wasm");
    expect(identity.compilerIdentityProtocol).toBe("line.long-carrier-compiler-identity.v1");
    expect(identity.compilerSourceFiles.some((path) => path.startsWith("benchmark/v2/") || path.startsWith("scripts/v0/benchmark_v2/")))
      .toBe(false);
    expect(identity.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test("rejects alternate cohort, budget, engine, and roster before compilation", () => {
    const caseId = LONG_CARRIER_REPLICATION_CAPTURE_CASES[0]!.id;
    const root = mkdtempSync(join(tmpdir(), "line-long-carrier-capture-cli-"));
    const run = (args: string[], engine = "wasm") => spawnSync(process.execPath, [
      "--import", "tsx", "scripts/v0/capture_long_carrier_replication_fixture.ts", ...args,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, LR_ENGINE: engine },
    });
    const common = [`--case=${caseId}`, "--cohort=validation", "--budget=500000", `--out=${join(root, "fixture.json")}`];

    const wrongBudget = run([...common.filter((value) => value !== "--budget=500000"), "--budget=499999"]);
    expect(wrongBudget.status).toBe(1);
    expect(`${wrongBudget.stdout}\n${wrongBudget.stderr}`).toContain("requires --budget=500000");

    const wrongCohort = run([...common.filter((value) => value !== "--cohort=validation"), "--cohort=calibration"]);
    expect(wrongCohort.status).toBe(1);
    expect(`${wrongCohort.stdout}\n${wrongCohort.stderr}`).toContain("requires --cohort=validation");

    const wrongEngine = run(common, "js");
    expect(wrongEngine.status).toBe(1);
    expect(`${wrongEngine.stdout}\n${wrongEngine.stderr}`).toContain("requires exactly LR_ENGINE=wasm");

    const unknown = run([...common.filter((value) => !value.startsWith("--case=")), "--case=not-declared"]);
    expect(unknown.status).toBe(1);
    expect(`${unknown.stdout}\n${unknown.stderr}`).toContain("unknown long-carrier replication case");
  }, 15_000);

  test("rejects loader overrides before preflight and strips unrelated child environment", () => {
    const runPreflight = (environment: NodeJS.ProcessEnv) => spawnSync(process.execPath, [
      "--import", "tsx", "scripts/v0/run_long_carrier_replication.ts",
      `--out-dir=${join(tmpdir(), "line-long-carrier-runtime-guard")}`,
      "--check",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
    });

    const nodeOptions = runPreflight({ ...process.env, LR_ENGINE: "wasm", NODE_OPTIONS: "--trace-warnings" });
    expect(nodeOptions.status).toBe(1);
    expect(`${nodeOptions.stdout}\n${nodeOptions.stderr}`).toContain("forbids semantic loader/runtime environment variable(s): NODE_OPTIONS");

    const tsxOverride = runPreflight({ ...process.env, LR_ENGINE: "wasm", TSX_REPLICATION_TEST: "1" });
    expect(tsxOverride.status).toBe(1);
    expect(`${tsxOverride.stdout}\n${tsxOverride.stderr}`).toContain("forbids semantic loader/runtime environment variable(s): TSX_REPLICATION_TEST");

    expect(longCarrierReplicationChildEnvironment({
      PATH: "/bin",
      HOME: "/tmp/home",
      UNRELATED_SENTINEL: "must-not-reach-child",
      LR_ENGINE: "other",
    })).toEqual({ PATH: "/bin", HOME: "/tmp/home", LR_ENGINE: "wasm" });
  }, 15_000);
});
