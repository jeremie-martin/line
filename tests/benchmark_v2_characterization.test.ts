import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildCharacterizationReport,
  characterizeSpec,
  loadHeldoutManifest,
  loadSourceManifest,
  loadSourceSpec,
  numericSummary,
  type ResolvedSource,
  resolveSources,
  resolveHeldoutSources,
  type SourceManifest,
} from "../scripts/v0/benchmark_v2/model.ts";
import type { Curve, Spec } from "../scripts/v0/types.ts";

const constantCurve = (value: number): Curve => ((_: number) => value) as Curve;

function source(id: string, pulse?: number): ResolvedSource {
  return {
    id,
    role: "representative_candidate",
    module: `specs/v2/${id}.ts`,
    sourceFiles: [],
    sourceFingerprint: id,
    originFamily: "test",
    musicBacked: false,
    musicWorkId: undefined,
    eligibleComponents: [],
    diagnosticComponents: [],
    referencePulseSeconds: pulse,
  };
}

function spec(contactTimes: number[]): Spec {
  return {
    duration: Math.max(...contactTimes) + 0.5,
    contacts: contactTimes.map((t, index) => ({ t, impact: index / 10 })),
    axes: {
      air: constantCurve(0.6),
      speed: constantCurve(0.7),
      grain: constantCurve(0.5),
    },
  };
}

describe("Benchmark V2 static characterization", () => {
  test("computes interpolated quantiles without collapsing exact median indexes", () => {
    const summary = numericSummary([0.3, 0.35, 0.65, 0.7, 1.0]);
    expect(summary.median).toBe(0.65);
    expect(summary.p10).toBeCloseTo(0.32, 6);
    expect(summary.p90).toBeCloseTo(0.88, 6);
  });

  test("reports cadence bands, pulse subdivisions, active targets, and inert grain", () => {
    const result = characterizeSpec(source("funky", 0.7), spec([0.7, 1.05, 1.4, 2.1, 2.8]));
    expect(result.cadence.interContactGapsSeconds.median).toBeCloseTo(0.525, 6);
    expect(result.cadence.gapBands["350_500ms"].count).toBe(2);
    expect(result.cadence.maximumConsecutiveShortGaps).toBe(0);
    expect(result.cadence.pulse?.ratioCounts.half).toBe(2);
    expect(result.cadence.pulse?.ratioCounts.primary).toBe(2);
    expect(result.activeTargetAxes).toEqual(["air", "speed", "impact"]);
    expect(result.inertAuthoredAxes).toEqual(["grain"]);
    expect(result.gapTargetCorrelations.air).toBeNull();
    expect(result.gapTargetCorrelations.speed).toBeNull();
  });

  test("separates exact contact timelines from equal frame-gap skeletons", () => {
    const a = characterizeSpec(source("a"), spec([0.5, 1.0, 1.5]));
    const b = characterizeSpec(source("b"), spec([0.6, 1.1, 1.6]));
    const report = buildCharacterizationReport(
      "benchmark/v2/test.json",
      "{}",
      [a, b],
    );
    expect(report.exactContactDuplicates).toEqual([]);
    expect(report.frameGapDuplicates).toHaveLength(1);
    expect(report.frameGapDuplicates[0].members).toEqual(["a", "b"]);
  });

  test("keeps impact gaps aligned when only some contacts author impact", () => {
    const sparseImpactSpec: Spec = {
      duration: 3,
      axes: {},
      contacts: [
        { t: 0.5, impact: 0.2 },
        { t: 1.0 },
        { t: 1.5, impact: 0.5 },
        { t: 2.5, impact: 0.9 },
      ],
    };
    const result = characterizeSpec(source("sparse-impact"), sparseImpactSpec);
    expect(result.targets.impact?.count).toBe(3);
    expect(result.gapTargetCorrelations.impact).not.toBeNull();
  });

  test("data fingerprint is stable under input ordering", () => {
    const a = characterizeSpec(source("a"), spec([0.5, 1.0, 1.5]));
    const b = characterizeSpec(source("b"), spec([0.6, 1.1, 1.6]));
    const forward = buildCharacterizationReport("manifest.json", "x", [a, b]);
    const reverse = buildCharacterizationReport("manifest.json", "x", [b, a]);
    expect(reverse.dataFingerprint).toBe(forward.dataFingerprint);
  });

  test("keeps development music distinct from qualification references", () => {
    const manifest: SourceManifest = {
      schema: "line.benchmark-v2.source-inventory.v4",
      status: "canonical-development-inventory",
      description: "test",
      representative_candidates: [],
      capability_candidates: [],
      regression_candidates: [],
      development_music_candidates: [{
        id: "diagnostic",
        module: "package.json",
        source_files: ["package.json"],
        origin_family: "song-a",
        music_backed: true,
        music_work_id: "song-a",
        eligible_components: ["sync"],
      }],
    };
    const heldout = {
      schema: "line.benchmark-v2.qualification-registry.v2" as const,
      status: "qualification-monitor" as const,
      description: "test",
      references: [{
        id: "heldout",
        module: "package-lock.json",
        source_files: ["package-lock.json"],
        music_backed: true,
        eligible_components: ["sync" as const],
      }],
    };
    expect(resolveSources(manifest).map((entry) => entry.role)).toEqual([
      "development_music_candidate",
    ]);
    expect(resolveHeldoutSources(heldout).map((entry) => entry.role)).toEqual(["qualification_reference"]);
  });

  test("keeps every V1 source outside the V2 inventory", () => {
    const parsed = JSON.parse(
      readFileSync("benchmark/v2/compat/source-manifest.json", "utf8"),
    ) as Record<string, unknown>;
    const manifest = loadSourceManifest("benchmark/v2/compat/source-manifest.json");
    const sources = resolveSources(manifest);
    const heldout = resolveHeldoutSources(loadHeldoutManifest("benchmark/v2/compat/heldout-manifest.json"));
    const audit = JSON.parse(
      readFileSync("benchmark/v1-audit/source-inventory.json", "utf8"),
    ) as { sources: Array<{ id: string }> };

    expect(parsed).not.toHaveProperty("legacy_candidates");
    expect(sources).toHaveLength(44);
    expect(heldout).toHaveLength(5);
    expect(audit.sources).toHaveLength(40);
    const auditIds = new Set(audit.sources.map((entry) => entry.id));
    expect(sources.filter((entry) => auditIds.has(entry.id))).toEqual([]);
    expect(sources.some((entry) => entry.module?.startsWith("specs/golden/"))).toBe(false);
    expect(sources.map((entry) => entry.role)).not.toContain("legacy_candidate");
    expect(sources.map((entry) => entry.id).filter((id) => heldout.some((entry) => entry.id === id))).toEqual([]);
  });

  test("pins the explicit long-form pickup and rideout capability boundaries", async () => {
    const manifest = loadSourceManifest("benchmark/v2/compat/source-manifest.json");
    const capabilities = resolveSources(manifest).filter((entry) => entry.role === "capability_candidate");
    const pickupSource = capabilities.find((entry) => entry.id === "frontier_pickup_progression")!;
    const rideoutSource = capabilities.find((entry) => entry.id === "frontier_low_air_endurance")!;
    const pickupSpec = await loadSourceSpec(pickupSource);
    const rideoutSpec = await loadSourceSpec(rideoutSource);
    const capabilitySource = (id: string): ResolvedSource => ({
      ...source(id),
      role: "capability_candidate",
      originFamily: id,
      referencePulseSeconds: id.includes("pickup") ? 0.6 : 0.5,
    });
    const pickups = characterizeSpec(capabilitySource("pickup"), pickupSpec);
    const rideouts = characterizeSpec(capabilitySource("rideout"), rideoutSpec);

    expect(pickups.cadence.rawInterContactGapsSeconds.min).toBe(0.18);
    // The raw 240ms pickup quantizes to 250ms at 40 fps; six gaps remain below 250ms.
    expect(pickups.cadence.gapBands.lt_250ms.count).toBeGreaterThanOrEqual(6);
    expect(pickups.cadence.maximumConsecutiveGaps.lt_250ms).toBe(1);
    expect(rideouts.cadence.rawInterContactGapsSeconds.max).toBe(5);
    expect(rideouts.cadence.gapBands["2_3s"].count).toBe(1);
    expect(rideouts.cadence.gapBands["3_5s"].count).toBe(1);
    expect(rideouts.cadence.gapBands.gte_5s.count).toBe(1);
    expect(rideouts.targets.air?.min).toBeLessThanOrEqual(0.06);
  });
});
