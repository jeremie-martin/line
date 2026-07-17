/**
 * Calibration-only label concentration readout for the retained dense-240
 * recursive transient artifact. This reports every fixed-screen label; it
 * never emits a candidate menu or reads a held-out/V2 result.
 */
import { readFileSync } from "node:fs";

const defaultArtifact = "generated/studies/two-contact-shooting/recursive-return-v1/dense240-db0b899a54a0.json";
const argv = process.argv.slice(2);
const artifactArgument = argv.find((value) => value.startsWith("--artifact="))?.slice("--artifact=".length);
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write("Usage: audit_dense240_transient_concentration.ts [--artifact=PATH]\n");
  process.exit(0);
}
if (argv.some((value) => !value.startsWith("--artifact="))) {
  throw new Error("unsupported argument; expected only --artifact=PATH");
}

const path = artifactArgument ?? defaultArtifact;
const document = JSON.parse(readFileSync(path, "utf8")) as StudyDocument;
if (document.panel.id !== "dense240" || document.panel.cohort !== "calibration") {
  throw new Error("concentration audit accepts only the retained dense240 calibration artifact");
}

const records = document.rows.flatMap((outer) => {
  if (outer.family !== "capture-arc" || outer.segment2 === null) return [];
  return outer.segment2.rows.flatMap((second) => {
    const recurrence = second.family !== "capture-arc" ? null : second.returnBoundary?.recursiveTransient;
    if (recurrence === null || recurrence === undefined) return [];
    return recurrence.rows.map((third) => ({
      first: outer.controlId,
      second: normalize(second.label),
      third: normalize(third.label),
      admitted: third.admitted,
      materialized: third.materialized,
      normalControlAvailable: third.normalReturn?.rawNormalControlAvailable ?? false,
      normalReturn: (third.normalReturn?.rawNormalAdmitted ?? 0) > 0,
      normalAdmissions: third.normalReturn?.rawNormalAdmitted ?? 0,
    }));
  });
});

process.stdout.write(`${JSON.stringify({
  schema: "line.study-dense240-transient-control-concentration.v1",
  artifact: path,
  records: summarize(records),
  firstLabelMarginals: groups(records, (record) => record.first),
  secondLabelMarginals: groups(records, (record) => record.second),
  thirdLabelMarginals: groups(records, (record) => record.third),
  exactLabelTriples: groups(records, (record) => `${record.first} -> ${record.second} -> ${record.third}`),
}, null, 2)}\n`);

type RecordRow = {
  first: string;
  second: string;
  third: string;
  admitted: boolean;
  materialized: boolean;
  normalControlAvailable: boolean;
  normalReturn: boolean;
  normalAdmissions: number;
};

function groups(records: readonly RecordRow[], label: (record: RecordRow) => string): unknown[] {
  return Object.entries(records.reduce<Record<string, RecordRow[]>>((byLabel, record) => {
    (byLabel[label(record)] ??= []).push(record);
    return byLabel;
  }, {}))
    .map(([key, rows]) => ({ label: key, ...summarize(rows) }))
    .sort((left, right) => right.normalAdmissions - left.normalAdmissions || right.normalReturnTriples - left.normalReturnTriples || left.label.localeCompare(right.label));
}

function summarize(records: readonly RecordRow[]): {
  attempted: number;
  admitted: number;
  materialized: number;
  normalControlUnavailable: number;
  normalReturnTriples: number;
  normalAdmissions: number;
} {
  return {
    attempted: records.length,
    admitted: records.filter((record) => record.admitted).length,
    materialized: records.filter((record) => record.materialized).length,
    normalControlUnavailable: records.filter((record) => record.materialized && !record.normalControlAvailable).length,
    normalReturnTriples: records.filter((record) => record.normalReturn).length,
    normalAdmissions: records.reduce((sum, record) => sum + record.normalAdmissions, 0),
  };
}

function normalize(label: string): string {
  return label.replace(/_transient$/, "");
}

type StudyDocument = { panel: { id: string; cohort: string }; rows: OuterRow[] };
type OuterRow = { family: string; controlId: string; segment2: { rows: SegmentRow[] } | null };
type SegmentRow = { family: string; label: string; returnBoundary: { recursiveTransient: RecursiveTransient | null } | null };
type RecursiveTransient = { rows: RecursiveRow[] };
type RecursiveRow = { label: string; admitted: boolean; materialized: boolean; normalReturn: NormalReturn | null };
type NormalReturn = { rawNormalControlAvailable: boolean; rawNormalAdmitted: number };
