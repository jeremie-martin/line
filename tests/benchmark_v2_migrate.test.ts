import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  conformanceSuite,
  detectMinimumScope,
  runMigrationCommand,
  syntheticCase,
} from "../scripts/v0/benchmark_v2/migrate.ts";
import { pairedV2DecisionForCalibration } from "../scripts/v0/benchmark_v2/decision_model.ts";

describe("legacy broad-contract binding is dead", () => {
  test("nothing imports DECISION_SOURCE_FILES except its frozen definition", () => {
    const offenders: string[] = [];
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry === "node_modules" || entry.startsWith(".")) continue;
          scan(path);
        } else if (path.endsWith(".ts")) {
          const contents = readFileSync(path, "utf8");
          const stripped = contents
            .replaceAll("DECISION_INFERENCE_SOURCE_FILES", "")
            .replaceAll("DECISION_PROTOCOL_SOURCE_FILES", "");
          if (stripped.includes("DECISION_SOURCE_FILES") &&
              !path.endsWith("scripts/v0/benchmark_v2/suite_model.ts") &&
              !path.endsWith("tests/benchmark_v2_migrate.test.ts")) {
            offenders.push(path);
          }
        }
      }
    };
    scan("scripts");
    scan("tests");
    expect(offenders).toEqual([]);
  });
});

describe("migration scope detection", () => {
  test("file lists set the minimum scope", () => {
    expect(detectMinimumScope([])).toBe("none");
    expect(detectMinimumScope(["scripts/v0/benchmark_v2/decide.ts"])).toBe("protocol");
    expect(detectMinimumScope(["benchmark/v2/runner-compatibility.json"])).toBe("protocol");
    expect(detectMinimumScope(["scripts/v0/benchmark_v2/decision_model.ts"])).toBe("inference");
    expect(detectMinimumScope(["benchmark/v2/decision-policy.ts"])).toBe("inference");
    // inference wins over protocol when both changed
    expect(detectMinimumScope([
      "scripts/v0/benchmark_v2/decide.ts",
      "scripts/v0/benchmark_v2/decision_model.ts",
    ])).toBe("inference");
    // suite-definition files dominate everything (rollover, refused upstream)
    expect(detectMinimumScope([
      "scripts/v0/benchmark_v2/suite_model.ts",
      "scripts/v0/benchmark_v2/decide.ts",
    ])).toBe("suite");
    expect(detectMinimumScope(["benchmark/v2/policy.ts"])).toBe("suite");
  });
});

describe("migration command argument gates", () => {
  test("refuses bad or missing declarations", async () => {
    await expect(runMigrationCommand(["--scope=everything"])).rejects.toThrow(/--scope must be/);
    await expect(runMigrationCommand(["--scope=protocol"])).rejects.toThrow(/alters-decision-behavior/);
    await expect(runMigrationCommand(["--scope=protocol", "--alters-decision-behavior=maybe"]))
      .rejects.toThrow(/alters-decision-behavior/);
    await expect(runMigrationCommand(["--scope=protocol", "--alters-decision-behavior=no"]))
      .rejects.toThrow(/--approve/);
    await expect(runMigrationCommand([
      "--scope=protocol", "--alters-decision-behavior=no", "--approve", "--reason=  ", "--operator=x",
    ])).rejects.toThrow(/--approve, --reason/);
  });
});

describe("conformance synthetic constructions", () => {
  const suite = conformanceSuite();

  test("correlated seed adversary must stay unresolved", () => {
    const { base, candidate, options } = syntheticCase(suite, "correlated_seed_adversary");
    const decision = pairedV2DecisionForCalibration(base, candidate, suite, { ...options, bootstrapSeed: 0 });
    expect(decision.outcome).toBe("unresolved");
    expect(decision.uncertainty.seed.standardError).toBeGreaterThan(5);
  });

  test("uniform +15 gain advances at probe screening", () => {
    const { base, candidate, options } = syntheticCase(suite, "uniform_gain_15");
    const decision = pairedV2DecisionForCalibration(base, candidate, suite, { ...options, bootstrapSeed: 0 });
    expect(decision.outcome).toBe("advance");
    expect(decision.delta).toBeCloseTo(15, 0);
  });

  test("uniform -2 shift accepts canonical non-inferiority at margin 5", () => {
    const { base, candidate, options } = syntheticCase(suite, "noninferiority_margin5");
    const decision = pairedV2DecisionForCalibration(base, candidate, suite, { ...options, bootstrapSeed: 0 });
    expect(options.mode).toBe("simplification");
    expect(decision.outcome).toBe("accept");
    expect(decision.delta).toBeCloseTo(-2, 0);
  });
});
