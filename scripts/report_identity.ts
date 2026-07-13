import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DriftReport, Spec } from "./v0/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REPORT_SEMANTICS_FILES = [
  "scripts/lib/detector.ts",
  "scripts/v0/core/beats.ts",
  "scripts/v0/core/curves.ts",
  "scripts/v0/core/measure.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/score.ts",
  "scripts/v0/types.ts",
] as const;

export type RunReportMetadata = {
  schema: "line.run-report-metadata.v1";
  generatedAt: string;
  reportSemanticsFingerprint: string;
  compiledSpecFingerprint: string;
  specPath: string;
  compiler: string;
  engine: string;
  seed: number;
  budget: number;
  totalFrames: number;
};

export type IdentifiedDriftReport = DriftReport & { _line?: RunReportMetadata };

export function reportSemanticsFingerprint(): string {
  const hash = createHash("sha256");
  for (const path of REPORT_SEMANTICS_FILES) {
    hash.update(path).update("\0").update(readFileSync(resolve(ROOT, path))).update("\0");
  }
  return hash.digest("hex");
}

export function compiledSpecFingerprint(spec: Spec): string {
  return createHash("sha256").update(JSON.stringify(spec)).digest("hex");
}

export function identifyRunReport(
  report: DriftReport,
  metadata: Omit<RunReportMetadata, "schema" | "generatedAt" | "reportSemanticsFingerprint">,
): IdentifiedDriftReport {
  return {
    ...report,
    _line: {
      schema: "line.run-report-metadata.v1",
      generatedAt: new Date().toISOString(),
      reportSemanticsFingerprint: reportSemanticsFingerprint(),
      ...metadata,
      specPath: relative(ROOT, resolve(ROOT, metadata.specPath)),
    },
  };
}

export function reportComparisonIssue(
  a: IdentifiedDriftReport,
  b: IdentifiedDriftReport,
): string | null {
  if (a._line === undefined || b._line === undefined) {
    return "one or both reports predate run-report identity metadata";
  }
  if (a._line.schema !== b._line.schema) return "report metadata schemas differ";
  if (a._line.reportSemanticsFingerprint !== b._line.reportSemanticsFingerprint) {
    return "report scoring or target semantics differ";
  }
  if (a._line.compiledSpecFingerprint !== b._line.compiledSpecFingerprint) {
    return "compiled specifications differ";
  }
  return null;
}

export function normalizeReportTargets(
  a: DriftReport,
  b: DriftReport,
  source: "a" | "b",
): [DriftReport, DriftReport] {
  if (a.gaps.length !== b.gaps.length) {
    throw new Error(`cannot normalize target surfaces with ${a.gaps.length} vs ${b.gaps.length} gaps`);
  }
  const outA = structuredClone(a);
  const outB = structuredClone(b);
  const targets = source === "a" ? a : b;
  for (let i = 0; i < targets.gaps.length; i++) {
    const targetGap = targets.gaps[i];
    const gapA = outA.gaps[i];
    const gapB = outB.gaps[i];
    if (Math.abs(gapA.t_end - targetGap.t_end) > 1e-9 || Math.abs(gapB.t_end - targetGap.t_end) > 1e-9) {
      throw new Error(`cannot normalize targets: gap ${i} contact times differ`);
    }
    const axes = Object.keys(targetGap.axes);
    if (
      axes.length !== Object.keys(gapA.axes).length ||
      axes.length !== Object.keys(gapB.axes).length ||
      axes.some((axis) => gapA.axes[axis] === undefined || gapB.axes[axis] === undefined)
    ) {
      throw new Error(`cannot normalize targets: gap ${i} scored axes differ`);
    }
    for (const axis of axes) {
      const target = targetGap.axes[axis].target;
      gapA.axes[axis].target = target;
      gapA.axes[axis].error = Math.abs(gapA.axes[axis].achieved - target);
      gapB.axes[axis].target = target;
      gapB.axes[axis].error = Math.abs(gapB.axes[axis].achieved - target);
    }
  }
  return [outA, outB];
}
