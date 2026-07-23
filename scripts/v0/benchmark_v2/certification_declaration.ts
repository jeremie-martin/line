/**
 * A compact, reviewable projection of a generated certification report.
 *
 * Full simulation reports are local generated evidence.  The live promotion
 * contract needs only the frozen plan, identities, reference hashes, safety
 * bars, and the combined cell statistics that the guard checks.  Keeping this
 * projection in version control avoids treating thousands of generated trial
 * details as source while retaining a content hash of the full report.
 */

import { createHash } from "node:crypto";

export const CERTIFICATION_DECLARATION_SCHEMA = "line.benchmark-v2.certification-declaration.v1" as const;

export function compactCertificationDeclaration(
  report: any,
  sourceReportSha256: string,
  requiredCellIds?: readonly string[],
): Record<string, unknown> {
  if (report?.schema !== "line.benchmark-v2.independent-validation.v4") {
    throw new Error(`cannot compact an unsupported certification report`);
  }
  if (!/^[a-f0-9]{64}$/.test(sourceReportSha256)) {
    throw new Error(`certification report hash is malformed`);
  }
  const allCells = report.cells ?? [];
  const selectedCells = requiredCellIds === undefined
    ? allCells
    : requiredCellIds.map((id) => {
      const cell = allCells.find((entry: any) => entry?.id === id);
      if (cell === undefined) throw new Error(`certification report is missing requested cell ${id}`);
      return cell;
    });
  return {
    schema: CERTIFICATION_DECLARATION_SCHEMA,
    sourceReport: {
      schema: report.schema,
      sha256: sourceReportSha256,
    },
    mode: report.mode,
    predeclared: clone(report.predeclared),
    workerExecutionPlan: clone(report.workerExecutionPlan),
    workerExecutionPlanFingerprint: report.workerExecutionPlanFingerprint,
    suiteFingerprint: report.suiteFingerprint,
    scorerFingerprint: report.scorerFingerprint,
    decisionInferenceFingerprint: report.decisionInferenceFingerprint,
    evalChainInferenceFingerprint: report.evalChainInferenceFingerprint,
    certificationGeneratorFingerprint: report.certificationGeneratorFingerprint,
    independentReference: clone(report.independentReference),
    originalReference: clone(report.originalReference),
    upstream: clone(report.upstream),
    allBarsMet: report.allBarsMet,
    barsMet: clone(report.barsMet),
    // Only the cells referenced by the operating point need to be durable.
    // The safety bars themselves remain durable in `barsMet`, including bars
    // whose detailed cell statistics are not needed by this point.
    cells: selectedCells.map((cell: any) => ({
      id: cell?.id,
      combined: {
        trials: cell?.combined?.trials,
        meanSeedBlockSe: cell?.combined?.meanSeedBlockSe,
        accept: compactRate(cell?.combined?.accept),
        netAccept: compactRate(cell?.combined?.netAccept),
      },
    })),
  };
}

/** Accept either a historical full report or a compact declaration. */
export function certificationReportFromArtifact(value: any, path: string): any {
  if (value?.schema === "line.benchmark-v2.independent-validation.v4") return value;
  if (value?.schema !== CERTIFICATION_DECLARATION_SCHEMA) return value;
  if (
    value.sourceReport?.schema !== "line.benchmark-v2.independent-validation.v4" ||
    !/^[a-f0-9]{64}$/.test(value.sourceReport?.sha256 ?? "")
  ) throw new Error(`compact certification declaration ${path} has an invalid source report identity`);
  if (!Array.isArray(value.cells) || value.cells.length === 0) {
    throw new Error(`compact certification declaration ${path} has no combined cells`);
  }
  return {
    ...value,
    schema: value.sourceReport.schema,
  };
}

export function certificationDeclarationSha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compactRate(value: any): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  return {
    count: value.count,
    total: value.total,
    rate: value.rate,
    wilson95: clone(value.wilson95),
  };
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
