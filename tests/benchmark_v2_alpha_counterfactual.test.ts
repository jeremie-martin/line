import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildAlphaCounterfactual } from "../scripts/benchmark/analyze_alpha_counterfactual.ts";

const menu = JSON.parse(readFileSync("benchmark/v2/studies/menu-certification.json", "utf8"));
const powerGridBytes = readFileSync("benchmark/v2/studies/power-grid.json");
const powerGrid = JSON.parse(powerGridBytes.toString("utf8"));
const powerGridSha256 = createHash("sha256").update(powerGridBytes).digest("hex");

describe("98% promotion-critical counterfactual", () => {
  test("is diagnostic, monotone in power, and leaves risk explicitly unmeasured", () => {
    const report = buildAlphaCounterfactual(menu, powerGrid, powerGridSha256);
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
    expect(() => buildAlphaCounterfactual({
      ...menu,
      upstream: { ...menu.upstream, powerGrid: { ...menu.upstream.powerGrid, sha256: "stale" } },
    }, powerGrid, powerGridSha256)).toThrow(/not bound/);
    expect(() => buildAlphaCounterfactual(menu, {
      ...powerGrid,
      config: { ...powerGrid.config, criticals: [0.01] },
    }, powerGridSha256)).toThrow(/not bound/);
  });
});
