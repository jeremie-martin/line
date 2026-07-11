import { describe, expect, test } from "vitest";
import { listDashboardSpecs, loadSpecView } from "../scripts/serve.ts";

describe("Benchmark V2 specification dashboard", () => {
  test("lists exactly the authoritative development and qualification catalog", () => {
    const specs = listDashboardSpecs().filter((entry) => entry.group.startsWith("v2/"));

    expect(specs).toHaveLength(47);
    expect(new Set(specs.map((entry) => entry.path)).size).toBe(47);
    expect(specs.filter((entry) => entry.group === "v2/qualification")).toHaveLength(5);
    expect(specs).toContainEqual(expect.objectContaining({
      name: "river_reentry",
      path: "benchmark/v2/cases/normative/representative/river_reentry.ts",
      group: "v2/representative",
    }));
  });

  test("exposes authored phases and the retained listening-review clicks", async () => {
    const view = await loadSpecView(
      "benchmark/v2/cases/normative/representative/river_reentry.ts",
      140,
    ) as any;

    expect(view.benchmark).toMatchObject({ id: "river_reentry", cohort: "representative" });
    expect(view.summary.contacts).toBeGreaterThan(0);
    expect(view.overlayMeta.phases).toHaveLength(5);
    expect(view.music.audioUrl).toBe("/generated/benchmark-v2/listening-review/river_reentry.wav");
  });
});
