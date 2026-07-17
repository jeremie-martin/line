/**
 * Descriptive, post-decision economics audit for the declared central-six
 * projection of the recursive transient study. It never creates candidates,
 * rewrites artifacts, or selects controls from observed admissions.
 */
import { readFileSync } from "node:fs";

const CENTRAL_LABELS = new Set([
  "negative_balanced_at_target",
  "negative_balanced_half_frame_forward",
  "negative_balanced_one_frame_forward",
  "positive_balanced_at_target",
  "positive_balanced_half_frame_forward",
  "positive_balanced_one_frame_forward",
]);

const defaultArtifacts = [
  "generated/studies/two-contact-shooting/recursive-return-v1/dense240-db0b899a54a0.json",
  "generated/studies/two-contact-shooting/recursive-heldout-v1/heldout_open_hook_dense-46d675e189b4.json",
  "generated/studies/two-contact-shooting/recursive-heldout-v1/heldout_meter_exchange_ordinary-0731bf1bd5ff.json",
  "generated/studies/two-contact-shooting/recursive-heldout-v1/heldout_pickup_low_air-0e4023c32d5d.json",
];

const argv = process.argv.slice(2);
const requested = argv.filter((value) => value.startsWith("--artifact=")).map((value) => value.slice("--artifact=".length));
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: audit_central_six_transient.ts [--artifact=PATH ...]",
    "",
    "Filters retained recursive-study rows to the fixed six balanced mirrored controls.",
  ].join("\n") + "\n");
  process.exit(0);
}
if (argv.some((value) => !value.startsWith("--artifact="))) {
  throw new Error("unsupported argument; expected only --artifact=PATH");
}

const results = (requested.length === 0 ? defaultArtifacts : requested).map(auditArtifact);
process.stdout.write(`${JSON.stringify({
  schema: "line.study-central-six-transient-economics-audit.v1",
  projection: {
    controls: [...CENTRAL_LABELS],
    explanation: "both orientations x balanced 0.5 entry-turn-share x fixed phase offsets 0, 0.5, 1",
  },
  results,
}, null, 2)}\n`);

function auditArtifact(path: string): Record<string, unknown> {
  const document = JSON.parse(readFileSync(path, "utf8")) as StudyDocument;
  const outer = document.rows.filter((row) => row.family === "capture-arc" && isCentral(row.controlId));
  const pairs = outer.flatMap((row) => (row.segment2?.rows ?? [])
    .filter((segment) => segment.family === "capture-arc" && isCentral(segment.label) && segment.returnBoundary?.materialized === true)
    .map((segment) => segment.returnBoundary!));
  const recurrences = pairs.map((pair) => pair.recursiveTransient).filter((value): value is RecursiveTransient => value !== null);
  const allThirdRows = recurrences.flatMap((recurrence) => recurrence.rows);
  const thirdRows = allThirdRows.filter((row) => isCentral(row.label));
  const materialized = thirdRows.filter((row) => row.materialized);
  const normal = materialized.map((row) => row.normalReturn).filter((value): value is NormalReturn => value !== null);
  const centralRecursiveFrames = thirdRows.reduce((sum, row) => sum + rowCharge(row), 0);
  const retainedRecursiveFrames = allThirdRows.reduce((sum, row) => sum + rowCharge(row), 0);
  return {
    path,
    panel: document.panel.id,
    cohort: document.panel.cohort,
    selectedFirstControls: outer.length,
    selectedMaterializedPairs: pairs.length,
    selectedThird: {
      attempted: thirdRows.length,
      admitted: thirdRows.filter((row) => row.admitted).length,
      materialized: materialized.length,
      materializationFailures: thirdRows.filter((row) => row.admitted && !row.materialized).length,
      normalControlUnavailable: normal.filter((row) => !row.rawNormalControlAvailable).length,
      normalReturnTriples: normal.filter((row) => row.rawNormalAdmitted > 0).length,
      normalAdmissions: normal.reduce((sum, row) => sum + row.rawNormalAdmitted, 0),
    },
    retainedRecursiveRowCharge: {
      centralFrames: centralRecursiveFrames,
      allControlsFrames: retainedRecursiveFrames,
      centralShare: retainedRecursiveFrames === 0 ? null : round(centralRecursiveFrames / retainedRecursiveFrames),
    },
  };
}

function isCentral(label: string): boolean {
  return CENTRAL_LABELS.has(label.replace(/_transient$/, ""));
}

function rowCharge(row: RecursiveRow): number {
  return row.admissionFrames + row.materializationFrames + (row.normalReturn?.chargedFrames ?? 0);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

type StudyDocument = { panel: { id: string; cohort: string }; rows: OuterRow[] };
type OuterRow = { family: string; controlId: string; segment2: { rows: SegmentRow[] } | null };
type SegmentRow = { family: string; label: string; returnBoundary: ReturnBoundary | null };
type ReturnBoundary = { materialized: boolean; recursiveTransient: RecursiveTransient | null };
type RecursiveTransient = { rows: RecursiveRow[] };
type RecursiveRow = {
  label: string;
  admitted: boolean;
  materialized: boolean;
  admissionFrames: number;
  materializationFrames: number;
  normalReturn: NormalReturn | null;
};
type NormalReturn = { rawNormalControlAvailable: boolean; rawNormalAdmitted: number; chargedFrames: number };
