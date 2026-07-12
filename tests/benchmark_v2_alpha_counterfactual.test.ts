import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildAlphaCounterfactual } from "../scripts/benchmark/analyze_alpha_counterfactual.ts";

const menu = JSON.parse(readFileSync("benchmark/v2/studies/menu-certification.json", "utf8"));
const powerGrid = JSON.parse(readFileSync("benchmark/v2/studies/power-grid.json", "utf8"));

describe("98% promotion-critical counterfactual", () => {
  test("is diagnostic, monotone in power, and leaves risk explicitly unmeasured", () => {
    const report = buildAlphaCounterfactual(menu, powerGrid);
    expect(report.authority).toBe("diagnostic-only");
    expect(report.comparison.currentCriticalAlpha).toBe(0.01);
    expect(report.comparison.counterfactualCriticalAlpha).toBe(0.02);
    expect(report.comparison.criticals.df47.reduction).toBeGreaterThan(0);
    for (const row of report.finalPowerProjection) {
      expect(row.projectedPowerAt98).toBeGreaterThan(row.retainedPowerAt99);
      expect(row.projectedPowerAt98).toBeLessThan(1);
    }
    expect(report.limitations.join(" ")).toMatch(/unknown until the full chain is rerun/);
    expect(report.conclusion).toMatch(/Retain 99%/);
  });

  test("refuses stale or mismatched evidence", () => {
    expect(() => buildAlphaCounterfactual({ ...menu, suiteFingerprint: "stale" }, powerGrid))
      .toThrow(/current depth-48/);
    expect(() => buildAlphaCounterfactual(menu, {
      ...powerGrid,
      suiteFingerprint: "stale",
    })).toThrow(/current depth-48/);
  });
});
