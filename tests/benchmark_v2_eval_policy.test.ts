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
import { futilityUpperBound } from "../scripts/v0/benchmark_v2/eval.ts";
import { studentTQuantile } from "../scripts/v0/benchmark_v2/decision_model.ts";
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
    const futilityNull = menu.cells.find((cell: any) => cell.id === "futility_null");
    const futilityPower = menu.cells.find((cell: any) => cell.id === "futility_power_5");
    // Spend and envelope are read from the artifact, never hardcoded.
    expect(certified.spend).toBe(futilityNull.combined.netAccept.wilson95[1]);
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

  test("refuses stale artifacts: wrong suite, wrong inference identity, failed bars", () => {
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
});

describe("futility bound", () => {
  test("matches the certified one-sided t rule", () => {
    const bound = futilityUpperBound(-2.5, 1.2, 11, 0.05);
    expect(bound).toBeCloseTo(-2.5 + studentTQuantile(0.95, 11) * 1.2, 12);
    expect(futilityUpperBound(-2.5, 0, null, 0.05)).toBe(-2.5);
    expect(futilityUpperBound(1, 1, null, 0.05)).toBeCloseTo(1 + studentTQuantile(0.95, Infinity), 12);
  });
});
