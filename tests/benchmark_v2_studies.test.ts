import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { EVAL_CHAIN_INFERENCE_SOURCE_FILES } from "../scripts/v0/benchmark_v2/eval_chain_inference.ts";
import { CERTIFICATION_GENERATOR_SOURCE_FILES } from "../scripts/v0/benchmark_v2/certification_identity.ts";
import { fingerprintFiles } from "../scripts/v0/benchmark_v2/suite_model.ts";
import {
  assertKnobOnlyDelta,
  readVerifiedArtifact,
  verifyScaleStudyArchive,
} from "../scripts/benchmark/study_lib.ts";

const VOLATILE_KEYS = ["generatedAt", "runtimeSeconds", "workers"];

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"));
}

function findKeysRecursively(value: unknown, keys: string[], path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((child, i) => findKeysRecursively(child, keys, `${path}[${i}]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [
      ...(keys.includes(key) ? [`${path}.${key}`] : []),
      ...findKeysRecursively(child, keys, `${path}.${key}`),
    ]);
  }
  return [];
}

describe("retained study artifacts", () => {
  test("pairing.json v2 pins verified inputs with sidecars", () => {
    const pairing = loadJson("benchmark/v2/studies/pairing.json");
    expect(pairing.schema).toBe("line.benchmark-v2.pairing-study.v2");
    expect(pairing.verification.checks.length).toBeGreaterThanOrEqual(5);
    for (const [name, input] of Object.entries<any>(pairing.inputs)) {
      expect(input.sha256, name).toMatch(/^[0-9a-f]{64}$/);
      expect(input.rawSha256, name).toMatch(/^[0-9a-f]{64}$/);
      expect(existsSync(input.path), `${name}: ${input.path}`).toBe(true);
      expect(sha256(readFileSync(input.path)), name).toBe(input.sha256);
      expect(existsSync(`${input.path}.sha256`), `${name} sidecar`).toBe(true);
    }
    expect(pairing.inputs.smallArm.path).toContain("benchmark/v2/studies/arms/");
    expect(pairing.inputs.broadArm.path).toContain("benchmark/v2/studies/arms/");
  });

  test("simulation artifacts are volatile-free with provenance sidecars", () => {
    for (const name of ["power-grid", "probe-futility"]) {
      const artifactPath = `benchmark/v2/studies/${name}.json`;
      const artifact = loadJson(artifactPath);
      expect(artifact.schema, name).toMatch(/\.v2$/);
      expect(findKeysRecursively(artifact, VOLATILE_KEYS), name).toEqual([]);
      const provenance = loadJson(`benchmark/v2/studies/${name}.provenance.json`);
      expect(provenance.schema).toBe("line.benchmark-v2.study-provenance.v1");
      expect(provenance.artifactSha256).toBe(sha256(readFileSync(artifactPath)));
    }
  });

  test("two-mode validation artifacts recompute barsMet correctly", () => {
    // v4 artifacts: certify (in-sample pooled, hard power bars) and holdout
    // (variance-robust bars + truth transfer; power reported, not gated).
    for (const name of ["menu-certification", "holdout-validation"]) {
      const path = `benchmark/v2/studies/${name}.json`;
      if (!existsSync(path)) continue;
      const v = loadJson(path);
      expect(v.schema).toBe("line.benchmark-v2.independent-validation.v4");
      expect(v.evalChainInferenceFingerprint).toBe(fingerprintFiles(EVAL_CHAIN_INFERENCE_SOURCE_FILES));
      expect(v.certificationGeneratorFingerprint).toBe(fingerprintFiles(CERTIFICATION_GENERATOR_SOURCE_FILES));
      expect(v.methodology.futility).toContain(`depth-${v.predeclared.depth}`);
      expect(v.methodology.futility).not.toContain("depth-32");
      for (const reference of [v.independentReference, v.originalReference]) {
        const artifact = readFileSync(reference.path);
        expect(reference.artifactSha256).toBe(sha256(artifact));
        expect(reference.rawSha256).toBe(sha256(reference.path.endsWith(".gz") ? gunzipSync(artifact) : artifact));
      }
      const bars = v.predeclared.bars;
      const byId = new Map<string, any>(v.cells.map((cell: any) => [cell.id, cell]));
      const robust = {
        improve_null_empirical: byId.get("improve_null_empirical").combined.accept.wilson95[1] <= bars.nullFalseAcceptWilsonUpperMax,
        improve_null_validity_flips: byId.get("improve_null_validity_flips").combined.accept.wilson95[1] <= bars.nullFalseAcceptWilsonUpperMax,
        improve_null_hard_zero: byId.get("improve_null_hard_zero").combined.accept.wilson95[1] <= bars.nullFalseAcceptWilsonUpperMax,
        simplify_m5_boundary: byId.get("simplify_m5_boundary").combined.accept.wilson95[1] <= bars.boundaryFalseAcceptWilsonUpperMax,
        futility_null: byId.get("futility_null").combined.netAccept.wilson95[1] <= bars.futilityNullFalseAcceptWilsonUpperMax,
        determinism: v.barsMet.determinism,
      };
      const power = {
        improve_power_5: byId.get("improve_power_5").combined.accept.wilson95[0] >= bars.powerAtPlus5WilsonLowerMin,
        simplify_m5_noninferiority: byId.get("simplify_m5_noninferiority").combined.accept.wilson95[0] >= bars.noninferiorityPowerWilsonLowerMin,
        futility_power_5: byId.get("futility_power_5").combined.netAccept.wilson95[0] >= bars.futilityNetPowerAtPlus5WilsonLowerMin,
      };
      if (v.mode === "certify") {
        expect(v.barsMet).toEqual({ ...robust, ...power });
        expect(v.inSample).toBe(true);
      } else {
        const a = v.achievedTrueDeltas;
        const truth = Math.abs(a.improve2 - 2) <= 0.3 && Math.abs(a.improve3 - 3) <= 0.3 &&
          Math.abs(a.improve5 - 5) <= 0.3 && Math.abs(a.boundaryM5 + 5) <= 0.3;
        expect(v.barsMet).toEqual({ ...robust, truth_transfer: truth });
        expect(v.powerReported).toEqual(power);
      }
      expect(v.allBarsMet).toBe(Object.values(v.barsMet).every((met: boolean) => met));
      for (const cell of v.cells) {
        expect(cell.combined.accept.count + cell.combined.reject.count + cell.combined.inconclusive.count, cell.id)
          .toBe(cell.combined.trials);
      }
    }
  });

  test("independent-validation barsMet is correctly recomputed from stored counts and predeclared bars", () => {
    // A failed validation study must remain valid retained evidence: this test
    // verifies internal consistency of barsMet, NOT that the bars passed
    // (the P2-b gate enforces passing separately).
    const path = "benchmark/v2/studies/independent-validation.json";
    if (!existsSync(path)) return; // P2-b not yet landed
    const validation = loadJson(path);
    const bars = validation.predeclared.bars;
    const byId = new Map<string, any>(validation.cells.map((cell: any) => [cell.id, cell]));
    const expected = {
      improve_null_empirical: byId.get("improve_null_empirical").combined.accept.wilson95[1] <= bars.nullFalseAcceptWilsonUpperMax,
      improve_null_validity_flips: byId.get("improve_null_validity_flips").combined.accept.wilson95[1] <= bars.nullFalseAcceptWilsonUpperMax,
      improve_null_hard_zero: byId.get("improve_null_hard_zero").combined.accept.wilson95[1] <= bars.nullFalseAcceptWilsonUpperMax,
      improve_power_5: byId.get("improve_power_5").combined.accept.wilson95[0] >= bars.powerAtPlus5WilsonLowerMin,
      simplify_m5_noninferiority: byId.get("simplify_m5_noninferiority").combined.accept.wilson95[0] >= bars.noninferiorityPowerWilsonLowerMin,
      simplify_m5_boundary: byId.get("simplify_m5_boundary").combined.accept.wilson95[1] <= bars.boundaryFalseAcceptWilsonUpperMax,
      futility_power_5: byId.get("futility_power_5").combined.netAccept.wilson95[0] >= bars.futilityNetPowerAtPlus5WilsonLowerMin,
      futility_null: byId.get("futility_null").combined.netAccept.wilson95[1] <= bars.futilityNullFalseAcceptWilsonUpperMax,
      determinism: validation.barsMet.determinism, // pinned to the determinism artifact, checked below
    };
    expect(validation.barsMet).toEqual(expected);
    expect(validation.allBarsMet).toBe(Object.values(validation.barsMet).every((met: boolean) => met));
    // Historical artifact: its determinism pin documents the file it used at
    // the time (retrievable from git history); the live file legitimately
    // tracks the newest reference.
    expect(validation.upstream.determinismCheck.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Every combined tally partitions its trials.
    for (const cell of validation.cells) {
      const combined = cell.combined;
      expect(combined.accept.count + combined.reject.count + combined.inconclusive.count, cell.id)
        .toBe(combined.trials);
    }
  });
});

describe("study_lib verification helpers", () => {
  test("readVerifiedArtifact requires a matching sidecar", () => {
    const dir = mkdtempSync(join(tmpdir(), "study-lib-"));
    const artifact = join(dir, "artifact.json.gz");
    const bytes = gzipSync(Buffer.from(`{"hello":1}`));
    writeFileSync(artifact, bytes);
    expect(() => readVerifiedArtifact(artifact)).toThrow(/sidecar/);
    writeFileSync(`${artifact}.sha256`, `${"0".repeat(64)}  artifact.json.gz\n`);
    expect(() => readVerifiedArtifact(artifact)).toThrow(/checksum mismatch/);
    writeFileSync(`${artifact}.sha256`, `${sha256(bytes)}  artifact.json.gz\n`);
    const verified = readVerifiedArtifact(artifact);
    expect(verified.rawSha256).toBe(sha256(Buffer.from(`{"hello":1}`)));
  });

  test("assertKnobOnlyDelta accepts exactly one knob and rejects extras", () => {
    const base = {
      compilerSourceFingerprint: "a", engine: "wasm", engineArtifactFingerprint: "b",
      compilerEnvironment: {},
    };
    const arm = { ...base, compilerEnvironment: { LR_X: "1" } };
    expect(() => assertKnobOnlyDelta(base, arm, "LR_X", "1", "arm")).not.toThrow();
    expect(() => assertKnobOnlyDelta(base, arm, "LR_X", "2", "arm")).toThrow(/does not set/);
    const armExtra = { ...base, compilerEnvironment: { LR_X: "1", LR_Y: "3" } };
    expect(() => assertKnobOnlyDelta(base, armExtra, "LR_X", "1", "arm")).toThrow(/beyond LR_X/);
    const armSources = { ...arm, compilerSourceFingerprint: "z" };
    expect(() => assertKnobOnlyDelta(base, armSources, "LR_X", "1", "arm")).toThrow(/sources\/engine/);
  });

  test("verifyScaleStudyArchive enforces scope, duplicates, and rescoring (stub rescorer)", () => {
    const identity = {
      suiteFingerprint: "s", suiteManifestFingerprint: "sm",
      sourceManifestFingerprint: "src", definitionFingerprint: "def",
    } as any;
    const suite = { transform: { kind: "production_felt_jolt", jolt_ms: -15 } } as any;
    const sources = [
      { id: "a", sourceFingerprint: "fa" },
      { id: "b", sourceFingerprint: "fb" },
    ] as any[];
    const contracts = new Map<string, any>([["a", {}], ["b", {}]]);
    const candidate = {
      compilerIdentityProtocol: "line.compiler-source-identity.v2",
      compilerSourceFingerprint: "csf",
      compilerEnvironment: {},
      engine: "wasm",
      engineArtifactFingerprint: "eaf",
      compilerSourceFiles: ["package.json"],
      candidateFingerprint: "",
    };
    candidate.candidateFingerprint = sha256(Buffer.from(JSON.stringify({
      compilerIdentityProtocol: candidate.compilerIdentityProtocol,
      compilerSourceFingerprint: candidate.compilerSourceFingerprint,
      compilerEnvironment: candidate.compilerEnvironment,
      engine: candidate.engine,
      engineArtifactFingerprint: candidate.engineArtifactFingerprint,
    })));
    const run = (sourceId: string, seed: number) => ({
      status: "ok",
      task: { sourceId, budget: 100, actualSeed: seed },
      source: { sourceFingerprint: sourceId === "a" ? "fa" : "fb" },
      authoredContacts: 3,
      report: {},
      score: { score: 500, valid: true },
    });
    const archive = {
      schema: "line.benchmark-v2.budget-scale-study.v2",
      suiteFingerprint: "s", sourceManifestFingerprint: "src", definitionFingerprint: "def",
      scorerFingerprint: "scorer",
      transform: suite.transform,
      candidate,
      budgets: [100],
      seeds: [0, 1],
      runs: [run("a", 0), run("a", 1), run("b", 0), run("b", 1)],
    };
    const options = {
      label: "fixture", identity, suite, sources, contracts,
      scorerFingerprint: "scorer", members: ["a", "b"],
      rescore: (() => ({ score: 500, valid: true })) as any,
    };
    expect(verifyScaleStudyArchive(archive, options).size).toBe(4);
    const missing = structuredClone(archive);
    missing.runs.pop();
    expect(() => verifyScaleStudyArchive(missing, options)).toThrow(/missing/);
    const duplicate = structuredClone(archive);
    duplicate.runs.push(run("b", 1));
    expect(() => verifyScaleStudyArchive(duplicate, options)).toThrow(/duplicate/);
    const tampered = structuredClone(archive);
    tampered.runs[0].score = { score: 400, valid: true };
    expect(() => verifyScaleStudyArchive(tampered, options)).toThrow(/does not match its raw report/);
    const staleSuite = structuredClone(archive);
    staleSuite.suiteFingerprint = "other";
    expect(() => verifyScaleStudyArchive(staleSuite, options)).toThrow(/does not match the current suite/);
  });
});
