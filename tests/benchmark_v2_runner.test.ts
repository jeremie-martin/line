import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { AuditReport } from "../scripts/v0/benchmark_v2/audit_model.ts";
import {
  loadHeldoutManifest,
  loadSourceManifest,
  resolveHeldoutSources,
  resolveSources,
  type CharacterizationReport,
} from "../scripts/v0/benchmark_v2/model.ts";
import { validateEvidence } from "../scripts/v0/benchmark_v2/runner.ts";

describe("Benchmark V2 runner evidence gates", () => {
  test("accepts current evidence and rejects stale or failing evidence", () => {
    const sourceContents = readFileSync("benchmark/v2/compat/source-manifest.json", "utf8");
    const heldoutContents = readFileSync("benchmark/v2/compat/heldout-manifest.json", "utf8");
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const heldout = resolveHeldoutSources(loadHeldoutManifest("benchmark/v2/compat/heldout-manifest.json"));
    const characterization = JSON.parse(readFileSync("benchmark/v2/evidence/characterization.json", "utf8")) as CharacterizationReport;
    const audit = JSON.parse(readFileSync("benchmark/v2/evidence/audit.json", "utf8")) as AuditReport;
    expect(() => validateEvidence(characterization, audit, sourceContents, heldoutContents, sources, heldout)).not.toThrow();

    const stale = structuredClone(characterization);
    stale.manifestFingerprint = "stale";
    expect(() => validateEvidence(stale, audit, sourceContents, heldoutContents, sources, heldout)).toThrow(/stale/);

    const failing = structuredClone(audit);
    failing.hardFailures = ["failure"];
    expect(() => validateEvidence(characterization, failing, sourceContents, heldoutContents, sources, heldout)).toThrow(/stale/);

    const forgedCharacterization = structuredClone(characterization);
    forgedCharacterization.sources[0].contactCount++;
    expect(() => validateEvidence(forgedCharacterization, audit, sourceContents, heldoutContents, sources, heldout))
      .toThrow(/content fingerprint is stale/);
  });
});
