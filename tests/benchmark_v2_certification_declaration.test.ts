import { describe, expect, test } from "vitest";
import {
  CERTIFICATION_DECLARATION_SCHEMA,
  certificationReportFromArtifact,
  compactCertificationDeclaration,
} from "../scripts/v0/benchmark_v2/certification_declaration.ts";

const HASH = "a".repeat(64);

function report() {
  return {
    schema: "line.benchmark-v2.independent-validation.v4",
    mode: "certify",
    predeclared: { depth: 48 },
    workerExecutionPlan: { depth: 48 },
    workerExecutionPlanFingerprint: HASH,
    suiteFingerprint: HASH,
    scorerFingerprint: HASH,
    decisionInferenceFingerprint: HASH,
    evalChainInferenceFingerprint: HASH,
    certificationGeneratorFingerprint: HASH,
    independentReference: { path: "reference", artifactSha256: HASH, rawSha256: HASH },
    originalReference: { path: "reference", artifactSha256: HASH, rawSha256: HASH },
    upstream: {},
    allBarsMet: true,
    barsMet: { safe: true },
    cells: [
      { id: "needed", combined: { trials: 1000, meanSeedBlockSe: 0.5, accept: { count: 1, total: 1000, rate: 0.001, wilson95: [0, 0.01] }, netAccept: null } },
      { id: "unneeded", combined: { trials: 1000, meanSeedBlockSe: 1, accept: { count: 2, total: 1000, rate: 0.002, wilson95: [0, 0.02] }, netAccept: null } },
    ],
  };
}

describe("compact certification declarations", () => {
  test("retain only the required guard inputs and reconstruct the report view", () => {
    const declaration = compactCertificationDeclaration(report(), HASH, ["needed"]);
    expect(declaration.schema).toBe(CERTIFICATION_DECLARATION_SCHEMA);
    expect((declaration.cells as any[]).map((cell) => cell.id)).toEqual(["needed"]);
    expect((declaration.cells as any[])[0].combined).toEqual({
      trials: 1000,
      meanSeedBlockSe: 0.5,
      accept: { count: 1, total: 1000, rate: 0.001, wilson95: [0, 0.01] },
      netAccept: null,
    });
    expect(certificationReportFromArtifact(declaration, "declaration.json")).toMatchObject({
      schema: "line.benchmark-v2.independent-validation.v4",
      mode: "certify",
      cells: [{ id: "needed" }],
    });
  });

  test("refuses a declaration with an invalid source identity", () => {
    const declaration: any = compactCertificationDeclaration(report(), HASH, ["needed"]);
    declaration.sourceReport.sha256 = "invalid";
    expect(() => certificationReportFromArtifact(declaration, "declaration.json"))
      .toThrow(/invalid source report identity/);
  });
});
