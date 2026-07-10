import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildAuditReport, type AuditReport } from "../scripts/v0/benchmark_v2/audit_model.ts";
import {
  buildCharacterizationReport,
  characterizeSpec,
  loadSpecModule,
  type CharacterizationReport,
  type ResolvedSource,
} from "../scripts/v0/benchmark_v2/model.ts";

function source(id: string, role: ResolvedSource["role"]): ResolvedSource {
  return {
    id,
    role,
    module: `${id}.ts`,
    sourceFiles: [],
    sourceFingerprint: id,
    originFamily: role,
    musicBacked: role === "qualification_reference",
    eligibleComponents: ["sync", "survival", "air", "speed", "impact"],
    diagnosticComponents: [],
  };
}

describe("Benchmark V2 static audit", () => {
  test("current representative pool has no hard audit failures", () => {
    const audit = JSON.parse(readFileSync("benchmark/v2/evidence/audit.json", "utf8")) as AuditReport;
    expect(audit.hardFailures).toEqual([]);
    expect(audit.directSequenceMatches).toEqual([]);
  });

  test("detects the quarantined Luna timing copy", async () => {
    const prototype = await loadSpecModule("benchmark/v2/archive/prototype-v2.0/specs-v2/prototypes/manual/vocal_to_pulse.ts");
    const luna = await loadSpecModule("productions/luna_bala_44s/spec.ts");
    const sources = [
      characterizeSpec(source("prototype", "representative_candidate"), prototype),
      characterizeSpec(source("luna", "qualification_reference"), luna),
    ];
    const characterization = buildCharacterizationReport("test.json", "{}", sources);
    const audit = buildAuditReport(characterization);
    expect(audit.hardFailures.some((failure) => failure.includes("direct sequence match"))).toBe(true);
  });

  test("tracked audit is pinned to tracked characterization", () => {
    const characterization = JSON.parse(readFileSync("benchmark/v2/evidence/characterization.json", "utf8")) as CharacterizationReport;
    const audit = JSON.parse(readFileSync("benchmark/v2/evidence/audit.json", "utf8")) as AuditReport;
    expect(audit.characterizationFingerprint).toBe(characterization.dataFingerprint);
  });
});
