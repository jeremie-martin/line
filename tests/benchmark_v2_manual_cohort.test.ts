import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { AuditReport } from "../scripts/v0/benchmark_v2/audit_model.ts";
import {
  characterizeSpec,
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
  type CharacterizationReport,
} from "../scripts/v0/benchmark_v2/model.ts";
import { canonicalMembers, loadSuiteManifest } from "../scripts/v0/benchmark_v2/suite_model.ts";

describe("Benchmark V2 canonical cohort", () => {
  test("uses typed long-form parents plus deliberate variants", async () => {
    const manifest = loadSourceManifest("benchmark/v2/compat/source-manifest.json");
    const sources = resolveSources(manifest)
      .filter((source) => source.role === "representative_candidate");
    const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", resolveSources(manifest));
    expect(sources).toHaveLength(28);
    expect(suite.strata.map((stratum) => stratum.weight)).toEqual([0.7, 0.15, 0.1, 0.05]);
    expect(canonicalMembers(suite)).toHaveLength(44);
    expect(sources.every((source) => source.module?.startsWith("benchmark/v2/cases/"))).toBe(true);
    expect(sources.every((source) => !source.musicBacked)).toBe(true);
    expect(sources.filter((source) => source.parentId === undefined)).toHaveLength(14);
    expect(sources.filter((source) => source.parentId !== undefined)).toHaveLength(14);

    const characterized = [];
    for (const source of sources) {
      const spec = await loadSourceSpec(source);
      expect(spec.duration).toBeGreaterThanOrEqual(55);
      expect(spec.duration).toBeLessThanOrEqual(65);
      expect(spec.contacts.length).toBeGreaterThanOrEqual(55);
      expect(spec.contacts.length).toBeLessThanOrEqual(150);
      expect(spec.contacts.every((contact, index) =>
        contact.t >= 0 && contact.t <= spec.duration && contact.impact !== undefined &&
        (index === 0 || contact.t > spec.contacts[index - 1].t)
      )).toBe(true);
      characterized.push(characterizeSpec(source, spec));
    }

    expect(new Set(characterized.map((source) => source.cadence.exactContactHash)).size).toBeGreaterThanOrEqual(14);
    expect(new Set(characterized.map((source) => source.cadence.frameGapHash)).size).toBeGreaterThanOrEqual(14);
    expect(characterized.every((source) => !source.activeTargetAxes.includes("elevation"))).toBe(true);
    expect(characterized.every((source) => !source.activeTargetAxes.includes("grain"))).toBe(true);
    expect(Math.min(...characterized.map((source) => source.cadence.rawInterContactGapsSeconds.min!)))
      .toBeGreaterThanOrEqual(0.25);
    expect(Math.max(...characterized.map((source) => source.cadence.rawInterContactGapsSeconds.max!)))
      .toBeLessThan(2);
    expect(characterized.every((source) => source.scoreMetadata !== undefined)).toBe(true);
  });

  test("pins selection to the passing static audit without compiler evidence", () => {
    const characterization = JSON.parse(
      readFileSync("benchmark/v2/evidence/characterization.json", "utf8"),
    ) as CharacterizationReport;
    const audit = JSON.parse(readFileSync("benchmark/v2/evidence/audit.json", "utf8")) as AuditReport;
    const review = JSON.parse(readFileSync("benchmark/v2/evidence/candidate-review.json", "utf8")) as {
      status: string;
      characterization_fingerprint: string;
      audit_fingerprint: string;
      selection_basis: string;
      decisions: Array<{ id: string; disposition: string; rationale: string }>;
    };
    const canonicalIds = characterization.sources
      .filter((source) => source.role !== "qualification_reference")
      .map((source) => source.id)
      .sort();

    expect(audit.hardFailures).toEqual([]);
    expect(review.status).toBe("canonical-selected-without-compiler-results");
    expect(review.selection_basis).toMatch(/No compiler or qualification outcome/);
    expect(review.characterization_fingerprint).toBe(characterization.dataFingerprint);
    expect(review.audit_fingerprint).toBe(audit.auditFingerprint);
    expect(review.decisions.map((decision) => decision.id).sort()).toEqual(canonicalIds);
    expect(review.decisions.every((decision) => decision.disposition === "selected" && decision.rationale.length > 0)).toBe(true);
  });
});
